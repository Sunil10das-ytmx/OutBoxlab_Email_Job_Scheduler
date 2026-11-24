import { prisma } from "../config/database.js";
import { emailQueue, addScheduledEmailsBulk } from "../queue/email.queue.js";
import { enqueueEmailIndexing } from "./email-index-outbox.service.js";
import { dispatchPendingOutboxEvents } from "./outbox-dispatcher.service.js";

const DEFAULT_STALE_SENDING_MS = Number(
  process.env.STALE_SENDING_THRESHOLD_MS || 2 * 60 * 1000
);

let staleMonitorInterval: NodeJS.Timeout | null = null;


export async function recoverStaleSendingEmails(
  staleThresholdMs: number = DEFAULT_STALE_SENDING_MS
): Promise<number> {
  const cutoff = new Date(Date.now() - staleThresholdMs);

  const staleEmails = await prisma.scheduledEmail.findMany({
    where: {
      status: "sending",
      OR: [
        { sendingStartedAt: { lt: cutoff } },
        { sendingStartedAt: null, scheduledAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
    take: 500,
  });

  if (staleEmails.length === 0) return 0;

  const staleIds = staleEmails.map((e) => e.id);

  const updatedCount = await prisma.$transaction(async (tx) => {
    const updated = await tx.scheduledEmail.updateMany({
      where: {
        id: { in: staleIds },
        status: "sending",
      },
      data: {
        status: "unknown",
        errorMessage:
          "Worker crashed or timed out during SMTP delivery. Marked as unknown to prevent duplicate sending; manual reconciliation required.",
      },
    });

    if (updated.count > 0) {
      await enqueueEmailIndexing(tx, staleIds);
    }

    return updated.count;
  });

  if (updatedCount > 0) {
    console.warn(
      `[Recovery] Marked ${updatedCount} stale 'sending' email(s) as 'unknown' for manual reconciliation.`
    );
  }

  return updatedCount;
}

export async function recoverPendingJobs(): Promise<{
  recoveredEmailsCount: number;
  recoveredOutboxCount: number;
  staleUnknownCount: number;
}> {
  let recoveredEmailsCount = 0;
  let recoveredOutboxCount = 0;
  let staleUnknownCount = 0;

  try {
    staleUnknownCount = await recoverStaleSendingEmails();
    recoveredOutboxCount = await dispatchPendingOutboxEvents();

    const activeEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: { in: ["pending", "queued"] },
      },
      select: {
        id: true,
        scheduledAt: true,
      },
      take: 2000,
    });

    const missingEmails: Array<{ id: string; scheduledAt: Date }> = [];
    for (const email of activeEmails) {
      const existingJob = await emailQueue.getJob(`email-${email.id}`);
      if (!existingJob) {
        missingEmails.push(email);
      }
    }

    if (missingEmails.length > 0) {
      await addScheduledEmailsBulk(missingEmails);
      recoveredEmailsCount = missingEmails.length;
    }

    if (recoveredEmailsCount > 0 || recoveredOutboxCount > 0) {
      console.log(
        `[Recovery] Restored ${recoveredEmailsCount} missing queue jobs and dispatched ${recoveredOutboxCount} pending outbox events.`
      );
    } else if (staleUnknownCount === 0) {
      console.log("[Recovery] Recovery check complete: All scheduled jobs present in BullMQ.");
    }
  } catch (error: any) {
    console.warn("[Recovery] Startup recovery check skipped or failed:", error.message);
  }

  return { recoveredEmailsCount, recoveredOutboxCount, staleUnknownCount };
}

export function startStaleSendingMonitor(intervalMs = 60_000): void {
  if (staleMonitorInterval) return;

  staleMonitorInterval = setInterval(() => {
    recoverStaleSendingEmails().catch((err: unknown) => {
      console.error("[Recovery] Stale sending monitor error:", err);
    });
  }, intervalMs);
}

export function stopStaleSendingMonitor(): void {
  if (!staleMonitorInterval) return;
  clearInterval(staleMonitorInterval);
  staleMonitorInterval = null;
}

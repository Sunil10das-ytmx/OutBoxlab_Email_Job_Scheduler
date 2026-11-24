import { prisma } from "../config/database.js";
import { addScheduledEmailsBulk } from "../queue/email.queue.js";


export async function recoverPendingJobs(): Promise<{
  recoveredEmailsCount: number;
  recoveredOutboxCount: number;
}> {
  let recoveredEmailsCount = 0;
  let recoveredOutboxCount = 0;

  try {
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: { in: ["pending", "queued"] },
      },
      select: {
        id: true,
        scheduledAt: true,
      },
      take: 2000,
    });

    if (pendingEmails.length > 0) {
      await addScheduledEmailsBulk(pendingEmails);
      recoveredEmailsCount = pendingEmails.length;
    }

    const pendingOutboxEvents = await prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      select: { id: true, emailId: true },
      take: 2000,
    });

    if (pendingOutboxEvents.length > 0) {
      const outboxIds = pendingOutboxEvents.map((e) => e.id);
      await prisma.outboxEvent.updateMany({
        where: { id: { in: outboxIds } },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      recoveredOutboxCount = pendingOutboxEvents.length;
    }

    if (recoveredEmailsCount > 0 || recoveredOutboxCount > 0) {
      console.log(
        `[Recovery] Successfully scanned and restored ${recoveredEmailsCount} scheduled emails (${recoveredOutboxCount} outbox events) to BullMQ.`
      );
    } else {
      console.log("[Recovery] Recovery check complete: No orphaned jobs found.");
    }
  } catch (error: any) {
    console.warn("[Recovery] Startup recovery check skipped or failed:", error.message);
  }

  return { recoveredEmailsCount, recoveredOutboxCount };
}

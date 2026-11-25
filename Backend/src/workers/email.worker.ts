import "dotenv/config";
import { Worker, DelayedError } from "bullmq";
import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { sendEmail } from "../services/mail.service.js";
import { reserveEmailSlot } from "../services/rate-limit.service.js";
import { enqueueEmailIndexing } from "../services/email-index-outbox.service.js";


export const worker = new Worker(
  "email-queue",

  async (job, token) => {
    const { emailId } = job.data as { emailId: string };

    const email = await prisma.scheduledEmail.findUnique({
      where: { id: emailId },
      include: {
        campaign: {
          select: { senderId: true, hourlyLimit: true },
        },
      },
    });

    if (!email) return;
    if (
      email.status === "sent" ||
      email.status === "cancelled" ||
      email.status === "unknown"
    ) {
      return;
    }  

    const senderId    = email.campaign?.senderId ?? "";
    const hourlyLimit = email.campaign?.hourlyLimit
      ?? Number(process.env.MAX_EMAILS_PER_HOUR ?? 100);
    const minDelayMs  = Number(process.env.MIN_EMAIL_DELAY_MS ?? 2000);

    const decision = await reserveEmailSlot(
      senderId,
      emailId,
      hourlyLimit,
      minDelayMs
    );

    
    if (!decision.allowed || decision.runAt > Date.now()) {
      await prisma.$transaction(async (tx) => {
        await tx.scheduledEmail.update({
          where: { id: emailId },
          data: { status: "queued" },
        });
        await enqueueEmailIndexing(tx, [emailId]);
      });

      if (!decision.allowed) {
        console.log(
          `[Worker] ⛔ Rate limited  sender=${senderId} ` +
          `next slot at ${new Date(decision.runAt).toISOString()}`
        );
      } else {
        console.log(
          `[Worker] ⏳ Min-delay    sender=${senderId} ` +
          `reserved until ${new Date(decision.runAt).toISOString()}`
        );
      }

    
      await job.moveToDelayed(decision.runAt, token);
      throw new DelayedError();
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const updated = await tx.scheduledEmail.updateMany({
        where: {
          id: emailId,
          status: { in: ["pending", "queued"] },
        },
        data: {
          status: "sending",
          createdAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (updated.count > 0) {
        await enqueueEmailIndexing(tx, [emailId]);
      }
      return updated;
    });

    if (claimed.count === 0) {
      return;
    }

    try {
      const result = await sendEmail(email);

      await prisma.$transaction(async (tx) => {
        await tx.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: "sent",
            sentAt: new Date(),
            messageId: result.messageId,
            previewUrl: result.previewUrl,
          } as any,
        });
        await enqueueEmailIndexing(tx, [emailId]);
      });

      console.log(
        `[Worker] ✅ Sent  emailId=${emailId}  preview=${result.previewUrl ?? "—"}`
      );

      return result;
    } catch (error: any) {
      const maxAttempts = job.opts.attempts ?? 5;
      const currentAttempt = job.attemptsMade + 1;
      const isFinalAttempt = currentAttempt >= maxAttempts;

      await prisma.$transaction(async (tx) => {
        await tx.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: isFinalAttempt ? "failed" : "queued",
            errorMessage: error.message || String(error),
          },
        });
        await enqueueEmailIndexing(tx, [emailId]);
      });

      throw error;
    }
  },

  {
    connection:       redis,
    concurrency:      Number(process.env.WORKER_CONCURRENCY ?? 5),
    lockDuration:     30_000,
    stalledInterval:  30_000,
    maxStalledCount:  2,
  }
);



worker.on("ready", () => {
  console.log(
    `[Worker] Ready  concurrency=${process.env.WORKER_CONCURRENCY ?? 5}`
  );
});

worker.on("completed", (job) => {
  console.log(`[Worker] Completed  jobId=${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[Worker] Failed  jobId=${job?.id}  error=${error.message}`);
});

worker.on("error", (err) => {  if (process.env.NODE_ENV !== "development") {
    console.error("[Worker] Error:", err);
  }
});

const shutdownWorker = async (signal: string) => {
  console.log(`[Worker] Received ${signal}. Closing worker gracefully...`);
  await worker.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
};

process.on("SIGINT", () => void shutdownWorker("SIGINT"));
process.on("SIGTERM", () => void shutdownWorker("SIGTERM"));

export default worker;

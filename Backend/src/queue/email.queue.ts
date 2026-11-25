import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>("email-queue", {
  connection: redis,
});

/* Prevent BullMQ EventEmitter from throwing unhandled error if Redis is restarting or offline */
emailQueue.on("error", (err) => {
  if (process.env.NODE_ENV !== "production") {
    // Silent or debug log in dev
  }
});

export async function addScheduledEmailsBulk(
  emails: Array<{ id: string; scheduledAt: Date }>
) {
  if (emails.length === 0) return [];

  const now = Date.now();

  const jobs = emails.map((email) => ({
    name: "send-email",
    data: {
      emailId: email.id,
    },
    opts: {
      jobId: `email-${email.id}`,
      delay: Math.max(0, email.scheduledAt.getTime() - now),
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  }));

  try {
    return await emailQueue.addBulk(jobs);
  } catch (err: any) {
    console.warn("[Queue] addScheduledEmailsBulk deferred:", err.message);
    return [];
  }
}

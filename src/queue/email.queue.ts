import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>("email-queue", {
  connection: redis,
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

  return await emailQueue.addBulk(jobs);
}

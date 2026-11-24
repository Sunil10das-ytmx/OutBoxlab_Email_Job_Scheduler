import { Queue } from "bullmq";
import "dotenv/config";

export interface EmailJobPayload {
  emailId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export const EMAIL_QUEUE_NAME = "email-queue";

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep 24 hours
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep 7 days
    },
  },
});

emailQueue.on("error", (err) => {
  // Gracefully handle Redis connection drops in background
  if (process.env.NODE_ENV === "development") {
    // console.debug("[BullMQ Queue Error]", err.message);
  }
});

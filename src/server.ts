import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { redis } from "./config/redis.js";
import {
  recoverPendingJobs,
  startStaleSendingMonitor,
  stopStaleSendingMonitor,
} from "./services/recovery.service.js";
import {
  startOutboxDispatcher,
  stopOutboxDispatcher,
} from "./services/outbox-dispatcher.service.js";
import {
  startEmailIndexOutboxDispatcher,
  stopEmailIndexOutboxDispatcher,
} from "./services/email-index-outbox.service.js";
import { emailQueue } from "./queue/email.queue.js";

async function pingWithTimeout(promise: Promise<any>, timeoutMs: number) {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Connection timed out")), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function startServer() {
  try {
    await pingWithTimeout(prisma.$connect(), 3000);
    console.log("Database connected successfully");
  } catch (error: any) {
    console.warn("Database connection warning:", error.message);
  }

  try {
    await pingWithTimeout(redis.ping(), 3000);
    console.log("Redis connected successfully");
  } catch (error: any) {
    console.warn("Redis connection warning:", error.message);
  }

  await recoverPendingJobs();
  startStaleSendingMonitor(60_000);

  startOutboxDispatcher(3000);
  console.log("Outbox background dispatcher started");

  startEmailIndexOutboxDispatcher();
  console.log("Email search indexing dispatcher started");

  const port = Number(process.env.PORT || 5000);

  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
    stopOutboxDispatcher();
    stopEmailIndexOutboxDispatcher();
    stopStaleSendingMonitor();

    server.close(async () => {
      await Promise.allSettled([
        emailQueue.close(),
        prisma.$disconnect(),
        redis.quit(),
      ]);
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});

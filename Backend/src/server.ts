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
  const port = Number(process.env.PORT || 5000);

  // 1. Start HTTP Server immediately so port 5000 is available instantly
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  // 2. Health checks (non-blocking)
  pingWithTimeout(prisma.$connect(), 4000)
    .then(() => console.log("Database connected successfully"))
    .catch((err) => console.warn("Database connection warning:", err.message));

  pingWithTimeout(redis.ping(), 3000)
    .then(() => {
      console.log("Redis connected successfully");
      // Run recovery once Redis is confirmed online
      recoverPendingJobs().catch((e) =>
        console.warn("[Recovery] Startup check warning:", e.message)
      );
    })
    .catch((err) => console.warn("Redis connection warning:", err.message));

  // 3. Start background monitors
  startStaleSendingMonitor(60_000);
  startOutboxDispatcher(3000);
  console.log("Outbox background dispatcher started");

  startEmailIndexOutboxDispatcher();
  console.log("Email search indexing dispatcher started");

  // 4. Graceful shutdown handler
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

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("Critical failure during server startup:", error);
  process.exit(1);
});

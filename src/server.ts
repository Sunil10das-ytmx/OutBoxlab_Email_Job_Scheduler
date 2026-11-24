import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { redis } from "./config/redis.js";

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

  const port = Number(process.env.PORT || 5000);

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});

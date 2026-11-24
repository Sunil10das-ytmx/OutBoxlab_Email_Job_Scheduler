import "dotenv/config";
import { Redis as IORedis } from "ioredis";

export const redis = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    return Math.min(times * 100, 2000);
  },
});

redis.on("error", (err) => {
  if (process.env.NODE_ENV === "development") {
  }
});

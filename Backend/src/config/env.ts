import "dotenv/config";

export const env = Object.freeze({
  port: Number(process.env.PORT ?? "5000"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redis: {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? "6379"),
  },
  jwtSecret: process.env.JWT_SECRET ?? "your_secret_key",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  ethereal: {
    user: process.env.ETHEREAL_USER ?? "",
    pass: process.env.ETHEREAL_PASS ?? "",
  },
  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? "5"),
    minEmailDelayMs: Number(process.env.MIN_EMAIL_DELAY_MS ?? "2000"),
    maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR ?? "100"),
  },
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
});

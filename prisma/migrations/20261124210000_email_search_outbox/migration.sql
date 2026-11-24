CREATE TABLE "EmailIndexOutbox" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailIndexOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailIndexOutbox_status_nextAttemptAt_createdAt_idx"
    ON "EmailIndexOutbox"("status", "nextAttemptAt", "createdAt");

CREATE INDEX "EmailIndexOutbox_emailId_idx"
    ON "EmailIndexOutbox"("emailId");

INSERT INTO "EmailIndexOutbox" ("id", "emailId")
SELECT gen_random_uuid()::text, "id"
FROM "ScheduledEmail";

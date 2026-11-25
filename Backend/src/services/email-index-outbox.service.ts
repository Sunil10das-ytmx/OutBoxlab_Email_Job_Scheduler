import type { Prisma } from "@prisma/client";
import type { estypes } from "@elastic/elasticsearch";
import { prisma } from "../config/database.js";
import { elasticClient } from "../config/elasticsearch.js";

const EMAIL_INDEX = "emails";
const BATCH_SIZE = 100;
const LOCK_TIMEOUT_MS = 60_000;

let isDispatching = false;
let dispatcherInterval: NodeJS.Timeout | null = null;
let indexInitialization: Promise<void> | undefined;

interface IndexedEmail {
  emailId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
}

export async function enqueueEmailIndexing(
  tx: Prisma.TransactionClient,
  emailIds: string[]
): Promise<void> {
  if (emailIds.length === 0) return;

  await tx.emailIndexOutbox.createMany({
    data: emailIds.map((emailId) => ({ emailId })),
  });
}

async function ensureEmailIndex(): Promise<void> {
  if (!indexInitialization) {
    indexInitialization = (async () => {
      if (await elasticClient.indices.exists({ index: EMAIL_INDEX })) return;

      try {
        await elasticClient.indices.create({
          index: EMAIL_INDEX,
          mappings: {
            properties: {
              emailId: { type: "keyword" },
              userId: { type: "keyword" },
              recipient: {
                type: "text",
                fields: { keyword: { type: "keyword" } },
              },
              subject: { type: "text" },
              body: { type: "text" },
              status: { type: "keyword" },
              scheduledAt: { type: "date" },
              sentAt: { type: "date" },
            },
          },
        });
      } catch (error) {
        const response = error as {
          meta?: { statusCode?: number; body?: { error?: { type?: string } } };
        };
        if (
          response.meta?.statusCode !== 400 ||
          response.meta.body?.error?.type !== "resource_already_exists_exception"
        ) {
          throw error;
        }
      }
    })();
  }

  try {
    await indexInitialization;
  } catch (error) {
    indexInitialization = undefined;
    throw error;
  }
}

async function indexEmail(emailId: string): Promise<void> {
  const email = await prisma.scheduledEmail.findUnique({
    where: { id: emailId },
    include: {
      campaign: {
        select: { userId: true, subject: true, body: true },
      },
    },
  });

  if (!email) {
    try {
      await elasticClient.delete({ index: EMAIL_INDEX, id: emailId });
    } catch (error) {
      const response = error as { meta?: { statusCode?: number } };
      if (response.meta?.statusCode !== 404) throw error;
    }
    return;
  }

  const document: IndexedEmail = {
    emailId: email.id,
    userId: email.campaign.userId,
    recipient: email.recipientEmail,
    subject: email.subject ?? email.campaign.subject,
    body: email.body ?? email.campaign.body,
    status: email.status,
    scheduledAt: email.scheduledAt,
    sentAt: email.sentAt,
  };

  await elasticClient.index({
    index: EMAIL_INDEX,
    id: email.id,
    document,
  });
}

export async function dispatchPendingEmailIndexEvents(): Promise<number> {
  if (isDispatching) return 0;
  isDispatching = true;

  try {
    await prisma.emailIndexOutbox.updateMany({
      where: {
        status: "PROCESSING",
        lockedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_MS) },
      },
      data: { status: "PENDING", lockedAt: null },
    });

    const events = await prisma.emailIndexOutbox.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    let processed = 0;
    for (const event of events) {
      const claim = await prisma.emailIndexOutbox.updateMany({
        where: { id: event.id, status: "PENDING" },
        data: { status: "PROCESSING", lockedAt: new Date() },
      });
      if (claim.count === 0) continue;

      try {
        await ensureEmailIndex();
        await indexEmail(event.emailId);
        await prisma.emailIndexOutbox.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
            lockedAt: null,
            errorMessage: null,
          },
        });
        processed += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        const retryDelayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
        const message = error instanceof Error ? error.message : String(error);

        await prisma.emailIndexOutbox.update({
          where: { id: event.id },
          data: {
            status: "PENDING",
            attempts,
            errorMessage: message,
            nextAttemptAt: new Date(Date.now() + retryDelayMs),
            lockedAt: null,
          },
        });
        console.error(
          `[EmailIndex] Indexing failed emailId=${event.emailId}; retry scheduled: ${message}`
        );
      }
    }

    return processed;
  } finally {
    isDispatching = false;
  }
}

export function startEmailIndexOutboxDispatcher(intervalMs = 5_000): void {
  if (dispatcherInterval) return;

  const dispatch = () => {
    dispatchPendingEmailIndexEvents().catch((error: unknown) => {
      console.error("[EmailIndex] Outbox dispatcher failed:", error);
    });
  };

  setImmediate(dispatch);
  dispatcherInterval = setInterval(dispatch, intervalMs);
}

export function stopEmailIndexOutboxDispatcher(): void {
  if (!dispatcherInterval) return;
  clearInterval(dispatcherInterval);
  dispatcherInterval = null;
}

export async function searchEmails(
  userId: string,
  query: string,
  status?: "scheduled" | "sent"
) {
  const filters: estypes.QueryDslQueryContainer[] = [{ term: { userId } }];
  if (status === "sent") {
    filters.push({ term: { status: "sent" } });
  } else if (status === "scheduled") {
    filters.push({ terms: { status: ["pending", "queued", "sending"] } });
  }

  const result = await elasticClient.search<IndexedEmail>({
    index: EMAIL_INDEX,
    size: 100,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["subject^3", "recipient", "body"],
            },
          },
        ],
        filter: filters,
      },
    },
  });

  const total =
    typeof result.hits.total === "number"
      ? result.hits.total
      : (result.hits.total?.value ?? 0);

  return {
    total,
    emails: result.hits.hits.flatMap((hit) =>
      hit._source ? [{ ...hit._source, score: hit._score }] : []
    ),
  };
}

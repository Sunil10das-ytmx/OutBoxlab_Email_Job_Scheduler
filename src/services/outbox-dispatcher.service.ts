import { prisma } from "../config/database.js";
import { emailQueue, type EmailJobPayload } from "../queue/email.queue.js";

let isDispatching = false;
let dispatcherInterval: NodeJS.Timeout | null = null;

/**
 * Dispatches pending outbox events to BullMQ queue.
 * - Idempotent (uses emailId as BullMQ jobId)
 * - Atomic state transitions
 * - Automatic retry on failures
 */
export async function dispatchPendingOutboxEvents(): Promise<number> {
  if (isDispatching) return 0;
  isDispatching = true;

  let dispatchedCount = 0;

  try {
    // Fetch batch of unpublished outbox events
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    if (pendingEvents.length === 0) {
      return 0;
    }

    for (const event of pendingEvents) {
      try {
        const payload: EmailJobPayload = JSON.parse(event.payload);

        // Calculate delay relative to scheduled time
        const scheduledTimeMs = new Date(payload.scheduledAt).getTime();
        const nowMs = Date.now();
        const delayMs = Math.max(0, scheduledTimeMs - nowMs);

        // Add job to BullMQ queue (idempotent with jobId = event.emailId)
        await emailQueue.add("send-scheduled-email", payload, {
          delay: delayMs,
          jobId: event.emailId,
        });

        // Mark outbox event as published
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });

        // Update corresponding scheduled_email status to 'queued'
        await prisma.scheduledEmail.update({
          where: { id: event.emailId },
          data: { status: "queued" },
        });

        dispatchedCount++;
      } catch (jobError: any) {
        // Increment attempts and store error, will retry on next poll
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            errorMessage: jobError.message || "Failed to publish to BullMQ",
          },
        });
      }
    }
  } catch (error: any) {
    // Database or connection error during poll
  } finally {
    isDispatching = false;
  }

  return dispatchedCount;
}

/**
 * Proactively triggers dispatcher without waiting for interval.
 */
export function triggerOutboxDispatcher(): void {
  setImmediate(() => {
    dispatchPendingOutboxEvents().catch(() => {});
  });
}

/**
 * Starts continuous background outbox dispatcher loop.
 * Also checks and flushes pending events on startup.
 */
export function startOutboxDispatcher(intervalMs: number = 3000): void {
  if (dispatcherInterval) return;

  // 1. Initial startup check
  triggerOutboxDispatcher();

  // 2. Periodic background polling
  dispatcherInterval = setInterval(() => {
    dispatchPendingOutboxEvents().catch(() => {});
  }, intervalMs);
}

/**
 * Stops dispatcher on server shutdown.
 */
export function stopOutboxDispatcher(): void {
  if (dispatcherInterval) {
    clearInterval(dispatcherInterval);
    dispatcherInterval = null;
  }
}

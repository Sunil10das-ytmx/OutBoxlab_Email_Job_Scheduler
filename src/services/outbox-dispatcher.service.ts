import { prisma } from "../config/database.js";
import { addScheduledEmailsBulk } from "../queue/email.queue.js";

let isDispatching = false;
let dispatcherInterval: NodeJS.Timeout | null = null;


export async function dispatchPendingOutboxEvents(): Promise<number> {
  if (isDispatching) return 0;
  isDispatching = true;

  try {
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    if (pendingEvents.length === 0) {
      return 0;
    }

    const emailItems = pendingEvents.map((event) => {
      const payload = JSON.parse(event.payload);
      return {
        id: event.emailId,
        scheduledAt: new Date(payload.scheduledAt),
      };
    });

    await addScheduledEmailsBulk(emailItems);

    const eventIds = pendingEvents.map((e) => e.id);
    const emailIds = pendingEvents.map((e) => e.emailId);

    await prisma.outboxEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await prisma.scheduledEmail.updateMany({
      where: { id: { in: emailIds } },
      data: { status: "queued" },
    });

    return pendingEvents.length;
  } catch (error: any) {
    return 0;
  } finally {
    isDispatching = false;
  }
}

export function triggerOutboxDispatcher(): void {
  setImmediate(() => {
    dispatchPendingOutboxEvents().catch(() => {});
  });
}


export function startOutboxDispatcher(intervalMs: number = 3000): void {
  if (dispatcherInterval) return;


  triggerOutboxDispatcher();

  
  dispatcherInterval = setInterval(() => {
    dispatchPendingOutboxEvents().catch(() => {});
  }, intervalMs);
}


export function stopOutboxDispatcher(): void {
  if (dispatcherInterval) {
    clearInterval(dispatcherInterval);
    dispatcherInterval = null;
  }
}

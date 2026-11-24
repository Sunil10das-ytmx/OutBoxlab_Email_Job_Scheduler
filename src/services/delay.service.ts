/**
 * Helper to calculate sequential timezone-aware scheduling timestamps.
 */
export interface ScheduledItem {
  recipientEmail: string;
  sequenceNo: number;
  scheduledAt: Date;
}

/**
 * Calculates scheduled timestamp for each recipient in UTC.
 * Sequence numbers are 1-based.
 */
export function calculateEmailSchedules(
  recipients: string[],
  startTime: Date,
  delayBetweenEmailsMs: number
): ScheduledItem[] {
  const startMs = startTime.getTime();

  return recipients.map((recipient, index) => ({
    recipientEmail: recipient.trim().toLowerCase(),
    sequenceNo: index + 1,
    scheduledAt: new Date(startMs + index * delayBetweenEmailsMs),
  }));
}

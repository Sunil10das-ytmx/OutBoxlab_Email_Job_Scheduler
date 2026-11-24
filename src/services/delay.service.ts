
export interface ScheduledItem {
  recipientEmail: string;
  sequenceNo: number;
  scheduledAt: Date;
}


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

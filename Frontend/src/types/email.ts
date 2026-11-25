export type EmailStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "unknown"
  | "cancelled";

export interface Email {
  id: string;
  recipientEmail: string;
  subject: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  recipient?: string;
  previewUrl?: string;
  campaign?: { id: string; name: string };
}

export interface ScheduleEmailRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  campaignName?: string;
}

/* ── Aliases for seamless component compatibility ────────────────── */
export type ScheduledEmail = Email;
export type ScheduleEmailPayload = ScheduleEmailRequest;

export interface Sender {
  id: string;
  senderName: string;
  senderEmail: string;
  smtpHost?: string;
  smtpPort?: number;
  isActive?: boolean;
  useEthereal?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  _count?: { scheduledEmails: number };
}

export interface CampaignStats {
  sent: number;
  pending: number;
  failed: number;
  unknown: number;
  total: number;
}

export interface CsvParseResult {
  totalRows: number;
  validEmails: number;
  invalidEmails: number;
  recipients: string[];
}

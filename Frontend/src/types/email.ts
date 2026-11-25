export type EmailStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "unknown"
  | "cancelled";

export interface Sender {
  id: string;
  senderName: string;
  senderEmail: string;
  smtpHost?: string;
  smtpPort?: number;
  isActive?: boolean;
  useEthereal?: boolean;
}

export interface ScheduledEmail {
  id: string;
  recipientEmail: string;   // backend field name
  recipient?: string;       // alias fallback
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string;
  previewUrl?: string;
  campaign?: { id: string; name: string };
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

export interface ScheduleEmailPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  campaignName?: string;
}

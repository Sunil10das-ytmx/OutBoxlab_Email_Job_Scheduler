import { api } from "../../services/api";
import type {
  Campaign,
  CampaignStats,
  CsvParseResult,
  ScheduledEmail,
  ScheduleEmailPayload,
  Sender,
} from "../../types/email";

/* ── Named Functions (as requested) ─────────────────────────────── */

export const getScheduledEmails = async () => {
  const response = await api.get<{ success?: boolean; count?: number; emails: ScheduledEmail[] }>(
    "/api/emails/scheduled"
  );
  return response.data;
};

export const getSentEmails = async () => {
  const response = await api.get<{ success?: boolean; count?: number; emails: ScheduledEmail[] }>(
    "/api/emails/sent"
  );
  return response.data;
};

export const scheduleEmails = async (data: ScheduleEmailPayload | unknown) => {
  const response = await api.post<{
    success: boolean;
    message?: string;
    data?: { campaignId: string; queued: number };
    campaignId?: string;
    queued?: number;
  }>("/api/emails/schedule", data);
  return response.data;
};

export const parseCsvFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<CsvParseResult>("/api/emails/parse-csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const cancelEmail = async (id: string) => {
  const response = await api.post(`/api/emails/${id}/cancel`);
  return response.data;
};

export const searchEmails = async (q: string) => {
  const response = await api.get<{ success?: boolean; count?: number; emails?: ScheduledEmail[] } | ScheduledEmail[]>(
    `/api/emails/search?q=${encodeURIComponent(q)}`
  );
  return response.data;
};

/* ── Service Object (backwards-compatible with existing components) ── */

export const emailService = {
  parseCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<CsvParseResult>("/api/emails/parse-csv", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  schedule: (payload: ScheduleEmailPayload) =>
    api.post<{ campaignId: string; queued: number; data?: { campaignId: string; queued: number } }>(
      "/api/emails/schedule",
      payload
    ),

  getScheduled: () =>
    api.get<{ success?: boolean; count?: number; emails: ScheduledEmail[] }>("/api/emails/scheduled"),

  getSent: () =>
    api.get<{ success?: boolean; count?: number; emails: ScheduledEmail[] }>("/api/emails/sent"),

  getById: (id: string) => api.get<ScheduledEmail>(`/api/emails/${id}`),

  cancel: (id: string) => api.post(`/api/emails/${id}/cancel`),

  search: (q: string) =>
    api.get<{ success?: boolean; count?: number; emails?: ScheduledEmail[] } | ScheduledEmail[]>(
      `/api/emails/search?q=${encodeURIComponent(q)}`
    ),
};

export const campaignService = {
  list: () => api.get<Campaign[]>("/api/campaigns"),
  getById: (id: string) => api.get<Campaign>(`/api/campaigns/${id}`),
  getStats: (id: string) =>
    api.get<CampaignStats>(`/api/campaigns/${id}/stats`),
};

export const senderService = {
  list: async () => {
    const res = await api.get<{ success?: boolean; count?: number; senders?: Sender[] } | Sender[]>(
      "/api/senders"
    );
    const list = Array.isArray(res.data)
      ? res.data
      : (res.data as { senders?: Sender[] }).senders ?? [];
    return { ...res, data: list };
  },
  create: (payload: {
    senderName: string;
    senderEmail: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUsername?: string;
    smtpPassword?: string;
    useEthereal?: boolean;
  }) => api.post<{ success: boolean; sender: Sender }>("/api/senders", payload),
};

import { api, API_BASE } from "../../services/api";
import type { SlackStatus } from "../../types/user";

export const slackService = {
  getStatus: () => api.get<SlackStatus>("/api/integrations/slack/status"),

  disconnect: () => api.post("/api/integrations/slack/disconnect"),

  getConnectUrl: () => `${API_BASE}/api/integrations/slack/connect`,
};

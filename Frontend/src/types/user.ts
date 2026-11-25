export interface User {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  avatar?: string | null;
  picture?: string;
}

export interface SlackStatus {
  connected: boolean;
  channelId?: string;
  teamName?: string;
}

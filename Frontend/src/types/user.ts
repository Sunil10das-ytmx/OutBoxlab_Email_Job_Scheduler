export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  googleId?: string;
  picture?: string;
}

export interface SlackStatus {
  connected: boolean;
  channelId?: string;
  teamName?: string;
}

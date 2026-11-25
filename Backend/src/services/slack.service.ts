import { WebClient } from "@slack/web-api";
import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { encrypt, decrypt } from "../utils/encryption.js";


export function buildSlackOAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID ?? "";
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? "";
  const scopes = "chat:write,channels:read,groups:read";

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}


export async function exchangeSlackCode(
  code: string,
  userId: string
): Promise<{ teamId: string; channelId: string }> {
  const client = new WebClient();

  const response = await client.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID ?? "",
    client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
    code,
    redirect_uri: process.env.SLACK_REDIRECT_URI ?? "",
  });

  if (!response.ok || !response.access_token || !response.team?.id) {
    throw new Error(`Slack OAuth failed: ${response.error ?? "unknown error"}`);
  }

  const botToken = response.access_token;
  const teamId = response.team.id;

  
  const channelId =
    (response as any).incoming_webhook?.channel_id ??
    process.env.SLACK_DEFAULT_CHANNEL ??
    "general";

  const botTokenEncrypted = encrypt(botToken);

  await prisma.slackConnection.upsert({
    where: { userId },
    update: { slackTeamId: teamId, botTokenEncrypted, channelId },
    create: { userId, slackTeamId: teamId, botTokenEncrypted, channelId },
  });
  return { teamId, channelId };
}


export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}


export async function getSlackConnection(
  userId: string
): Promise<{ botToken: string; channelId: string } | null> {
  const conn = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  try {
    return { botToken: decrypt(conn.botTokenEncrypted), channelId: conn.channelId };
  } catch {
    return null; 
  }
}


export async function sendSlackNotification(
  userId: string,
  message: string
): Promise<void> {
  try {
    const conn = await getSlackConnection(userId);
    if (!conn) return; 

    const client = new WebClient(conn.botToken);
    await client.chat.postMessage({
      channel: conn.channelId,
      text: message,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: message },
        },
      ],
    });
  } catch (err) {
    console.error("[Slack] Failed to send notification:", err);
  }
}


export async function notifyRateLimitBreach(
  senderId: string,
  senderEmail: string,
  hourlyLimit: number,
  emailsSentThisHour: number
): Promise<void> {
  const now = new Date();
  const windowKey =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}` +
    `${String(now.getUTCHours()).padStart(2, "0")}`;

  const dedupKey = `slack-notification:${senderId}:${windowKey}`;

  try {
    
    const acquired = await redis.set(dedupKey, "1", "PX", 65 * 60 * 1000, "NX");
    if (!acquired) {
      return;
    }
  } catch {
  }

  const sender = await prisma.emailSender.findUnique({
    where: { id: senderId },
    select: { userId: true },
  });

  if (!sender) return;

  const message =
    `⚠️ *Email sending paused*\n\n` +
    `*Sender:* ${senderEmail}\n` +
    `*Hourly limit:* ${hourlyLimit} emails\n` +
    `*Emails sent:* ${emailsSentThisHour}\n` +
    `*Reason:* Maximum hourly email limit reached.\n\n` +
    `Remaining emails will automatically resume in the next available sending window.`;

  await sendSlackNotification(sender.userId, message);

  try {
    const windowStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours()
      )
    );
    await prisma.rateLimitEvent.updateMany({
      where: {
        senderId,
        windowStart,
        notificationSent: false,
      },
      data: { notificationSent: true },
    });
  } catch {
  }
}

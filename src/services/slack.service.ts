import { WebClient } from "@slack/web-api";
import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { encrypt, decrypt } from "../utils/encryption.js";

// ─────────────────────────────────────────────────────────────────────────────
// OAuth helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Slack OAuth authorization URL.
 * `state` is a CSRF token the caller must store (e.g. in Redis) and verify
 * when Slack redirects back.
 */
export function buildSlackOAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID ?? "";
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? "";
  // Scopes: chat:write to post messages, channels:read to list channels
  const scopes = "chat:write,channels:read,groups:read";

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Exchange an OAuth `code` for an access token and store (encrypted) in DB.
 * Returns the saved SlackConnection record.
 */
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

  // Pick the first available channel from the app's default channel,
  // or fall back to the env-configured default.
  const channelId =
    (response as any).incoming_webhook?.channel_id ??
    process.env.SLACK_DEFAULT_CHANNEL ??
    "general";

  const botTokenEncrypted = encrypt(botToken);

  // Upsert: one connection per user (replace if already connected)
  await prisma.slackConnection.upsert({
    where: { userId },
    update: { slackTeamId: teamId, botTokenEncrypted, channelId },
    create: { userId, slackTeamId: teamId, botTokenEncrypted, channelId },
  });

  return { teamId, channelId };
}

/**
 * Remove a user's Slack connection from DB.
 */
export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}

/**
 * Load the decrypted bot token + channelId for a user.
 * Returns null if not connected.
 */
export async function getSlackConnection(
  userId: string
): Promise<{ botToken: string; channelId: string } | null> {
  const conn = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  try {
    return { botToken: decrypt(conn.botTokenEncrypted), channelId: conn.channelId };
  } catch {
    return null; // corrupted token — treat as disconnected
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a Slack message to the user who owns `senderId`.
 * Silently swallows errors so it never crashes the email worker.
 */
export async function sendSlackNotification(
  userId: string,
  message: string
): Promise<void> {
  try {
    const conn = await getSlackConnection(userId);
    if (!conn) return; // user has not connected Slack

    const client = new WebClient(conn.botToken);
    await client.chat.postMessage({
      channel: conn.channelId,
      text: message,
      // Fallback plain-text already in `text`; also send rich block
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: message },
        },
      ],
    });
  } catch (err) {
    // Best-effort only — never let Slack failure affect email delivery
    console.error("[Slack] Failed to send notification:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit breach notification (deduplicated per sender × window)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the sender's owner via Slack that their hourly rate limit was hit.
 *
 * Deduplication: Redis atomic SETNX on key
 *   `slack-notification:<senderId>:<windowKey>`
 * ensures at most ONE notification per sender per hourly window, even when
 * hundreds of jobs hit the limit simultaneously.
 *
 * Key format: slack-notification:sender-123:2026112510
 *   (YYYYMMDDHH in UTC — changes every hour)
 */
export async function notifyRateLimitBreach(
  senderId: string,
  senderEmail: string,
  hourlyLimit: number,
  emailsSentThisHour: number
): Promise<void> {
  // Build window key — unique per sender × hour
  const now = new Date();
  const windowKey =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}` +
    `${String(now.getUTCHours()).padStart(2, "0")}`;

  const dedupKey = `slack-notification:${senderId}:${windowKey}`;

  try {
    // NX = only set if key does NOT exist (atomic "first one wins")
    // PX = auto-expire after 65 min so next window is always clean
    const acquired = await redis.set(dedupKey, "1", "NX", "PX", 65 * 60 * 1000);
    if (!acquired) {
      // Another worker already sent the notification for this window
      return;
    }
  } catch {
    // Redis offline → still attempt notification (not deduplicated but better than silence)
  }

  // Resolve the user who owns this sender
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

  // Mark the DB event as notification sent (best-effort)
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
    // Non-critical
  }
}

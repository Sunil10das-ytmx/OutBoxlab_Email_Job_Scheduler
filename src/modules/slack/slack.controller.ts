import type { Request, Response } from "express";
import crypto from "crypto";
import { redis } from "../../config/redis.js";
import {
  buildSlackOAuthUrl,
  exchangeSlackCode,
  disconnectSlack,
  getSlackConnection,
} from "../../services/slack.service.js";


export async function slackConnect(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  
  const state = crypto.randomBytes(32).toString("hex");

  
  try {
    await redis.set(`slack-oauth-state:${state}`, userId, "EX", 300);
  } catch {
    res.status(503).json({ error: "Redis unavailable. Please try again shortly." });
    return;
  }

  const authUrl = buildSlackOAuthUrl(state);
  res.redirect(authUrl);
}


export async function slackCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query as Record<string, string>;

  
  if (error) {
    res.status(400).json({ error: `Slack authorization denied: ${error}` });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state parameter" });
    return;
  }

  let userId: string | null = null;
  try {
    userId = await redis.get(`slack-oauth-state:${state}`);
    if (userId) {
      await redis.del(`slack-oauth-state:${state}`); 
    }
  } catch {
    res.status(503).json({ error: "Redis unavailable. Cannot verify state." });
    return;
  }

  if (!userId) {
    res
      .status(400)
      .json({ error: "Invalid or expired OAuth state token. Please try connecting again." });
    return;
  }

  try {
    const { teamId, channelId } = await exchangeSlackCode(code, userId);

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    res.redirect(`${frontendUrl}/slack?slack=connected&team=${teamId}&channel=${channelId}`);
  } catch (err: any) {
    console.error("[Slack callback] token exchange failed:", err.message);
    res.status(500).json({ error: "Failed to connect Slack. Please try again." });
  }
}


export async function slackDisconnect(req: Request, res: Response): Promise<void> {
  try {
    await disconnectSlack(req.user!.id);
    res.json({ message: "Slack disconnected successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to disconnect Slack" });
  }
}


export async function slackStatus(req: Request, res: Response): Promise<void> {
  const conn = await getSlackConnection(req.user!.id);

  if (!conn) {
    res.json({ connected: false });
    return;
  }

  res.json({ connected: true, channelId: conn.channelId });
}

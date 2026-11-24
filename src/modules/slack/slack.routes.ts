import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  slackConnect,
  slackCallback,
  slackDisconnect,
  slackStatus,
} from "./slack.controller.js";

const slackRouter = Router();

// All Slack endpoints require an authenticated user (JWT)
// except the OAuth callback which uses the state token for identity.
slackRouter.get("/connect",    authenticate, slackConnect);
slackRouter.get("/callback",   slackCallback);         // Slack redirects here (no JWT yet)
slackRouter.post("/disconnect", authenticate, slackDisconnect);
slackRouter.get("/status",     authenticate, slackStatus);

export default slackRouter;

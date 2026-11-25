import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  getUserCampaigns,
  getCampaignById,
  getCampaignStats,
} from "./campaign.controller.js";

const campaignRouter = Router();

campaignRouter.use(authenticate);

campaignRouter.get("/", getUserCampaigns);
campaignRouter.get("/:id", getCampaignById);
campaignRouter.get("/:id/stats", getCampaignStats);

export default campaignRouter;

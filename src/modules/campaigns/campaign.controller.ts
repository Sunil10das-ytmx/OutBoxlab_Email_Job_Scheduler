import type { Request, Response } from "express";
import { prisma } from "../../config/database.js";

export async function getUserCampaigns(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        sender: {
          select: {
            id: true,
            senderName: true,
            senderEmail: true,
          },
        },
        _count: {
          select: { emails: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: campaigns.length,
      campaigns,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch campaigns" });
  }
}

export async function getCampaignById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid campaign ID parameter is required" });
      return;
    }

    const userId = req.user!.id;
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        sender: {
          select: {
            id: true,
            senderName: true,
            senderEmail: true,
          },
        },
        emails: {
          orderBy: { sequenceNo: "asc" },
          take: 200,
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    res.status(200).json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch campaign details" });
  }
}

export async function getCampaignStats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid campaign ID parameter is required" });
      return;
    }

    const userId = req.user!.id;
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId },
      select: { id: true, subject: true, totalEmails: true, status: true },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const grouped = await prisma.scheduledEmail.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { status: true },
    });

    const counts: Record<string, number> = {
      sent: 0,
      pending: 0,
      queued: 0,
      sending: 0,
      failed: 0,
      cancelled: 0,
      unknown: 0,
    };

    for (const row of grouped) {
      counts[row.status] = row._count.status;
    }

    const pendingTotal =
      (counts["pending"] ?? 0) +
      (counts["queued"] ?? 0) +
      (counts["sending"] ?? 0);

    res.status(200).json({
      success: true,
      campaignId: campaign.id,
      totalEmails: campaign.totalEmails,
      stats: {
        sent: counts["sent"] ?? 0,
        pending: pendingTotal,
        failed: counts["failed"] ?? 0,
        cancelled: counts["cancelled"] ?? 0,
        unknown: counts["unknown"] ?? 0,
        breakdown: counts,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch campaign stats" });
  }
}

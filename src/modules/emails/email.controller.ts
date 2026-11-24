import type { Request, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "../../config/database.js";
import { scheduleEmailCampaign } from "./email.service.js";

export async function scheduleEmailHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await scheduleEmailCampaign(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Campaign and emails scheduled successfully",
      data: result,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message || "Failed to schedule emails",
    });
  }
}

export async function getScheduledEmails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaignId =
      typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: {
          userId,
          ...(campaignId ? { id: campaignId } : {}),
        },
        ...(status ? { status } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });

    res.status(200).json({ success: true, count: emails.length, emails });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}


export async function getEmailById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid email ID parameter is required" });
      return;
    }

    const userId = req.user!.id;

    const email = await prisma.scheduledEmail.findFirst({
      where: {
        id,
        campaign: { userId },
      },
      include: {
        campaign: {
          select: {
            id: true,
            subject: true,
            status: true,
          },
        },
      },
    });

    if (!email) {
      res.status(404).json({ error: "Scheduled email not found" });
      return;
    }

    res.status(200).json({ success: true, email });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

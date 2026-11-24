import type { Request, Response } from "express";
import { ZodError } from "zod";
import { prisma } from "../../config/database.js";
import { scheduleEmailCampaign } from "./email.service.js";
import {
  searchEmails,
  enqueueEmailIndexing,
} from "../../services/email-index-outbox.service.js";
import { emailQueue, addScheduledEmailsBulk } from "../../queue/email.queue.js";
import { parseAndValidateRecipientCsv } from "../../services/csv.service.js";

export async function scheduleEmailHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const input =
      req.file?.buffer
        ? { ...req.body, csv: req.file.buffer.toString("utf8") }
        : req.body;

    const result = await scheduleEmailCampaign(userId, input);

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

export async function searchEmailsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    res.status(400).json({ error: "Search query parameter q is required" });
    return;
  }

  const statusValue = req.query.status;
  if (
    statusValue !== undefined &&
    statusValue !== "scheduled" &&
    statusValue !== "sent"
  ) {
    res.status(400).json({
      error: "status must be either scheduled or sent",
    });
    return;
  }

  try {
    const result = await searchEmails(
      req.user!.id,
      query,
      statusValue === "scheduled" || statusValue === "sent"
        ? statusValue
        : undefined
    );
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[EmailSearch] Search request failed:", error);
    res.status(503).json({ error: "Email search is temporarily unavailable" });
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

export async function parseCsvHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    let csvContent: string | undefined;

    if (req.file?.buffer) {
      csvContent = req.file.buffer.toString("utf8");
    } else if (typeof req.body?.csv === "string") {
      csvContent = req.body.csv;
    }

    if (!csvContent || !csvContent.trim()) {
      res.status(400).json({
        error: "CSV file (field: file) or raw CSV string (body.csv) is required",
      });
      return;
    }

    const result = parseAndValidateRecipientCsv(csvContent);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({
      error: error.message || "Failed to parse CSV content",
    });
  }
}

export async function getScheduledOnlyEmails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaignId =
      typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: {
          userId,
          ...(campaignId ? { id: campaignId } : {}),
        },
        status: { in: ["pending", "queued", "sending"] },
      },
      include: {
        campaign: {
          select: { id: true, subject: true, senderId: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });

    res.status(200).json({ success: true, count: emails.length, emails });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getSentEmails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaignId =
      typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: {
          userId,
          ...(campaignId ? { id: campaignId } : {}),
        },
        status: "sent",
      },
      include: {
        campaign: {
          select: { id: true, subject: true, senderId: true },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });

    res.status(200).json({ success: true, count: emails.length, emails });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function cancelScheduledEmail(
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
      where: { id, campaign: { userId } },
    });

    if (!email) {
      res.status(404).json({ error: "Scheduled email not found" });
      return;
    }

    if (email.status === "sent") {
      res.status(400).json({ error: "Cannot cancel an email that has already been sent" });
      return;
    }

    if (email.status === "cancelled") {
      res.status(200).json({ success: true, message: "Email is already cancelled", email });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.scheduledEmail.update({
        where: { id },
        data: { status: "cancelled" },
      });
      await enqueueEmailIndexing(tx, [id]);
      return record;
    });

    try {
      const job = await emailQueue.getJob(`email-${id}`);
      if (job) {
        await job.remove();
      }
    } catch {
    }

    res.status(200).json({
      success: true,
      message: "Scheduled email cancelled successfully",
      email: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getUnknownEmails(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const campaignId =
      typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        campaign: {
          userId,
          ...(campaignId ? { id: campaignId } : {}),
        },
        status: "unknown",
      },
      include: {
        campaign: {
          select: { id: true, subject: true, senderId: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    });

    res.status(200).json({ success: true, count: emails.length, emails });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function reconcileUnknownEmail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid email ID parameter is required" });
      return;
    }

    const action = req.body?.action;
    if (action !== "mark_sent" && action !== "mark_failed" && action !== "retry") {
      res.status(400).json({
        error: "action must be one of: mark_sent, mark_failed, retry",
      });
      return;
    }

    const userId = req.user!.id;
    const email = await prisma.scheduledEmail.findFirst({
      where: { id, campaign: { userId } },
    });

    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    if (email.status !== "unknown") {
      res.status(400).json({
        error: `Only emails in 'unknown' status can be reconciled (current: '${email.status}')`,
      });
      return;
    }

    const nextStatus =
      action === "mark_sent"
        ? "sent"
        : action === "mark_failed"
          ? "failed"
          : "queued";

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.scheduledEmail.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(action === "mark_sent"
            ? { sentAt: new Date(), errorMessage: null }
            : {}),
          ...(action === "retry"
            ? { sendingStartedAt: null, errorMessage: null }
            : {}),
        },
      });
      await enqueueEmailIndexing(tx, [id]);
      return record;
    });

    if (action === "retry") {
      await addScheduledEmailsBulk([
        { id: updated.id, scheduledAt: new Date() },
      ]);
    }

    res.status(200).json({
      success: true,
      message: `Email reconciled as '${nextStatus}'`,
      email: updated,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

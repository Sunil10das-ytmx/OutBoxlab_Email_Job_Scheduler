import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { prisma } from "../../config/database.js";
import { encrypt } from "../../utils/encryption.js";
import {
  createEtherealTestSender,
  invalidateSenderTransporter,
} from "../../services/mail.service.js";

const createSenderSchema = z.object({
  senderName: z.string().min(1, "senderName is required"),
  senderEmail: z.string().email("Valid senderEmail is required"),
  smtpHost: z.string().min(1).default("smtp.ethereal.email"),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpUsername: z.string().min(1, "smtpUsername is required"),
  smtpPassword: z.string().min(1, "smtpPassword is required"),
  isActive: z.boolean().optional().default(true),
});

const updateSenderSchema = z.object({
  senderName: z.string().min(1).optional(),
  senderEmail: z.string().email().optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const senderSelect = {
  id: true,
  senderName: true,
  senderEmail: true,
  smtpHost: true,
  smtpPort: true,
  smtpUsername: true,
  isActive: true,
  createdAt: true,
} as const;

export async function createSender(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // Convenience: if useEthereal=true is passed, auto-provision a test Ethereal sender
    if (req.body?.useEthereal === true) {
      const senderName =
        typeof req.body.senderName === "string" && req.body.senderName.trim()
          ? req.body.senderName.trim()
          : "Ethereal Test Sender";
      const sender = await createEtherealTestSender(userId, senderName);
      res.status(201).json({
        success: true,
        sender: {
          id: sender.id,
          senderName: sender.senderName,
          senderEmail: sender.senderEmail,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          smtpUsername: sender.smtpUsername,
          isActive: sender.isActive,
          createdAt: sender.createdAt,
        },
      });
      return;
    }

    const input = createSenderSchema.parse(req.body);

    const sender = await prisma.emailSender.create({
      data: {
        userId,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUsername: input.smtpUsername,
        smtpPasswordEncrypted: encrypt(input.smtpPassword),
        isActive: input.isActive,
      },
      select: senderSelect,
    });

    res.status(201).json({ success: true, sender });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    res.status(500).json({ error: error.message || "Failed to create sender" });
  }
}

export async function getSenders(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const senders = await prisma.emailSender.findMany({
      where: { userId },
      select: senderSelect,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: senders.length,
      senders,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch senders" });
  }
}

export async function updateSender(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid sender ID parameter is required" });
      return;
    }

    const userId = req.user!.id;
    const existing = await prisma.emailSender.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Sender not found" });
      return;
    }

    const input = updateSenderSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (input.senderName !== undefined) updateData.senderName = input.senderName;
    if (input.senderEmail !== undefined) updateData.senderEmail = input.senderEmail;
    if (input.smtpHost !== undefined) updateData.smtpHost = input.smtpHost;
    if (input.smtpPort !== undefined) updateData.smtpPort = input.smtpPort;
    if (input.smtpUsername !== undefined) updateData.smtpUsername = input.smtpUsername;
    if (input.smtpPassword !== undefined) {
      updateData.smtpPasswordEncrypted = encrypt(input.smtpPassword);
    }
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const sender = await prisma.emailSender.update({
      where: { id },
      data: updateData,
      select: senderSelect,
    });

    invalidateSenderTransporter(id);

    res.status(200).json({ success: true, sender });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    res.status(500).json({ error: error.message || "Failed to update sender" });
  }
}

export async function deleteSender(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "Valid sender ID parameter is required" });
      return;
    }

    const userId = req.user!.id;
    const deleted = await prisma.emailSender.deleteMany({
      where: { id, userId },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: "Sender not found" });
      return;
    }

    invalidateSenderTransporter(id);

    res.status(200).json({
      success: true,
      message: "Sender removed successfully",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete sender" });
  }
}

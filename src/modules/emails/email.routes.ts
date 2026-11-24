import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  scheduleEmailHandler,
  getScheduledEmails,
  getEmailById,
} from "./email.controller.js";
import { createEtherealTestSender } from "../../services/mail.service.js";
import { prisma } from "../../config/database.js";

const emailRouter = Router();

emailRouter.use(authenticate);

emailRouter.post("/schedule", scheduleEmailHandler);

emailRouter.get("/", getScheduledEmails);
emailRouter.get("/:id", getEmailById);

emailRouter.post("/senders/ethereal", async (req, res) => {
  try {
    const userId = req.user!.id;
    const senderName = req.body.senderName || "Ethereal Test Sender";
    const sender = await createEtherealTestSender(userId, senderName);

    res.status(201).json({
      success: true,
      message: "Ethereal test sender created successfully",
      sender: {
        id: sender.id,
        senderName: sender.senderName,
        senderEmail: sender.senderEmail,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        isActive: sender.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

emailRouter.get("/senders/list", async (req, res) => {
  try {
    const userId = req.user!.id;
    const senders = await prisma.emailSender.findMany({
      where: { userId },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        smtpHost: true,
        smtpPort: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(200).json({ success: true, count: senders.length, senders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default emailRouter;

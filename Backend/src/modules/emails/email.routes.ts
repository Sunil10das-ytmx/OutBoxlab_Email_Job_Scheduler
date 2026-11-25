import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.middleware.js";
import { MAX_CSV_FILE_SIZE_BYTES } from "../../services/csv.service.js";
import {
  scheduleEmailHandler,
  getScheduledEmails,
  getScheduledOnlyEmails,
  getSentEmails,
  getUnknownEmails,
  getEmailById,
  cancelScheduledEmail,
  reconcileUnknownEmail,
  searchEmailsHandler,
  parseCsvHandler,
} from "./email.controller.js";
import { createEtherealTestSender } from "../../services/mail.service.js";
import { prisma } from "../../config/database.js";

const emailRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const isCsvName = file.originalname.toLowerCase().endsWith(".csv");
    const isCsvMime = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ].includes(file.mimetype);

    if (isCsvName || isCsvMime) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv files are allowed"));
    }
  },
});

function handleCsvUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `CSV file too large. Maximum size is ${Math.round(MAX_CSV_FILE_SIZE_BYTES / (1024 * 1024))}MB`
          : err.message || "Invalid CSV upload";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

emailRouter.use(authenticate);

emailRouter.post("/parse-csv", handleCsvUpload, parseCsvHandler);
emailRouter.post("/schedule", handleCsvUpload, scheduleEmailHandler);

emailRouter.get("/search", searchEmailsHandler);
emailRouter.get("/scheduled", getScheduledOnlyEmails);
emailRouter.get("/sent", getSentEmails);
emailRouter.get("/unknown", getUnknownEmails);
emailRouter.get("/", getScheduledEmails);
emailRouter.get("/:id", getEmailById);
emailRouter.post("/:id/cancel", cancelScheduledEmail);
emailRouter.post("/:id/reconcile", reconcileUnknownEmail);

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

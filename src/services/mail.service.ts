import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../config/database.js";
import { decrypt, encrypt } from "../utils/encryption.js";

export interface SendEmailPayload {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject?: string | null;
  body?: string | null;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
  response: string;
}

const transporterCache = new Map<string, Transporter>();


export async function getTransporterForSender(sender?: {
  id: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  senderName: string;
  senderEmail: string;
} | null): Promise<{
  transporter: Transporter;
  from: string;
}> {
  if (sender && sender.smtpHost && sender.smtpUsername) {
    const cacheKey = sender.id;
    if (transporterCache.has(cacheKey)) {
      return {
        transporter: transporterCache.get(cacheKey)!,
        from: `"${sender.senderName}" <${sender.senderEmail}>`,
      };
    }

    let password = sender.smtpPasswordEncrypted;
    try {
      password = decrypt(sender.smtpPasswordEncrypted);
    } catch {
    }

    const isSecure = sender.smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: isSecure,
      auth: {
        user: sender.smtpUsername,
        pass: password,
      },
    });

    transporterCache.set(cacheKey, transporter);

    return {
      transporter,
      from: `"${sender.senderName}" <${sender.senderEmail}>`,
    };
  }

  if (
    process.env.ETHEREAL_USER &&
    process.env.ETHEREAL_PASS &&
    process.env.ETHEREAL_USER !== "your_ethereal_username"
  ) {
    const cacheKey = "env-ethereal";
    if (transporterCache.has(cacheKey)) {
      return {
        transporter: transporterCache.get(cacheKey)!,
        from: `"ReachInbox" <${process.env.ETHEREAL_USER}>`,
      };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });

    transporterCache.set(cacheKey, transporter);

    return {
      transporter,
      from: `"ReachInbox" <${process.env.ETHEREAL_USER}>`,
    };
  }

  const cacheKey = "ephemeral-ethereal";
  if (!transporterCache.has(cacheKey)) {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`[Ethereal] Generated ephemeral test account: ${testAccount.user}`);

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    transporterCache.set(cacheKey, transporter);
  }

  return {
    transporter: transporterCache.get(cacheKey)!,
    from: '"ReachInbox Test" <test@ethereal.email>',
  };
}


export async function sendEmail(email: SendEmailPayload): Promise<SendEmailResult> {
  const emailRecord = await prisma.scheduledEmail.findUnique({
    where: { id: email.id },
    include: {
      campaign: {
        include: {
          sender: true,
        },
      },
    },
  });

  const campaign = emailRecord?.campaign;
  const sender = campaign?.sender;

  const subject = email.subject || campaign?.subject || "No Subject";
  const body = email.body || campaign?.body || "";

  const { transporter, from } = await getTransporterForSender(sender);

  const info = await transporter.sendMail({
    from,
    to: email.recipientEmail,
    subject,
    text: body,
    html: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  if (previewUrl) {
    console.log(`[Ethereal Delivery] Email to ${email.recipientEmail} sent! Preview: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
    response: info.response || "250 OK",
  };
}


export async function createEtherealTestSender(
  userId: string,
  senderName: string = "Ethereal Test Sender"
) {
  const testAccount = await nodemailer.createTestAccount();

  return await prisma.emailSender.create({
    data: {
      userId,
      senderName,
      senderEmail: testAccount.user,
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUsername: testAccount.user,
      smtpPasswordEncrypted: encrypt(testAccount.pass || "ethereal-pass"),
      isActive: true,
    },
  });
}

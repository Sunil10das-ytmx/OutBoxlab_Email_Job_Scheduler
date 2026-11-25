import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { calculateEmailSchedules } from "../../services/delay.service.js";
import { triggerOutboxDispatcher } from "../../services/outbox-dispatcher.service.js";
import { enqueueEmailIndexing } from "../../services/email-index-outbox.service.js";
import {
  MAX_RECIPIENTS_PER_CAMPAIGN,
  parseAndValidateRecipientCsv,
} from "../../services/csv.service.js";

export const scheduleRequestSchema = z
  .object({
    senderId: z.string({ error: "senderId is required" }).min(1),
    subject: z.string({ error: "subject is required" }).min(1, "Subject cannot be empty"),
    body: z.string({ error: "body is required" }).min(1, "Body cannot be empty"),
    recipients: z
      .array(z.string().email("Invalid recipient email format"))
      .max(
        MAX_RECIPIENTS_PER_CAMPAIGN,
        `Maximum ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients allowed per campaign`
      )
      .optional(),
    csv: z.string().min(1).optional(),
    startTime: z.string({ error: "startTime ISO-8601 string is required" }).refine(
      (val) => !isNaN(Date.parse(val)),
      "startTime must be a valid ISO-8601 timestamp with timezone"
    ),
    delayBetweenEmails: z.coerce.number().int().min(0).default(2000),
    hourlyLimit: z.coerce.number().int().min(1).default(100),
  })
  .refine(
    (data) => (data.recipients && data.recipients.length > 0) || Boolean(data.csv),
    {
      message: "At least one recipient email or a CSV file is required",
      path: ["recipients"],
    }
  );

export type ScheduleEmailInput = z.infer<typeof scheduleRequestSchema>;

export interface ScheduleResult {
  campaign: {
    id: string;
    subject: string;
    totalEmails: number;
    startTime: Date;
    delayMs: number;
    hourlyLimit: number;
    status: string;
  };
  recipientCount: number;
  firstScheduledAt: Date;
  lastScheduledAt: Date;
}


export async function scheduleEmailCampaign(
  userId: string,
  rawInput: unknown
): Promise<ScheduleResult> {
  const validated = scheduleRequestSchema.parse(rawInput);
  const {
    senderId,
    subject,
    body,
    recipients,
    csv,
    startTime,
    delayBetweenEmails,
    hourlyLimit,
  } = validated;

  let uniqueRecipients: string[];
  if (csv) {
    const parsedCsv = parseAndValidateRecipientCsv(csv);
    if (parsedCsv.recipients.length === 0) {
      const error = new Error("CSV contains no valid recipient emails");
      (error as any).statusCode = 400;
      throw error;
    }
    uniqueRecipients = parsedCsv.recipients;
  } else {
    uniqueRecipients = Array.from(
      new Set((recipients ?? []).map((r) => r.trim().toLowerCase()))
    );
  }

  if (uniqueRecipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
    const error = new Error(
      `Recipient limit exceeded. Maximum ${MAX_RECIPIENTS_PER_CAMPAIGN} unique recipients allowed.`
    );
    (error as any).statusCode = 400;
    throw error;
  }

  const sender = await prisma.emailSender.findFirst({
    where: {
      id: senderId,
      userId,
    },
  });

  if (!sender) {
    const error = new Error("Sender not found or does not belong to the authenticated user");
    (error as any).statusCode = 404;
    throw error;
  }

  if (!sender.isActive) {
    const error = new Error("Selected email sender is currently inactive");
    (error as any).statusCode = 400;
    throw error;
  }

  const startDate = new Date(startTime);
  const now = new Date();
  if (startDate.getTime() < now.getTime() - 60 * 1000) {
    const error = new Error("Start time must be in the future (ISO-8601 timestamp with timezone)");
    (error as any).statusCode = 400;
    throw error;
  }

  const scheduledItems = calculateEmailSchedules(
    uniqueRecipients,
    startDate,
    delayBetweenEmails
  );

  const transactionResult = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        userId,
        senderId: sender.id,
        subject,
        body,
        startTime: startDate,
        delayMs: delayBetweenEmails,
        hourlyLimit,
        totalEmails: scheduledItems.length,
        status: "scheduled",
      },
    });

    const emailRows = scheduledItems.map((item) => {
      const emailId = crypto.randomUUID();
      return {
        id: emailId,
        campaignId: campaign.id,
        recipientEmail: item.recipientEmail,
        subject,
        body,
        sequenceNo: item.sequenceNo,
        scheduledAt: item.scheduledAt,
        status: "pending",
        attempts: 0,
      };
    });

    await tx.scheduledEmail.createMany({
      data: emailRows,
    });

    await enqueueEmailIndexing(
      tx,
      emailRows.map((email) => email.id)
    );

    const outboxRows = emailRows.map((email) => ({
      id: crypto.randomUUID(),
      emailId: email.id,
      campaignId: campaign.id,
      payload: JSON.stringify({
        emailId: email.id,
        campaignId: campaign.id,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        scheduledAt: email.scheduledAt.toISOString(),
      }),
      status: "PENDING",
      attempts: 0,
    }));

    await tx.outboxEvent.createMany({
      data: outboxRows,
    });

    return {
      campaign,
      emailRows,
    };
  });

  triggerOutboxDispatcher();

  const firstItem = transactionResult.emailRows[0]!;
  const lastItem = transactionResult.emailRows[transactionResult.emailRows.length - 1]!;

  return {
    campaign: {
      id: transactionResult.campaign.id,
      subject: transactionResult.campaign.subject,
      totalEmails: transactionResult.campaign.totalEmails,
      startTime: transactionResult.campaign.startTime,
      delayMs: transactionResult.campaign.delayMs,
      hourlyLimit: transactionResult.campaign.hourlyLimit,
      status: transactionResult.campaign.status,
    },
    recipientCount: transactionResult.emailRows.length,
    firstScheduledAt: firstItem.scheduledAt,
    lastScheduledAt: lastItem.scheduledAt,
  };
}

import { parse as parseCsv } from "csv-parse/sync";
import { z } from "zod";

export const MAX_CSV_FILE_SIZE_BYTES = Number(
  process.env.MAX_CSV_FILE_SIZE_BYTES || 2 * 1024 * 1024
);

export const MAX_RECIPIENTS_PER_CAMPAIGN = Number(
  process.env.MAX_RECIPIENTS_PER_CAMPAIGN || 5000
);

const EMAIL_HEADER_NAMES = new Set([
  "email",
  "emails",
  "email_address",
  "emailaddress",
  "e-mail",
  "recipient",
  "recipients",
  "to",
]);

const emailSchema = z.string().email();

export interface CsvParseResult {
  totalRows: number;
  validEmails: number;
  invalidEmails: number;
  duplicatesRemoved: number;
  recipients: string[];
  errors: string[];
}

function createBadRequestError(message: string): Error {
  const err = new Error(message);
  (err as any).statusCode = 400;
  return err;
}


export function parseAndValidateRecipientCsv(csvContent: string): CsvParseResult {
  if (!csvContent || !csvContent.trim()) {
    throw createBadRequestError("CSV content is empty");
  }

  let rows: string[][];
  try {
    rows = parseCsv(csvContent, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch (error: any) {
    throw createBadRequestError(`Invalid CSV format: ${error.message}`);
  }

  if (rows.length === 0) {
    throw createBadRequestError("CSV file contains no rows");
  }

  const firstRow = rows[0] ?? [];
  let emailColIdx = -1;
  let hasHeader = false;

  for (let i = 0; i < firstRow.length; i++) {
    const header = (firstRow[i] ?? "").trim().toLowerCase();
    if (EMAIL_HEADER_NAMES.has(header)) {
      emailColIdx = i;
      hasHeader = true;
      break;
    }
  }

  if (emailColIdx === -1) {
    const colScores = new Map<number, number>();
    const sampleLimit = Math.min(rows.length, 10);

    for (let r = 0; r < sampleLimit; r++) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const val = (row[c] ?? "").trim().toLowerCase();
        if (emailSchema.safeParse(val).success) {
          colScores.set(c, (colScores.get(c) ?? 0) + 1);
        }
      }
    }

    let bestCol = 0;
    let bestScore = -1;
    for (const [col, score] of colScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    emailColIdx = bestCol;

    const firstCell = (firstRow[emailColIdx] ?? "").trim();
    if (
      rows.length > 1 &&
      !firstCell.includes("@") &&
      /^[a-zA-Z0-9_\-\s]+$/.test(firstCell)
    ) {
      hasHeader = true;
    }
  }

  const startRow = hasHeader ? 1 : 0;
  const dataRows = rows.slice(startRow);

  if (dataRows.length === 0) {
    throw createBadRequestError("CSV contains headers but no recipient rows");
  }

  const validSet = new Set<string>();
  const errors: string[] = [];
  let invalidEmails = 0;
  let duplicatesRemoved = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const rawValue = (row[emailColIdx] ?? "").trim();
    const rowNumber = startRow + i + 1;

    if (!rawValue) {
      invalidEmails += 1;
      errors.push(`Row ${rowNumber}: Missing email address`);
      continue;
    }

    const normalized = rawValue.toLowerCase();
    if (!emailSchema.safeParse(normalized).success) {
      invalidEmails += 1;
      errors.push(`Row ${rowNumber}: Invalid email "${rawValue}"`);
      continue;
    }

    if (validSet.has(normalized)) {
      duplicatesRemoved += 1;
      continue;
    }

    validSet.add(normalized);

    if (validSet.size > MAX_RECIPIENTS_PER_CAMPAIGN) {
      throw createBadRequestError(
        `Recipient limit exceeded. Maximum ${MAX_RECIPIENTS_PER_CAMPAIGN} unique recipients allowed per campaign.`
      );
    }
  }

  const recipients = Array.from(validSet);

  return {
    totalRows: dataRows.length,
    validEmails: recipients.length,
    invalidEmails,
    duplicatesRemoved,
    recipients,
    errors,
  };
}

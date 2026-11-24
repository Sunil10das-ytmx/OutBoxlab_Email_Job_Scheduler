import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; 
const AUTH_TAG_LENGTH = 16;


function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required (must be 64-char hex string for 256 bits)."
    );
  }
  const keyBuffer = Buffer.from(hexKey, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY length: got ${keyBuffer.length} bytes, expected 32 bytes (64 hex characters).`
    );
  }
  return keyBuffer;
}

export function encrypt(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encryptedPart1 = cipher.update(plainText, "utf8", "hex");
  const encryptedPart2 = cipher.final("hex");
  const ciphertext = `${encryptedPart1}${encryptedPart2}`;

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected iv:authTag:ciphertext.");
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const cipherTextHex = parts[2];

  if (!ivHex || !authTagHex || !cipherTextHex) {
    throw new Error("Malformed encrypted string components.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedPart1 = decipher.update(cipherTextHex, "hex", "utf8");
  const decryptedPart2 = decipher.final("utf8");

  return `${decryptedPart1}${decryptedPart2}`;
}

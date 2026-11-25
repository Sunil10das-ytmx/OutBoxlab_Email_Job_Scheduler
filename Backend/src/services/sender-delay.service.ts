import { redis } from "../config/redis.js";

const REDIS_KEY_PREFIX = "sender:last-reserved-at";
const DEFAULT_MIN_DELAY_MS = Number(process.env.MIN_EMAIL_DELAY_MS || 2000);



const reserveSlotScript = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local minDelay   = tonumber(ARGV[2])
local ttlMs      = tonumber(ARGV[3])

local lastStr    = redis.call("GET", key)
local last       = lastStr and tonumber(lastStr) or 0

local nextAt     = math.max(now, last + minDelay)

-- Store with a generous TTL so stale keys auto-expire (24h)
redis.call("SET", key, tostring(nextAt), "PX", ttlMs)

return tostring(nextAt)
`;


export async function reserveSenderSlot(
  senderId: string,
  minDelayMs: number = DEFAULT_MIN_DELAY_MS
): Promise<{ nextAllowedAtMs: number; delayNeededMs: number }> {
  const key = `${REDIS_KEY_PREFIX}:${senderId}`;
  const now = Date.now();
  const ttlMs = 24 * 60 * 60 * 1000; 

  let nextAllowedAtMs: number;

  try {
    const result = await redis.eval(
      reserveSlotScript,
      1,
      key,
      String(now),
      String(minDelayMs),
      String(ttlMs)
    );

    nextAllowedAtMs = Number(result);
  } catch {
    
    nextAllowedAtMs = now;
  }

  const delayNeededMs = Math.max(0, nextAllowedAtMs - now);
  return { nextAllowedAtMs, delayNeededMs };
}


export async function peekSenderLastReservedAt(
  senderId: string
): Promise<number | null> {
  const key = `${REDIS_KEY_PREFIX}:${senderId}`;
  try {
    const val = await redis.get(key);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

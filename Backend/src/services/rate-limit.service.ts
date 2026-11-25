import { redis } from "../config/redis.js";
import { prisma } from "../config/database.js";
import { notifyRateLimitBreach } from "./slack.service.js";



export interface RateLimitDecision {
  
  allowed: boolean;

  
  runAt: number;

  senderId: string;
  emailId: string;
}



const HOUR_MS = 3_600_000;
const KEY_TTL_MS = 2 * HOUR_MS;


const RESERVE_SLOT_LUA = `
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local limit    = tonumber(ARGV[2])
local minDelay = tonumber(ARGV[3])
local emailId  = ARGV[4]
local ttlMs    = tonumber(ARGV[5])
local HOUR_MS  = 3600000

-- 1. Remove stale entries outside the rolling window
redis.call("ZREMRANGEBYSCORE", key, "-inf", now - HOUR_MS)

-- 2. Idempotency check: emailId already has a reserved slot → return it
local existingScore = redis.call("ZSCORE", key, emailId)
if existingScore then
  return {"1", existingScore}
end

-- 3. Last reserved timestamp (highest score = most recent reservation)
local lastEntries = redis.call("ZREVRANGE", key, 0, 0, "WITHSCORES")
local lastReservedAt = 0
if #lastEntries >= 2 then
  lastReservedAt = tonumber(lastEntries[2])
end

-- 4. Candidate send time: respect per-sender minimum delay
local candidate = math.max(now, lastReservedAt + minDelay)

-- 5. Count reservations in the rolling window that ends at candidate
--    (uses candidate as the window end because we're checking if sending
--     at "candidate" would exceed the hourly budget)
local windowCount = redis.call("ZCOUNT", key, candidate - HOUR_MS, candidate)

if windowCount < limit then
  -- 6a. Slot is available — reserve it atomically
  redis.call("ZADD", key, candidate, emailId)
  redis.call("PEXPIRE", key, ttlMs)
  return {"1", tostring(candidate)}
else
  -- 6b. Hourly limit reached.
  --     Find the entry at index (windowCount - limit): when it falls off the
  --     window (its score + HOUR_MS), one new slot opens.
  local overflowIdx = windowCount - limit
  local expireEntry = redis.call(
    "ZRANGEBYSCORE", key,
    tostring(candidate - HOUR_MS), tostring(candidate),
    "WITHSCORES", "LIMIT", overflowIdx, 1
  )

  local runAt
  if #expireEntry >= 2 then
    runAt = tonumber(expireEntry[2]) + HOUR_MS
  else
    -- Fallback: shouldn't happen, but be safe
    runAt = candidate + HOUR_MS
  end

  -- Also honour min-delay from the last reservation
  runAt = math.max(runAt, lastReservedAt + minDelay)

  return {"0", tostring(runAt)}
end
`;


export async function reserveEmailSlot(
  senderId: string,
  emailId: string,
  hourlyLimit: number,
  minDelayMs: number
): Promise<RateLimitDecision> {
  const key = `email-rate:${senderId}`;
  const now = Date.now();

  try {
    const result = (await redis.eval(
      RESERVE_SLOT_LUA,
      1,           
      key,         
      String(now),
      String(hourlyLimit),
      String(minDelayMs),
      emailId,
      String(KEY_TTL_MS)
    )) as [string, string];

    const allowed = result[0] === "1";
    const runAt = Number(result[1]);

    if (!allowed) {
      void logRateLimitEvent(senderId);
      void triggerSlackRateLimitAlert(senderId, hourlyLimit);
    }

    return { allowed, runAt, senderId, emailId };
  } catch (err) {
    console.error("[RateLimit] Redis Lua eval failed, failing open:", err);
    return { allowed: true, runAt: now, senderId, emailId };
  }
}


async function logRateLimitEvent(senderId: string): Promise<void> {
  try {
    const windowStart = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
    await prisma.rateLimitEvent.create({
      data: { senderId, windowStart, notificationSent: false },
    });
  } catch {
    // Best-effort; never block the email worker on a log entry
  }
}

/** Fire-and-forget: resolve sender details then call Slack notifier. */
async function triggerSlackRateLimitAlert(
  senderId: string,
  hourlyLimit: number
): Promise<void> {
  try {
    const sender = await prisma.emailSender.findUnique({
      where: { id: senderId },
      select: { senderEmail: true },
    });
    if (!sender) return;

    // Count emails sent in the rolling hour for the notification text
    const oneHourAgo = new Date(Date.now() - HOUR_MS);
    const emailsSentThisHour = await prisma.scheduledEmail.count({
      where: {
        campaign: { senderId },
        status: "sent",
        sentAt: { gte: oneHourAgo },
      },
    });

    await notifyRateLimitBreach(
      senderId,
      sender.senderEmail,
      hourlyLimit,
      emailsSentThisHour
    );
  } catch {
    // Non-critical — never crash the worker
  }
}

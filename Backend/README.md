# MailBox - Email Scheduler

A production-grade email scheduling platform built with **Node.js**, **TypeScript**, **Express**, **Prisma (PostgreSQL)**, **BullMQ + Redis**, **Elasticsearch**, **Ethereal SMTP**, **Google OAuth**, and **Slack OAuth**.

---

## 1. Project Overview

OutBoxLab (ReachInbox Email Scheduler) lets authenticated users schedule bulk or single email campaigns via CSV upload or JSON payloads, enforce per-sender hourly rate limits and minimum send delays, survive API/worker restarts without losing future jobs or sending duplicates, search email history with Elasticsearch, and receive Slack notifications when rate limits are breached.

---

## 2. Tech Stack

- **Runtime & Language:** Node.js (ESM), TypeScript
- **API Framework:** Express v5
- **Database & ORM:** PostgreSQL 16 + Prisma v7 (`@prisma/adapter-pg`)
- **Queue & Caching / Rate Limiting:** Redis 7 (AOF persistence) + BullMQ + `ioredis`
- **Search:** Elasticsearch 9 (`@elastic/elasticsearch`)
- **SMTP Mailer:** Nodemailer + Ethereal Email (test SMTP)
- **Authentication:** Google OAuth (`google-auth-library`) + JWT (`jsonwebtoken`) with Redis logout blacklist
- **Integrations & Monitoring:** Slack Web API (`@slack/web-api`), Bull Board (`/admin/queues`)
- **Validation & Parsing:** Zod v4, Multer, `csv-parse`

---

## 3. Architecture

```text
┌───────────────┐      REST + JWT       ┌────────────────────────────────────┐
│ React/Vite FE │ ────────────────────▶ │ Express API (src/server.ts)        │
└───────────────┘                       │  ├─ Auth, Campaigns, Senders, Slack│
                                        │  ├─ CSV Parse & Validation         │
                                        │  └─ Outbox + Index Outbox Poll     │
                                        └──────────────┬─────────────────────┘
                                                       │ Prisma Tx (DB + Outbox)
                                                       ▼
┌─────────────────────────────────┐     ┌────────────────────────────────────┐
│ PostgreSQL                      │     │ Outbox Dispatcher (3s interval)    │
│  ├─ users / email_senders       │◀────│  └─ addScheduledEmailsBulk()       │
│  ├─ campaigns / scheduled_emails│     └──────────────┬─────────────────────┘
│  └─ outbox_events / index_outbox│                    │ Delayed Jobs
└─────────────────────────────────┘                    ▼
                                        ┌────────────────────────────────────┐
                                        │ Redis (AOF Persistent) + BullMQ    │
                                        │  ├─ email-queue (delayed jobs)     │
                                        │  └─ email-rate:<senderId> (ZSET)   │
                                        └──────────────┬─────────────────────┘
                                                       │ Concurrency = 5
                                                       ▼
                                        ┌────────────────────────────────────┐
                                        │ Email Worker (email.worker.ts)     │
                                        │  ├─ Lua Rate Limit + Min Delay     │
                                        │  ├─ Atomic DB Claim (sending)      │
                                        │  ├─ Nodemailer / Ethereal SMTP     │
                                        │  └─ Slack Alert on Limit Breach    │
                                        └────────────────────────────────────┘
```

---

## 4. Features

- **Google OAuth Login:** Real Google ID token verification issuing 7-day JWTs, with Redis-backed token revocation on logout.
- **CSV Upload & Validation:** Parses CSVs with Multer + `csv-parse`, auto-detects email columns, filters invalid emails, deduplicates recipients, and enforces file size (`2MB`) and recipient count (`5000`) limits.
- **Per-Sender Throttling:** Atomic Redis Lua script enforcing both **hourly rate limits** (rolling 60-minute window) and **minimum delay** between sends for the same sender.
- **Transactional Outbox Pattern:** DB records and outbox events are written atomically so jobs are never lost if Redis is temporarily unavailable during scheduling.
- **Crash & Restart Recovery:** Startup recovery (`recoverPendingJobs`) + 60-second stale `sending` monitor (`startStaleSendingMonitor`) + Redis AOF persistence.
- **Elasticsearch Full-Text Search:** Asynchronous `EmailIndexOutbox` keeps Elasticsearch synced without blocking email scheduling or delivery if Elasticsearch is down.
- **Slack Integration:** OAuth 2.0 connection per user with encrypted tokens (AES-256-GCM) and deduplicated hourly rate-limit breach alerts.
- **Bull Board Admin UI:** Protected by HTTP Basic Auth at `/admin/queues`.

---

## 5. Prerequisites

- **Node.js** v20+ (supports `--env-file=.env` and native ESM)
- **Docker & Docker Compose** (for PostgreSQL, Redis, Elasticsearch)
- **Google Cloud OAuth Client ID**
- **Slack App Credentials** (optional, for Slack notifications)

---

## 6. Environment Variables

Create `Backend/.env` (see `Backend/.env.example`):

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Express API port | `5000` |
| `FRONTEND_URL` | Allowed CORS origin & Slack OAuth redirect target | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/reachinbox` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | Secret for signing auth JWTs | `your_secret_key` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | `...apps.googleusercontent.com` |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint | `http://localhost:9200` |
| `ETHEREAL_USER` / `ETHEREAL_PASS` | Fallback Ethereal SMTP credentials | `...` |
| `WORKER_CONCURRENCY` | BullMQ concurrent jobs per worker | `5` |
| `MIN_EMAIL_DELAY_MS` | Minimum gap between same-sender emails (ms) | `2000` |
| `MAX_EMAILS_PER_HOUR` | Default hourly limit per sender | `100` |
| `ENCRYPTION_KEY` | 32-byte hex key (64 chars) for AES-256-GCM encryption | `0123...cdef` |
| `SLACK_CLIENT_ID` | Slack App Client ID | `...` |
| `SLACK_CLIENT_SECRET` | Slack App Client Secret | `...` |
| `SLACK_REDIRECT_URI` | Slack OAuth callback URL | `http://localhost:5000/api/integrations/slack/callback` |
| `SLACK_DEFAULT_CHANNEL` | Fallback Slack channel | `general` |
| `ADMIN_USER` / `ADMIN_PASS` | Basic Auth credentials for `/admin/queues` | `admin` / `changeme_in_production` |

---

## 7. Backend Setup

```bash
cd Backend
npm install
npx prisma generate
npx tsc
```

Start the API server and worker in separate terminals:

```bash
# Terminal 1 — API Server + Outbox Dispatchers + Recovery Monitor
npm run dev          # development (tsx watch)
# or
npm start            # production (node dist/server.js)

# Terminal 2 — BullMQ Email Worker
npm run dev:worker   # development (tsx watch)
# or
npm run start:worker # production (node dist/workers/email.worker.js)
```

---

## 8. Frontend Setup

```bash
cd Frontend
npm install
```

Set `Frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Run the Vite dev server:
```bash
npm run dev
```

---

## 9. Database Setup

Start PostgreSQL via Docker Compose (defined in `Backend/docker-compose.yml`):

```bash
cd Backend
docker-compose up -d postgres
```

Push schema / run migrations and generate Prisma client:

```bash
npx prisma migrate deploy   # or: npx prisma db push
npx prisma generate
```

*(Note: Prisma v7 is configured via `prisma.config.ts` and `@prisma/adapter-pg`.)*

---

## 10. Redis and BullMQ Setup

Redis runs with **AOF persistence enabled** (`--appendonly yes`) and a named volume (`redis_data:/data`) in `Backend/docker-compose.yml`:

```bash
cd Backend
docker-compose up -d redis
```

- Queue name: `email-queue` (`src/queue/email.queue.ts`)
- Bull Board monitoring UI: `http://localhost:5000/admin/queues` (Basic Auth: `ADMIN_USER` / `ADMIN_PASS`)

---

## 11. Ethereal Email Configuration

Ethereal SMTP is used for safe email testing without sending real external emails.

- **Per-user Ethereal Sender:** Call `POST /api/senders` with `{ "name": "...", "email": "...", "useEthereal": true }` (or `POST /api/emails/senders/ethereal`), which calls `createEtherealTestSender` via `nodemailer.createTestAccount()` and encrypts the SMTP password with AES-256-GCM before saving.
- **Preview URL:** When an email is sent, the worker saves `messageId` and `previewUrl` (`nodemailer.getTestMessageUrl(info)`) on `ScheduledEmail`, visible via `GET /api/emails/sent` and in the Frontend Dashboard.

---

## 12. Google OAuth Setup

1. Go to Google Cloud Console → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add `http://localhost:5173` to **Authorized JavaScript origins**.
4. Copy the Client ID into both `Backend/.env` (`GOOGLE_CLIENT_ID`) and `Frontend/.env` (`VITE_GOOGLE_CLIENT_ID`).

---

## 13. Slack OAuth Setup

1. Create a Slack App at `api.slack.com/apps`.
2. Under **OAuth & Permissions**, add Redirect URL:
   `http://localhost:5000/api/integrations/slack/callback`
3. Add Bot Token Scopes (`chat:write`, `incoming-webhook` / channel scopes as needed).
4. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI` in `Backend/.env`.
5. Connect from the Frontend `/slack` screen (`GET /api/integrations/slack/connect`). Tokens are stored encrypted using AES-256-GCM.

---

## 14. Elasticsearch Setup

Start Elasticsearch via Docker Compose:

```bash
cd Backend
docker-compose up -d elasticsearch
```

- Indexing happens asynchronously via `EmailIndexOutbox` (`src/services/email-index-outbox.service.ts`).
- If Elasticsearch is down, email scheduling and sending continue unaffected; pending index events are retried automatically when Elasticsearch comes back online.

---

## 15. API Documentation

All endpoints except `/health`, `/api/auth/google`, and `/api/integrations/slack/callback` require `Authorization: Bearer <jwt>`.

### Authentication (`/api/auth`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/google` | Verify Google ID token, upsert user, return JWT |
| `GET` | `/api/auth/me` | Return current authenticated user |
| `POST` | `/api/auth/logout` | Blacklist current JWT in Redis |

### Emails (`/api/emails`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/emails/parse-csv` | Upload CSV (`file`), validate & deduplicate emails |
| `POST` | `/api/emails/schedule` | Schedule campaign via `recipients[]` or CSV `file` |
| `GET` | `/api/emails/scheduled` | List `pending`, `queued`, `sending` emails |
| `GET` | `/api/emails/sent` | List `sent`, `failed`, `cancelled` emails |
| `GET` | `/api/emails/unknown` | List crash-uncertain `unknown` emails |
| `GET` | `/api/emails/:id` | Get single email details |
| `POST` | `/api/emails/:id/cancel` | Cancel a `pending`/`queued` email |
| `POST` | `/api/emails/:id/reconcile` | Reconcile `unknown` email (`mark_sent`, `mark_failed`, `retry`) |
| `GET` | `/api/emails/search?q=` | Search emails via Elasticsearch |

### Campaigns (`/api/campaigns`)
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/campaigns` | List user's campaigns |
| `GET` | `/api/campaigns/:id` | Get campaign details |
| `GET` | `/api/campaigns/:id/stats` | Get `sent`, `pending`, `failed`, `unknown`, `total` counts |

### Senders (`/api/senders`)
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/senders` | Create sender (supports `useEthereal: true`) |
| `GET` | `/api/senders` | List user's senders |
| `PUT` | `/api/senders/:id` | Update sender & invalidate cached transporter |
| `DELETE` | `/api/senders/:id` | Delete sender |

### Slack (`/api/integrations/slack`)
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/integrations/slack/connect` | Start Slack OAuth with Redis CSRF state |
| `GET` | `/api/integrations/slack/callback` | Exchange code, save encrypted token, redirect to FE |
| `GET` | `/api/integrations/slack/status` | Check connection status & `channelId` |
| `POST` | `/api/integrations/slack/disconnect` | Remove Slack connection |

---

## 16. Scheduling Architecture

- **No Cron Jobs Used:** We intentionally **did not use cron jobs** (e.g., `node-cron` polling the DB every minute). Cron polling introduces unnecessary database load, coarse 1-minute timing jitter, and complex distributed locking when scaling multiple workers.
- **How BullMQ Delayed Jobs Work:**
  1. When a campaign is scheduled, `ScheduledEmail` rows and an `OutboxEvent` are written in a single PostgreSQL transaction.
  2. The Outbox Dispatcher calls `addScheduledEmailsBulk()`, which computes `delay = Math.max(0, email.scheduledAt.getTime() - Date.now())` and enqueues each email with `jobId: \`email-${email.id}\`` into Redis.
  3. Redis stores delayed jobs in a sorted set scored by their exact execution timestamp. BullMQ promotes a job to `wait` at the exact millisecond its delay expires, and a worker picks it up immediately.

---

## 17. Persistence and Restart Recovery

- **Redis Persistence:** `docker-compose.yml` configures Redis with `redis-server --appendonly yes` (AOF) backed by the named volume `redis_data:/data`. Delayed BullMQ jobs and rate-limit sorted sets survive container/server restarts as long as the volume is preserved.
- **Post-Restart Recovery Flow (`src/services/recovery.service.ts`):**
  On API server startup (`src/server.ts`), `recoverPendingJobs()` executes three checks:
  1. **Stale `sending` recovery (`recoverStaleSendingEmails`):** Finds emails stuck in `sending` past `STALE_SENDING_THRESHOLD_MS` (default `2` minutes) and moves them to `unknown` (also runs every `60s` via `startStaleSendingMonitor`).
  2. **Pending Outbox recovery (`dispatchPendingOutboxEvents`):** Publishes any `OutboxEvent` records that were committed to PostgreSQL before a crash but not yet pushed to Redis.
  3. **Missing BullMQ job recovery:** Scans active `pending`/`queued` emails in PostgreSQL, checks `emailQueue.getJob(\`email-${email.id}\`)`, and re-enqueues any missing jobs via `addScheduledEmailsBulk()`.

---

## 18. Rate Limiting and Concurrency

- **Worker Concurrency:** Configured via `WORKER_CONCURRENCY` (default `5`) on the BullMQ `Worker` instance in `src/workers/email.worker.ts`. Up to 5 jobs are processed concurrently across the worker pool.
- **Per-Sender Rate Limiting (`src/services/rate-limit.service.ts`):**
  Enforced atomically in Redis using a **Lua script (`RESERVE_SLOT_LUA`)** operating on a Sorted Set (`email-rate:<senderId>`) representing a rolling 60-minute (`3,600,000 ms`) window:
  1. `ZREMRANGEBYSCORE` prunes entries older than `now - 1 hour`.
  2. Idempotency check (`ZSCORE`) returns the existing reserved timestamp if `emailId` already holds a slot.
  3. `ZCOUNT` counts reservations in the rolling window up to the candidate send time.
  4. If `windowCount < hourlyLimit`, the script reserves the slot (`ZADD`) and allows sending.
  5. If the limit is reached, it computes the exact `runAt` timestamp when the oldest blocking slot expires (`+ 1 hour`), triggers a deduplicated Slack alert (`notifyRateLimitBreach` via Redis `SET NX`), and the worker calls `await job.moveToDelayed(decision.runAt, token)` + `throw new DelayedError()` so the job is rescheduled without consuming a retry attempt.
- **Race Condition Handling Across Multiple Workers:**
  - Because `RESERVE_SLOT_LUA` executes inside Redis as a single atomic operation, concurrent workers cannot read the same count and oversubscribe a sender's hourly quota.
  - Inside PostgreSQL, workers perform an **atomic DB claim** (`prisma.scheduledEmail.updateMany` with `where: { id: emailId, status: { in: ["pending", "queued"] } }`). If two workers ever receive the same job, only the one with `claimed.count === 1` proceeds to SMTP delivery.

---

## 19. Delay Between Emails

Minimum delay between consecutive emails from the **same sender** (`MIN_EMAIL_DELAY_MS`, default `2000` ms) is enforced inside the same atomic `RESERVE_SLOT_LUA` script:

1. The script reads the highest score (`lastReservedAt`) from `email-rate:<senderId>` via `ZREVRANGE ... 0 0 WITHSCORES`.
2. It computes `candidate = math.max(now, lastReservedAt + minDelay)`.
3. Even when `WORKER_CONCURRENCY=5` pulls 5 jobs for the same sender simultaneously, each worker reserves a staggered slot (`t`, `t+2s`, `t+4s`, ...). Jobs whose `decision.runAt > Date.now()` are cleanly delayed via `job.moveToDelayed(decision.runAt, token)` + `DelayedError`.

---

## 20. Assumptions and Trade-offs

### Duplicate Email Prevention & SMTP Uncertainty

SMTP does not provide a universal provider-side idempotency key. If a worker hands an email to SMTP and crashes before updating `status = "sent"` in PostgreSQL, retrying blindly could deliver a duplicate email.

**Safeguards Implemented:**
| Safeguard | Implementation | Purpose |
|---|---|---|
| **Unique Email ID** | UUID primary key on `ScheduledEmail` | Unique identity per recipient |
| **Unique BullMQ Job ID** | `jobId: \`email-${email.id}\`` | Prevents duplicate queue jobs |
| **Atomic DB Claim** | `updateMany` where `status IN ('pending', 'queued')` | Only one worker can claim an email |
| **`sending` + `sendingStartedAt`** | Recorded before SMTP call | Tracks in-flight delivery |
| **Retry Policy** | `attempts: 5`, exponential backoff (`5000ms`) | Retries transient SMTP errors (`queued` → retry → `failed`) |
| **Stale `sending` Recovery** | Startup + 60s monitor → `unknown` | Flags crash-uncertain emails without auto-resending |

**Status Lifecycle:**
```text
pending ──▶ queued ──▶ sending ──┬──▶ sent     (SMTP accepted & DB updated)
                                 ├──▶ failed   (final retry exhausted)
                                 └──▶ unknown  (worker crashed/timed out mid-SMTP)
```

**At-Most-Once Trade-Off:**
- Transient SMTP failures (caught in `try/catch`) keep status `queued` until the final attempt fails (`failed`).
- Mid-SMTP crashes (`sending` timeout) transition to **`unknown`** rather than auto-retrying, prioritizing **no duplicate emails** over automatic crash retry. Operators can inspect `GET /api/emails/unknown` and manually resolve via `POST /api/emails/:id/reconcile` (`mark_sent`, `mark_failed`, or `retry`).

**Other Trade-Offs:**
- **Fail-Open Rate Limiter:** If Redis `eval` errors unexpectedly, `reserveEmailSlot` fails open so email delivery isn't permanently halted, while logging the error.
- **Eventual Consistency for Search:** Elasticsearch indexing is outbox-driven and asynchronous; search results may lag by a few seconds but remain resilient if Elasticsearch goes down.

---

## 21. Testing Instructions

See [`Backend/tests/README.md`](tests/README.md) for the full test guide. Quick summary:

1. **Start Infrastructure & App:**
   ```bash
   cd Backend
   docker-compose up -d redis postgres elasticsearch
   npx tsc
   node dist/server.js               # Terminal 1
   node dist/workers/email.worker.js # Terminal 2
   ```

2. **Set Auth Token (from Google login on Frontend `localStorage.getItem('token')`):**
   ```powershell
   $env:TEST_JWT_TOKEN = "<your_jwt_token>"
   ```

3. **Run Automated API & Edge-Case Suite:**
   ```bash
   node --env-file=.env tests/run-all-tests.mjs
   ```
   Covers single email scheduling, duplicate API requests, CSV duplicate filtering, cancel, Slack status, and Elasticsearch fallback.

4. **Run 1000-Email Load Test (Concurrency = 5):**
   ```bash
   node --env-file=.env tests/load-test-1000.mjs
   ```
   Monitor concurrency live on Bull Board: `http://localhost:5000/admin/queues`.

5. **Run Rate-Limit & Min-Delay Test (`hourlyLimit=10`, `delay=2000ms`):**
   ```bash
   node --env-file=.env tests/test-rate-limit.mjs
   ```

6. **Run Restart Survival Test:**
   ```bash
   node --env-file=.env tests/test-restart.mjs before
   # Stop API & worker, restart Redis (preserve volume), restart API & worker
   node --env-file=.env tests/test-restart.mjs after
   ```

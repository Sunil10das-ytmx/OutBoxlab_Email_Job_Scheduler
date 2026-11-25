# ReachInbox / OutBoxLab — Distributed Email Job Scheduler & Cold Outreach Platform

A production-grade, distributed cold email outreach and scheduling platform built with **Node.js, Express, TypeScript, Redis, BullMQ, PostgreSQL (Prisma), Elasticsearch, and React (Vite, Tailwind CSS)**.

---

## 📁 Repository Structure

```
OutBoxLab/
├── Backend/                 # Express, BullMQ, Redis, Prisma, Elasticsearch
│   ├── src/                 # Controllers, Services, Workers, Queues
│   ├── prisma/              # Schema & database migrations
│   ├── docker-compose.yml   # Redis & local services
│   └── README.md            # In-depth 21-section backend architectural documentation
│
├── Frontend/                # React 18, Vite, TypeScript, Tailwind CSS
│   ├── src/
│   │   ├── components/      # Header, Sidebar, Modal, Button, StatusBadge
│   │   ├── features/
│   │   │   ├── auth/        # Google OAuth Login & auth service
│   │   │   ├── emails/      # ComposeEmail, ScheduledEmails, SentEmails, EmailTable
│   │   │   └── slack/       # Slack rate limit alerting integration
│   │   ├── pages/           # Dashboard, Login, NotFound
│   │   └── services/        # Centralized Axios API client (api.ts)
│   └── README.md            # Frontend overview and setup instructions
│
├── docker-compose.yml       # Monorepo container services
└── README.md                # Project overview and run guide
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ or v20+
- **Docker**: For running Redis & Elasticsearch (or cloud hosted)
- **PostgreSQL**: Neon Cloud Postgres or local instance

### 2. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env     # Configure DATABASE_URL, REDIS_URL, GOOGLE_CLIENT_ID, etc.
npx prisma db push
npm run build
npm run dev
```
Backend runs on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd Frontend
npm install
cp .env.example .env     # Configure VITE_API_URL and VITE_GOOGLE_CLIENT_ID
npm run dev
```
Frontend runs on `http://localhost:5173`.

---

## ✨ Features
- **Deterministic Delayed Scheduling**: Powered by BullMQ delayed jobs with persistence on Redis (no cron jobs).
- **Per-Sender Rate Limiting**: Distributed Sliding Window rate limiting per sender per hour.
- **Transactional Outbox Pattern**: Crash-resilient email dispatching with restart recovery.
- **Duplicate Prevention**: Idempotency keys preventing double-sends during network retries.
- **Real Google OAuth & Dual Auth**: Supports both HTTP-only Cookies and Bearer Tokens.
- **Slack Alerting**: Instant notifications when sender hourly rate limits are approached or breached.
- **Full-Text Lead Search**: High-performance Elasticsearch indexing for emails and campaigns.
- **Cold Email Outreach UI**: Clean, light-theme interface with CSV upload, delay gaps, and status tracking.

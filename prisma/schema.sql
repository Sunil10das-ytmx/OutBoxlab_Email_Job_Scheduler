CREATE EXTENSION IF NOT EXISTS "pgcrypto";


DO $$ BEGIN
    CREATE TYPE campaign_status_enum AS ENUM (
        'DRAFT',
        'SCHEDULED',
        'IN_PROGRESS',
        'PAUSED',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE email_status_enum AS ENUM (
        'PENDING',
        'QUEUED',
        'SENDING',
        'SENT',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS email_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL CHECK (smtp_port > 0 AND smtp_port <= 65535),
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_senders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_senders_user_id ON email_senders(user_id);
CREATE INDEX IF NOT EXISTS idx_email_senders_active ON email_senders(is_active);

CREATE TRIGGER set_timestamp_email_senders
BEFORE UPDATE ON email_senders
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    delay_ms INTEGER NOT NULL DEFAULT 0 CHECK (delay_ms >= 0),
    hourly_limit INTEGER NOT NULL DEFAULT 50 CHECK (hourly_limit > 0),
    total_emails INTEGER NOT NULL DEFAULT 0 CHECK (total_emails >= 0),
    status campaign_status_enum NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaigns_sender FOREIGN KEY (sender_id) REFERENCES email_senders(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_sender_id ON campaigns(sender_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

CREATE TRIGGER set_timestamp_campaigns
BEFORE UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS scheduled_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    sequence_no INTEGER NOT NULL CHECK (sequence_no >= 1),
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status email_status_enum NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scheduled_emails_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_status_time
ON scheduled_emails(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_email_campaign
ON scheduled_emails(campaign_id, sequence_no);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_recipient
ON scheduled_emails(campaign_id, recipient_email);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_campaign_status
ON scheduled_emails(campaign_id, status);

CREATE TRIGGER set_timestamp_scheduled_emails
BEFORE UPDATE ON scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS slack_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    slack_team_id VARCHAR(100) NOT NULL,
    bot_token_encrypted TEXT NOT NULL,
    channel_id VARCHAR(100) NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_slack_connections_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_slack_channel UNIQUE(user_id, slack_team_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_slack_connections_user_id ON slack_connections(user_id);

CREATE TRIGGER set_timestamp_slack_connections
BEFORE UPDATE ON slack_connections
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


CREATE TABLE IF NOT EXISTS rate_limit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rate_limit_events_sender FOREIGN KEY (sender_id) REFERENCES email_senders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_sender_window ON rate_limit_events(sender_id, window_start);

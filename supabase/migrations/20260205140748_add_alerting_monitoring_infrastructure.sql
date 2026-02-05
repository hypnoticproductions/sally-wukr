/*
  # Add Alerting & Monitoring Infrastructure

  1. New Tables
    - `error_logs`
      - `id` (uuid, primary key)
      - `source` (text) - edge function name or service identifier
      - `error_type` (text) - categorized error type (webhook_failure, payment_failure, database_error, etc.)
      - `severity` (text) - critical, high, medium, low
      - `message` (text) - human-readable error message
      - `stack_trace` (text) - full error stack trace
      - `context` (jsonb) - additional context data (request_id, client_id, etc.)
      - `resolved` (boolean) - whether the error has been acknowledged/resolved
      - `resolved_at` (timestamptz) - when the error was resolved
      - `created_at` (timestamptz)

    - `webhook_failures`
      - `id` (uuid, primary key)
      - `webhook_log_id` (uuid) - reference to original webhook_logs entry
      - `source` (text) - calendly, stripe, telnyx
      - `event_type` (text) - specific webhook event type
      - `failure_reason` (text) - why it failed
      - `retry_count` (integer) - number of retry attempts
      - `max_retries` (integer) - maximum retries allowed
      - `next_retry_at` (timestamptz) - when to retry next
      - `status` (text) - pending, retrying, failed, resolved
      - `payload` (jsonb) - original webhook payload for retry
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `health_checks`
      - `id` (uuid, primary key)
      - `service` (text) - database, stripe, calendly, telnyx, manus
      - `status` (text) - healthy, degraded, down
      - `response_time_ms` (integer) - latency measurement
      - `details` (jsonb) - additional health check data
      - `checked_at` (timestamptz)

    - `alert_rules`
      - `id` (uuid, primary key)
      - `name` (text) - rule name
      - `error_type` (text) - which error type to monitor
      - `threshold` (integer) - error count threshold
      - `window_minutes` (integer) - time window for threshold
      - `severity` (text) - what severity to assign
      - `enabled` (boolean) - whether rule is active
      - `notification_channels` (jsonb) - array of channels to notify
      - `created_at` (timestamptz)

    - `alert_notifications`
      - `id` (uuid, primary key)
      - `alert_rule_id` (uuid) - which rule triggered this
      - `error_log_ids` (jsonb) - array of error log IDs that triggered
      - `channel` (text) - email, slack, webhook
      - `recipient` (text) - where notification was sent
      - `status` (text) - sent, failed, acknowledged
      - `sent_at` (timestamptz)
      - `acknowledged_at` (timestamptz)
      - `acknowledged_by` (text)

  2. Indexes
    - error_logs: source, error_type, severity, created_at, resolved
    - webhook_failures: source, status, next_retry_at
    - health_checks: service, checked_at
    - alert_notifications: status, sent_at

  3. Security
    - Enable RLS on all tables
    - Add service role policies for edge functions
*/

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  error_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message text NOT NULL,
  stack_trace text,
  context jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now()
);

-- Webhook Failures Table
CREATE TABLE IF NOT EXISTS webhook_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_log_id uuid REFERENCES webhook_logs(id),
  source text NOT NULL,
  event_type text NOT NULL,
  failure_reason text NOT NULL,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  next_retry_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'resolved')),
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Health Checks Table
CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms integer,
  details jsonb DEFAULT '{}'::jsonb,
  checked_at timestamptz DEFAULT now()
);

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  error_type text NOT NULL,
  threshold integer DEFAULT 3,
  window_minutes integer DEFAULT 60,
  severity text DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  enabled boolean DEFAULT true,
  notification_channels jsonb DEFAULT '["dashboard"]'::jsonb,
  cooldown_minutes integer DEFAULT 30,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Alert Notifications Table
CREATE TABLE IF NOT EXISTS alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id uuid REFERENCES alert_rules(id),
  error_log_ids jsonb DEFAULT '[]'::jsonb,
  channel text NOT NULL,
  recipient text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'acknowledged')),
  message text,
  sent_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text
);

-- Indexes for error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved) WHERE resolved = false;

-- Indexes for webhook_failures
CREATE INDEX IF NOT EXISTS idx_webhook_failures_source ON webhook_failures(source);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_status ON webhook_failures(status);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_next_retry ON webhook_failures(next_retry_at) WHERE status IN ('pending', 'retrying');

-- Indexes for health_checks
CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at DESC);

-- Indexes for alert_notifications
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_sent_at ON alert_notifications(sent_at DESC);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

-- Service role policies for edge functions (using service_role key)
CREATE POLICY "Service role can manage error_logs"
  ON error_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage webhook_failures"
  ON webhook_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage health_checks"
  ON health_checks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage alert_rules"
  ON alert_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage alert_notifications"
  ON alert_notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon role read access for dashboard (authenticated via anon key)
CREATE POLICY "Anon can read error_logs"
  ON error_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read webhook_failures"
  ON webhook_failures FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read health_checks"
  ON health_checks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read alert_rules"
  ON alert_rules FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read alert_notifications"
  ON alert_notifications FOR SELECT
  TO anon
  USING (true);

-- Insert default alert rules
INSERT INTO alert_rules (name, error_type, threshold, window_minutes, severity, notification_channels) VALUES
  ('High Payment Failure Rate', 'payment_failure', 3, 15, 'critical', '["dashboard"]'),
  ('Webhook Delivery Failures', 'webhook_failure', 5, 60, 'high', '["dashboard"]'),
  ('Edge Function Errors', 'function_error', 10, 60, 'high', '["dashboard"]'),
  ('Database Connection Issues', 'database_error', 2, 5, 'critical', '["dashboard"]'),
  ('External Service Down', 'service_unavailable', 1, 5, 'critical', '["dashboard"]')
ON CONFLICT DO NOTHING;

-- Add status column to webhook_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE webhook_logs ADD COLUMN status text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending'));
  END IF;
END $$;

-- Add processing_time_ms column to webhook_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_logs' AND column_name = 'processing_time_ms'
  ) THEN
    ALTER TABLE webhook_logs ADD COLUMN processing_time_ms integer;
  END IF;
END $$;

-- Add error_message column to webhook_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_logs' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE webhook_logs ADD COLUMN error_message text;
  END IF;
END $$;
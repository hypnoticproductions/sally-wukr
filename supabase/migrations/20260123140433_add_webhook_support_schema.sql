/*
  # Add Webhook Support Schema

  ## Overview
  This migration adds support for receiving webhooks from Manus and tracking their processing.

  ## New Tables
  
  ### `webhook_logs`
  Tracks all incoming webhook events from external systems (Manus, Stripe, etc.)
  - `id` (uuid, primary key) - Unique identifier
  - `source` (text) - Source system (e.g., 'manus', 'stripe')
  - `event_type` (text) - Type of event received
  - `payload` (jsonb) - Full webhook payload
  - `processed_at` (timestamptz) - When the webhook was processed
  - `created_at` (timestamptz) - When the log entry was created

  ## Modified Tables
  
  ### `clients`
  Add columns to track Manus workflow status and follow-ups:
  - `last_manus_update` (timestamptz) - Last time Manus updated this client
  - `manus_task_status` (text) - Status of the Manus task (e.g., 'pending', 'completed')
  - `next_follow_up` (timestamptz) - Scheduled follow-up time from Manus
  - `requires_follow_up` (boolean) - Flag for urgent follow-ups
  - `last_reminder_sent` (timestamptz) - Last reminder sent timestamp

  ## Security
  - Enable RLS on webhook_logs table
  - Service role can manage webhook logs (for edge functions)
  - Authenticated users can read webhook logs (for admin dashboard)
  - No public access to webhook_logs

  ## Important Notes
  - Webhook logs help with debugging and auditing
  - Client tracking columns support bidirectional Manus integration
  - All timestamps use UTC timezone
*/

-- ============================================================================
-- CREATE WEBHOOK LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ADD MANUS TRACKING COLUMNS TO CLIENTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_manus_update'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_manus_update timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'manus_task_status'
  ) THEN
    ALTER TABLE clients ADD COLUMN manus_task_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'next_follow_up'
  ) THEN
    ALTER TABLE clients ADD COLUMN next_follow_up timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'requires_follow_up'
  ) THEN
    ALTER TABLE clients ADD COLUMN requires_follow_up boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_reminder_sent'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_reminder_sent timestamptz;
  END IF;
END $$;

-- ============================================================================
-- ENABLE RLS ON WEBHOOK LOGS
-- ============================================================================

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES FOR WEBHOOK LOGS
-- ============================================================================

CREATE POLICY "Service role can manage webhook logs"
  ON webhook_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read webhook logs"
  ON webhook_logs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_next_follow_up ON clients(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_requires_follow_up ON clients(requires_follow_up) WHERE requires_follow_up = true;

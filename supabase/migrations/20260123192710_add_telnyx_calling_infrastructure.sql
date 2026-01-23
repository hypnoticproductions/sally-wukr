/*
  # Telnyx Calling Infrastructure

  ## Summary
  This migration creates the complete database schema for Telnyx voice calling integration,
  including tables for call tracking, recording management, and client phone numbers.

  ## Changes

  ### 1. New Tables
  
  #### `calls`
  Main table for tracking all inbound and outbound calls via Telnyx.
  - `id` (uuid, primary key) - Unique identifier for each call record
  - `client_id` (uuid, foreign key) - Links to clients table
  - `call_control_id` (text, unique) - Telnyx Call Control API identifier
  - `call_session_id` (text) - Telnyx session identifier for tracking call legs
  - `direction` (text) - Either 'inbound' or 'outbound'
  - `from_number` (text) - Caller's phone number
  - `to_number` (text) - Recipient's phone number
  - `call_state` (text) - Current state: initiated, ringing, answered, hangup, failed
  - `duration_seconds` (integer) - Total call duration in seconds
  - `recording_url` (text) - URL to Telnyx call recording
  - `transcript` (text) - Transcribed conversation text
  - `ai_summary` (text) - AI-generated summary of the call
  - `cost_usd` (numeric) - Call cost in USD
  - `answered_at` (timestamptz) - When call was answered
  - `ended_at` (timestamptz) - When call ended
  - `created_at` (timestamptz) - Record creation timestamp

  #### `call_attempts`
  Tracks retry attempts for failed or unanswered calls.
  - `id` (uuid, primary key) - Unique identifier
  - `client_id` (uuid, foreign key) - Links to clients table
  - `call_id` (uuid, foreign key, nullable) - Links to successful call if completed
  - `attempt_number` (integer) - Which retry attempt (1, 2, 3, etc.)
  - `status` (text) - no_answer, busy, failed, completed
  - `next_retry_at` (timestamptz) - When to retry next
  - `notes` (text) - Additional context about the attempt
  - `created_at` (timestamptz) - Record creation timestamp

  #### `call_recordings`
  Stores transcribed recordings and metadata for analysis.
  - `id` (uuid, primary key) - Unique identifier
  - `call_id` (uuid, foreign key) - Links to calls table
  - `recording_url` (text) - Telnyx storage URL
  - `recording_duration` (integer) - Duration in seconds
  - `channel_count` (integer) - 1 for mono, 2 for dual-channel
  - `transcript_text` (text) - Full transcription
  - `speaker_labels` (jsonb) - Speaker identification data
  - `sentiment_score` (numeric) - AI sentiment analysis (-1 to 1)
  - `action_items` (jsonb) - Extracted action items from call
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. Column Additions
  
  #### `clients` table
  - `phone_number` (text) - Client's phone number for calling
  - `phone_verified` (boolean) - Whether phone number is validated
  - `call_preferences` (jsonb) - Calling preferences and DNC status
  - `last_call_at` (timestamptz) - Timestamp of most recent call

  ### 3. Security
  - Enable RLS on all new tables
  - Authenticated users can view all calls (admin access)
  - Service role has full access for edge functions
  - Public users cannot access call data

  ### 4. Indexes
  - Index on call_control_id for fast webhook lookups
  - Index on client_id for call history queries
  - Index on call_state for filtering active calls
  - Index on next_retry_at for scheduled call processing
*/

-- Add phone number fields to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE clients 
    ADD COLUMN phone_number text,
    ADD COLUMN phone_verified boolean DEFAULT false,
    ADD COLUMN call_preferences jsonb DEFAULT '{"do_not_call": false, "preferred_time": "09:00-17:00", "timezone": "America/New_York"}'::jsonb,
    ADD COLUMN last_call_at timestamptz;
  END IF;
END $$;

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  call_control_id text UNIQUE,
  call_session_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  call_state text DEFAULT 'initiated' CHECK (call_state IN ('initiated', 'ringing', 'answered', 'hangup', 'failed', 'busy', 'no_answer')),
  duration_seconds integer DEFAULT 0,
  recording_url text,
  transcript text,
  ai_summary text,
  cost_usd numeric(10, 4),
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for calls
CREATE INDEX IF NOT EXISTS idx_calls_client_id ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_control_id ON calls(call_control_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_state ON calls(call_state);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);

-- Create call_attempts table
CREATE TABLE IF NOT EXISTS call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('no_answer', 'busy', 'failed', 'completed')),
  next_retry_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for call_attempts
CREATE INDEX IF NOT EXISTS idx_call_attempts_client_id ON call_attempts(client_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_next_retry_at ON call_attempts(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_attempts_status ON call_attempts(status);

-- Create call_recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  recording_url text NOT NULL,
  recording_duration integer,
  channel_count integer DEFAULT 1,
  transcript_text text,
  speaker_labels jsonb,
  sentiment_score numeric(3, 2),
  action_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for call_recordings
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id ON call_recordings(call_id);

-- Enable RLS on all tables
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calls table
CREATE POLICY "Authenticated users can view all calls"
  ON calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage all calls"
  ON calls FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for call_attempts table
CREATE POLICY "Authenticated users can view all call attempts"
  ON call_attempts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage all call attempts"
  ON call_attempts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for call_recordings table
CREATE POLICY "Authenticated users can view all recordings"
  ON call_recordings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage all recordings"
  ON call_recordings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
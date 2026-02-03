/*
  # Calendly Consultations Integration Schema

  ## Overview
  This migration adds support for tracking Calendly consultation bookings, enabling the dual-product offering system (Profile Retention + Strategy Consultations).

  ## New Tables
  
  ### `consultations`
  Tracks all consultation sessions scheduled through Calendly
  - `id` (uuid, primary key) - Unique consultation identifier
  - `client_id` (uuid, foreign key) - Links to clients table
  - `event_uri` (text, unique) - Calendly event URI from webhook
  - `invitee_uri` (text, unique) - Calendly invitee URI from webhook
  - `scheduled_at` (timestamptz) - When the consultation was booked
  - `event_start_time` (timestamptz) - Scheduled start time of meeting
  - `event_end_time` (timestamptz) - Scheduled end time of meeting
  - `status` (text) - Current status: scheduled, completed, cancelled, no_show, rescheduled
  - `meeting_link` (text) - Video conference URL (Zoom, Google Meet, etc)
  - `cancellation_reason` (text) - Reason provided when cancelled
  - `canceled_by` (text) - Who cancelled: host or invitee
  - `rescheduled` (boolean) - True if this was a reschedule event
  - `old_invitee_uri` (text) - URI of previous invitee (for reschedules)
  - `questions_and_answers` (jsonb) - Custom questions answered during booking
  - `timezone` (text) - Client's timezone
  - `tracking_data` (jsonb) - UTM parameters and tracking info
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Modified Tables
  
  ### `payment_transactions` (existing table - adding columns)
  - Added `product_type` (text) - Type: profile_retention or consultation
  - Added `stripe_session_id` (text) - Stripe checkout session ID
  - Added `calendly_event_uri` (text) - Calendly event URI for consultation payments
  - Added `payment_date` (timestamptz) - When payment was received
  
  ### `clients` (existing table - adding columns)
  - Added `has_active_consultation` (boolean) - Tracks if client has upcoming consultation
  - Added `consultation_count` (integer) - Number of consultations booked

  ## Indexes
  - `consultations.event_uri` - Fast webhook lookups
  - `consultations.invitee_uri` - Fast webhook lookups
  - `consultations.client_id` - Fast client consultation queries
  - `consultations.status` - Fast status filtering
  - `payment_transactions.product_type` - Fast product type filtering

  ## Security
  - RLS enabled on new consultations table
  - Policies restrict access to authenticated users only
  - Service role required for webhook operations

  ## Important Notes
  - Consultations flow through Calendly's Stripe integration
  - Profile retention flows through our Stripe integration
  - Both payment types tracked in payment_transactions with product_type differentiation
  - Webhook payload provides URIs that require additional API calls for full details
*/

-- Create consultations table
CREATE TABLE IF NOT EXISTS consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  event_uri text UNIQUE NOT NULL,
  invitee_uri text UNIQUE NOT NULL,
  scheduled_at timestamptz DEFAULT now(),
  event_start_time timestamptz,
  event_end_time timestamptz,
  status text DEFAULT 'scheduled',
  meeting_link text,
  cancellation_reason text,
  canceled_by text,
  rescheduled boolean DEFAULT false,
  old_invitee_uri text,
  questions_and_answers jsonb,
  timezone text,
  tracking_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT consultations_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled'))
);

-- Add new columns to payment_transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'product_type'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN product_type text DEFAULT 'profile_retention';
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_product_type_check 
      CHECK (product_type IN ('profile_retention', 'consultation'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN stripe_session_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'calendly_event_uri'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN calendly_event_uri text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN payment_date timestamptz DEFAULT now();
  END IF;
END $$;

-- Add new columns to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'has_active_consultation'
  ) THEN
    ALTER TABLE clients ADD COLUMN has_active_consultation boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'consultation_count'
  ) THEN
    ALTER TABLE clients ADD COLUMN consultation_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_consultations_event_uri ON consultations(event_uri);
CREATE INDEX IF NOT EXISTS idx_consultations_invitee_uri ON consultations(invitee_uri);
CREATE INDEX IF NOT EXISTS idx_consultations_client_id ON consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_event_start_time ON consultations(event_start_time);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_product_type ON payment_transactions(product_type);

-- Enable RLS on consultations
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consultations
CREATE POLICY "Service role can manage all consultations"
  ON consultations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view consultations"
  ON consultations
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on consultations
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
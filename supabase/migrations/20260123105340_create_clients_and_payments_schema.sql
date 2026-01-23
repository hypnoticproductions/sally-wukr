/*
  # Create Clients and Payment Tracking Schema

  ## Overview
  Creates tables to manage paid client profiles with 30-day retention and payment tracking.

  ## New Tables
  
  ### `clients`
  Tracks client profiles with payment status and business context
  - `id` (uuid, primary key) - Unique client identifier
  - `name` (text) - Full client name
  - `email` (text, unique) - Client email address
  - `company` (text) - Company name
  - `industry` (text, nullable) - Business industry
  - `pain_points` (text, nullable) - Extracted business challenges
  - `desired_outcome` (text, nullable) - Client goals
  - `payment_status` (text) - Status: free, paid, expired
  - `profile_expires_at` (timestamptz, nullable) - Profile expiration date (30 days from payment)
  - `stripe_customer_id` (text, nullable) - Stripe customer ID
  - `total_paid` (numeric) - Total amount paid
  - `payment_date` (timestamptz, nullable) - Most recent payment date
  - `returning_client` (boolean) - Whether client has returned
  - `client_value_score` (integer) - Conversation quality score (0-100)
  - `metadata` (jsonb) - Additional client data
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `payment_transactions`
  Audit trail for all payment transactions
  - `id` (uuid, primary key) - Unique transaction identifier
  - `client_id` (uuid, foreign key) - References clients table
  - `stripe_payment_intent_id` (text) - Stripe payment intent ID
  - `amount` (numeric) - Payment amount in dollars
  - `status` (text) - Transaction status: pending, succeeded, failed, refunded
  - `payment_method` (text) - Payment method type
  - `refund_reason` (text, nullable) - Reason for refund if applicable
  - `metadata` (jsonb) - Additional transaction data
  - `created_at` (timestamptz) - Transaction timestamp

  ### Updated Tables
  - Link sessions to clients via client_id
  - Link briefs to clients via client_id

  ## Security
  - Enable RLS on all tables
  - Allow public read/write for client creation (widget needs this)
  - Authenticated users can manage all records
  - Track payment security with Stripe

  ## Indexes
  - Index on client email for fast lookup
  - Index on payment_status for filtering
  - Index on profile_expires_at for expiration checks
  - Index on stripe_customer_id for Stripe operations
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  company text NOT NULL DEFAULT '',
  industry text,
  pain_points text,
  desired_outcome text,
  payment_status text NOT NULL DEFAULT 'free',
  profile_expires_at timestamptz,
  stripe_customer_id text,
  total_paid numeric DEFAULT 0,
  payment_date timestamptz,
  returning_client boolean DEFAULT false,
  client_value_score integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stripe_payment_intent_id text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  refund_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add client_id to sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE sessions ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add client_id to briefs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'briefs' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE briefs ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Clients policies: Allow public access for widget functionality
CREATE POLICY "Anyone can create clients"
  ON clients FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read clients"
  ON clients FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update clients"
  ON clients FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- Payment transactions policies
CREATE POLICY "Anyone can create transactions"
  ON payment_transactions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read transactions"
  ON payment_transactions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can update transactions"
  ON payment_transactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_payment_status ON clients(payment_status);
CREATE INDEX IF NOT EXISTS idx_clients_profile_expires_at ON clients(profile_expires_at);
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_briefs_client_id ON briefs(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_client_id ON payment_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_id ON payment_transactions(stripe_payment_intent_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_clients_updated_at'
  ) THEN
    CREATE TRIGGER update_clients_updated_at
      BEFORE UPDATE ON clients
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
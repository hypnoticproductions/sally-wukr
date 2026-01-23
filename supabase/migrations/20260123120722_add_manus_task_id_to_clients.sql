/*
  # Add Manus Integration Support

  ## Overview
  Adds Manus task tracking to clients table for workflow automation integration.

  ## Changes
  
  ### Updated Tables
  - `clients` table: Add `manus_task_id` column to track associated Manus tasks

  ## Details
  - New column stores the Manus API task ID returned when a client task is created
  - Allows tracking of workflow automation in Richard's Manus system
  - Optional field - only populated when Manus integration is active
  - Indexed for fast lookup when syncing task status

  ## Purpose
  When a client pays for the 30-day profile retention:
  1. Payment is processed via Stripe
  2. Client record is updated in Supabase
  3. Manus task is automatically created in Richard's workflow
  4. Task ID is stored in this column for reference

  This creates a seamless handoff from Sally to Richard's workflow management system.
*/

-- Add manus_task_id column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'manus_task_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN manus_task_id text;
  END IF;
END $$;

-- Create index for Manus task ID lookups
CREATE INDEX IF NOT EXISTS idx_clients_manus_task_id ON clients(manus_task_id);

-- Update RLS policies (no changes needed - existing policies cover the new column)

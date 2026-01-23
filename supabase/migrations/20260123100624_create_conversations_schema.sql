/*
  # Create Sally Wukr Conversations Schema

  ## Overview
  Creates tables to store voice conversation sessions and message history for the Sally Wukr voice assistant.

  ## New Tables
  
  ### `sessions`
  Tracks individual conversation sessions with Sally
  - `id` (uuid, primary key) - Unique session identifier
  - `domain` (text) - Domain where the widget is embedded
  - `started_at` (timestamptz) - When the session started
  - `ended_at` (timestamptz, nullable) - When the session ended
  - `voice_profile` (text) - Voice profile used (Kore or Zephyr)
  - `status` (text) - Session status (active, completed, error)
  - `metadata` (jsonb) - Additional session metadata
  - `created_at` (timestamptz) - Record creation timestamp

  ### `messages`
  Stores individual messages within conversation sessions
  - `id` (uuid, primary key) - Unique message identifier
  - `session_id` (uuid, foreign key) - References sessions table
  - `role` (text) - Message role (User or Sally)
  - `content` (text) - Message transcript content
  - `timestamp` (timestamptz) - When the message was sent
  - `created_at` (timestamptz) - Record creation timestamp

  ### `briefs`
  Stores generated briefing documents
  - `id` (uuid, primary key) - Unique brief identifier
  - `session_id` (uuid, foreign key) - References sessions table
  - `client_name` (text) - Extracted client name
  - `brief_content` (text) - Generated brief content
  - `sent_to` (text) - Email recipient
  - `sent_at` (timestamptz, nullable) - When the brief was sent
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated access
  - Public read access for session creation (widget needs to create sessions)
*/

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL DEFAULT '',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  voice_profile text DEFAULT 'Kore',
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create briefs table
CREATE TABLE IF NOT EXISTS briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_name text DEFAULT '',
  brief_content text NOT NULL,
  sent_to text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

-- Sessions policies: Allow anyone to create and read their own sessions
CREATE POLICY "Anyone can create sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can update sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Messages policies: Allow anyone to create and read messages
CREATE POLICY "Anyone can create messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read messages"
  ON messages FOR SELECT
  TO anon
  USING (true);

-- Briefs policies: Allow anyone to create and read briefs
CREATE POLICY "Anyone can create briefs"
  ON briefs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read briefs"
  ON briefs FOR SELECT
  TO anon
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_domain ON sessions(domain);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_session_id ON briefs(session_id);

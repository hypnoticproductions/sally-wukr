/*
  # Create Quintapoo Task Knowledge Base Schema

  ## Overview
  Creates a comprehensive knowledge base for tracking all Manus tasks, deliverables, and metadata.
  This serves as the source of truth for all client work managed through the Manus workflow system.

  ## New Tables
  
  ### `tasks`
  Central task registry storing all work items from Manus
  - `id` (uuid, primary key) - Internal unique identifier
  - `manus_task_id` (text, unique) - Manus API task ID (source of truth reference)
  - `client_id` (uuid, foreign key) - Links to clients table
  - `brief_content` (text) - Original client brief or task description
  - `task_description` (text) - Detailed task description from Manus
  - `status` (text) - Task status: created, in_progress, completed, cancelled
  - `priority` (text) - Task priority: low, medium, high
  - `context` (jsonb) - Full task context and metadata from Manus
  - `created_at` (timestamptz) - Task creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `completed_at` (timestamptz, nullable) - Task completion timestamp

  ### `task_deliverables`
  Stores all completed work, results, and deliverables for tasks
  - `id` (uuid, primary key) - Unique deliverable identifier
  - `task_id` (uuid, foreign key) - References tasks table
  - `deliverable_type` (text) - Type: document, report, call_summary, email, file, other
  - `title` (text) - Deliverable title or name
  - `content` (text, nullable) - Text content or description
  - `file_url` (text, nullable) - URL to file storage if applicable
  - `metadata` (jsonb) - Additional deliverable metadata
  - `created_at` (timestamptz) - Deliverable creation timestamp

  ### `task_metadata`
  Flexible key-value storage for additional task context and tracking
  - `id` (uuid, primary key) - Unique metadata entry identifier
  - `task_id` (uuid, foreign key) - References tasks table
  - `key` (text) - Metadata key name
  - `value` (jsonb) - Metadata value (supports complex objects)
  - `created_at` (timestamptz) - Entry creation timestamp

  ## Security
  - Enable RLS on all tables
  - Service role has full access (for webhook edge functions)
  - Authenticated users can read all data (for admin dashboard)
  - No public/anonymous access to task data

  ## Indexes
  - Index on manus_task_id for webhook lookups
  - Index on client_id for client task queries
  - Index on task status for filtering active work
  - Index on created_at for chronological queries
  - Full-text search indexes on task_description and deliverable content

  ## Important Notes
  - This creates the source of truth for all Manus workflow tasks
  - Webhooks from Manus populate and update these tables
  - Sally queries this data to understand client history and context
  - Deliverables preserve all completed work for future reference
*/

-- ============================================================================
-- CREATE TASKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manus_task_id text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  brief_content text NOT NULL DEFAULT '',
  task_description text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  priority text NOT NULL DEFAULT 'medium',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================================
-- CREATE TASK DELIVERABLES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  content text,
  file_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- CREATE TASK METADATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_metadata ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES FOR TASKS
-- ============================================================================

CREATE POLICY "Service role can manage tasks"
  ON tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE RLS POLICIES FOR TASK DELIVERABLES
-- ============================================================================

CREATE POLICY "Service role can manage deliverables"
  ON task_deliverables FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read deliverables"
  ON task_deliverables FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE RLS POLICIES FOR TASK METADATA
-- ============================================================================

CREATE POLICY "Service role can manage task metadata"
  ON task_metadata FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read task metadata"
  ON task_metadata FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_manus_task_id ON tasks(manus_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_deliverables_task_id ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_type ON task_deliverables(deliverable_type);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_created_at ON task_deliverables(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_metadata_task_id ON task_metadata(task_id);
CREATE INDEX IF NOT EXISTS idx_task_metadata_key ON task_metadata(key);

-- ============================================================================
-- CREATE FULL-TEXT SEARCH INDEXES
-- ============================================================================

-- Add tsvector columns for full-text search
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE task_deliverables ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create indexes on tsvector columns
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_search ON task_deliverables USING gin(search_vector);

-- Create function to update task search vector
CREATE OR REPLACE FUNCTION update_task_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.task_description, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.brief_content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update deliverable search vector
CREATE OR REPLACE FUNCTION update_deliverable_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic search vector updates
DROP TRIGGER IF EXISTS tasks_search_vector_update ON tasks;
CREATE TRIGGER tasks_search_vector_update
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_search_vector();

DROP TRIGGER IF EXISTS task_deliverables_search_vector_update ON task_deliverables;
CREATE TRIGGER task_deliverables_search_vector_update
  BEFORE INSERT OR UPDATE ON task_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_deliverable_search_vector();

-- ============================================================================
-- CREATE TRIGGER FOR TASKS UPDATED_AT
-- ============================================================================

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREATE MATERIALIZED VIEW FOR TASK SUMMARY
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS task_summary AS
SELECT 
  t.id,
  t.manus_task_id,
  t.client_id,
  c.name as client_name,
  c.email as client_email,
  t.task_description,
  t.status,
  t.priority,
  t.created_at,
  t.updated_at,
  t.completed_at,
  COUNT(DISTINCT td.id) as deliverables_count,
  ARRAY_AGG(DISTINCT td.deliverable_type) FILTER (WHERE td.deliverable_type IS NOT NULL) as deliverable_types
FROM tasks t
LEFT JOIN clients c ON t.client_id = c.id
LEFT JOIN task_deliverables td ON t.id = td.task_id
GROUP BY t.id, c.name, c.email;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_summary_id ON task_summary(id);
CREATE INDEX IF NOT EXISTS idx_task_summary_client_id ON task_summary(client_id);
CREATE INDEX IF NOT EXISTS idx_task_summary_status ON task_summary(status);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_task_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY task_summary;
END;
$$ LANGUAGE plpgsql;

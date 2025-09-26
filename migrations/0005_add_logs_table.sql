-- Add logs table for logger-service integration
-- Migration: 0005_add_logs_table

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  severity TEXT NOT NULL,
  category TEXT,
  source TEXT,
  component TEXT,
  endpoint TEXT,
  environment TEXT,
  message TEXT NOT NULL,
  error_type TEXT,
  error_code TEXT,
  stack_trace TEXT,
  user_id TEXT,
  session_id TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT DEFAULT '{}',
  tags TEXT DEFAULT '[]',
  duration INTEGER,
  memory_usage INTEGER,
  feature TEXT,
  workflow TEXT,
  version TEXT,
  processed_at TEXT NOT NULL,
  processing_time INTEGER,
  categorization_confidence REAL,
  patterns TEXT DEFAULT '[]',
  triage_level TEXT,
  triage_actions TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for efficient log queries
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_component ON logs(component);
CREATE INDEX IF NOT EXISTS idx_logs_environment ON logs(environment);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);
CREATE INDEX IF NOT EXISTS idx_logs_request_id ON logs(request_id);
CREATE INDEX IF NOT EXISTS idx_logs_feature ON logs(feature);
CREATE INDEX IF NOT EXISTS idx_logs_triage_level ON logs(triage_level);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_logs_timestamp_severity ON logs(timestamp, severity);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp_category ON logs(timestamp, category);
CREATE INDEX IF NOT EXISTS idx_logs_environment_timestamp ON logs(environment, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_component_timestamp ON logs(component, timestamp);
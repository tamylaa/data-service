-- Add files table for content store metadata
-- Migration: 0003_add_files_table

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  is_public INTEGER DEFAULT 0,
  category TEXT,
  checksum TEXT,
  last_accessed_at TEXT,
  download_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_is_public ON files(is_public);
CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);

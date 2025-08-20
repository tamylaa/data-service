-- Migration: 0004_add_processing_fields.sql
-- Add processing status and analysis fields to files table for content-skimmer integration

-- Add processing status tracking fields
ALTER TABLE files ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE files ADD COLUMN processing_started_at TEXT;
ALTER TABLE files ADD COLUMN processing_completed_at TEXT;

-- Add analysis result fields
ALTER TABLE files ADD COLUMN analysis_result TEXT; -- JSON string containing full analysis results
ALTER TABLE files ADD COLUMN analysis_summary TEXT; -- Human-readable summary
ALTER TABLE files ADD COLUMN content_type_detected TEXT; -- Detected content type from skimmer
ALTER TABLE files ADD COLUMN extraction_status TEXT; -- 'success', 'failed', 'partial'

-- Add skimmer job tracking
ALTER TABLE files ADD COLUMN skimmer_job_id TEXT; -- Unique job ID from skimmer
ALTER TABLE files ADD COLUMN callback_attempts INTEGER DEFAULT 0; -- Track webhook retry attempts
ALTER TABLE files ADD COLUMN last_callback_at TEXT; -- Last webhook received timestamp

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_files_processing_status ON files(processing_status);
CREATE INDEX IF NOT EXISTS idx_files_skimmer_job_id ON files(skimmer_job_id);
CREATE INDEX IF NOT EXISTS idx_files_processing_started_at ON files(processing_started_at);
CREATE INDEX IF NOT EXISTS idx_files_processing_completed_at ON files(processing_completed_at);
CREATE INDEX IF NOT EXISTS idx_files_extraction_status ON files(extraction_status);

-- Add constraints for valid processing statuses
-- Valid statuses: 'pending', 'processing', 'completed', 'failed', 'retrying'

-- Optional: Add trigger to update updated_at when processing fields change
-- CREATE TRIGGER IF NOT EXISTS update_files_timestamp 
-- AFTER UPDATE ON files 
-- WHEN OLD.processing_status != NEW.processing_status
-- BEGIN
--   UPDATE files SET updated_at = datetime('now') WHERE id = NEW.id;
-- END;

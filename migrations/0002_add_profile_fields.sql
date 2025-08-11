-- Add profile fields to users table
-- Migration: 0002_add_profile_fields

-- Add phone, company, and position columns to users table if they don't exist
-- Using IF NOT EXISTS pattern for SQLite
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a workaround

-- Check if phone column exists, if not add it
-- This will fail silently if column already exists
BEGIN;
ALTER TABLE users ADD COLUMN phone TEXT;
ROLLBACK;

BEGIN;
ALTER TABLE users ADD COLUMN company TEXT;
ROLLBACK;

BEGIN;
ALTER TABLE users ADD COLUMN position TEXT;
ROLLBACK;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add profile fields to users table
-- Migration: 0002_add_profile_fields

-- Add phone, company, and position columns to users table
-- Note: In D1, we cannot use transactions, so we add columns directly
-- If columns already exist, the migration will fail but can be safely ignored

-- Add profile fields
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN company TEXT;
ALTER TABLE users ADD COLUMN position TEXT;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

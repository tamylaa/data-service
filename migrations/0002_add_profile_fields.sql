-- Add profile fields to users table
-- Migration: 0002_add_profile_fields

-- Add phone, company, and position columns to users table
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN company TEXT;
ALTER TABLE users ADD COLUMN position TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

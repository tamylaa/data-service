-- Consolidated Database Schema
-- This file replaces all previous migration files and serves as the single source of truth
-- for the database schema.

-- Users table - stores user account information
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  is_email_verified INTEGER DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Magic links table - for email-based authentication
CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_used INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Tokens table - for various token types (JWT, refresh, etc.)
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Indexes for magic_links table
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links(expires_at);

-- Indexes for tokens table
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);

-- Unique index for unused tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_token 
ON tokens(token) 
WHERE is_used = 0;

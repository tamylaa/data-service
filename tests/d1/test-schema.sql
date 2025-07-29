-- Test schema for BaseD1Client
CREATE TABLE IF NOT EXISTS test_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TEXT NOT NULL
);

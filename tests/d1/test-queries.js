// Test queries to run against the D1 client

export const createTableQuery = `
CREATE TABLE IF NOT EXISTS test_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TEXT NOT NULL
)`;

export const insertUserQuery = `
INSERT INTO test_users (id, name, email, created_at) 
VALUES (?, ?, ?, ?)`;

export const selectUserQuery = `
SELECT * FROM test_users 
WHERE id = ?`;

export const selectAllUsersQuery = `
SELECT * FROM test_users 
ORDER BY created_at DESC`;

export const updateUserQuery = `
UPDATE test_users 
SET name = ?, email = ? 
WHERE id = ?`;

export const deleteUserQuery = `
DELETE FROM test_users 
WHERE id = ?`;

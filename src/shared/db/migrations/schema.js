/**
 * Database Schema
 * Defines the database schema and provides migration utilities
 */

export const SCHEMA_VERSION = 1;

// Define each SQL statement as a separate string in an array
export const INITIAL_SCHEMA = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    is_email_verified INTEGER DEFAULT 0,
    last_login TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  
  // Magic links table
  `CREATE TABLE IF NOT EXISTS magic_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    is_used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
  
  // Files table
  `CREATE TABLE IF NOT EXISTS files (
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
    download_count INTEGER DEFAULT 0
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token)`,
  `CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_files_owner_id ON files(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_files_storage_path ON files(storage_path)`,
  `CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at)`
];

/**
 * Get migration SQL for a specific version
 * @param {number} version - Target schema version
 * @returns {string} SQL for the specified version
 */
export function getMigration(version) {
  switch (version) {
    case 1:
      return INITIAL_SCHEMA;
    // Add future migrations here
    default:
      throw new Error(`No migration found for version ${version}`);
  }
}

/**
 * Get all migrations up to a specific version
 * @param {number} targetVersion - Target schema version
 * @returns {Array<string>} Array of SQL statements to execute
 */
export function getMigrationsUpTo(targetVersion) {
  let statements = [];
  for (let v = 1; v <= targetVersion; v++) {
    const migration = getMigration(v);
    if (Array.isArray(migration)) {
      // If it's an array, add each statement
      statements.push(...migration.map(stmt => stmt.trim()));
    } else if (typeof migration === 'string') {
      // If it's a string, split it into statements
      statements.push(...migration.split(';').map(s => s.trim()).filter(s => s.length > 0));
    }
  }
  return statements;
}

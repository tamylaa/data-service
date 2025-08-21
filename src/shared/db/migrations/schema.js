/**
 * Database Schema
 * Defines the database schema and provides migration utilities
 */

export const SCHEMA_VERSION = 2;

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

// Query learning schema (version 2)
export const QUERY_LEARNING_SCHEMA = [
  // Query Events Table
  `CREATE TABLE IF NOT EXISTS query_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    query_text TEXT NOT NULL,
    search_engine TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    result_count INTEGER NOT NULL,
    response_time INTEGER NOT NULL,
    results_clicked TEXT,
    follow_up_queries TEXT,
    task_completed BOOLEAN DEFAULT FALSE
  )`,

  // Query Sessions Table
  `CREATE TABLE IF NOT EXISTS query_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    status TEXT DEFAULT 'active',
    task_context TEXT
  )`,

  // Query Patterns Table
  `CREATE TABLE IF NOT EXISTS query_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pattern_text TEXT NOT NULL,
    frequency INTEGER NOT NULL,
    success_rate REAL NOT NULL,
    avg_response_time REAL NOT NULL,
    last_updated DATETIME NOT NULL,
    UNIQUE(user_id, pattern_text)
  )`,

  // Query learning indexes
  `CREATE INDEX IF NOT EXISTS idx_query_user_timestamp ON query_events(user_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_query_session ON query_events(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_query_text ON query_events(query_text)`,
  `CREATE INDEX IF NOT EXISTS idx_session_user ON query_sessions(user_id, start_time)`,
  `CREATE INDEX IF NOT EXISTS idx_patterns_user ON query_patterns(user_id, frequency DESC)`
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
    case 2:
      return QUERY_LEARNING_SCHEMA;
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

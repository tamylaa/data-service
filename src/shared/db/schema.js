/**
 * Database Schema Definition
 * This is the single source of truth for the database schema.
 * All migrations and test databases should use these definitions.
 */

export const DATABASE_SCHEMA = {
  // Users table - stores user account information
  users: {
    name: 'users',
    columns: [
      { name: 'id', type: 'TEXT', constraints: ['PRIMARY KEY'] },
      { name: 'email', type: 'TEXT', constraints: ['NOT NULL', 'UNIQUE'] },
      { name: 'name', type: 'TEXT' },
      { name: 'is_email_verified', type: 'INTEGER', constraints: ['DEFAULT 0'] },
      { name: 'last_login', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'updated_at', type: 'TEXT', constraints: ['NOT NULL'] }
    ],
    indexes: [
      { columns: ['email'], unique: true }
    ]
  },
  
  // Magic links table - for email-based authentication
  magic_links: {
    name: 'magic_links',
    columns: [
      { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY', 'AUTOINCREMENT'] },
      { name: 'user_id', type: 'TEXT', constraints: ['NOT NULL', 'REFERENCES users(id) ON DELETE CASCADE'] },
      { name: 'token', type: 'TEXT', constraints: ['NOT NULL', 'UNIQUE'] },
      { name: 'is_used', type: 'INTEGER', constraints: ['DEFAULT 0'] },
      { name: 'expires_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'updated_at', type: 'TEXT', constraints: ['NOT NULL'] }
    ],
    indexes: [
      { columns: ['token'], unique: true },
      { columns: ['user_id'] },
      { columns: ['expires_at'] }
    ]
  },
  
  // Tokens table - for various token types (JWT, refresh, etc.)
  tokens: {
    name: 'tokens',
    columns: [
      { name: 'id', type: 'TEXT', constraints: ['PRIMARY KEY'] },
      { name: 'user_id', type: 'TEXT', constraints: ['NOT NULL', 'REFERENCES users(id) ON DELETE CASCADE'] },
      { name: 'token', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'type', type: 'TEXT', constraints: ['NOT NULL'] }, // 'access', 'refresh', 'verification', etc.
      { name: 'expires_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'is_used', type: 'INTEGER', constraints: ['DEFAULT 0'] },
      { name: 'metadata', type: 'TEXT', constraints: ['DEFAULT "{}"'] },
      { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'updated_at', type: 'TEXT', constraints: ['NOT NULL'] }
    ],
    indexes: [
      { columns: ['token'] },
      { columns: ['user_id'] },
      { columns: ['type'] },
      { columns: ['expires_at'] },
      { 
        columns: ['token'], 
        unique: true,
        where: 'is_used = 0',
        name: 'idx_unique_token'
      }
    ]
  },

  // Files table - stores file metadata for content store
  files: {
    name: 'files',
    columns: [
      { name: 'id', type: 'TEXT', constraints: ['PRIMARY KEY'] },
      { name: 'original_filename', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'file_size', type: 'INTEGER', constraints: ['NOT NULL'] },
      { name: 'mime_type', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'owner_id', type: 'TEXT', constraints: ['NOT NULL'] },
      { name: 'storage_path', type: 'TEXT', constraints: ['NOT NULL', 'UNIQUE'] },
      { name: 'is_public', type: 'INTEGER', constraints: ['DEFAULT 0'] },
      { name: 'category', type: 'TEXT' },
      { name: 'checksum', type: 'TEXT' },
      { name: 'last_accessed_at', type: 'TEXT' },
      { name: 'download_count', type: 'INTEGER', constraints: ['DEFAULT 0'] }
    ],
    indexes: [
      { columns: ['owner_id'] },
      { columns: ['checksum'] },
      { columns: ['storage_path'], unique: true },
      { columns: ['created_at'] }
    ]
  }
};

/**
 * Generate SQL for creating all tables
 * @returns {string} SQL statements for creating all tables and indexes
 */
export function generateSchemaSQL() {
  const statements = [];
  
  // Create tables
  Object.values(DATABASE_SCHEMA).forEach(table => {
    const columns = [
      ...table.columns.map(col => 
        [col.name, col.type, ...(col.constraints || [])].join(' ')
      )
    ].join(',\n  ');
    
    statements.push(`
-- ${table.name} table
CREATE TABLE IF NOT EXISTS ${table.name} (
  ${columns}
);`);
  });
  
  // Create indexes
  Object.values(DATABASE_SCHEMA).forEach(table => {
    (table.indexes || []).forEach((index, i) => {
      const indexName = index.name || `idx_${table.name}_${index.columns.join('_')}`;
      const whereClause = index.where ? ` WHERE ${index.where}` : '';
      statements.push(`
-- Index for ${table.name}.${index.columns.join(', ')}
CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${indexName}
ON ${table.name}(${index.columns.join(', ')})${whereClause};`);
    });
  });
  
  return statements.join('\n\n');
}

/**
 * Initialize database tables
 * @param {Object} db - Database connection object
 * @returns {Promise<void>}
 */
export async function initializeDatabase(db) {
  const sql = generateSchemaSQL();
  await db.exec(sql);
}

/**
 * Get the schema for a specific table
 * @param {string} tableName - Name of the table
 * @returns {Object} Table schema definition
 */
export function getTableSchema(tableName) {
  return DATABASE_SCHEMA[tableName];
}

/**
 * Get all table names
 * @returns {string[]} Array of table names
 */
export function getTableNames() {
  return Object.keys(DATABASE_SCHEMA);
}

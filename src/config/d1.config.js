/**
 * D1 Database Configuration
 * 
 * This file contains the configuration for the D1 database.
 * It exports functions to interact with the D1 database.
 */

import { generateSchemaSQL } from '../shared/db/schema.js';

/**
 * Get a D1 database instance
 * @param {Object} env - The environment object (from Cloudflare Workers)
 * @returns {Object} The D1 database instance
 */
export function getD1Client(env) {
  if (!env.DB) {
    throw new Error('DB binding is not available in the environment');
  }
  return env.DB;
}

/**
 * D1 database schema version
 * Increment this when making schema changes
 */
export const DB_SCHEMA_VERSION = 2; // Bumped version for schema updates

/**
 * Generate the database schema SQL
 * @returns {string} SQL statements for creating all tables and indexes
 */
function getDatabaseSchema() {
  return generateSchemaSQL();
}

/**
 * Get the schema for a specific table
 * @param {string} tableName - The name of the table
 * @returns {Object} The table schema definition
 */
function getTableSchema(tableName) {
  const { DATABASE_SCHEMA } = require('../shared/db/schema.js');
  return DATABASE_SCHEMA[tableName];
}

/**
 * Database tables and their schemas
 * Used for initialization and migrations
 */
export const DB_TABLES = {
  USERS: {
    name: 'users',
    get schema() {
      return getTableSchema('users');
    },
    get indexes() {
      return [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
      ];
    }
  },
  MAGIC_LINKS: {
    name: 'magic_links',
    get schema() {
      return getTableSchema('magic_links');
    },
    get indexes() {
      return [
        'CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token)',
        'CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON magic_links(expires_at)'
      ];
    }
  },
  TOKENS: {
    name: 'tokens',
    get schema() {
      return getTableSchema('tokens');
    },
    get indexes() {
      return [
        'CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token)',
        'CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type)',
        'CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at)'
      ];
    }
  }
};

/**
 * Initialize the database with the required tables and indexes
 * @param {Object} db - The D1 database instance
 * @returns {Promise<void>}
 */
export async function initializeDatabase(db) {
  try {
    console.log('Initializing database with consolidated schema...');
    
    // Generate and execute the schema SQL
    const schemaSQL = getDatabaseSchema();
    const statements = schemaSQL.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const sql of statements) {
      if (!sql) continue;
      try {
        await db.prepare(sql).run();
      } catch (err) {
        console.error(`Error executing SQL: ${sql}`, err);
        throw err;
      }
    }
    
    // Create indexes
    for (const table of Object.values(DB_TABLES)) {
      for (const index of table.indexes || []) {
        try {
          await db.prepare(index).run();
        } catch (err) {
          console.error(`Error creating index: ${index}`, err);
          throw err;
        }
      }
    }
    
    console.log('Database initialized successfully with consolidated schema');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export default {
  getD1Client,
  DB_SCHEMA_VERSION,
  DB_TABLES,
  initializeDatabase
};

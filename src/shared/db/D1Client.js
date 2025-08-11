/**
 * D1Client extending BaseD1Client with model-specific functionality
 */

import { BaseD1Client } from '../clients/d1/BaseD1Client.js';
import { UserClient } from '../clients/d1/UserClient.js';
import { MagicLinkClient } from '../clients/d1/MagicLinkClient.js';
import { TokenClient } from '../clients/d1/TokenClient.js';
import { getMigrationsUpTo, SCHEMA_VERSION } from './migrations/schema.js';

// Web Crypto API shim for Cloudflare Workers
const crypto = {
  randomUUID: () => globalThis.crypto.randomUUID()
};

export class D1Client extends BaseD1Client {
  /**
   * Create a new D1Client instance
   * @param {D1Database} db - D1 database instance
   */
  constructor(db) {
    super(db);
    this.isInitialized = false;
    
    // Initialize sub-clients
    this.users = new UserClient(db);
    this.magicLinks = new MagicLinkClient(db);
    this.tokens = new TokenClient(db);
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
  }

  /**
   * Initialize the database client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    
    // Run migrations
    await this.runMigrations();
    
    this.isInitialized = true;
  }

  /**
   * Run database migrations
   * @private
   */
  async runMigrations() {
    try {
      // Get all migrations up to the current schema version
      const migrations = getMigrationsUpTo(SCHEMA_VERSION);
      
      // Run each migration
      for (const migration of migrations) {
        await this.db.batch(
          migration.up.map(sql => this.db.prepare(sql))
        );
      }
      
      console.log(`✅ Database migrations completed (v${SCHEMA_VERSION})`);
    } catch (error) {
      console.error('❌ Failed to run database migrations:', error);
      throw error;
    }
  }
}

// Export a singleton instance for the application
let d1ClientInstance = null;

/**
 * Get the D1 client instance
 * @param {D1Database} db - D1 database instance
 * @returns {D1Client} D1 client instance
 */
export function getD1Client(db) {
  if (!db) {
    if (!d1ClientInstance) {
      throw new Error('D1 database not initialized. Call getD1Client with a database instance first.');
    }
    return d1ClientInstance;
  }
  
  if (!d1ClientInstance) {
    d1ClientInstance = new D1Client(db);
  }
  
  return d1ClientInstance;
}

/**
 * Reset the D1 client (for testing)
 * @param {D1Database} [db] - Optional new D1 database instance
 * @returns {D1Client} New D1 client instance
 */
export function resetD1Client(db) {
  if (db) {
    d1ClientInstance = new D1Client(db);
  } else {
    d1ClientInstance = null;
  }
  return d1ClientInstance;
}

export default D1Client;

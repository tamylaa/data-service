/**
 * D1 Database Client
 * Main entry point for database operations
 */

import { BaseD1Client } from '../clients/d1/BaseD1Client.js';
import { getMigrationsUpTo, SCHEMA_VERSION } from './migrations/schema.js';

// Web Crypto API shim for Cloudflare Workers
const crypto = {
  randomUUID: () => globalThis.crypto.randomUUID(),
  randomBytes: (size) => {
    const array = new Uint8Array(size);
    globalThis.crypto.getRandomValues(array);
    
    // Return a Uint8Array with a toString method that converts to hex
    const result = new Uint8Array(array);
    result.toString = (encoding = 'hex') => {
      if (encoding !== 'hex') {
        throw new Error('Only hex encoding is supported in this shim');
      }
      return Array.from(result)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };
    return result;
  }
};

export class D1Client extends BaseD1Client {
  constructor(db, env = {}) {
    super(db, env);
    this.isInitialized = false;
    
    // Initialize sub-clients
    this.users = {
      findByEmail: this.findUserByEmail.bind(this),
      create: this.createUser.bind(this),
      update: this.updateUser.bind(this),
      findById: this.findUserById.bind(this)
    };
    
    this.magicLinks = {
      create: this.createMagicLink.bind(this),
      findByToken: this.findMagicLinkByToken.bind(this),
      markAsUsed: this.markMagicLinkAsUsed.bind(this)
    };
    
    this.tokens = {
      create: this.createToken.bind(this),
      findValid: this.findValidToken.bind(this),
      invalidate: this.invalidateToken.bind(this)
    };
    
    // Bind methods to maintain 'this' context
    this.createToken = this.createToken.bind(this);
    this.findValidToken = this.findValidToken.bind(this);
    this.invalidateToken = this.invalidateToken.bind(this);
  }

  /**
   * Find or create a user by email
   * @param {Object} options - User options
   * @param {string} options.email - User's email (required)
   * @param {string} [options.name] - User's name (optional)
   * @returns {Promise<Object>} User object
   */
  async findOrCreateUser({ email, name }) {
    if (!email) throw new Error('Email is required');
    
    // Try to find existing user
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) return existingUser;
    
    // Create new user if not found
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const defaultName = name || email.split('@')[0];
    
    await this.db.prepare(
      'INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      userId,
      email,
      defaultName,
      0, // is_email_verified = false
      now,
      now
    ).run();
    
    return {
      id: userId,
      email,
      name: defaultName,
      is_email_verified: false,
      created_at: now,
      updated_at: now
    };
  }
  
  /**
   * Get user by email
   * @param {string} email - User's email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async getUserByEmail(email) {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!result) return null;
    
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      isEmailVerified: result.is_email_verified === 1,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
  
  /**
   * Create a generic token
   * @param {Object} options - Token options
   * @param {string} options.userId - User ID
   * @param {string} options.type - Token type (e.g., 'magic_link', 'refresh_token')
   * @param {Date|string} options.expiresAt - Expiration date
   * @param {Object} [options.metadata] - Additional token metadata
   * @returns {Promise<Object>} Created token
   */
  async createToken({ userId, type, expiresAt, metadata = {} }) {
    const tokenId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    
    await this.db.prepare(
      'INSERT INTO tokens (id, user_id, token, type, expires_at, is_used, metadata, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      tokenId,
      userId,
      token,
      type,
      expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
      0, // is_used = false
      JSON.stringify(metadata),
      now,
      now
    ).run();
    
    return {
      id: tokenId,
      user_id: userId,
      token,
      type,
      expires_at: expiresAt,
      is_used: false,
      metadata,
      created_at: now,
      updated_at: now
    };
  }
  
  /**
   * Find a valid, unused token
   * @param {Object} options - Token options
   * @param {string} options.token - Token string
   * @param {string} options.type - Token type
   * @returns {Promise<Object|null>} Token object or null if not found/invalid
   */
  async findValidToken({ token, type }) {
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(
      'SELECT * FROM tokens WHERE token = ? AND type = ? AND is_used = 0 AND expires_at > ?'
    ).bind(token, type, now).first();
    
    if (!result) return null;
    
    return {
      id: result.id,
      user_id: result.user_id,
      token: result.token,
      type: result.type,
      expires_at: result.expires_at,
      is_used: result.is_used === 1,
      metadata: JSON.parse(result.metadata || '{}'),
      created_at: result.created_at,
      updated_at: result.updated_at
    };
  }
  
  /**
   * Invalidate a token
   * @param {string} tokenId - Token ID to invalidate
   * @returns {Promise<boolean>} True if token was invalidated
   */
  async invalidateToken(tokenId) {
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(
      'UPDATE tokens SET is_used = 1, updated_at = ? WHERE id = ? AND is_used = 0 RETURNING 1'
    ).bind(now, tokenId).first();
    
    return !!result;
  }

  /**
   * Create a new magic link
   * @param {Object} options - Magic link options
   * @param {string} options.userId - User ID (optional if email is provided)
   * @param {string} options.email - User email (required if userId is not provided)
   * @param {string} [options.name] - User name (optional, used if creating a new user)
   * @returns {Promise<Object>} Object containing the token, expiresAt, and user
   */
  async createMagicLink({ userId, email, name }) {
    // Get or create user
    let user;
    const now = new Date();
    
    if (!userId && !email) {
      throw new Error('Either userId or email is required');
    }

    // If we have a userId, get the user by ID
    if (userId) {
      user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
    } 
    // If we have an email, find or create the user
    else if (email) {
      user = await this.findUserByEmail(email);
      
      // If user doesn't exist, create a new one
      if (!user) {
        if (!name) {
          name = email.split('@')[0]; // Default name from email
        }
        
        const newUserId = crypto.randomUUID();
        user = {
          id: newUserId,
          email,
          name,
          isEmailVerified: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
        
        await this.db.prepare(
          'INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          user.id,
          user.email,
          user.name,
          user.isEmailVerified ? 1 : 0,
          user.createdAt,
          user.updatedAt
        ).run();
      }
    }

    if (!user) {
      throw new Error('Failed to find or create user');
    }

    // Generate a token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    
    // Create the magic link
    await this.db.prepare(
      'INSERT INTO magic_links (user_id, token, expires_at, is_used, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      user.id,
      token,
      expiresAt.toISOString(),
      0, // is_used = false
      now.toISOString(),
      now.toISOString()
    ).run();
    
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified
      }
    };
  }
  
  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserById(id) {
    const result = await this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();
    
    if (!result) return null;
    
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      isEmailVerified: result.is_email_verified === 1,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
  
  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findUserByEmail(email) {
    const sql = `
      SELECT * FROM users WHERE email = ?
    `;
    return this.first(sql, [email]);
  }

  /**
   * Create a new user
   * @param {Object} user - User object
   * @param {string} user.email - User's email
   * @param {string} [user.name] - User's name
   * @returns {Promise<Object>} Created user
   */
  async createUser({ email, name }) {
    const sql = `
      INSERT INTO users (email, name)
      VALUES (?, ?)
    `;
    const result = await this.run(sql, [email, name || '']);
    return this.findUserById(result.lastRowId);
  }

  /**
   * Update a user
   * @param {number|string} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(id, updates) {
    const validFields = ['name', 'email'];
    const fields = Object.keys(updates).filter(field => validFields.includes(field));
    
    if (fields.length === 0) {
      return this.findUserById(id);
    }

    const sql = `
      UPDATE users 
      SET ${fields.map(field => `${field} = ?`).join(', ')},
          updated_at = datetime('now')
      WHERE id = ?
    `;

    const values = [...fields.map(field => updates[field]), id];
    await this.run(sql, values);
    
    return this.findUserById(id);
  }

  /**
   * Find a magic link by token
   * @param {string} token - Magic link token
   * @returns {Promise<Object|null>} Magic link if found and not expired
   */
  async findMagicLinkByToken(token) {
    const now = new Date().toISOString();
    const sql = `
      SELECT ml.*, u.email, u.name
      FROM magic_links ml
      JOIN users u ON ml.user_id = u.id
      WHERE ml.token = ?
        AND ml.is_used = 0
        AND ml.expires_at > ?
    `;
    return this.first(sql, [token, now]);
  }

  /**
   * Mark a magic link as used
   * @param {string} token - Magic link token
   * @returns {Promise<boolean>} True if marked as used successfully
   */
  async markMagicLinkAsUsed(token) {
    const now = new Date().toISOString();
    const sql = `
      UPDATE magic_links 
      SET is_used = 1, 
          updated_at = ? 
      WHERE token = ? 
        AND is_used = 0
        AND expires_at > ?
    `;
    const result = await this.run(sql, [now, token, now]);
    return result.changes > 0;
  }

  /**
   * Verify a magic link token
   * @param {string} token - The magic link token to verify
   * @returns {Promise<Object>} The user associated with the magic link
   */
  async verifyMagicLink(token) {
    const link = await this.findMagicLinkByToken(token);
    if (!link) {
      throw new Error('Invalid or expired magic link');
    }

    const success = await this.markMagicLinkAsUsed(token);
    if (!success) {
      throw new Error('Failed to mark magic link as used');
    }

    return this.findUserById(link.user_id);
  }

  async initialize() {
    console.log('=== D1 Client Initialization Started ===');
    
    if (this.isInitialized) {
      console.log('Database already initialized, skipping...');
      return;
    }

    if (!this.db) {
      const error = new Error('Cannot initialize D1Client: No database binding available');
      console.error('❌', error.message);
      console.log('DB binding available:', !!this.db);
      console.log('DB binding type:', typeof this.db);
      console.log('DB binding keys:', this.db ? Object.keys(this.db) : 'N/A');
      throw error;
    }

    try {
      console.log('🔧 Initializing database...');
      console.log('Environment:', this.env?.NODE_ENV || 'development');
      console.log('DB binding type:', typeof this.db);
      console.log('DB binding has exec:', typeof this.db.exec === 'function');
      console.log('DB binding has prepare:', typeof this.db.prepare === 'function');
      
      // Test a simple query to verify the database connection
      console.log('🔍 Testing database connection...');
      try {
        const testResult = await this.db.prepare('SELECT 1 as test').first();
        console.log('✅ Database connection test successful:', testResult);
      } catch (testError) {
        console.error('❌ Database connection test failed:', testError);
        throw testError;
      }
      
      // Run migrations
      console.log('🔄 Running database migrations...');
      await this.runMigrations();
      
      // Mark as initialized
      this.isInitialized = true;
      console.log('✅ Database initialized successfully');
      console.log('===================================');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        cause: error.cause
      });
      this.isInitialized = false; // Reset initialization state on error
      console.log('===================================');
      throw error;
    }
  }

  /**
   * Run database migrations
   * @private
   */
  async runMigrations() {
    // In production, you might want to track migrations in a table
    // For simplicity, we'll just run all migrations in development
    if (this.env?.NODE_ENV !== 'production') {
      console.log('Disabling foreign key constraints for migration');
      try {
        await this.db.prepare('PRAGMA foreign_keys = OFF').run();
      } catch (error) {
        console.error('Failed to disable foreign key constraints:', error);
        throw error;
      }
    }

    try {
      // Get all migrations up to the current version as an array of statements
      const statements = getMigrationsUpTo(SCHEMA_VERSION);
      
      console.log(`Running ${statements.length} migration statements`);
      
      // Execute each statement individually
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`\n--- Executing statement ${i + 1}/${statements.length} ---`);
        console.log('SQL:', statement);
        
        try {
          const startTime = Date.now();
          // Use prepare and run for better error handling
          const result = await this.db.prepare(statement).run();
          const duration = Date.now() - startTime;
          
          console.log(`✓ Statement ${i + 1} executed successfully in ${duration}ms`);
          console.log('Result:', JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(`✗ Error executing statement ${i + 1}:`);
          console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            cause: error.cause
          });
          console.error('Failing SQL:', statement);
          throw error;
        }
      }
      
      console.log('✅ All migrations completed successfully');
    } finally {
      if (this.env?.NODE_ENV !== 'production') {
        console.log('Re-enabling foreign key constraints');
        try {
          await this.db.prepare('PRAGMA foreign_keys = ON').run();
          console.log('Foreign key constraints re-enabled');
        } catch (error) {
          console.error('Failed to re-enable foreign key constraints:', error);
          // Don't rethrow to avoid masking the original error
        }
      }
    }
  }

  /**
   * Reset the database (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    // Drop all tables
    await this.db.exec(`
      DROP TABLE IF EXISTS magic_links;
      DROP TABLE IF EXISTS users;
    `);
    
    // Re-run migrations
    this.isInitialized = false;
    await this.initialize();
  }
}

// Export a singleton instance for the application
let d1ClientInstance = null;

/**
 * Get the D1 client instance
 * @param {D1Database} db - D1 database instance
 * @returns {D1Client|null} D1 client instance or null if db is not provided
 */
export function getD1Client(db) {
  if (!db) {
    console.warn('No database binding provided to getD1Client');
    return null;
  }
  
  if (!d1ClientInstance) {
    d1ClientInstance = new D1Client(db);
  } else if (d1ClientInstance.db !== db) {
    // If we have a different DB instance, reset the client
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
  d1ClientInstance = db ? new D1Client(db) : null;
  return d1ClientInstance;
}

// Export the D1Client
export default D1Client;

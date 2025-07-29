/**
 * MagicLink Model
 * Handles all database operations for magic links
 */

import { BaseD1Client } from '../baseClient.js';

// Web Crypto API is available in both Node.js and browsers/workers
const crypto = {
  randomUUID: () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  randomBytes: (size) => {
    const array = new Uint8Array(size);
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for non-secure random (not recommended for production)
      for (let i = 0; i < size; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  }
};

export class MagicLinkModel extends BaseD1Client {
  constructor({ db }) {
    super(db);
    this.tableName = 'magic_links';
    // The users reference will be set by D1Client after construction
    this.users = null;
  }

  /**
   * Create a new magic link
   * @param {string} userId - User ID
   * @param {string} token - Magic link token
   * @param {Date} expiresAt - Expiration date
   * @returns {Promise<Object>} Created magic link
   */
  async create(userId, token, expiresAt) {
    const now = new Date().toISOString();
    
    const result = await this.run(
      `INSERT INTO ${this.tableName} (user_id, token, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, token, expiresAt.toISOString(), now, now]
    );

    if (!result.success) {
      throw new Error('Failed to create magic link');
    }

    return this.findByToken(token);
  }

  /**
   * Get all magic links
   * @returns {Promise<Array>} Array of magic links
   */
  async all() {
    return super.all(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
      []
    );
  }

  /**
   * Find a magic link by token
   * @param {string} token - Magic link token
   * @returns {Promise<Object|null>} Magic link or null if not found
   */
  async findByToken(token) {
    return this.first(
      `SELECT * FROM ${this.tableName} WHERE token = ?`,
      [token]
    );
  }

  /**
   * Find active magic link by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active magic link or null if not found
   */
  async findActiveByUserId(userId) {
    const now = new Date().toISOString();
    
    return this.first(
      `SELECT * FROM ${this.tableName} 
       WHERE user_id = ? AND expires_at > ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId, now]
    );
  }

  /**
   * Get the most recent magic link for a user, regardless of expiration
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Most recent magic link or null if not found
   */
  async getLatestMagicLinkForUser(userId) {
    return this.first(
      `SELECT * FROM ${this.tableName} 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
  }

  /**
   * Mark a magic link as used
   * @param {string} token - Magic link token
   * @returns {Promise<boolean>} Success status
   */
  async markAsUsed(token) {
    const now = new Date().toISOString();
    
    const result = await this.run(
      `UPDATE ${this.tableName} 
       SET is_used = 1, updated_at = ? 
       WHERE token = ?`,
      [now, token]
    );
    
    return result.success;
  }

  /**
   * Delete expired magic links
   * @param {Date} [beforeDate] - Delete links expired before this date (default: now)
   * @returns {Promise<number>} Number of deleted links
   */
  async deleteExpired(beforeDate = new Date()) {
    const result = await this.run(
      `DELETE FROM ${this.tableName} 
       WHERE expires_at < ?`,
      [beforeDate.toISOString()]
    );
    
    return result.meta.changes;
  }

  /**
   * Delete all magic links for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteByUserId(userId) {
    const result = await this.run(
      `DELETE FROM ${this.tableName} WHERE user_id = ?`,
      [userId]
    );
    
    return result.success;
  }

  /**
   * Create a new magic link for a user
   * @param {Object} options - Options for creating a magic link
   * @param {string} [options.userId] - User ID (either userId or email is required)
   * @param {string} [options.email] - User email (either userId or email is required)
   * @param {string} [options.name] - User name (optional, used if creating a new user)
   * @returns {Promise<Object>} Object containing token, expiresAt, and user
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
      user = await this.users.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
    } 
    // If we have an email, find or create the user
    else if (email) {
      user = await this.users.findUserByEmail(email);
      
      // If user doesn't exist, create a new one
      if (!user) {
        if (!name) {
          name = email.split('@')[0]; // Default name from email
        }
        
        const newUserId = crypto.randomUUID();
        await this.users.create({
          id: newUserId,
          email,
          name,
          isEmailVerified: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
        
        // Get the newly created user
        user = await this.users.findUserByEmail(email);
      }
    }

    if (!user) {
      throw new Error('Failed to find or create user');
    }

    // Generate a token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
    
    // Create the magic link
    await this.create(user.id, token, expiresAt);
    
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
   * Verify a magic link token
   * @param {string} token - The magic link token to verify
   * @returns {Promise<Object>} The user associated with the magic link
   */
  async verify(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    const now = new Date();
    
    // Find the magic link
    const magicLink = await this.findByToken(token);
    if (!magicLink) {
      throw new Error('Invalid or expired magic link');
    }

    // Check if already used
    if (magicLink.is_used) {
      throw new Error('Magic link has already been used');
    }

    // Check if expired
    const expiresAt = new Date(magicLink.expires_at);
    if (expiresAt < now) {
      throw new Error('Magic link has expired');
    }

    // Get the user
    const user = await this.db.users.findUserById(magicLink.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    // Mark the magic link as used
    await this.markAsUsed(token);

    return user;
  }
}

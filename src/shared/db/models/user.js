/**
 * User Model
 * Handles all database operations for users
 */

import { BaseD1Client } from '../baseClient.js';

export class UserModel extends BaseD1Client {
  constructor({ db }) {
    super(db);
    this.tableName = 'users';
    // The magicLinks reference will be set by D1Client after construction
    this.magicLinks = null;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.email - User's email address
   * @param {string} [userData.name=''] - User's name (optional)
   * @returns {Promise<Object>} Created user
   */
  async create({ email, name = '' }) {
    if (!email) {
      const error = new Error('Email is required');
      console.error('[UserModel] Error creating user:', error.message);
      throw error;
    }

    // Normalize the email
    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[UserModel] Creating user with email: ${normalizedEmail}`);
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    try {
      // Check if user already exists with case-insensitive comparison
      const existingUser = await this.findByEmail(normalizedEmail);
      if (existingUser) {
        const error = new Error(`User with email ${normalizedEmail} already exists`);
        console.error(`[UserModel] ${error.message}`);
        throw error;
      }

      // Create new user with normalized email
      const result = await this.run(
        `INSERT INTO ${this.tableName} (id, email, name, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, normalizedEmail, name.trim(), now, now]
      );

      if (!result.success) {
        const error = new Error('Failed to create user in database');
        console.error(`[UserModel] ${error.message} for email: ${normalizedEmail}`);
        throw error;
      }

      console.log(`[UserModel] Successfully created user with ID: ${id}`);
      return this.findById(id);
    } catch (error) {
      console.error(`[UserModel] Error creating user ${normalizedEmail}:`, error);
      throw error;
    }
  }

  /**
   * Get all users
   * @returns {Promise<Array>} Array of users
   */
  async all() {
    return super.all(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
      []
    );
  }

  /**
   * Find a user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User or null if not found
   */
  async findById(userId) {
    return this.first(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [userId]
    );
  }

  /**
   * Find a user by exact email match (case-insensitive)
   * @param {string} email - User email to search for
   * @returns {Promise<Object|null>} User or null if not found
   */
  async findByEmail(email) {
    if (!email) {
      console.error('[UserModel] No email provided to findByEmail');
      return null;
    }

    // Normalize the input email for comparison
    const normalizedInput = email.trim().toLowerCase();
    console.log(`[UserModel] Looking up user with email: ${email} (normalized: ${normalizedInput})`);
    
    try {
      // First, get all users to see what we're working with
      const allUsers = await this.all(`SELECT * FROM ${this.tableName}`);
      console.log(`[UserModel] Total users in database: ${allUsers.length}`);
      
      // Find exact match after normalizing both emails
      const matchingUser = allUsers.find(user => {
        if (!user || !user.email) return false;
        const normalizedDbEmail = user.email.trim().toLowerCase();
        return normalizedDbEmail === normalizedInput;
      });
      
      if (matchingUser) {
        console.log(`[UserModel] Found exact match for email: ${email} (DB: ${matchingUser.email})`);
      } else {
        console.log(`[UserModel] No user found with email: ${email}`);
        // Log similar emails for debugging
        const similarEmails = allUsers
          .filter(u => u.email && u.email.toLowerCase().includes(normalizedInput))
          .map(u => u.email);
        
        if (similarEmails.length > 0) {
          console.log(`[UserModel] Similar emails found:`, similarEmails);
        }
      }
      
      return matchingUser || null;
    } catch (error) {
      console.error(`[UserModel] Error finding user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Update a user
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async update(userId, updates) {
    const now = new Date().toISOString();
    const allowedUpdates = ['name', 'email', 'is_email_verified', 'last_login'];
    
    // Filter and prepare updates
    const updateFields = [];
    const updateValues = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedUpdates.includes(key) && value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    });
    
    if (updateFields.length === 0) {
      return this.findById(userId);
    }
    
    // Add updated_at and userId to values
    updateFields.push('updated_at = ?');
    updateValues.push(now, userId);
    
    const result = await this.run(
      `UPDATE ${this.tableName} 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );
    
    if (!result.success) {
      throw new Error('Failed to update user');
    }
    
    return this.findById(userId);
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(userId) {
    const result = await this.run(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [userId]
    );
    
    return result.success;
  }
}

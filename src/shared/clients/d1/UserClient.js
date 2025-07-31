/**
 * User Client
 * Handles user-related da      await this.d1Client.run(
        'INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, normalizedEmail, user.name, 0, now, now]
      );se operations using D1
 */

/**
 * User client for D1 database operations
 */
export class UserClient {
  /**
   * Create a new UserClient instance
   * @param {D1Client} d1Client - The D1 client instance
   */
  constructor(d1Client) {
    this.d1Client = d1Client;
  }
  /**
   * Create a new user
   * @param {Object} userData - The user data
   * @param {string} userData.email - User's email (required)
   * @param {string} [userData.name] - User's name (optional)
   * @returns {Promise<Object>} The created user
   */
  async create({ email, name = '' }) {
    if (!email) {
      throw new Error('Email is required to create a user');
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[UserClient] Creating user with email: ${normalizedEmail}`);
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    try {
      // Create the user directly since we've already checked for existence
      const user = {
        id,
        email: normalizedEmail,
        name: name || '',
        is_email_verified: false,
        created_at: now,
        updated_at: now
      };
      
      await this.d1Client.run(
        'INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, normalizedEmail, user.name, 0, now, now]
      );
      
      console.log(`[UserClient] Created user with ID: ${id}`);
      return user;
    } catch (error) {
      // Handle unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        console.log(`[UserClient] User with email ${normalizedEmail} already exists`);
        // Return the existing user
        return this.findByEmail(normalizedEmail);
      }
      
      console.error(`[UserClient] Error creating user:`, error);
      throw error;
    }
  }

  /**
   * Find a user by email (case-insensitive)
   * @param {string} email - The email to search for
   * @returns {Promise<Object|null>} The user or null if not found
   */
  async findByEmail(email) {
    if (!email) return null;
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[UserClient] Finding user by email: ${normalizedEmail}`);
    
    try {
      const user = await this.d1Client.first(
        'SELECT * FROM users WHERE LOWER(email) = ?',
        [normalizedEmail]
      );
      
      if (!user) {
        console.log(`[UserClient] No user found with email: ${normalizedEmail}`);
        return null;
      }
      
      // Map database fields to application fields
      return this.mapUser(user);
    } catch (error) {
      console.error(`[UserClient] Error finding user by email:`, error);
      throw error;
    }
  }

  /**
   * Find a user by ID
   * @param {string} id - The user ID to search for
   * @returns {Promise<Object|null>} The user or null if not found
   */
  async findById(id) {
    if (!id) return null;
    
    console.log(`[UserClient] Finding user by ID: ${id}`);
    
    try {
      const user = await this.d1Client.first(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      
      if (!user) {
        console.log(`[UserClient] No user found with ID: ${id}`);
        return null;
      }
      
      return this.mapUser(user);
    } catch (error) {
      console.error(`[UserClient] Error finding user by ID:`, error);
      throw error;
    }
  }

  /**
   * Find or create a user by email
   * @param {Object} options - User options
   * @param {string} options.email - User's email (required)
   * @param {string} [options.name] - User's name (optional)
   * @returns {Promise<Object>} The user object
   */
  async findOrCreate({ email, name = '' }) {
    if (!email) throw new Error('Email is required');
    
    // Try to find existing user
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      return existingUser;
    }
    
    // Create new user if not found
    return this.create({ email, name });
  }

  /**
   * Update a user
   * @param {string} id - The user ID to update
   * @param {Object} updates - The fields to update
   * @returns {Promise<Object>} The updated user
   */
  async update(id, updates) {
    if (!id) throw new Error('User ID is required');
    
    const now = new Date().toISOString();
    const fields = [];
    const params = [];
    
    // Build the update query dynamically based on provided fields
    if ('name' in updates) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    
    if ('phone' in updates) {
      fields.push('phone = ?');
      params.push(updates.phone);
    }
    
    if ('company' in updates) {
      fields.push('company = ?');
      params.push(updates.company);
    }
    
    if ('position' in updates) {
      fields.push('position = ?');
      params.push(updates.position);
    }
    
    if ('is_email_verified' in updates) {
      fields.push('is_email_verified = ?');
      params.push(updates.is_email_verified ? 1 : 0);
    }
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    // Add updated_at and ID to params
    fields.push('updated_at = ?');
    params.push(now, id);
    
    // Execute the update
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await this.d1Client.run(query, params);
    
    // Return the updated user
    return this.findById(id);
  }
  
  /**
   * Delete a user by ID
   * @param {string} id - The ID of the user to delete
   * @returns {Promise<boolean>} True if the user was deleted, false otherwise
   */
  async delete(id) {
    if (!id) return false;
    
    console.log(`[UserClient] Deleting user with ID: ${id}`);
    
    try {
      // First check if user exists
      const user = await this.findById(id);
      if (!user) {
        console.log(`[UserClient] No user found with ID: ${id}`);
        return false;
      }
      
      // Delete the user
      await this.d1Client.run('DELETE FROM users WHERE id = ?', [id]);
      console.log(`[UserClient] Deleted user with ID: ${id}`);
      
      return true;
    } catch (error) {
      console.error(`[UserClient] Error deleting user:`, error);
      throw error;
    }
  }

  /**
   * Map database user to application user
   * @private
   */
  mapUser(dbUser) {
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      phone: dbUser.phone,
      company: dbUser.company,
      position: dbUser.position,
      is_email_verified: dbUser.is_email_verified === 1,
      isEmailVerified: dbUser.is_email_verified === 1, // camelCase for frontend
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }
}

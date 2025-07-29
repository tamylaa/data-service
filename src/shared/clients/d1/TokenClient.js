/**
 * Token Client
 * Handles token-related database operations using D1
 */

/**
 * Token client for D1 database operations
 */
export class TokenClient {
  /**
   * Create a new TokenClient instance
   * @param {D1Client} d1Client - The D1 client instance
   */
  constructor(d1Client) {
    this.d1Client = d1Client;
  }
  /**
   * Create a new token
   * @param {Object} params - The token parameters
   * @param {string} params.userId - The user ID
   * @param {string} params.type - The token type (e.g., 'refresh', 'access')
   * @param {string} [params.token] - The token value (auto-generated if not provided)
   * @param {Date|string} [params.expiresAt] - Expiration date (defaults to 7 days from now)
   * @param {number} [params.expiresInDays=7] - Expiration in days (alternative to expiresAt)
   * @returns {Promise<Object>} The created token
   */
  async create({ userId, type, token, expiresAt, expiresInDays = 7 }) {
    if (!userId || !type) {
      throw new Error('User ID and token type are required');
    }
    
    console.log(`[TokenClient] Creating ${type} token for user ${userId}`);
    
    const tokenValue = token || crypto.randomUUID();
    const now = new Date();
    const expiration = expiresAt || 
      (expiresInDays ? new Date(now.getTime() + (expiresInDays * 24 * 60 * 60 * 1000)) : null);
    
    if (!expiration) {
      throw new Error('Either expiresAt or expiresInDays must be provided');
    }
    
    const tokenData = {
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      token: tokenValue,
      is_revoked: false,
      expires_at: expiration instanceof Date ? expiration.toISOString() : expiration,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
    
    try {
      await this.d1Client.run(
        `INSERT INTO tokens (id, user_id, type, token, is_revoked, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tokenData.id,
          tokenData.user_id,
          tokenData.type,
          tokenData.token,
          tokenData.is_revoked ? 1 : 0,
          tokenData.expires_at,
          tokenData.created_at,
          tokenData.updated_at
        ]
      );
      
      console.log(`[TokenClient] Created ${type} token for user ${userId}`);
      return this.mapToken(tokenData);
    } catch (error) {
      console.error('[TokenClient] Error creating token:', error);
      throw error;
    }
  }

  /**
   * Find a token by its value
   * @param {string} token - The token value
   * @returns {Promise<Object|null>} The token or null if not found
   */
  async findByToken(token) {
    if (!token) return null;
    
    console.log(`[TokenClient] Finding token`);
    
    try {
      const tokenData = await this.d1Client.first(
        'SELECT * FROM tokens WHERE token = ?',
        [token]
      );
      
      if (!tokenData) {
        console.log('[TokenClient] Token not found');
        return null;
      }
      
      console.log(`[TokenClient] Found ${tokenData.type} token for user ${tokenData.user_id}`);
      return this.mapToken(tokenData);
    } catch (error) {
      console.error('[TokenClient] Error finding token:', error);
      throw error;
    }
  }

  /**
   * Revoke a token
   * @param {string} token - The token to revoke
   * @returns {Promise<boolean>} True if the token was revoked
   */
  async revoke(token) {
    if (!token) return false;
    
    console.log(`[TokenClient] Revoking token`);
    
    try {
      const now = new Date().toISOString();
      const result = await this.d1Client.run(
        'UPDATE tokens SET is_revoked = 1, updated_at = ? WHERE token = ? AND is_revoked = 0',
        [now, token]
      );
      
      const success = result.meta.changes > 0;
      console.log(`[TokenClient] Token revocation ${success ? 'succeeded' : 'failed'}`);
      return success;
    } catch (error) {
      console.error('[TokenClient] Error revoking token:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a user of a specific type
   * @param {string} userId - The user ID
   * @param {string} [type] - Optional token type to revoke
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllForUser(userId, type) {
    if (!userId) return 0;
    
    console.log(`[TokenClient] Revoking all ${type || ''} tokens for user ${userId}`.trim());
    
    try {
      const now = new Date().toISOString();
      let query = 'UPDATE tokens SET is_revoked = 1, updated_at = ? WHERE user_id = ? AND is_revoked = 0';
      const params = [now, userId];
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      const result = await this.d1Client.run(query, params);
      const count = result.meta.changes;
      
      console.log(`[TokenClient] Revoked ${count} tokens`);
      return count;
    } catch (error) {
      console.error('[TokenClient] Error revoking tokens:', error);
      throw error;
    }
  }

  /**
   * Check if a token is valid (exists, not expired, and not revoked)
   * @param {string} token - The token to validate
   * @param {string} [type] - Optional token type to validate against
   * @returns {Promise<boolean>} True if the token is valid
   */
  async isValid(token, type) {
    if (!token) return false;
    
    console.log(`[TokenClient] Validating token`);
    
    try {
      const now = new Date().toISOString();
      let query = 'SELECT 1 as valid FROM tokens WHERE token = ? AND is_revoked = 0 AND expires_at > ?';
      const params = [token, now];
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      const result = await this.d1Client.first(query, params);
      const isValid = !!result?.valid;
      
      console.log(`[TokenClient] Token validation ${isValid ? 'succeeded' : 'failed'}`);
      return isValid;
    } catch (error) {
      console.error('[TokenClient] Error validating token:', error);
      return false;
    }
  }

  /**
   * Get all valid tokens for a user
   * @param {string} userId - The user ID
   * @param {string} [type] - Optional token type to filter by
   * @param {boolean} [includeRevoked=false] - Include revoked tokens
   * @returns {Promise<Array>} Array of tokens
   */
  async findByUserId(userId, type, includeRevoked = false) {
    if (!userId) return [];
    
    console.log(`[TokenClient] Getting ${type || 'all'} tokens for user ${userId}`);
    
    try {
      const now = new Date().toISOString();
      let query = 'SELECT * FROM tokens WHERE user_id = ?';
      const params = [userId];
      
      if (!includeRevoked) {
        query += ' AND is_revoked = 0 AND expires_at > ?';
        params.push(now);
      }
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      const tokens = await this.d1Client.all(query, params);
      console.log(`[TokenClient] Found ${tokens.length} tokens`);
      
      return tokens.map(token => this.mapToken(token));
    } catch (error) {
      console.error('[TokenClient] Error getting user tokens:', error);
      throw error;
    }
  }
  
  /**
   * Delete expired tokens
   * @returns {Promise<number>} Number of tokens deleted
   */
  async deleteExpired() {
    try {
      const now = new Date().toISOString();
      const result = await this.d1Client.run(
        'DELETE FROM tokens WHERE expires_at <= ?',
        [now]
      );
      
      const count = result.meta.changes;
      console.log(`[TokenClient] Deleted ${count} expired tokens`);
      return count;
    } catch (error) {
      console.error('[TokenClient] Error deleting expired tokens:', error);
      throw error;
    }
  }
  
  /**
   * Delete a token by its value
   * @param {string} token - The token value to delete
   * @returns {Promise<boolean>} True if the token was deleted, false otherwise
   */
  async delete(token) {
    if (!token) return false;
    
    console.log(`[TokenClient] Deleting token`);
    
    try {
      const result = await this.d1Client.run(
        'DELETE FROM tokens WHERE token = ?',
        [token]
      );
      
      const deleted = result.meta.changes > 0;
      console.log(`[TokenClient] Token ${deleted ? 'deleted' : 'not found'}`);
      return deleted;
    } catch (error) {
      console.error(`[TokenClient] Error deleting token:`, error);
      throw error;
    }
  }

  /**
   * Map database token to application token
   * @private
   */
  mapToken(dbToken) {
    if (!dbToken) return null;
    
    return {
      id: dbToken.id,
      userId: dbToken.user_id,
      type: dbToken.type,
      token: dbToken.token,
      isRevoked: dbToken.is_revoked === 1,
      expiresAt: dbToken.expires_at,
      createdAt: dbToken.created_at,
      updatedAt: dbToken.updated_at
    };
  }
}

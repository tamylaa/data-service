/**
 * Magic Link Client
 * Handles magic link-related database operations using D1
 */

/**
 * Magic link client for D1 database operations
 */
export class MagicLinkClient {
  /**
   * Create a new MagicLinkClient instance
   * @param {D1Client} d1Client - The D1 client instance
   */
  constructor(d1Client) {
    this.d1Client = d1Client;
  }
  /**
   * Create a new magic link
   * @param {Object} params - The magic link parameters
   * @param {string} params.userId - The user ID
   * @param {string} params.email - The user's email
   * @param {string} [params.name] - The user's name (optional)
   * @param {number} [expiryMinutes=30] - Expiration time in minutes (default: 30)
   * @returns {Promise<Object>} The created magic link
   */
  async create({ userId, email, name = '', expiryMinutes = 30 }) {
    if (!userId || !email) {
      throw new Error('User ID and email are required to create a magic link');
    }
    
    console.log(`[MagicLinkClient] Creating magic link for user ${userId} (${email})`);
    
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (expiryMinutes * 60 * 1000));
    
    const magicLink = {
      id: crypto.randomUUID(),
      user_id: userId,
      token,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      is_used: false,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
    
    console.log('[MagicLinkClient] Generated magic link:', {
      ...magicLink,
      is_used: magicLink.is_used ? 1 : 0
    });
    
    try {
      console.log('[MagicLinkClient] Executing INSERT INTO magic_links with params:', [
        magicLink.id,
        magicLink.user_id,
        magicLink.token,
        magicLink.email,
        magicLink.name,
        magicLink.is_used ? 1 : 0,
        magicLink.expires_at,
        magicLink.created_at,
        magicLink.updated_at
      ]);
      
      await this.run(
        `INSERT INTO magic_links (
          id, user_id, token, email, name, 
          is_used, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          magicLink.id,
          magicLink.user_id,
          magicLink.token,
          magicLink.email,
          magicLink.name,
          magicLink.is_used ? 1 : 0,
          magicLink.expires_at,
          magicLink.created_at,
          magicLink.updated_at
        ]
      );
      
      console.log('[MagicLinkClient] Successfully created magic link');
      
      console.log(`[MagicLinkClient] Created magic link with token: ${token}`);
      return this.mapMagicLink(magicLink);
    } catch (error) {
      console.error('[MagicLinkClient] Error creating magic link:', error);
      throw error;
    }
  }

  /**
   * Find a magic link by token
   * @param {string} token - The magic link token
   * @returns {Promise<Object|null>} The magic link or null if not found
   */
  async findByToken(token, includeExpired = false) {
    if (!token) {
      console.log('[MagicLinkClient] No token provided to findByToken');
      return null;
    }
    
    console.log(`[MagicLinkClient] Finding magic link with token: ${token}, includeExpired: ${includeExpired}`);
    
    try {
      // First, check if the token exists at all
      console.log('[MagicLinkClient] Querying magic_links table for token...');
      let query = 'SELECT * FROM magic_links WHERE token = ?';
      const params = [token];
      
      console.log(`[MagicLinkClient] Executing query: ${query} with params:`, params);
      
      // Get the magic link first
      const magicLink = await this.first(query, params);
      
      if (!magicLink) {
        console.log(`[MagicLinkClient] No magic link found in database with token: ${token}`);
        // Let's check if there are any magic links in the database at all
        const allLinks = await this.all('SELECT token, user_id, expires_at, is_used FROM magic_links LIMIT 5');
        console.log(`[MagicLinkClient] First 5 magic links in database:`, allLinks);
        return null;
      }
      
      console.log(`[MagicLinkClient] Found magic link in database:`, {
        id: magicLink.id,
        user_id: magicLink.user_id,
        is_used: magicLink.is_used,
        expires_at: magicLink.expires_at,
        created_at: magicLink.created_at
      });
      
      // Check if the link is already used
      if (magicLink.is_used) {
        console.log('[MagicLinkClient] Magic link has already been used');
        if (!includeExpired) return null;
      }
      
      // Check expiration if not explicitly including expired links
      if (!includeExpired) {
        const now = new Date();
        const expiresAt = new Date(magicLink.expires_at);
        
        console.log(`[MagicLinkClient] Checking expiration - Current time: ${now.toISOString()}, Expires at: ${expiresAt.toISOString()}`);
        
        if (expiresAt <= now) {
          console.log(`[MagicLinkClient] Magic link expired on ${expiresAt.toISOString()}`);
          return null;
        }
      }
      
      // If we get here, the link is valid
      console.log('[MagicLinkClient] Magic link is valid');
      return this.mapMagicLink(magicLink);
    } catch (error) {
      console.error('[MagicLinkClient] Error finding magic link:', error);
      throw error;
    }
  }

  /**
   * Find all magic links for a user
   * @param {string} userId - The user ID
   * @param {boolean} [includeUsed=false] - Include used magic links
   * @param {boolean} [includeExpired=false] - Include expired magic links
   * @returns {Promise<Array>} Array of magic links
   */
  async findByUserId(userId, includeUsed = false, includeExpired = false) {
    if (!userId) return [];
    
    console.log(`[MagicLinkClient] Finding magic links for user: ${userId}`);
    
    try {
      const now = new Date().toISOString();
      let query = 'SELECT * FROM magic_links WHERE user_id = ?';
      const params = [userId];
      
      if (!includeUsed) {
        query += ' AND is_used = 0';
      }
      
      if (!includeExpired) {
        query += ' AND expires_at > ?';
        params.push(now);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const magicLinks = await this.all(query, params);
      console.log(`[MagicLinkClient] Found ${magicLinks.length} magic links for user: ${userId}`);
      
      return magicLinks.map(link => this.mapMagicLink(link));
    } catch (error) {
      console.error('[MagicLinkClient] Error finding magic links:', error);
      throw error;
    }
  }

  /**
   * Get the most recent valid magic link for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object|null>} The most recent magic link or null if not found
   */
  async findLatestForUser(userId) {
    if (!userId) return null;
    
    console.log(`[MagicLinkClient] Getting latest magic link for user: ${userId}`);
    
    try {
      const now = new Date().toISOString();
      const magicLink = await this.first(
        `SELECT * FROM magic_links 
         WHERE user_id = ? AND is_used = 0 AND expires_at > ? 
         ORDER BY created_at DESC LIMIT 1`,
        [userId, now]
      );
      
      if (!magicLink) {
        console.log(`[MagicLinkClient] No valid magic links found for user: ${userId}`);
        return null;
      }
      
      console.log(`[MagicLinkClient] Found valid magic link for user: ${userId}`);
      return this.mapMagicLink(magicLink);
    } catch (error) {
      console.error('[MagicLinkClient] Error getting latest magic link:', error);
      throw error;
    }
  }

  /**
   * Mark a magic link as used
   * @param {string} token - The magic link token
   * @returns {Promise<boolean>} True if the magic link was marked as used
   */
  async markAsUsed(token) {
    if (!token) return false;
    
    console.log(`[MagicLinkClient] Marking magic link as used: ${token}`);
    
    try {
      const now = new Date().toISOString();
      const result = await this.run(
        'UPDATE magic_links SET is_used = 1, updated_at = ? WHERE token = ? AND is_used = 0',
        [now, token]
      );
      
      const success = result.meta.changes > 0;
      console.log(`[MagicLinkClient] Magic link marked as used: ${success}`);
      return success;
    } catch (error) {
      console.error('[MagicLinkClient] Error marking magic link as used:', error);
      throw error;
    }
  }

  /**
   * Check if a magic link is valid (not used and not expired)
   * @param {string} token - The magic link token
   * @returns {Promise<boolean>} True if the magic link is valid
   */
  async isValid(token) {
    if (!token) return false;
    
    try {
      const now = new Date().toISOString();
      const result = await this.first(
        'SELECT 1 as valid FROM magic_links WHERE token = ? AND is_used = 0 AND expires_at > ?',
        [token, now]
      );
      
      return !!result?.valid;
    } catch (error) {
      console.error('[MagicLinkClient] Error validating magic link:', error);
      return false;
    }
  }
  
  /**
   * Delete expired magic links
   * @returns {Promise<number>} Number of magic links deleted
   */
  async deleteExpired() {
    try {
      const now = new Date().toISOString();
      const result = await this.run(
        'DELETE FROM magic_links WHERE expires_at <= ?',
        [now]
      );
      
      const count = result.meta.changes;
      console.log(`[MagicLinkClient] Deleted ${count} expired magic links`);
      return count;
    } catch (error) {
      console.error('[MagicLinkClient] Error deleting expired magic links:', error);
      throw error;
    }
  }
  
  /**
   * Delete a magic link by token
   * @param {string} token - The magic link token to delete
   * @returns {Promise<boolean>} True if the magic link was deleted, false otherwise
   */
  async delete(token) {
    if (!token) return false;
    
    console.log(`[MagicLinkClient] Deleting magic link with token: ${token}`);
    
    try {
      const result = await this.run(
        'DELETE FROM magic_links WHERE token = ?',
        [token]
      );
      
      const deleted = result.meta.changes > 0;
      console.log(`[MagicLinkClient] Magic link ${deleted ? 'deleted' : 'not found'}: ${token}`);
      return deleted;
    } catch (error) {
      console.error(`[MagicLinkClient] Error deleting magic link:`, error);
      throw error;
    }
  }

  /**
   * Map database magic link to application magic link
   * @private
   */
  mapMagicLink(dbMagicLink) {
    if (!dbMagicLink) return null;
    
    return {
      id: dbMagicLink.id,
      userId: dbMagicLink.user_id,
      token: dbMagicLink.token,
      email: dbMagicLink.email,
      name: dbMagicLink.name,
      isUsed: dbMagicLink.is_used === 1,
      expiresAt: dbMagicLink.expires_at,
      createdAt: dbMagicLink.created_at,
      updatedAt: dbMagicLink.updated_at
    };
  }
}

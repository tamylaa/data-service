/**
 * Base D1 Client
 * Provides common database operations for D1 clients
 */

class BaseD1Client {
  /**
   * Create a new BaseD1Client instance
   * @param {Object} db - The D1 database instance
   * @param {Object} env - Environment variables
   */
  constructor(db, env = {}) {
    if (!db || typeof db.prepare !== 'function') {
      throw new Error('Valid D1 database instance is required');
    }
    this.db = db;
    this.env = env;
  }

  /**
   * Execute a query and get results based on available methods
   * @private
   */
  async _executeQuery(stmt, params, method) {
    try {
      if (typeof stmt.bind === 'function' && typeof stmt[method] === 'function') {
        return await stmt.bind(...params)[method]();
      }
      if (typeof stmt[method] === 'function') {
        return await stmt[method](...params);
      }
      if (typeof stmt.run === 'function') {
        return await stmt.run(...params);
      }
      throw new Error(`No valid D1 execution method available for method: ${method}`);
    } catch (error) {
      console.warn(`[BaseD1Client] Method attempt failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return all results
   * @param {string} query - The SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} The query results
   */
  async all(query, params = []) {
    try {
      console.log(`[BaseD1Client] Executing all query: ${query}`);
      console.log(`[BaseD1Client] With params:`, params);
      
      const stmt = this.db.prepare(query);
      let result;
      
      // Try different D1 API methods based on what's available
      try {
        // Try production-style chained method first
        if (typeof stmt.bind === 'function' && typeof stmt.all === 'function') {
          result = await stmt.bind(...params).all();
          return result?.results || [];
        }
        
        // Try direct execution with params 
        if (typeof stmt.all === 'function') {
          result = await stmt.all(...params);
          return result?.results || [];
        }
        
        // Try using run as fallback
        if (typeof stmt.run === 'function') {
          result = await stmt.run(...params);
          return result?.results || [];
        }
        
        // No valid execution method found
        throw new Error('No valid D1 execution method available on prepared statement');
      } catch (e) {
        console.warn(`[BaseD1Client] Method attempt failed:`, e);
        // Ultimate fallback - try raw query execution
        result = await this.db.exec(query, params);
        return result?.results || [];
      }
    } catch (error) {
      console.error(`[BaseD1Client] Error executing query: ${query}`, error);
      throw error;
    }
  }

  /**
   * Execute a SELECT query and return the first result
   * @param {string} query - The SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>} The first result or null if no results
   */
  async first(query, params = []) {
    try {
      console.log(`[BaseD1Client] Executing first query: ${query}`);
      console.log(`[BaseD1Client] With params:`, params);
      
      const stmt = this.db.prepare(query);
      
      // Try different D1 API methods based on what's available
      try {
        // Try production-style chained method first
        if (typeof stmt.bind === 'function' && typeof stmt.first === 'function') {
          return await stmt.bind(...params).first() || null;
        }
        
        // Try direct execution with params
        if (typeof stmt.run === 'function') {
          const result = await stmt.run(...params);
          return result?.results?.[0] || null;
        }
        
        // Try getting all results and taking first
        if (typeof stmt.all === 'function') {
          const results = await stmt.all(...params);
          return results?.results?.[0] || null;
        }
        
        // No valid execution method found
        throw new Error('No valid D1 execution method available on prepared statement');
      } catch (e) {
        console.warn(`[BaseD1Client] Method attempt failed:`, e);
        // Final fallback - try raw query execution
        const result = await this.db.exec(query, params);
        return result?.results?.[0] || null;
      }
    } catch (error) {
      console.error(`[BaseD1Client] Error executing query: ${query}`, error);
      throw error;
    }
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE query
   * @param {string} query - The SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} The query result
   */
  async run(query, params = []) {
    try {
      console.log(`[BaseD1Client] Executing run query: ${query}`);
      console.log(`[BaseD1Client] With params:`, params);
      
      const stmt = this.db.prepare(query);
      
      try {
        // Try production-style chained method first
        if (typeof stmt.bind === 'function' && typeof stmt.run === 'function') {
          return await stmt.bind(...params).run();
        }
        
        // Try direct execution with params
        if (typeof stmt.run === 'function') {
          return await stmt.run(...params);
        }
        
        // No valid execution method found, fall back to raw execution
        return await this.db.exec(query, params);
      } catch (e) {
        console.warn(`[BaseD1Client] Method attempt failed:`, e);
        // Ultimate fallback - try raw query execution
        return await this.db.exec(query, params);
      }
    } catch (error) {
      console.error(`[BaseD1Client] Error executing query: ${query}`, {
        error: error.message,
        stack: error.stack,
        query,
        params,
        dbType: typeof this.db,
        dbMethods: this.db ? Object.getOwnPropertyNames(this.db) : 'no db'
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Array<{query: string, params: Array}>} queries - Array of queries to execute
   * @returns {Promise<Array>} The results of all queries
   */
  async batch(queries) {
    try {
      console.log(`[BaseD1Client] Executing batch queries: ${JSON.stringify(queries)}`);
      
      // Try different batch approaches based on what's available
      try {
        // First try the native batch method if available
        const statements = queries.map(({ query, params = [] }) => {
          const stmt = this.db.prepare(query);
          if (typeof stmt.bind === 'function') {
            return stmt.bind(...params);
          }
          return stmt;
        });
        
        if (typeof this.db.batch === 'function') {
          return await this.db.batch(statements);
        }
        
        // Fallback to sequential execution if batch is not available
        const results = [];
        for (const { query, params = [] } of queries) {
          const result = await this.run(query, params);
          results.push(result);
        }
        return results;
      } catch (e) {
        console.warn(`[BaseD1Client] Batch method failed:`, e);
        // Final fallback - execute queries sequentially
        const results = [];
        for (const { query, params = [] } of queries) {
          const result = await this.run(query, params);
          results.push(result);
        }
        return results;
      }
    } catch (error) {
      console.error('Error executing batch queries:', error);
      throw error;
    }
  }

  /**
   * Generate a UUID
   * @returns {string} A new UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get the current timestamp in ISO format
   * @returns {string} The current timestamp
   */
  getCurrentTimestamp() {
    return new Date().toISOString();
  }
}

export { BaseD1Client };
export default BaseD1Client;

import { BaseD1Client } from './BaseD1Client.js';

/**
 * D1 Client for test environment
 * Implements D1-like interface but works with TestDatabase
 */
export class TestD1Client extends BaseD1Client {
    constructor(db) {
        super(db);
        this.isTestMode = true;
        this.users = {
            find: async (id) => this.first('SELECT * FROM users WHERE id = ?', [id]),
            findByEmail: async (email) => this.first('SELECT * FROM users WHERE email = ?', [email]),
            create: async (data) => {
                const result = await this.run('INSERT INTO users (id, email, name, is_email_verified, last_login, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [data.id, data.email, data.name, data.is_email_verified, data.last_login, data.created_at, data.updated_at]);
                return result;
            }
        };
        this.magicLinks = {
            create: async (data) => {
                const result = await this.run('INSERT INTO magic_links (user_id, token, is_used, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [data.user_id, data.token, data.is_used, data.expires_at, data.created_at, data.updated_at]);
                return result;
            },
            findByToken: async (token) => this.first('SELECT * FROM magic_links WHERE token = ?', [token]),
            markAsUsed: async (id) => this.run('UPDATE magic_links SET is_used = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id])
        };
        this.tokens = {
            create: async (data) => {
                const result = await this.run('INSERT INTO tokens (id, user_id, token, type, expires_at, is_used, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [data.id, data.user_id, data.token, data.type, data.expires_at, data.is_used, JSON.stringify(data.metadata || {}), data.created_at, data.updated_at]);
                return result;
            },
            findByToken: async (token) => this.first('SELECT * FROM tokens WHERE token = ?', [token]),
            markAsUsed: async (id) => this.run('UPDATE tokens SET is_used = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id])
        };
    }

    /**
     * Initialize the test client
     * @returns {Promise<void>}
     */
    async initialize() {
        // Test environment is already initialized when the database is created
        console.log('[TestD1Client] Test client initialization complete');
    }

    /**
     * Execute a SELECT query and return all results
     * @param {string} query - The SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} The query results
     */
    async all(query, params = []) {
        try {
            console.log(`[TestD1Client] Executing all query: ${query}`);
            console.log(`[TestD1Client] With params:`, params);
            
            // Use _executeQuery directly for test database
            const result = await this.db._executeQuery(query, params, 'all');
            return Array.isArray(result) ? result : [];
        } catch (error) {
            console.error(`[TestD1Client] Error executing query: ${query}`, error);
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
            console.log(`[TestD1Client] Executing first query: ${query}`);
            console.log(`[TestD1Client] With params:`, params);
            
            const result = await this.db._executeQuery(query, params, 'first');
            return Array.isArray(result) ? result[0] || null : result || null;
        } catch (error) {
            console.error(`[TestD1Client] Error executing query: ${query}`, error);
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
            console.log(`[TestD1Client] Executing run query: ${query}`);
            console.log(`[TestD1Client] With params:`, params);
            
            const result = await this.db._executeQuery(query, params, 'run');
            return {
                success: true,
                meta: {
                    changes: result?.changes || 0,
                    duration: 0,
                    last_row_id: result?.lastRowId || null
                }
            };
        } catch (error) {
            console.error(`[TestD1Client] Error executing query: ${query}`, {
                error: error.message,
                stack: error.stack,
                query,
                params
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
            console.log(`[TestD1Client] Executing batch queries`);
            const results = [];
            
            // Execute queries sequentially in test mode
            for (const { query, params = [] } of queries) {
                const result = await this.run(query, params);
                results.push(result);
            }
            
            return results;
        } catch (error) {
            console.error('[TestD1Client] Error executing batch queries:', error);
            throw error;
        }
    }
}

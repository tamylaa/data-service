/**
 * D1 Database Client
 * Main entry point for database operations using D1
 */

import { initializeDatabase } from '../../../config/d1.config.js';
import { UserClient } from './UserClient.js';
import { MagicLinkClient } from './MagicLinkClient.js';
import { TokenClient } from './TokenClient.js';

// In-memory database for development
let devDb;

/**
 * Reset the in-memory database (for testing)
 * @returns {Object} The dev database instance
 */
export function resetDevDb() {
  if (devDb) {
    devDb.tables = {
      users: new Map(),
      magic_links: new Map(),
      tokens: new Map()
    };
  }
  return devDb;
}

/**
 * D1 Database Client
 * Provides a clean, modular interface for database operations
 */
export class D1Client {
  /**
   * Create a new D1Client instance
   * @param {Object} db - The D1 database binding
   */
  constructor(db, env = {}) {
    // Initialize the database synchronously
    this.db = null;
    this._isInitialized = false;
    this._env = env;
    
    // Get the global object in a cross-platform way
    const globalObj = typeof globalThis !== 'undefined' ? globalThis : 
                     typeof window !== 'undefined' ? window : 
                     typeof global !== 'undefined' ? global : {};
    
    // Check if we're running in a Cloudflare Workers environment
    const isCloudflareWorker = 
      typeof globalThis !== 'undefined' && globalThis.process === undefined;
    
    // Handle test database setup - only in Node.js environment
    const isTestEnv = globalObj.process?.env?.NODE_ENV === 'test' || 
                     globalObj.process?.env?.USE_TEST_DB === 'true' ||
                     env.NODE_ENV === 'test' || 
                     env.USE_TEST_DB === 'true';
    
    if (isTestEnv) {
      this._initializeTestDatabase(globalObj, env);
      return; // Skip the rest of the constructor
    }
    
    // Fall back to standard behavior - production/development mode
    const hasPrepareMethod = db && typeof db.prepare === 'function';
    
    if (hasPrepareMethod) {
      console.log('Using provided database binding');
      this.db = db;
    } else if (this._env.NODE_ENV === 'development') {
      console.warn('Development environment detected, initializing in-memory database');
      this._initializeDevDb();
    } else {
      throw new Error('Invalid D1 database binding');
    }
    
    // Ensure the database is properly initialized
    if (this.db && typeof this.db.initialize === 'function') {
      this.db.initialize();
    }

    // Initialize sub-clients with proper binding
    const userClient = new UserClient(this);
    const magicLinkClient = new MagicLinkClient(this);
    const tokenClient = new TokenClient(this);
    
    // Helper function to safely bind methods
    const safeBind = (obj, methodName) => {
      if (typeof obj[methodName] === 'function') {
        return obj[methodName].bind(obj);
      }
      console.warn(`Method ${methodName} not found on client`);
      return () => Promise.reject(new Error(`Method ${methodName} not implemented`));
    };
    
    // Bind methods to maintain 'this' context
    this.users = {
      create: safeBind(userClient, 'create'),
      findById: safeBind(userClient, 'findById'),
      findByEmail: safeBind(userClient, 'findByEmail'),
      update: safeBind(userClient, 'update'),
      delete: safeBind(userClient, 'delete')
    };
    
    this.magicLinks = {
      create: safeBind(magicLinkClient, 'create'),
      findByToken: safeBind(magicLinkClient, 'findByToken'),
      delete: safeBind(magicLinkClient, 'delete')
    };
    
    this.tokens = {
      create: safeBind(tokenClient, 'create'),
      findByToken: safeBind(tokenClient, 'findByToken'),
      delete: safeBind(tokenClient, 'delete'),
      deleteExpired: safeBind(tokenClient, 'deleteExpired')
    };
    
    // Verify all required methods are available
    this._verifyClientMethods(userClient, ['create', 'findById', 'findByEmail', 'update', 'delete'], 'UserClient');
    this._verifyClientMethods(magicLinkClient, ['create', 'findByToken', 'delete'], 'MagicLinkClient');
    this._verifyClientMethods(tokenClient, ['create', 'findByToken', 'delete', 'deleteExpired'], 'TokenClient');
  }

  /**
   * Ensure the database client is initialized
   * @returns {Promise<void>}
   * @private
   */
  async ensureInitialized() {
    if (this._initialized) return;
    
    // If we're in test mode and the DB isn't initialized yet, wait for it
    if ((this._env.NODE_ENV === 'test' || this._env.USE_TEST_DB === 'true') && !this._isInitialized) {
      await new Promise((resolve) => {
        const checkInitialized = () => {
          if (this._isInitialized) {
            resolve();
          } else {
            setTimeout(checkInitialized, 10);
          }
        };
        checkInitialized();
      });
    }
    
    // Initialize sub-clients if not already done
    if (!this._initialized) {
      await this.initialize();
    }
  }
  
  /**
   * Initialize the database client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    
    // Initialize sub-clients
    this.users = new UserClient(this);
    this.magicLinks = new MagicLinkClient(this);
    this.tokens = new TokenClient(this);
    
    this._initialized = true;
  }

  /**
   * Initialize in-memory database for development and testing
   * @private
   */
  async _initializeDevDb() {
    console.warn('Running in development mode with in-memory database');
    
    if (!devDb) {
      const tables = {
        users: new Map(),
        magic_links: new Map(),
        tokens: new Map()
      };
      
      // Import the consolidated schema
      const { DATABASE_SCHEMA } = await import('../../../shared/db/schema.js');
      
      // Convert the schema to the format expected by the dev DB
      const schemas = {};
      
      Object.entries(DATABASE_SCHEMA).forEach(([tableName, tableDef]) => {
        schemas[tableName] = tableDef.columns.map(col => 
          [col.name, col.type, ...(col.constraints || [])].join(' ')
        );
      });
      
      // Create a simple database interface
      const prepareStatement = (sql, params = []) => {
        return {
          bind: (...bindParams) => prepareStatement(sql, [...params, ...bindParams]),
          all: async () => {
            // Parse table name from SQL
            const tableMatch = sql.match(/FROM\s+([\w"]+)/i);
            if (!tableMatch) return { results: [] };
            
            const tableName = tableMatch[1].toLowerCase().replace(/["`]/g, '');
            if (!tables[tableName]) return { results: [] };
            
            // Apply simple WHERE filtering if present
            let results = Array.from(tables[tableName].values());
            
            // Simple WHERE clause handling (very basic for dev)
            const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s|$)/i);
            if (whereMatch) {
              const condition = whereMatch[1];
              const [column, operator, value] = condition.split(/\s+/);
              
              if (column && operator && value) {
                const cleanColumn = column.replace(/["`]/g, '');
                const cleanValue = value.replace(/['"]/g, '');
                
                results = results.filter(row => {
                  if (operator === '=') return String(row[cleanColumn]) === cleanValue;
                  if (operator === '!=') return String(row[cleanColumn]) !== cleanValue;
                  if (operator === '>') return row[cleanColumn] > cleanValue;
                  if (operator === '<') return row[cleanColumn] < cleanValue;
                  return true;
                });
              }
            }
            
            return { results };
          },
          first: async () => {
            const { results } = await this.all();
            return results[0] || null;
          },
          run: async () => {
            // Handle INSERT statements
            const insertMatch = sql.match(/INSERT\s+INTO\s+([\w"]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
            if (insertMatch) {
              const tableName = insertMatch[1].toLowerCase().replace(/["`]/g, '');
              const columns = insertMatch[2].split(',').map(c => c.trim().replace(/["`]/g, ''));
              const values = insertMatch[3].split(',').map(v => v.trim().replace(/^['"](.*)['"]$/, '$1'));
              
              if (tables[tableName]) {
                const id = crypto.randomUUID();
                const row = { id };
                
                // Map columns to values
                columns.forEach((col, index) => {
                  // Use the provided value or the parameter value if it's a placeholder
                  const value = values[index] === '?' ? params.shift() : values[index];
                  row[col] = value;
                });
                
                // Set defaults for required fields if not provided
                if (tableName === 'users') {
                  if (!row.is_email_verified) row.is_email_verified = 0;
                  if (!row.created_at) row.created_at = new Date().toISOString();
                  if (!row.updated_at) row.updated_at = new Date().toISOString();
                }
                
                tables[tableName].set(id, row);
                return { success: true, meta: { changes: 1, lastRowId: id } };
              }
            }
            return { success: true, meta: { changes: 0 } };
          }
        };
      };

      devDb = {
        tables,
        prepare: (sql) => prepareStatement(sql),
        batch: async (statements) => {
          const results = [];
          for (const stmt of statements) {
            results.push(await stmt.run());
          }
          return results;
        }
      };
    }
    
    this.db = devDb;
    this._initializeClients();
  }

  /**
   * Initialize sub-clients for users, magic links, and tokens
   * @private
   */
  _initializeClients() {
    // Initialize sub-clients with proper binding
    const userClient = new UserClient(this);
    const magicLinkClient = new MagicLinkClient(this);
    const tokenClient = new TokenClient(this);
    
    // Helper function to safely bind methods
    const safeBind = (obj, methodName) => {
      if (typeof obj[methodName] === 'function') {
        return obj[methodName].bind(obj);
      }
      console.warn(`Method ${methodName} not found on client`);
      return () => Promise.reject(new Error(`Method ${methodName} not implemented`));
    };
    
    // Bind methods to maintain 'this' context
    this.users = {
      create: safeBind(userClient, 'create'),
      findById: safeBind(userClient, 'findById'),
      findByEmail: safeBind(userClient, 'findByEmail'),
      update: safeBind(userClient, 'update'),
      delete: safeBind(userClient, 'delete')
    };
    
    this.magicLinks = {
      create: safeBind(magicLinkClient, 'create'),
      findByToken: safeBind(magicLinkClient, 'findByToken'),
      delete: safeBind(magicLinkClient, 'delete')
    };
    
    this.tokens = {
      create: safeBind(tokenClient, 'create'),
      findByToken: safeBind(tokenClient, 'findByToken'),
      delete: safeBind(tokenClient, 'delete'),
      deleteExpired: safeBind(tokenClient, 'deleteExpired')
    };
    
    // Verify all required methods are available
    this._verifyClientMethods(userClient, 
      ['create', 'findById', 'findByEmail', 'update', 'delete'], 
      'UserClient');
    this._verifyClientMethods(magicLinkClient, 
      ['create', 'findByToken', 'delete'], 
      'MagicLinkClient');
    this._verifyClientMethods(tokenClient, 
      ['create', 'findByToken', 'delete', 'deleteExpired'], 
      'TokenClient');
  }

  /**
   * Verify that a client has all required methods
   * @private
   * @param {Object} client - The client to verify
   * @param {string[]} requiredMethods - Array of required method names
   * @param {string} clientName - Name of the client for error messages
   * @throws {Error} If any required methods are missing
   */
  _verifyClientMethods(client, requiredMethods, clientName) {
    const missingMethods = requiredMethods.filter(method => 
      typeof client[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      throw new Error(
        `${clientName} is missing required methods: ${missingMethods.join(', ')}`
      );
    }
  }

  /**
   * Initialize the test database based on the environment
   * @private
   * @param {Object} globalObj - The global object
   * @param {Object} env - Environment variables
   */
  _initializeTestDatabase(globalObj, env) {
    // Try to use the test database manager first
    if (globalObj.process?.env?.TEST_DB_MANAGER === 'true' || env.TEST_DB_MANAGER === 'true') {
      // Import the test database manager dynamically to avoid circular dependencies
      import('../../../../tests/setup/testDb/TestDbManager.js')
        .then((module) => {
          const testDbManager = module.testDbManager || module.default;
          if (testDbManager && typeof testDbManager.getDb === 'function') {
            this.db = testDbManager.getDb();
            this._isInitialized = true;
            console.log('Using test database manager instance');
            this._initializeClients();
          } else {
            console.warn('TestDbManager not available, falling back to D1TestWrapper');
            this._createNewTestDatabase();
          }
        })
        .catch(error => {
          console.error('Failed to initialize test database manager:', error);
          this._createNewTestDatabase();
        });
      return;
    }
    
    // Try to use a global test DB instance
    if (globalObj.__TEST_DB_INSTANCE) {
      this.db = globalObj.__TEST_DB_INSTANCE;
      this._isInitialized = true;
      console.log('Using legacy global test database instance');
      this._initializeClients();
      return;
    }
    
    // Try to initialize from environment
    if (env.TEST_DB_INSTANCE) {
      this._initializeFromEnv(env);
      return;
    }
    
    // Fallback to creating a new test database
    this._createNewTestDatabase();
  }

  /**
   * Initialize the test database from environment variables
   * @private
   * @param {Object} env - Environment variables
   */
  async _initializeFromEnv(env) {
    try {
      const testDbConfig = JSON.parse(env.TEST_DB_INSTANCE);
      if (testDbConfig.type === 'D1TestWrapper') {
        const module = await import('../../../../tests/setup/testDb/D1TestWrapper.js');
        const D1TestWrapper = module.D1TestWrapper || module.default;
        
        if (!D1TestWrapper) {
          throw new Error('D1TestWrapper not found in module exports');
        }
        
        this.db = new D1TestWrapper();
        this._isInitialized = true;
        console.log('Using D1TestWrapper instance from environment');
        this._initializeClients();
      }
    } catch (error) {
      console.error('Failed to initialize test database from environment:', error);
      // Fall back to creating a new test database
      this._createNewTestDatabase();
    }
  }

  /**
   * Create a new test database instance
   * @private
   */
  async _createNewTestDatabase() {
    try {
      const module = await import('../../../../tests/setup/testDb/D1TestWrapper.js');
      const D1TestWrapper = module.D1TestWrapper || module.default;
      
      if (!D1TestWrapper) {
        throw new Error('D1TestWrapper not found in module exports');
      }
      
      this.db = new D1TestWrapper();
      this._isInitialized = true;
      console.log('Created new test database instance');
      this._initializeClients();
    } catch (error) {
      console.error('Failed to create new test database:', error);
      throw error;
    }
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - The SQL query to execute
   * @param {Array|...any} params - Query parameters (can be array or individual args)
   * @returns {Promise<D1Result>} The query result
   */
  async exec(sql, ...params) {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    // Handle both array parameters and individual parameters
    const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    try {
      return await this.db.prepare(sql).bind(...bindParams).run();
    } catch (error) {
      console.error('Database query failed:', { sql, params: bindParams, error });
      throw error;
    }
  }

  /**
   * Execute a raw SQL query and return the first result
   * @param {string} sql - The SQL query to execute
   * @param {Array|...any} params - Query parameters (can be array or individual args)
   * @returns {Promise<Object|null>} The first result or null
   */
  async first(sql, ...params) {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    // Handle both array parameters and individual parameters
    const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    try {
      return await this.db.prepare(sql).bind(...bindParams).first();
    } catch (error) {
      console.error('Database query failed:', { sql, params: bindParams, error });
      throw error;
    }
  }

  /**
   * Execute a raw SQL query and return all results
   * @param {string} sql - The SQL query to execute
   * @param {Array|...any} params - Query parameters (can be array or individual args)
   * @returns {Promise<Object[]>} Array of results
   */
  async all(sql, ...params) {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    // Handle both array parameters and individual parameters
    const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    try {
      const result = await this.db.prepare(sql).bind(...bindParams).all();
      return result.results || [];
    } catch (error) {
      console.error('Database query failed:', { sql, params: bindParams, error });
      throw error;
    }
  }

  /**
   * Execute a raw SQL statement (INSERT, UPDATE, DELETE)
   * @param {string} sql - The SQL statement to execute
   * @param {Array|...any} params - Query parameters (can be array or individual args)
   * @returns {Promise<Object>} The execution result
   */
  async run(sql, ...params) {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    
    // Handle both array parameters and individual parameters
    const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    try {
      return await this.db.prepare(sql).bind(...bindParams).run();
    } catch (error) {
      console.error('Database statement failed:', { sql, params: bindParams, error });
      throw error;
    }
  }

  /**
   * Generate a unique ID
   * @returns {string} A unique identifier
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get the current timestamp in ISO format
   * @returns {string} Current timestamp
   */
  getCurrentTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Prepare a SQL statement
   * @param {string} sql - The SQL query to prepare
   * @returns {Promise<D1PreparedStatement>} A prepared statement
   */
  async prepare(sql) {
    await this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db.prepare(sql);
  }

  // Backward compatibility methods
  // These delegate to the appropriate sub-client with the new method names

  // User methods
  async createUser(userData) {
    return this.users.create(userData);
  }

  async findUserByEmail(email) {
    return this.users.findByEmail(email);
  }

  async findUserById(userId) {
    return this.users.findById(userId);
  }

  async updateUser(userId, updates) {
    return this.users.update(userId, updates);
  }

  // Magic link methods
  async createMagicLink(params) {
    return this.magicLinks.create(params);
  }

  async findMagicLinkByToken(token) {
    return this.magicLinks.findByToken(token);
  }

  async markMagicLinkAsUsed(token) {
    return this.magicLinks.markAsUsed(token);
  }

  async getLatestMagicLinkForUser(userId) {
    return this.magicLinks.findLatestForUser(userId);
  }

  // Token methods
  async createToken(params) {
    return this.tokens.create(params);
  }

  async findToken(token) {
    return this.tokens.findByToken(token);
  }

  async revokeToken(token) {
    return this.tokens.revoke(token);
  }

  async isTokenValid(token, type) {
    return this.tokens.isValid(token, type);
  }

  async getUserTokens(userId, type) {
    return this.tokens.findByUserId(userId, type);
  }
}

// Export a singleton instance
let d1ClientInstance = null;

/**
 * Initialize the D1 client with environment bindings
 * @param {Object} env - The environment object containing DB binding
 * @returns {Promise<D1Client>} The initialized D1 client instance
 */
export async function initD1Client(env) {
  if (!env) {
    throw new Error('Environment object is required');
  }

  // Create a new instance of D1Client with the environment
  d1ClientInstance = new D1Client(env.DB, env);
  
  // If we're in a test environment, we need to wait for the DB to be initialized
  if (env.NODE_ENV === 'test' || env.USE_TEST_DB === 'true') {
    await new Promise((resolve) => {
      const checkInitialized = () => {
        if (d1ClientInstance._isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialized, 10);
        }
      };
      checkInitialized();
    });
  }
  
  return d1ClientInstance;
}

/**
 * Get the D1 client instance
 * @returns {D1Client} The D1 client instance
 * @throws {Error} If client is not initialized
 */
export function getD1Client() {
  if (!d1ClientInstance) {
    throw new Error('D1 client not initialized. Call initD1Client() first.');
  }
  return d1ClientInstance;
}

/**
 * Reset the D1 client instance (for testing)
 * @param {Object} [db] - Optional new database binding
 * @returns {D1Client} The D1 client instance
 */
export function resetD1Client(db) {
  d1ClientInstance = db ? new D1Client(db) : null;
  return d1ClientInstance;
}

// For backward compatibility
export { D1Client as default };

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

// Global SQL.js instance
let SQL = null;

/**
 * Create an in-memory SQLite database for testing with D1-compatible interface
 * @returns {Promise<Object>} A D1-compatible database instance
 */
export async function createTestDb() {
  console.log('\n=== Starting createTestDb() ===');
  console.log('   - Current working directory:', process.cwd());
  console.log('   - Node.js version:', process.version);
  console.log('   - Platform:', process.platform);
  
  // Initialize SQL.js if not already done
  if (!SQL) {
    console.log('1. Initializing SQL.js...');
    try {
      console.log('   - Attempting to import sql.js...');
      
      // Try different ways to import sql.js
      let sqlJsModule;
      try {
        // First try the default import
        console.log('   - Trying default import...');
        sqlJsModule = await import('sql.js');
        console.log('   - Successfully imported sql.js using default import');
      } catch (importError) {
        console.log('   - Default import failed, trying alternative import...');
        try {
          // Try alternative import
          sqlJsModule = await import('sql.js/dist/sql-wasm.js');
          console.log('   - Successfully imported sql.js using alternative path');
        } catch (altImportError) {
          console.error('   - All import attempts failed:', {
            defaultImportError: importError.message,
            altImportError: altImportError.message
          });
          throw new Error(`Failed to import sql.js: ${importError.message}`);
        }
      }
      
      if (!sqlJsModule) {
        throw new Error('sql.js module import returned undefined');
      }
      
      console.log('   - SQL.js module loaded successfully');
      console.log('   - Module exports:', Object.keys(sqlJsModule).join(', '));
      
      // Get the initSqlJs function from the module
      const initSqlJs = sqlJsModule.default || sqlJsModule.initSqlJs || sqlJsModule;
      
      if (!initSqlJs) {
        console.error('   - Could not find initSqlJs function in sql.js module');
        console.error('   - Available properties:', Object.keys(sqlJsModule).join(', '));
        throw new Error('Could not find initSqlJs function in sql.js module');
      }
      
      console.log('   - Found initSqlJs function:', typeof initSqlJs);
      
      try {
        console.log('   - Initializing SQL.js...');
        SQL = await (typeof initSqlJs === 'function' ? initSqlJs() : initSqlJs);
        
        if (!SQL) {
          throw new Error('SQL.js initialization returned undefined');
        }
        
        console.log('   ✅ SQL.js initialized successfully');
        console.log('   - SQL.js version:', SQL.version || 'unknown');
        console.log('   - SQL.js Database type:', typeof SQL.Database);
      } catch (initError) {
        console.error('   ❌ SQL.js initialization failed:', initError);
        if (initError.stack) {
          console.error('   Stack trace:', initError.stack);
        }
        throw new Error(`SQL.js initialization failed: ${initError.message}`);
      }
      
    } catch (error) {
      console.error('   ❌ Failed to initialize SQL.js:', error);
      if (error.stack) {
        console.error('   Stack trace:', error.stack);
      }
      throw new Error(`SQL.js initialization failed: ${error.message}`);
    }
  } else {
    console.log('1. SQL.js already initialized');
  }
  
  // Create a new in-memory database
  console.log('2. Creating in-memory database...');
  try {
    if (!SQL.Database) {
      throw new Error('SQL.Database is not a constructor');
    }
    
    const db = new SQL.Database();
    
    if (!db) {
      throw new Error('Failed to create database instance');
    }
    
    console.log('   ✅ In-memory database created');
    
    // Store the original prepare method
    if (typeof db.prepare !== 'function') {
      throw new Error(`db.prepare is not a function. Available methods: ${Object.keys(db).join(', ')}`);
    }
    
    const originalPrepare = db.prepare.bind(db);
    
    // Add D1-compatible methods
    db.prepare = (sql) => {
      console.log(`\n=== Preparing SQL statement ===`);
      console.log('SQL:', sql.replace(/\s+/g, ' ').trim());
      
      try {
        const stmt = originalPrepare.call(db, sql);
        if (!stmt) {
          throw new Error('Failed to prepare statement - returned undefined');
        }
        console.log('   ✅ Statement prepared successfully');
        
        // Add D1-compatible methods
        stmt.all = async (params = []) => {
          console.log('   - Executing .all() with params:', params);
          try {
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
            stmt.reset();
            console.log(`   - Retrieved ${results.length} rows`);
            return { results };
          } catch (error) {
            console.error('   - Error in .all():', error);
            throw error;
          }
        };
        
        // Store original methods to prevent infinite recursion
        const originalMethods = {
          getAsObject: stmt.getAsObject.bind(stmt),
          step: stmt.step.bind(stmt),
          reset: stmt.reset.bind(stmt),
          bind: stmt.bind.bind(stmt)
        };

        // Override methods with wrapped versions
        stmt.get = async (params = []) => {
          console.log('   - Executing .get() with params:', params);
          try {
            originalMethods.bind(params);
            const hasRow = originalMethods.step();
            const result = hasRow ? originalMethods.getAsObject() : null;
            originalMethods.reset();
            return result;
          } catch (error) {
            console.error('   - Error in .get():', error);
            throw error;
          }
        };
        
        stmt.run = async (params = []) => {
          console.log('   - Executing .run() with params:', params);
          try {
            stmt.bind(params);
            stmt.step();
            stmt.reset();
            return { success: true };
          } catch (error) {
            console.error('   - Error in .run():', error);
            throw error;
          }
        };
        
        stmt.finalize = function() {
          try {
            stmt.free();
            console.log('   ✅ Statement finalized');
            return { success: true };
          } catch (error) {
            console.error('   Failed to finalize statement:', error);
            throw error;
          }
        };
        
        stmt.bind = (params = []) => {
          console.log('   - Binding params:', params);
          try {
            originalBind(params);
            return stmt;
          } catch (error) {
            console.error('   - Error in .bind():', error);
            throw error;
          }
        };
        
        return stmt;
        
      } catch (error) {
        console.error('   - Error preparing statement:', error);
        throw error;
      }
    };
    
    // Add D1-compatible exec method
    db.exec = (sql) => {
      console.log(`\n=== Executing SQL directly ===`);
      console.log('SQL:', sql);
      
      try {
        const results = [];
        const stmt = db.prepare(sql);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        console.log(`   ✅ Executed, ${results.length} rows affected`);
        return results;
      } catch (error) {
        console.error('   ❌ Execution failed:', error);
        throw error;
      }
    };
    
    // Add D1-compatible batch method
    db.batch = async (statements) => {
      const results = [];
      for (const stmt of statements) {
        const prepared = db.prepare(stmt.sql);
        prepared.bind(stmt.params || []);
        prepared.step();
        prepared.free();
        results.push({ success: true });
      }
      return results;
    };
    
    // Test the database connection
    try {
      console.log('\n=== Testing database connection ===');
      const testResult = db.prepare('SELECT 1 as test').get();
      console.log('   ✅ Database connection test successful:', testResult);
      return db;
    } catch (testError) {
      console.error('   ❌ Database connection test failed:', testError);
      throw new Error(`Database connection test failed: ${testError.message}`);
    }
    
  } catch (error) {
    console.error('   ❌ Failed to create in-memory database:', error);
    console.error('   - SQL available:', !!SQL);
    console.error('   - SQL.Database available:', !!(SQL && SQL.Database));
    console.error('   - Error details:', error.stack || error.message);
    throw new Error(`Failed to create in-memory database: ${error.message}`);
  }
}

/**
 * Initialize the test database with schema and migrations
 * @param {Object} db - The database instance
 * @param {string} migrationsPath - Path to the migrations directory
 * @returns {Promise<void>}
 */
export async function initTestDb(db, migrationsPath = join(process.cwd(), 'migrations')) {
  console.log('\n=== Initializing test database ===');
  console.log('   - Migrations path:', migrationsPath);
  
  try {
    // Read and apply migrations
    const migrationFiles = [
      '0001_initial_schema.sql',
      // Add more migration files as needed
    ];
    
    for (const file of migrationFiles) {
      const filePath = join(migrationsPath, file);
      console.log(`   - Applying migration: ${file}`);
      
      try {
        const sql = await readFile(filePath, 'utf8');
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const stmt of statements) {
          if (stmt.trim()) {
            await db.prepare(stmt).run();
          }
        }
        
        console.log(`   ✅ Applied migration: ${file}`);
      } catch (error) {
        console.error(`   ❌ Failed to apply migration ${file}:`, error);
        throw error;
      }
    }
    
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Close the test database connection
 * @param {Object} db - The database instance to close
 * @returns {Promise<void>}
 */
export async function closeTestDb(db) {
  if (!db) return;
  
  try {
    console.log('\n=== Closing test database ===');
    // Close the database if it has a close method
    if (typeof db.db.close === 'function') {
      await db.db.close();
      console.log('   ✅ Database closed successfully');
    } else {
      console.log('   ℹ️ Database does not have a close method');
    }
  } catch (error) {
    console.error('   ❌ Failed to close database:', error);
    throw error;
  }
}

/**
 * Reset the test database to initial state
 * @param {Object} db - The database instance to reset
 * @returns {Promise<void>}
 */
export async function resetTestDb(db) {
  if (!db) return;
  
  try {
    console.log('\n=== Resetting test database ===');
    // Get all tables
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV'"
    ).all();
    
    // Drop all tables
    for (const table of tables.results) {
      await db.prepare(`DROP TABLE IF EXISTS ${table.name}`).run();
      console.log(`   - Dropped table: ${table.name}`);
    }
    
    console.log('   ✅ Database reset completed');
  } catch (error) {
    console.error('   ❌ Failed to reset database:', error);
    throw error;
  }
}

export default {
  createTestDb,
  initTestDb,
  closeTestDb,
  resetTestDb
};

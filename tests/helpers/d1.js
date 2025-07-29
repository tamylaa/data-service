import sqlite, { sql } from '@databases/sqlite';
import { getWranglerConfig } from './config.js';

/**
 * Get a D1-compatible database instance for testing
 */
export async function getTestDatabase() {
  const config = await getWranglerConfig();
  const dbConfig = config.env.development.d1_databases[0];
  
  // Connect to the local SQLite database
  const db = await sqlite(`:memory:`);
  
  // Helper function to create parameterized query
  const createQuery = (query, params) => {
    // Replace ? placeholders with actual parameters for SQLite
    let paramIndex = 0;
    const processedQuery = query.replace(/\?/g, () => {
      const param = params[paramIndex++];
      if (typeof param === 'string') {
        return `'${param.replace(/'/g, "''")}'`; // Escape single quotes
      }
      return param;
    });
    return sql.__dangerous__rawValue(processedQuery);
  };

  // Add D1-compatible methods
  return {
    prepare: (query) => ({
      bind: (...params) => ({
        all: async () => {
          const results = await db.query(createQuery(query, params));
          return { results };
        },
        first: async () => {
          const results = await db.query(createQuery(query, params));
          return results[0] || null;
        },
        run: async () => {
          await db.query(createQuery(query, params));
          return { success: true };
        }
      }),
      all: async (...params) => {
        const results = await db.query(createQuery(query, params));
        return { results };
      },
      first: async (...params) => {
        const results = await db.query(createQuery(query, params));
        return results[0] || null;
      },
      run: async (...params) => {
        await db.query(createQuery(query, params));
        return { success: true };
      }
    }),
    exec: async (query, params = []) => {
      const results = await db.query(createQuery(query, params));
      return { results };
    },
    batch: async (statements) => {
      const results = [];
      for (const stmt of statements) {
        // Handle both prepared statements and query objects
        const query = stmt.query || stmt;
        const params = stmt.params || [];
        await db.query(createQuery(query, params));
        results.push({ success: true });
      }
      return results;
    }
  };
}

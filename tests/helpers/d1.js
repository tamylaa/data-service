/**
 * Get a D1-compatible database instance for testing
 * Uses the same test database infrastructure as the E2E tests
 */
export async function getTestDatabase() {
  // Import the D1TestWrapper that we know works from E2E tests
  try {
    const module = await import('../setup/testDb/D1TestWrapper.js');
    const D1TestWrapper = module.D1TestWrapper || module.default;
    
    if (!D1TestWrapper) {
      throw new Error('D1TestWrapper not found in module exports');
    }
    
    return new D1TestWrapper();
  } catch (error) {
    console.error('Failed to create test database:', error);
    
    // Fallback to simple in-memory implementation
    const tables = {
      users: new Map(),
      magic_links: new Map(),
      tokens: new Map()
    };
    
    const prepareStatement = (sql, params = []) => {
      return {
        bind: (...bindParams) => prepareStatement(sql, [...params, ...bindParams]),
        all: async () => {
          // Parse table name from SQL
          const tableMatch = sql.match(/FROM\s+([\w"]+)/i);
          if (!tableMatch) return { results: [] };
          
          const tableName = tableMatch[1].toLowerCase().replace(/["`]/g, '');
          if (!tables[tableName]) return { results: [] };
          
          return { results: Array.from(tables[tableName].values()) };
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
            const id = crypto.randomUUID();
            
            if (tables[tableName]) {
              tables[tableName].set(id, { id });
              return { success: true, meta: { changes: 1, lastRowId: id } };
            }
          }
          return { success: true, meta: { changes: 0 } };
        }
      };
    };

    return {
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
}

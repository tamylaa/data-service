/**
 * D1TestWrapper - Simple test database wrapper for E2E tests
 * Provides a minimal D1-compatible interface for testing
 */

export class D1TestWrapper {
  constructor() {
    this.tables = {
      users: new Map(),
      magic_links: new Map(),
      tokens: new Map()
    };
    this.initialized = true;
  }

  /**
   * Prepare a SQL statement
   * @param {string} sql - The SQL query
   * @returns {Object} Prepared statement interface
   */
  prepare(sql) {
    return {
      bind: (...params) => this._createBoundStatement(sql, params),
      all: () => this._executeQuery(sql, 'all'),
      first: () => this._executeQuery(sql, 'first'),
      run: () => this._executeQuery(sql, 'run')
    };
  }

  /**
   * Create a bound statement with parameters
   * @private
   */
  _createBoundStatement(sql, params) {
    return {
      all: () => this._executeQuery(sql, 'all', params),
      first: () => this._executeQuery(sql, 'first', params),
      run: () => this._executeQuery(sql, 'run', params)
    };
  }

  /**
   * Execute a SQL query
   * @private
   */
  async _executeQuery(sql, type, params = []) {
    const sqlLower = sql.toLowerCase().trim();
    
    // Handle SELECT queries
    if (sqlLower.startsWith('select')) {
      return this._handleSelect(sql, type, params);
    }
    
    // Handle INSERT queries
    if (sqlLower.startsWith('insert')) {
      return this._handleInsert(sql, params);
    }
    
    // Handle UPDATE queries
    if (sqlLower.startsWith('update')) {
      return this._handleUpdate(sql, params);
    }
    
    // Handle DELETE queries
    if (sqlLower.startsWith('delete')) {
      return this._handleDelete(sql, params);
    }
    
    // Default response for unknown queries
    return type === 'run' ? { success: true, meta: { changes: 0 } } : 
           type === 'first' ? null : { results: [] };
  }

  /**
   * Handle SELECT queries
   * @private
   */
  _handleSelect(sql, type, params) {
    // Extract table name
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) {
      return type === 'first' ? null : { results: [] };
    }
    
    const tableName = tableMatch[1];
    const table = this.tables[tableName];
    if (!table) {
      return type === 'first' ? null : { results: [] };
    }
    
    let results = Array.from(table.values());
    
    // Simple WHERE clause handling
    const whereMatch = sql.match(/where\s+(.+?)(?:\s+order|\s+limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Handle email = ? or email = 'value'
      if (whereClause.includes('email')) {
        const emailMatch = whereClause.match(/email\s*=\s*\?/i);
        if (emailMatch && params[0]) {
          results = results.filter(row => row.email === params[0]);
        } else {
          const emailValueMatch = whereClause.match(/email\s*=\s*['"]([^'"]+)['"]/i);
          if (emailValueMatch) {
            results = results.filter(row => row.email === emailValueMatch[1]);
          }
        }
      }
      
      // Handle id = ? or id = 'value'
      if (whereClause.includes('id')) {
        const idMatch = whereClause.match(/id\s*=\s*\?/i);
        if (idMatch && params[0]) {
          results = results.filter(row => row.id === params[0]);
        } else {
          const idValueMatch = whereClause.match(/id\s*=\s*['"]([^'"]+)['"]/i);
          if (idValueMatch) {
            results = results.filter(row => row.id === idValueMatch[1]);
          }
        }
      }
      
      // Handle token = ? or token = 'value'
      if (whereClause.includes('token')) {
        const tokenMatch = whereClause.match(/token\s*=\s*\?/i);
        if (tokenMatch && params[0]) {
          results = results.filter(row => row.token === params[0]);
        } else {
          const tokenValueMatch = whereClause.match(/token\s*=\s*['"]([^'"]+)['"]/i);
          if (tokenValueMatch) {
            results = results.filter(row => row.token === tokenValueMatch[1]);
          }
        }
      }
    }
    
    if (type === 'first') {
      return results[0] || null;
    }
    
    return { results };
  }

  /**
   * Handle INSERT queries
   * @private
   */
  _handleInsert(sql, params) {
    const insertMatch = sql.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (!insertMatch) {
      return { success: true, meta: { changes: 0 } };
    }
    
    const tableName = insertMatch[1];
    const columns = insertMatch[2].split(',').map(c => c.trim());
    const placeholders = insertMatch[3].split(',').map(p => p.trim());
    
    const table = this.tables[tableName];
    if (!table) {
      return { success: true, meta: { changes: 0 } };
    }
    
    const id = this._generateId();
    const row = { id };
    
    // Map columns to values
    columns.forEach((col, index) => {
      if (placeholders[index] === '?') {
        row[col] = params[index] || null;
      } else {
        // Remove quotes from literal values
        row[col] = placeholders[index].replace(/^['"](.*)['"]$/, '$1');
      }
    });
    
    // Set defaults for common fields
    if (tableName === 'users') {
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (!row.updated_at) row.updated_at = new Date().toISOString();
      if (row.is_email_verified === undefined) row.is_email_verified = 0;
    }
    
    if (tableName === 'magic_links') {
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (!row.expires_at && row.expiry) row.expires_at = row.expiry;
      if (row.is_used === undefined) row.is_used = 0;
    }
    
    if (tableName === 'tokens') {
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (!row.expires_at && row.expiry) row.expires_at = row.expiry;
      if (row.is_revoked === undefined) row.is_revoked = 0;
    }
    
    table.set(id, row);
    
    return { 
      success: true, 
      meta: { 
        changes: 1, 
        last_row_id: id,
        lastRowId: id
      } 
    };
  }

  /**
   * Handle UPDATE queries
   * @private
   */
  _handleUpdate(sql, params) {
    const updateMatch = sql.match(/update\s+(\w+)\s+set\s+(.+?)\s+where\s+(.+)/i);
    if (!updateMatch) {
      return { success: true, meta: { changes: 0 } };
    }
    
    const tableName = updateMatch[1];
    const setClause = updateMatch[2];
    const whereClause = updateMatch[3];
    
    const table = this.tables[tableName];
    if (!table) {
      return { success: true, meta: { changes: 0 } };
    }
    
    // Parse SET clause (e.g., "is_email_verified = ?, updated_at = ?")
    const setFields = [];
    const setParts = setClause.split(',');
    let paramIndex = 0;
    
    setParts.forEach(part => {
      const [field, value] = part.trim().split('=').map(s => s.trim());
      if (value === '?') {
        setFields.push({ field, value: params[paramIndex++] });
      } else {
        setFields.push({ field, value: value.replace(/^['"](.*)['"]$/, '$1') });
      }
    });
    
    // Parse WHERE clause (simple: assumes "id = ?" format)
    const whereMatch = whereClause.match(/(\w+)\s*=\s*\?/);
    if (!whereMatch) {
      return { success: true, meta: { changes: 0 } };
    }
    
    const whereField = whereMatch[1];
    const whereValue = params[paramIndex]; // The remaining parameter should be the WHERE value
    
    // Find and update the record
    let changes = 0;
    for (const [id, row] of table.entries()) {
      if (row[whereField] === whereValue) {
        // Update the row
        setFields.forEach(({ field, value }) => {
          row[field] = value;
        });
        changes++;
        break; // Assuming single record update
      }
    }
    
    return { success: true, meta: { changes } };
  }

  /**
   * Handle DELETE queries
   * @private
   */
  _handleDelete(sql, params) {
    // Simple delete handling - you can expand this as needed
    return { success: true, meta: { changes: 1 } };
  }

  /**
   * Generate a unique ID
   * @private
   */
  _generateId() {
    return crypto.randomUUID();
  }

  /**
   * Execute batch statements
   */
  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  /**
   * Initialize method for compatibility
   */
  initialize() {
    // Already initialized in constructor
    return this;
  }

  /**
   * Reset all tables (useful for testing)
   */
  reset() {
    this.tables = {
      users: new Map(),
      magic_links: new Map(),
      tokens: new Map()
    };
  }
}

export default D1TestWrapper;

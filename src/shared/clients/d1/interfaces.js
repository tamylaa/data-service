/**
 * @typedef {Object} D1Statement
 * @property {function} bind - Bind parameters to the statement
 * @property {function} first - Get first result
 * @property {function} all - Get all results
 * @property {function} run - Execute the statement
 */

/**
 * @typedef {Object} D1Database
 * @property {function} prepare - Prepare a statement
 * @property {function} exec - Execute raw SQL
 */

/**
 * @typedef {Object} TestStatement
 * @property {function} first - Get first result
 * @property {function} all - Get all results
 * @property {function} run - Execute the statement
 */

/**
 * @typedef {Object} TestDatabase
 * @property {function} prepare - Prepare a statement
 * @property {function} exec - Execute raw SQL
 * @property {function} _executeQuery - Internal query execution
 */

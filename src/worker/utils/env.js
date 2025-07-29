/**
 * Safely get environment variables that work in both Node.js and Cloudflare Workers
 * @param {Object} env - The Cloudflare Workers environment object
 * @param {string} key - The environment variable key
 * @param {string} [defaultValue] - Default value if the environment variable is not found
 * @returns {string} The environment variable value or the default value
 */
export function getEnv(env, key, defaultValue = '') {
  // In Cloudflare Workers, we only use the env object
  if (env && typeof env[key] !== 'undefined') {
    return env[key];
  }
  
  return defaultValue;
}

/**
 * Get the current environment (development, test, production)
 * @param {Object} env - The Cloudflare Workers environment object
 * @returns {string} The current environment
 */
export function getEnvType(env) {
  return getEnv(env, 'NODE_ENV', 'development');
}

/**
 * Check if the current environment is development
 * @param {Object} env - The Cloudflare Workers environment object
 * @returns {boolean} True if in development environment
 */
export function isDevelopment(env) {
  return getEnvType(env) === 'development';
}

/**
 * Check if the current environment is test
 * @param {Object} env - The Cloudflare Workers environment object
 * @returns {boolean} True if in test environment
 */
export function isTest(env) {
  return getEnvType(env) === 'test';
}

/**
 * Check if the current environment is production
 * @param {Object} env - The Cloudflare Workers environment object
 * @returns {boolean} True if in production environment
 */
export function isProduction(env) {
  return getEnvType(env) === 'production';
}

/**
 * Test Configuration
 * Manages test environment and database configuration
 */

export const TEST_CONFIG = {
    // Test environment configurations
    ENV: {
        development: 'development',
        test: 'test',
        integration: 'integration'
    },

    // Database configurations
    DB: {
        inMemory: {
            type: 'memory',
            name: 'in-memory-test-db'
        },
        local: {
            type: 'local',
            name: 'tamyla-auth-db-local',
            file: './local-db.sql'
        }
    },

    // Test user configurations
    TEST_USER: {
        email: 'test-user@example.com',
        password: 'test-password-123',
        name: 'Test User'
    },

    // API configurations
    API: {
        baseUrl: 'http://localhost:3002'
    }
};

/**
 * Get database configuration based on test environment
 * @param {string} env - Test environment
 * @returns {Object} Database configuration
 */
export function getDbConfig(env = process.env.NODE_ENV) {
    switch (env) {
        case TEST_CONFIG.ENV.integration:
            return TEST_CONFIG.DB.local;
        case TEST_CONFIG.ENV.development:
        case TEST_CONFIG.ENV.test:
        default:
            return TEST_CONFIG.DB.inMemory;
    }
}

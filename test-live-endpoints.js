/**
 * Live API Endpoint Testing Script
 * Tests all endpoints against a running data service instance
 * Usage: node test-live-endpoints.js [baseUrl]
 */

import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'endpoint-test-results.log');

// Clear previous log
if (fs.existsSync(LOG_FILE)) {
  fs.unlinkSync(LOG_FILE);
}

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:8787';
const TEST_USER = {
  email: 'test@example.com',
  name: 'Test User'
};

// Logger
const logger = {
  log: (...args) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${args.join(' ')}`;
    console.log(...args);
    fs.appendFileSync(LOG_FILE, message + '\n');
  },
  error: (...args) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ERROR: ${args.join(' ')}`;
    console.error(...args);
    fs.appendFileSync(LOG_FILE, message + '\n');
  }
};

// Test utilities
const test = async (name, fn) => {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASSED: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAILED: ${name}:`, error.message);
    logger.error(`${name}: ${error.message}`);
    return false;
  }
};

const makeRequest = async (method, endpoint, body = null, headers = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  logger.log(`${method} ${url}`);
  if (body) {
    logger.log(`Request body: ${JSON.stringify(body)}`);
  }
  
  const response = await fetch(url, options);
  const responseText = await response.text();
  
  logger.log(`Response status: ${response.status}`);
  logger.log(`Response body: ${responseText}`);
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  
  return { response, data };
};

// Test cases
const tests = {
  async healthCheck() {
    const { response, data } = await makeRequest('GET', '/health');
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    
    if (typeof data === 'object' && data.status) {
      console.log(`  ℹ️ Service status: ${data.status}`);
      console.log(`  ℹ️ Environment: ${data.environment || 'unknown'}`);
      console.log(`  ℹ️ Timestamp: ${data.timestamp || 'unknown'}`);
    }
  },

  async magicLinkRequest() {
    const { response, data } = await makeRequest('POST', '/auth/magic-link', TEST_USER);
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (!data.success) {
      throw new Error(`Magic link request failed: ${data.error || 'Unknown error'}`);
    }
    
    console.log(`  ℹ️ Magic link generated successfully`);
    
    // Store token for verification test
    if (data.token) {
      tests._magicToken = data.token;
      console.log(`  ℹ️ Token available for testing: ${data.token.substring(0, 8)}...`);
    }
    
    if (data.magicLink) {
      console.log(`  ℹ️ Magic link: ${data.magicLink}`);
    }
    
    return data;
  },

  async magicLinkVerification() {
    if (!tests._magicToken) {
      throw new Error('No magic token available (run magic link request first)');
    }
    
    const { response, data } = await makeRequest('POST', '/auth/magic-link/verify', {
      token: tests._magicToken
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (!data.success) {
      throw new Error(`Magic link verification failed: ${data.error || 'Unknown error'}`);
    }
    
    if (!data.token) {
      throw new Error('No auth token returned');
    }
    
    if (!data.user) {
      throw new Error('No user data returned');
    }
    
    console.log(`  ℹ️ User authenticated: ${data.user.email}`);
    console.log(`  ℹ️ Auth token: ${data.token.substring(0, 16)}...`);
    
    // Store auth token for subsequent tests
    tests._authToken = data.token;
    
    return data;
  },

  async getCurrentUser() {
    if (!tests._authToken) {
      throw new Error('No auth token available (run magic link verification first)');
    }
    
    const { response, data } = await makeRequest('GET', '/auth/me', null, {
      'Authorization': `Bearer ${tests._authToken}`
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(data)}`);
    }
    
    if (!data.email) {
      throw new Error('No user email returned');
    }
    
    console.log(`  ℹ️ Current user: ${data.email}`);
    console.log(`  ℹ️ Email verified: ${data.is_email_verified ? 'Yes' : 'No'}`);
    
    return data;
  },

  async unauthorizedAccess() {
    const { response, data } = await makeRequest('GET', '/auth/me');
    
    if (response.status !== 401) {
      throw new Error(`Expected 401 (unauthorized), got ${response.status}`);
    }
    
    console.log(`  ℹ️ Properly rejected unauthorized request`);
  },

  async invalidEndpoint() {
    const { response } = await makeRequest('GET', '/invalid-endpoint');
    
    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }
    
    console.log(`  ℹ️ Properly returned 404 for invalid endpoint`);
  }
};

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Live API Endpoint Tests');
  console.log(`📡 Testing against: ${BASE_URL}`);
  console.log(`📝 Logs will be saved to: ${LOG_FILE}`);
  console.log('=' .repeat(60));
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // Core functionality tests
  const testSequence = [
    'healthCheck',
    'magicLinkRequest', 
    'magicLinkVerification',
    'getCurrentUser',
    'unauthorizedAccess',
    'invalidEndpoint'
  ];
  
  for (const testName of testSequence) {
    results.total++;
    const passed = await test(testName, tests[testName]);
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
      results.errors.push(testName);
    }
  }
  
  // Results summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(60));
  
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log(`\n🚨 Failed Tests:`);
    results.errors.forEach(error => console.log(`  • ${error}`));
  }
  
  const successRate = (results.passed / results.total) * 100;
  console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (successRate === 100) {
    console.log('\n🎉 ALL TESTS PASSED! API is fully functional.');
  } else if (successRate >= 80) {
    console.log('\n⚠️ Most tests passed. Check failed tests for issues.');
  } else {
    console.log('\n🚨 Multiple test failures. API needs attention.');
  }
  
  console.log(`\n📋 Detailed logs saved to: ${LOG_FILE}`);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  logger.error('Uncaught Exception:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Run tests
runAllTests();

/**
 * Test script for local production simulation
 * Run with: npm run test:prod
 */

import fetch from 'node-fetch';

import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'test-results.log');

// Clear previous log file
if (fs.existsSync(LOG_FILE)) {
  fs.unlinkSync(LOG_FILE);
}

// Custom logger
const logger = {
  log: (...args) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ')}`;
    
    console.log(...args);
    fs.appendFileSync(LOG_FILE, message + '\n');
  },
  error: (...args) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ERROR: ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ')}`;
    
    console.error(...args);
    fs.appendFileSync(LOG_FILE, message + '\n');
  }
};

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3002',
  endpoints: {
    health: '/health',
    requestMagicLink: '/api/auth/magic-link',
    verifyMagicLink: '/api/auth/verify',
    getCurrentUser: '/api/auth/me'
  },
  testUser: {
    email: 'test@example.com',
    name: 'Test User'
  }
};

// Utility functions
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}:`, error.message);
    throw error;
  }
};

// Test cases
const originalConsoleLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  originalConsoleLog(`[${timestamp}]`, ...args);
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${args.join(' ')}\n`);
};

// Test runner with better error handling
async function runTests() {
  logger.log('🚀 Starting production simulation tests...\n');
  let passed = 0;
  let failed = 0;
  
  const runTest = async (name, testFn) => {
    const testStart = Date.now();
    try {
      logger.log(`\n=== TEST: ${name} ===`);
      await testFn();
      const duration = Date.now() - testStart;
      logger.log(`✅ ${name} (${duration}ms)`);
      passed++;
      return true;
    } catch (error) {
      const duration = Date.now() - testStart;
      logger.error(`❌ ${name} failed (${duration}ms):`);
      logger.error(error.message);
      if (error.response) {
        logger.error('Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: Object.fromEntries(error.response.headers.entries()),
          body: error.response._bodyText || error.response.body
        });
      }
      if (error.stack) {
        logger.error('Stack:', error.stack.split('\n').slice(1).join('\n'));
      }
      failed++;
      return false;
    }
  };
  
  // 1. Test health check
  await runTest('Health check endpoint', async () => {
    const url = `${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.health}`;
    logger.log(`GET ${url}`);
    
    const response = await fetch(url);
    const responseText = await response.text();
    
    logger.log(`Response status: ${response.status} ${response.statusText}`);
    logger.log('Response headers:', Object.fromEntries(response.headers.entries()));
    logger.log('Response body:', responseText);
    
    if (!response.ok) {
      throw Object.assign(
        new Error(`Health check failed with status ${response.status}: ${response.statusText}`),
        { response }
      );
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
      logger.log('Parsed response:', JSON.stringify(data, null, 2));
    } catch (e) {
      throw new Error(`Failed to parse health check response: ${e.message}\nResponse: ${responseText}`);
    }
    
    if (data.status !== 'ok') {
      throw new Error(`Unexpected health check response: ${JSON.stringify(data)}`);
    }
  });

  // 2. Test magic link request
  let magicLinkToken;
  await runTest('Request magic link', async () => {
    const url = `${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.requestMagicLink}`;
    const requestBody = {
      email: TEST_CONFIG.testUser.email,
      name: TEST_CONFIG.testUser.name
    };
    
    console.log('\nSending magic link request to:', url);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', JSON.stringify([...response.headers.entries()], null, 2));
    console.log('Response body:', responseText);

    if (!response.ok) {
      let errorMessage = `Magic link request failed with status ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage += `: ${errorData.message || response.statusText}`;
      } catch (e) {
        errorMessage += `: ${responseText}`;
      }
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Parsed response data:', JSON.stringify(data, null, 2));
      
      // Check for token in the response
      if (data.success && data.data && data.data.token) {
        magicLinkToken = data.data.token;
        console.log('Magic link token received:', magicLinkToken);
      } else {
        throw new Error(`Unexpected response format. Expected token in data.data.token. Got: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (e) {
      throw new Error(`Failed to process magic link response: ${e.message}\nResponse: ${responseText}`);
    }
  });

  const summary = `\n=== TEST SUMMARY ===\n✅ ${passed} tests passed\n${failed > 0 ? `❌ ${failed} tests failed` : '🎉 All tests passed!'}`;
  
  logger.log(summary);
  
  if (failed > 0) {
    logger.error('\nCheck the test-results.log file for detailed error information.');
    process.exit(1);
  }
  console.log('\nTo test the magic link flow:');
  console.log(`1. Use this token to verify: ${magicLinkToken}`);
  console.log(`2. Send a POST request to ${TEST_CONFIG.baseUrl}${TEST_CONFIG.endpoints.verifyMagicLink}`);
  console.log('   with body: { "token": "' + magicLinkToken + '" }');
};

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});

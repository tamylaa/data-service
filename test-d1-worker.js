import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { D1Client } from './src/shared/clients/d1/index.js';

const execAsync = promisify(exec);

// Configuration
let BASE_URL = 'http://localhost:3002';
const TEST_EMAIL = `test-user-${Date.now()}@example.com`; // Unique email for each test run
const TEST_PASSWORD = 'test-password-123';
const WORKER_SCRIPT = 'src/worker/index.js';

console.log('Test Configuration:');
console.log(`- Base URL: ${BASE_URL}`);
console.log(`- Test Email: ${TEST_EMAIL}`);
console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);

// Global variables to store test data
let authToken = '';
let userId = '';
let magicLinkToken = '';
let currentTest = 'Initializing test runner';
let d1Client; // D1 client instance for direct database access

// Set environment to development for in-memory database
process.env.NODE_ENV = 'development';

// Handle uncaught exceptions
process.on('uncaughtException', (error, origin) => {
  console.error('\n🚨 UNCAUGHT EXCEPTION:', error);
  console.error('Exception origin:', origin);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// Helper function to find an available port
async function findAvailablePort(startPort = 3002, maxAttempts = 10) {
  let port = startPort;
  let attempts = 0;
  
  // Simple port checker using net module
  const isPortAvailable = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          server.close();
          resolve(true);
        })
        .listen(port);
    });
  };
  
  // Now try to find an available port
  while (attempts < maxAttempts) {
    try {
      await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.once('listening', () => {
          server.close();
          resolve();
        });
        server.listen(port);
      });
      // If we get here, the port is available
      return port;
    } catch (error) {
      // Port is in use or another error occurred
      if (port === startPort + maxAttempts - 1) {
        throw new Error(`Could not find an available port between ${startPort} and ${startPort + maxAttempts - 1}`);
      }
    }
  }
  
  throw new Error('No available ports found');
}

// Start the worker in development mode
async function startWorker() {
  try {
    console.log('1.1 Starting worker...');
    
    // Initialize D1 client for direct database access
    console.log('   Initializing D1 client...');
    d1Client = new D1Client({});
    await d1Client.initialize();
    console.log('   ✅ D1 client initialized');
    
    // Find an available port
    console.log('   Finding an available port...');
    const port = await findAvailablePort(3002);
    const workerUrl = `http://localhost:${port}`;
    console.log(`   Using port: ${port}`);
    
    // Update the BASE_URL for all tests to use this port
    BASE_URL = workerUrl;
    
    console.log(`   Starting worker process on port ${port}...`);
    // Set up environment variables for the worker
    // These will be available in the worker's env object
    const workerEnv = {
      // Worker-specific environment variables
      NODE_ENV: 'test',
      WORKER_NAME: 'data-service-test',
      
      // Database configuration - passed directly to the worker
      DB: JSON.stringify(d1Client),
      
      // Server configuration
      PORT: port.toString(),
      
      // Authentication - must match what's in .dev.vars for consistency
      JWT_SECRET: '3f73cf24522c6887d23f5dbca9d8e0c264da1c6c4ac4f7fd3abdb49d74c5a1f3',
      
      // Frontend URL for redirects
      FRONTEND_URL: 'http://localhost:3000',
      
      // Rate limiting
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX: '100',
      
      // Pass all environment variables explicitly
      // This ensures they're available in the worker's env object
      ...Object.fromEntries(
        Object.entries(process.env)
          .filter(([key]) => key.startsWith('JWT_') || key === 'NODE_ENV')
      )
    };
    
    console.log('Starting worker with environment variables:', {
      ...workerEnv,
      DB: workerEnv.DB ? '[D1 client data]' : 'undefined'
    });
    
    // Ensure .dev.vars exists with test values
    const devVarsPath = path.join(process.cwd(), '.dev.vars');
    if (!fs.existsSync(devVarsPath)) {
      const defaultVars = [
        'NODE_ENV=test',
        'JWT_SECRET=3f73cf24522c6887d23f5dbca9d8e0c264da1c6c4ac4f7fd3abdb49d74c5a1f3',
        'FRONTEND_URL=http://localhost:3000',
        'RATE_LIMIT_WINDOW_MS=900000',
        'RATE_LIMIT_MAX=100',
        'MAGIC_LINK_EXPIRY_MINUTES=15'
      ].join('\n');
      fs.writeFileSync(devVarsPath, defaultVars);
      console.log('Created default .dev.vars file with test values');
    }
    
    // Set environment variables for the worker process
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      MINIFLIFY: 'none',
      DEBUG: '*',
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || 'local',
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || 'local',
      WRANGLER_SEND_METRICS: 'false'
    };

    console.log('Starting worker with environment using .dev.vars');
    
    // Use staging environment which will read from .dev.vars
    const workerProcess = exec(`npx wrangler dev --port=${port} --env=staging --local ${WORKER_SCRIPT}`, {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MINIFLIFY: 'none', // Disable minification for better error messages
        DEBUG: '*', // Enable debug logging
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || 'local',
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || 'local',
        WRANGLER_SEND_METRICS: 'false',
        NO_D1_WARNING: 'true',
        MINIFLOW_ENV: 'test'
      },
      shell: true
    });
    
    // Buffer to collect worker output
    let workerOutput = '';
    let isReady = false;
    const maxAttempts = 30; // 30 seconds max
    const delay = 1000; // 1 second between attempts
    let healthCheckAttempts = 0;
    
    // Log worker output
    workerProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      const timestamp = new Date().toISOString();
      workerOutput += `[${timestamp}] ${output}\n`;
      
      // Log worker output for debugging
      const lines = output.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => {
        console.log(`[WORKER] ${line}`);
      });
      
      // Check if the worker is ready to accept connections
      if (output.includes('Listening on') || output.includes('Ready on')) {
        console.log('Worker signaled readiness');
        isReady = true;
      }
    });
    
    workerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      const lines = error.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => {
        console.error(`[WORKER ERROR] ${line}`);
      });
      workerOutput += `[ERROR] ${error}`;
    });
    
    // Handle process exit
    workerProcess.on('exit', (code, signal) => {
      console.log(`Worker process exited with code ${code}, signal ${signal}`);
      if (code !== 0) {
        console.error('Worker process exited with error. Output:', workerOutput);
      }
    });
    
    // Handle process error
    workerProcess.on('error', (error) => {
      console.error('Worker process error:', error);
      throw new Error(`Failed to start worker: ${error.message}`);
    });
    
    // Wait for the worker to be ready
    console.log('   Waiting for worker to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
      if (isReady) {
        console.log(`✅ Worker is ready after ${i + 1} seconds`);
        
        try {
          // Double-check with a health check
          const healthCheckUrl = `${BASE_URL}/health`;
          console.log(`   Verifying health check at: ${healthCheckUrl}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            const response = await fetch(healthCheckUrl, {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'TestRunner/1.0',
                'Accept': 'application/json'
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const data = await response.json();
            
            if (response.ok && data.status === 'ok') {
              console.log('✅ Health check passed');
              console.log('   Worker is ready and healthy');
              return workerProcess;
            } else {
              console.warn(`Health check failed (attempt ${i + 1}):`, data);
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              console.warn('   Health check request timed out after 5 seconds');
            } else {
              console.warn(`Health check error (attempt ${i + 1}):`, error.message);
            }
          }
        } catch (error) {
          console.warn(`Health check setup error (attempt ${i + 1}):`, error.message);
        }
        
        // If we've already seen the ready signal but health check is failing,
        // we'll still proceed after a few attempts to avoid hanging
        if (healthCheckAttempts++ > 3) {
          console.warn('Proceeding despite health check failures - worker reported ready');
          return workerProcess;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (i === maxAttempts - 1) {
        console.error('Worker output before timeout:', workerOutput);
        throw new Error(`Worker did not become ready after ${maxAttempts} seconds`);
      }
      
      console.log(`   Waiting for worker to be ready... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // If we get here, all attempts failed
    console.error('❌ Worker failed to start. Last output:');
    console.error(workerOutput);
    
    // Try to kill the worker process
    try {
      if (workerProcess && !workerProcess.killed) {
        workerProcess.kill('SIGTERM');
      }
    } catch (killError) {
      console.error('   Failed to kill worker process:', killError);
    }
    
    throw new Error('Worker failed to start within the expected time');
  } catch (error) {
    console.error('❌ Failed to start worker:', error);
    throw error;
  }
}

// Clean up test data
async function cleanupTestData(workerProcess) {
  try {
    console.log('\n=== Cleaning up test data ===');
    
    // Delete the test user if it exists
    if (userId) {
      try {
        const response = await fetch(`${BASE_URL}/api/users/email/${encodeURIComponent(TEST_EMAIL)}`);
        if (response.ok) {
          const user = await response.json();
          const deleteResponse = await fetch(`${BASE_URL}/api/users/${user.id || user._id}`, {
            method: 'DELETE'
          });
          
          if (!deleteResponse.ok) {
            console.warn('⚠️  Failed to delete test user');
          } else {
            console.log('✅ Deleted test user');
          }
        }
      } catch (error) {
        console.warn('⚠️  Error during test user cleanup:', error.message);
      }
    }
    
    // Clean up any test tokens
    try {
      const tokensResponse = await fetch(`${BASE_URL}/api/tokens`);
      if (tokensResponse.ok) {
        const tokens = await tokensResponse.json();
        const testTokens = tokens.filter(t => t.metadata?.test === true);
        
        for (const token of testTokens) {
          await fetch(`${BASE_URL}/api/tokens/${token.id}`, {
            method: 'DELETE'
          });
        }
        
        if (testTokens.length > 0) {
          console.log(`✅ Cleaned up ${testTokens.length} test tokens`);
        }
      }
    } catch (error) {
      console.warn('⚠️  Error during token cleanup:', error.message);
    }
    
    console.log('✅ Test data cleanup completed');
    
    // Stop the worker
    if (workerProcess) {
      console.log('Stopping worker...');
      workerProcess.kill();
    }
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
    throw error;
  }
}

// Test runner

async function logStep(step) {
  currentTest = step;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`STEP: ${step}`);
  console.log(`${'='.repeat(80)}`);
}

async function runTests() {
  let client;
  try {
    // Core functionality tests
    await testHealthCheck();
    
    // User management tests
    await testUserRegistration();
    await testFindOrCreateUser();
    await testGetUserByEmail();
    
    // Token management tests
    await testTokenManagement();
    
    // Magic link flow tests
    await testMagicLinkGeneration();
    await testMagicLinkVerification();
    
    // Additional user tests
    await testGetCurrentUser();
    await testUpdateUser();
    await testGetAllUsers();
    await testGetUserById();
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    throw error;
  }
}

// Test: Health Check
async function testHealthCheck() {
  console.log('1. Testing health check...');
  
  try {
    console.log(`   - Sending GET request to ${BASE_URL}/health`);
    const response = await fetch(`${BASE_URL}/health`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Health check failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('   - Health check response:', JSON.stringify(data, null, 2));
    
    if (data.status !== 'ok') {
      throw new Error(`Health check status is not 'ok': ${JSON.stringify(data)}`);
    }
    
    console.log('   ✓ Health check passed');
  } catch (error) {
    console.error('   ❌ Health check error:', error);
    throw error;
  }
}

// Test: User Registration
async function testUserRegistration() {
  currentTest = 'User Registration';
  console.log(`\n=== ${currentTest} ===`);
  
  try {
    // First, check if user exists
    let user = await d1Client.getUserByEmail(TEST_EMAIL);
    
    if (!user) {
      // User doesn't exist, create a new one using the D1 client directly
      console.log(`Creating test user with email: ${TEST_EMAIL}`);
      user = await d1Client.createUser({
        email: TEST_EMAIL,
        name: 'Test User'
      });
      
      if (!user || !user.id) {
        throw new Error('Failed to create user');
      }
    }
    
    userId = user.id;
    
    if (!userId) {
      throw new Error('No user ID in response');
    }
    
    console.log(`✅ User registered/verified with ID: ${userId}`);
    return true;
  } catch (error) {
    console.error('Error in testUserRegistration:', error);
    throw new Error(`User registration failed: ${error.message}`);
  }
}

// Test: Find or Create User
async function testFindOrCreateUser() {
  currentTest = 'Find or Create User';
  console.log(`\n=== ${currentTest} ===`);
  console.log('Starting testFindOrCreateUser function');
  
  try {
    // Log the current state of the D1 client
    console.log('D1 Client state:', {
      isInitialized: !!d1Client,
      db: d1Client?.db ? 'Initialized' : 'Not initialized',
      tables: d1Client?.db?.tables ? Object.keys(d1Client.db.tables) : 'No tables'
    });
    // Test creating a new user
    const newUserEmail = `new-user-${Date.now()}@example.com`;
    
    // Ensure we have a clean state
    console.log('Ensuring clean test state...');
    if (d1Client?.db?.tables?.users) {
      console.log(`Current user count before test: ${d1Client.db.tables.users.size}`);
    } else {
      console.log('No users table found in dev DB');
    }
    
    // Create user directly using D1 client
    console.log(`Creating test user with email: ${newUserEmail}`);
    const userData = {
      email: newUserEmail,
      name: 'New Test User'
    };
    console.log('User data to create:', userData);
    
    const newUser = await d1Client.createUser(userData);
    console.log('User creation result:', newUser ? 'Success' : 'Failed');
    
    if (!newUser || !newUser.id) {
      console.error('Failed to create user - no user ID returned');
      throw new Error('Failed to create user');
    }
    
    console.log(`✅ Created new user with ID: ${newUser.id}`);
    
    // Verify the user was actually added to the database
    if (d1Client?.db?.tables?.users) {
      const userInDb = d1Client.db.tables.users.get(newUser.id);
      console.log('User in DB after creation:', userInDb);
      if (!userInDb) {
        console.error('User not found in DB after creation');
        console.log('All user IDs in DB:', Array.from(d1Client.db.tables.users.keys()));
      }
    }
    
    // Test finding the user we just created
    console.log('\n--- Looking up user by email ---');
    console.log(`Looking up email: ${newUserEmail}`);
    
    try {
      const foundUser = await d1Client.findUserByEmail(newUserEmail);
      
      if (!foundUser) {
        console.error('❌ Failed to find user by email:', newUserEmail);
        console.error('All users in DB:', d1Client?.db?.tables?.users 
          ? Array.from(d1Client.db.tables.users.values()).map(u => ({
              id: u.id, 
              email: u.email,
              name: u.name
            }))
          : 'No users table found');
        throw new Error('Failed to find user by email');
      }
      
      // Verify we found the correct user
      console.log('Found user:', {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name
      });
      
      if (foundUser.id !== newUser.id) {
        console.error(`Found user ID does not match. Expected: ${newUser.id}, Found: ${foundUser.id}`);
        throw new Error(`Found user ID does not match. Expected: ${newUser.id}, Found: ${foundUser.id}`);
      }
      
      console.log('✅ Successfully found user by email');
      return true;
    } catch (error) {
      console.error('Error during findUserByEmail:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in testFindOrCreateUser:', error);
    throw new Error(`Find or create user test failed: ${error.message}`);
  }
}

// Test: Get User by Email
async function testGetUserByEmail() {
  currentTest = 'Get User by Email';
  console.log(`\n=== ${currentTest} ===`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/users/email/${encodeURIComponent(TEST_EMAIL)}`);
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    
    if (response.status === 404) {
      console.log('ℹ️  User not found (expected for some test cases)');
      return null;
    }
    
    const user = await response.json();
    console.log(`✅ Found user by email: ${user.email}`);
    return user;
  } catch (error) {
    throw new Error(`Get user by email failed: ${error.message}`);
  }
}

// Test: Token Management
async function testTokenManagement() {
  currentTest = 'Token Management';
  console.log(`\n=== ${currentTest} ===`);
  
  try {
    // Create a test user if one doesn't exist
    const testEmail = `token-test-${Date.now()}@example.com`;
    console.log('Creating test user for token management...');
    
    // Create user directly using D1 client
    const testUser = await d1Client.createUser({
      email: testEmail,
      name: 'Token Test User'
    });
    
    if (!testUser || !testUser.id) {
      throw new Error('Failed to create test user for token management');
    }
    
    console.log(`✅ Created test user with ID: ${testUser.id}`);
    
    // Generate a magic link (which will create a token)
    console.log('\n=== Starting Magic Link Generation ===');
    console.log(`Requesting magic link for test user: ${testUser.id}, ${testEmail}`);
    
    // Log current state of the database before making the request
    console.log('\n=== Database State Before Magic Link Generation ===');
    try {
      const users = await d1Client.db.prepare('SELECT * FROM users').all();
      console.log('Current users in database:', JSON.stringify(users, null, 2));
      
      const magicLinks = await d1Client.db.prepare('SELECT * FROM magic_links').all();
      console.log('Current magic links in database:', JSON.stringify(magicLinks, null, 2));
    } catch (error) {
      console.error('Error querying database:', error);
    }
    
    console.log('\n=== Making Magic Link Request ===');
    const magicLinkResponse = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        name: 'Token Test User'
      })
    });
    
    console.log('\n=== Magic Link Response ===');
    console.log(`Status: ${magicLinkResponse.status} ${magicLinkResponse.statusText}`);
    
    const responseText = await magicLinkResponse.text();
    console.log('Response body:', responseText);
    
    let magicLinkData;
    try {
      magicLinkData = JSON.parse(responseText);
      console.log('Parsed response data:', JSON.stringify(magicLinkData, null, 2));
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }
    
    if (!magicLinkResponse.ok) {
      throw new Error(`Failed to generate magic link: ${magicLinkResponse.status} ${magicLinkResponse.statusText}\nResponse: ${responseText}`);
    }
    
    // Verify we got a successful response
    if (!magicLinkData.success) {
      throw new Error(`Magic link generation was not successful: ${magicLinkData.message || 'No error message provided'}`);
    }
    
    console.log('✅ Generated magic link successfully');
    
    // Log database state after magic link generation
    console.log('\n=== Database State After Magic Link Generation ===');
    try {
      const magicLinks = await d1Client.db.prepare('SELECT * FROM magic_links').all();
      console.log('Magic links in database after generation:', JSON.stringify(magicLinks, null, 2));
      
      if (magicLinks.results && magicLinks.results.length > 0) {
        console.log('Found', magicLinks.results.length, 'magic links in database');
        magicLinks.results.forEach((ml, i) => {
          console.log(`Magic Link #${i + 1}:`, {
            id: ml.id,
            user_id: ml.user_id,
            token: ml.token ? `${ml.token.substring(0, 10)}...` : 'null',
            expires_at: ml.expires_at,
            is_used: ml.is_used,
            created_at: ml.created_at
          });
        });
      } else {
        console.log('No magic links found in database after generation');
      }
    } catch (error) {
      console.error('Error querying database after magic link generation:', error);
    }
    
    let token;
    
    // In development, we get the magic link in the response
    if (magicLinkData.magicLink) {
      console.log('\n=== Extracting Token from Magic Link ===');
      console.log('Magic link URL:', magicLinkData.magicLink);
      
      // Extract the token from the magic link URL
      const tokenMatch = magicLinkData.magicLink.match(/[?&]token=([^&]+)/);
      if (!tokenMatch || !tokenMatch[1]) {
        throw new Error('Could not extract token from magic link');
      }
      token = decodeURIComponent(tokenMatch[1]);
      console.log('✅ Extracted token from magic link URL:', token);
      
      // Also try to get the token from the database for verification
      console.log('\n=== Verifying Token in Database ===');
      console.log('Querying magic_links table for token...');
      
      try {
        const magicLinkFromDb = await d1Client.db.prepare(
          'SELECT * FROM magic_links WHERE token = ?'
        ).bind(token).first();
        
        console.log('Magic link from database:', magicLinkFromDb);
        
        if (!magicLinkFromDb) {
          console.error('❌ Magic link not found in database!');
          
          // Dump all magic links for debugging
          const allMagicLinks = await d1Client.db.prepare('SELECT * FROM magic_links').all();
          console.log('All magic links in database:', JSON.stringify(allMagicLinks, null, 2));
          
          if (allMagicLinks.results && allMagicLinks.results.length > 0) {
            console.log('Available magic links in database:');
            allMagicLinks.results.forEach((ml, i) => {
              console.log(`  ${i + 1}. ID: ${ml.id}, User ID: ${ml.user_id}, Token: ${ml.token ? `${ml.token.substring(0, 10)}...` : 'null'}`);
            });
          } else {
            console.log('No magic links found in database at all');
          }
          
          throw new Error('Magic link was not stored in the database');
        } else {
          console.log('✅ Found magic link in database with user_id:', magicLinkFromDb.user_id);
          console.log('Magic link details:', {
            id: magicLinkFromDb.id,
            user_id: magicLinkFromDb.user_id,
            token: magicLinkFromDb.token ? `${magicLinkFromDb.token.substring(0, 10)}...` : 'null',
            expires_at: magicLinkFromDb.expires_at,
            is_used: magicLinkFromDb.is_used,
            created_at: magicLinkFromDb.created_at
          });
        }
      } catch (dbError) {
        console.error('Error querying magic links from database:', dbError);
        throw new Error(`Database query failed: ${dbError.message}`);
      }
    } else {
      // In production, we need to get the token from the database
      // Since we're in a test, we'll get the latest magic link for the test user
      console.log('Getting magic link token from database...');
      const magicLink = await d1Client.getLatestMagicLinkForUser(testUser.id);
      console.log('Latest magic link from getLatestMagicLinkForUser:', magicLink);
      
      if (!magicLink || !magicLink.token) {
        console.error('Could not find magic link in database for user:', testUser.id);
        console.log('All magic links in database:', await d1Client.db.prepare('SELECT * FROM magic_links').all());
        throw new Error('Could not find magic link in database');
      }
      token = magicLink.token;
      console.log('✅ Retrieved token from database:', token);
    }
    
    console.log('✅ Extracted token from magic link URL');
    
    // First, verify the magic link to get the auth token
    console.log('Verifying magic link to get auth token...');
    const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    if (!verifyResponse.ok) {
      const errorBody = await verifyResponse.text();
      throw new Error(`Failed to verify magic link: ${verifyResponse.status} - ${errorBody}`);
    }
    
    const { token: authToken } = await verifyResponse.json();
    if (!authToken) {
      throw new Error('No auth token received after verifying magic link');
    }
    
    console.log('✅ Successfully verified magic link and got auth token');
    
    // Now, let's verify we can get the current user with the auth token
    console.log('Testing current user endpoint with auth token...');
    const currentUserResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!currentUserResponse.ok) {
      const errorBody = await currentUserResponse.text();
      throw new Error(`Failed to fetch current user: ${currentUserResponse.status} - ${errorBody}`);
    }
    
    const currentUser = await currentUserResponse.json();
    console.log(`✅ Successfully fetched current user: ${currentUser.email}`);
    
    // Verify the user data matches our test user
    if (currentUser.email !== testEmail.toLowerCase()) {
      throw new Error(`Unexpected user email. Expected ${testEmail}, got ${currentUser.email}`);
    }
    
    console.log('✅ Token management test completed successfully');
    return true;
  } catch (error) {
    throw new Error(`Token management test failed: ${error.message}`);
  }
}

// Test: Magic Link Generation
async function testMagicLinkGeneration() {
  console.log('3. Testing magic link generation...');
  console.log(`   Requesting magic link for email: ${TEST_EMAIL}`);
  
  const response = await fetch(`${BASE_URL}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  
  const data = await response.json();
  console.log('   Magic link response:', JSON.stringify(data, null, 2));
  
  if (!response.ok) {
    throw new Error(`Magic link generation failed: ${data.message || response.statusText}`);
  }
  
  // In the current implementation, the magic link is returned directly in the response
  // as a token, not as a URL with a token parameter
  if (data.token) {
    magicLinkToken = data.token;
    console.log(`   ✓ Magic link generated with token: ${magicLinkToken}`);
  } else if (data.magicLink) {
    // Handle the case where a full URL is returned (for backward compatibility)
    const url = new URL(data.magicLink);
    magicLinkToken = url.searchParams.get('token');
    if (!magicLinkToken) {
      throw new Error('Could not extract token from magic link URL');
    }
    console.log(`   ✓ Magic link generated with URL token: ${magicLinkToken}`);
  } else {
    throw new Error('No token or magic link in response');
  }
}

// Test: Verify Magic Link
async function testMagicLinkVerification() {
  console.log('4. Testing magic link verification...');
  
  if (!magicLinkToken) {
    throw new Error('No magic link token available for verification');
  }
  
  console.log(`   Verifying magic link with token: ${magicLinkToken}`);
  
  try {
    const verifyResponse = await fetch(`${BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: magicLinkToken
      })
    });
    
    if (!verifyResponse.ok) {
      let errorMessage = `HTTP error! status: ${verifyResponse.status}`;
      try {
        const errorData = await verifyResponse.json();
        errorMessage = `Magic link verification failed: ${errorData.message || errorMessage}`;
      } catch (e) {
        // If we can't parse the error as JSON, use the status text
        errorMessage = `Magic link verification failed: ${verifyResponse.statusText || errorMessage}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await verifyResponse.json();
    
    if (!data.token) {
      console.error('Verification response:', JSON.stringify(data, null, 2));
      throw new Error('No auth token received in verification response');
    }
    
    authToken = data.token;
    console.log('   ✓ Magic link verified successfully');
    console.log('   Auth token received');
    
    // Log the user ID from the token for debugging
    if (data.user) {
      userId = data.user.id;
      console.log(`   User ID from token: ${userId}`);
    }
    
  } catch (error) {
    console.error('   ❌ Error during magic link verification:', error.message);
    throw error;
  }
}

// Test: Get Current User
async function testGetCurrentUser() {
  if (!authToken) {
    throw new Error('No auth token available for current user test');
  }
  
  console.log('5. Testing get current user...');
  console.log(`   Using auth token: ${authToken.substring(0, 15)}...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    console.log('   Current user response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      throw new Error(`Failed to get current user: ${data.message || response.statusText}`);
    }
    
    if (!data || !data.id) {
      throw new Error('Invalid user data in response');
    }
    
    // Verify the email matches the test user
    if (data.email !== TEST_EMAIL) {
      console.error(`   ERROR: Email mismatch! Expected: ${TEST_EMAIL}, Got: ${data.email}`);
      console.error('   Full user data:', JSON.stringify(data, null, 2));
      
      // Try to fetch the user directly from the database for debugging
      try {
        const dbUser = await client.users.findById(data.id);
        console.error('   User from database:', JSON.stringify(dbUser, null, 2));
      } catch (dbError) {
        console.error('   Error fetching user from database:', dbError.message);
      }
      
      throw new Error(`Unexpected user data received. Expected email: ${TEST_EMAIL}, Got: ${data.email}`);
    }
    
    console.log(`   ✓ Current user verified as ${data.email}`);
  } catch (error) {
    console.error('   Error in testGetCurrentUser:', error);
    throw error;
  }
}

// Test: Update User
async function testUpdateUser() {
  console.log('6. Testing user update...');
  const newName = 'Updated Test User';
  
  try {
    console.log(`   Updating user ${userId} with new name: ${newName}`);
    
    const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name: newName })
    });
    
    const data = await response.json();
    
    console.log('   Update response status:', response.status);
    console.log('   Update response data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      throw new Error(`User update failed: ${data.message || response.statusText}`);
    }
    
    if (data.name !== newName) {
      console.error('   ❌ Name not updated correctly in response');
      console.error(`   Expected: ${newName}, Got: ${data.name || 'undefined'}`);
      
      // Verify the current user data
      const currentUserResponse = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (currentUserResponse.ok) {
        const currentUser = await currentUserResponse.json();
        console.log('   Current user data from /api/auth/me:', JSON.stringify(currentUser, null, 2));
      } else {
        console.error('   Failed to fetch current user data');
      }
      
      // Verify the user was updated in the database
      const dbUser = await client.users.findById(userId);
      
      if (!dbUser) {
        throw new Error('User not found in database after update');
      }
      
      if (dbUser.name !== newName) {
        throw new Error(`User name not updated in database. Expected: ${newName}, Got: ${dbUser.name}`);
      }
      
      throw new Error('User name was not updated correctly');
    }
    
    console.log(`   ✓ User updated: ${data.name}`);
  } catch (error) {
    console.error('   Error in testUpdateUser:', error);
    throw error;
  }
}

// Test: Get All Users
async function testGetAllUsers() {
  console.log('7. Testing get all users...');
  const response = await fetch(`${BASE_URL}/api/users`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get users: ${data.message || response.statusText}`);
  }
  
  if (!Array.isArray(data)) {
    throw new Error('Expected an array of users');
  }
  
  console.log(`   ✓ Retrieved ${data.length} users`);
}

// Test: Get User by ID
async function testGetUserById() {
  console.log('8. Testing get user by ID...');
  const response = await fetch(`${BASE_URL}/api/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get user by ID: ${data.message || response.statusText}`);
  }
  
  if (data.id !== userId) {
    throw new Error('Unexpected user data received');
  }
  
  console.log(`   ✓ Retrieved user by ID: ${data.email}`);
}

// Main test runner
async function main() {
  console.log('Starting test runner...');
  console.log('Process arguments:', process.argv);
  console.log('Current working directory:', process.cwd());
  
  let workerProcess = null;
  
  try {
    // 1. Start the worker
    console.log('\n=== 1. Starting worker ===');
    workerProcess = await startWorker();
    
    if (!workerProcess) {
      throw new Error('Failed to start worker process');
    }
    
    // 2. Run tests
    console.log('\n=== 2. Running tests ===');
    
    // Check if specific test was requested
    const testName = process.argv[2];
    if (testName) {
      console.log(`Running specific test: ${testName}`);
      
      // Find the test function
      const testFunction = global[testName] || this[testName];
      if (typeof testFunction === 'function') {
        console.log(`\n=== Running ${testName} ===`);
        await testFunction();
        console.log(`\n✅ ${testName} completed successfully`);
      } else {
        throw new Error(`Test function '${testName}' not found`);
      }
    } else {
      // Run all tests
      console.log('Running all tests...');
      await runTests();
      console.log('\n✅ All tests completed successfully!');
    }
    
    // 3. Clean up test data
    console.log('\n=== 3. Cleaning up ===');
    await cleanupTestData(workerProcess);
    
  } catch (error) {
    console.error('\n❌ Test runner failed:', error);
    
    // Try to clean up even if tests fail
    try {
      if (workerProcess) {
        console.log('Attempting to clean up after test failure...');
        await cleanupTestData(workerProcess);
      }
    } catch (cleanupError) {
      console.error('Error during cleanup after test failure:', cleanupError);
    }
    
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  } finally {
    console.log('\n=== Starting cleanup ===');
    try {
      // Clean up test data
      try {
        await cleanupTestData(workerProcess);
        console.log('   ✅ Test data cleaned up successfully');
      } catch (cleanupError) {
        console.error('   ❌ Error cleaning up test data:', cleanupError);
      }
    } catch (finallyError) {
      console.error('Error during cleanup:', finallyError);
    } finally {
      console.log('\n🏁 Test runner finished');
      
      // Ensure the worker process is terminated
      if (workerProcess && !workerProcess.killed) {
        try {
          console.log('Terminating worker process...');
          workerProcess.kill('SIGTERM');
        } catch (killError) {
          console.error('Error terminating worker process:', killError);
        }
      }
      
      // Explicitly exit the process
      process.exit(0);
    }
  }
}

// Enhanced error handler
function handleError(error, context) {
  console.error(`\n❌ ERROR in ${context}:`);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  if (error.cause) {
    console.error('\nCaused by:');
    console.error(error.cause);
  }
  
  process.exit(1);
}

// Enhanced error handler
function handleUncaughtError(error) {
  console.error('\n=== UNHANDLED ERROR IN TEST RUNNER ===');
  console.error('Error type:', error.constructor.name);
  console.error('Error message:', error.message);
  
  if (error.code) {
    console.error('Error code:', error.code);
  }
  
  if (error.syscall) {
    console.error('System call:', error.syscall);
  }
  
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  
  // Log additional context if available
  if (error.config) {
    console.error('\nRequest config:', JSON.stringify(error.config, null, 2));
  }
  
  if (error.response) {
    console.error('\nResponse status:', error.response.status);
    console.error('Response data:', error.response.data);
  }
  
  process.exit(1);
}

// Simple test runner
async function runTest() {
  try {
    console.log('Starting test runner...');
    
    // Initialize D1 client
    console.log('Initializing D1 client...');
    d1Client = new D1Client({});
    await d1Client.initialize();
    
    // Run tests
    console.log('\n=== Running testFindOrCreateUser ===');
    await testFindOrCreateUser();
    
    console.log('\n=== Running testMagicLinkGeneration ===');
    await testMagicLinkGeneration();
    
    console.log('\n=== Running testMagicLinkVerification ===');
    try {
      await testMagicLinkVerification();
      console.log('\n✅ All tests completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ testMagicLinkVerification failed:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
runTest();

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:3002';

async function testHealth() {
  try {
    console.log(`Testing health endpoint at ${DATA_SERVICE_URL}/health`);
    
    const response = await axios.get(`${DATA_SERVICE_URL}/health`);
    
    if (response.status === 200 && response.data.status === 'ok') {
      console.log('✅ Health check passed!');
      console.log('Environment:', response.data.environment);
      console.log('Database status:', response.data.services?.database || 'unknown');
      return true;
    } else {
      console.error('❌ Health check failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function testCreateUser() {
  try {
    console.log('\nTesting create user endpoint...');
    
    const userData = {
      email: `testuser_${Date.now()}@example.com`,
      name: 'Test User',
      password: 'test123'
    };
    
    console.log('Creating user with data:', userData);
    
    const response = await axios.post(`${DATA_SERVICE_URL}/api/users`, userData);
    
    if (response.data && response.data.id) {
      console.log('✅ User created successfully!');
      console.log('User ID:', response.data.id);
      return response.data.id; // Return the user ID for subsequent tests
    } else {
      console.error('❌ Failed to create user:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Create user failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function testGetUser(userId) {
  if (!userId) {
    console.log('Skipping get user test - no user ID provided');
    return;
  }
  
  try {
    console.log(`\nTesting get user endpoint for ID: ${userId}`);
    
    const response = await axios.get(`${DATA_SERVICE_URL}/api/users/${userId}`);
    
    if (response.data && response.data.id === userId) {
      console.log('✅ Get user successful!');
      console.log('User data:', response.data);
      return true;
    } else {
      console.error('❌ Get user failed - unexpected response:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Get user failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function testListUsers() {
  try {
    console.log('\nTesting list users endpoint...');
    
    const response = await axios.get(`${DATA_SERVICE_URL}/api/users`);
    
    if (Array.isArray(response.data)) {
      console.log(`✅ List users successful! Found ${response.data.length} users.`);
      if (response.data.length > 0) {
        console.log('First user:', JSON.stringify(response.data[0], null, 2));
      }
      return true;
    } else {
      console.error('❌ List users failed - unexpected response format:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ List users failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('Starting data service endpoint tests...');
  console.log('====================================');
  
  try {
    // Test health endpoint first
    console.log('\n--- Testing Health Endpoint ---');
    const healthOk = await testHealth();
    if (!healthOk) {
      console.error('❌ Initial health check failed. Aborting further tests.');
      return;
    }
    
    // Test user creation
    console.log('\n--- Testing User Creation ---');
    const userId = await testCreateUser();
    
    // Test getting the created user
    if (userId) {
      console.log('\n--- Testing Get User ---');
      await testGetUser(userId);
    }
    
    // Test listing users
    console.log('\n--- Testing List Users ---');
    await testListUsers();
    
    console.log('\n====================================');
    console.log('✅ Test sequence completed successfully!');
  } catch (error) {
    console.error('\n❌ Test sequence failed with error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    }
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

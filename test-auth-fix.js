#!/usr/bin/env node
/**
 * Quick test to verify the authentication fix is working
 * Tests that protected endpoints now require authentication
 */

const TEST_ENDPOINTS = [
  '/users',
  '/search/query-events', 
  '/files',
  '/health' // Should still work without auth
];

async function testEndpoint(url, endpoint, expectAuth = true) {
  console.log(`\n🔍 Testing ${endpoint}...`);
  
  try {
    // Test without auth
    const noAuthResponse = await fetch(`${url}${endpoint}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (expectAuth && noAuthResponse.status === 401) {
      console.log(`✅ ${endpoint} correctly requires authentication (401)`);
      return true;
    } else if (!expectAuth && noAuthResponse.status !== 401) {
      console.log(`✅ ${endpoint} correctly allows unauthenticated access (${noAuthResponse.status})`);
      return true;
    } else if (expectAuth && noAuthResponse.status !== 401) {
      console.log(`❌ ${endpoint} SECURITY ISSUE: Should require auth but returned ${noAuthResponse.status}`);
      return false;
    } else {
      console.log(`❌ ${endpoint} unexpectedly blocked (${noAuthResponse.status})`);
      return false;
    }
  } catch (error) {
    console.log(`⚠️  ${endpoint} test failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const BASE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:3002';
  console.log(`🚀 Testing data service authentication at: ${BASE_URL}`);
  
  const results = [];
  
  // Test protected endpoints
  results.push(await testEndpoint(BASE_URL, '/users', true));
  results.push(await testEndpoint(BASE_URL, '/search/query-events', true));
  results.push(await testEndpoint(BASE_URL, '/files', true));
  
  // Test unprotected endpoints
  results.push(await testEndpoint(BASE_URL, '/health', false));
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All authentication tests passed!');
    process.exit(0);
  } else {
    console.log('🚨 Some tests failed - authentication may not be properly configured');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint };
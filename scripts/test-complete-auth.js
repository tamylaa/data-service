#!/usr/bin/env node
/**
 * Test Auth Service Session-based Integration - Final Test
 */

const AUTH_SERVICE_URL = 'https://auth.tamyla.com';
const DATA_SERVICE_URL = 'https://data-service.tamylatrading.workers.dev';

async function testCompleteAuthFlow() {
  try {
    console.log('\n🧪 Testing Complete Auth Service → Data Service Flow\n');
    
    const testEmail = 'complete-test@example.com';
    const testName = 'Complete Test User';
    
    console.log(`📧 Testing with email: ${testEmail}\n`);
    
    // Step 1: Request magic link
    console.log('🔄 Step 1: Requesting magic link...');
    const magicLinkResponse = await fetch(`${AUTH_SERVICE_URL}/auth/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      },
      body: JSON.stringify({
        email: testEmail,
        name: testName
      })
    });
    
    const magicLinkResult = await magicLinkResponse.json();
    const magicLink = magicLinkResult.magicLink;
    console.log(`✅ Magic Link: ${magicLink}`);
    
    // Step 2: Follow magic link
    console.log('\n🔄 Step 2: Following magic link...');
    const verifyResponse = await fetch(magicLink, {
      method: 'GET',
      redirect: 'manual'
    });
    
    const location = verifyResponse.headers.get('location');
    const sessionFromUrl = new URL(location).searchParams.get('session');
    const cookies = verifyResponse.headers.get('set-cookie');
    
    console.log(`✅ Session ID: ${sessionFromUrl}`);
    
    // Step 3: Exchange session for JWT
    console.log('\n🔄 Step 3: Exchanging session for JWT...');
    const sessionExchangeResponse = await fetch(`${AUTH_SERVICE_URL}/auth/session-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com',
        'Cookie': cookies || `auth_session=${sessionFromUrl}`
      },
      body: JSON.stringify({
        sessionToken: sessionFromUrl
      })
    });
    
    const sessionResult = await sessionExchangeResponse.json();
    const jwtToken = sessionResult.token;
    const userId = sessionResult.user.id;
    
    console.log(`✅ JWT Token: ${jwtToken.substring(0, 50)}...`);
    console.log(`✅ User ID: ${userId}`);
    
    // Step 4: Update profile through auth-service
    console.log('\n🔄 Step 4: Updating profile through Auth Service...');
    const updatePayload = {
      name: testName + ' (Updated)',
      company: 'Final Test Company',
      position: 'Final Test Position'
    };
    
    const authUpdateResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      },
      body: JSON.stringify(updatePayload)
    });
    
    console.log(`Auth Update Status: ${authUpdateResponse.status}`);
    const authUpdateResult = await authUpdateResponse.text();
    console.log(`Auth Update Response:`, authUpdateResult);
    
    // Step 5: Check data-service
    console.log('\n🔄 Step 5: Checking Data Service for updated user...');
    const dataUserResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      }
    });
    
    const dataUserResult = await dataUserResponse.json();
    
    console.log('Data Service User Data:');
    console.log(`  Name: ${dataUserResult.name}`);
    console.log(`  Company: ${dataUserResult.company}`);
    console.log(`  Position: ${dataUserResult.position}`);
    console.log(`  Updated At: ${dataUserResult.updatedAt}`);
    
    // Step 6: Final analysis
    console.log('\n📊 FINAL ANALYSIS:');
    if (dataUserResult.company === updatePayload.company) {
      console.log('✅ SUCCESS: Updates ARE propagating from Auth Service to Data Service!');
      console.log('✅ Your authentication and data persistence system is working correctly!');
    } else {
      console.log('❌ ISSUE: Updates are NOT propagating from Auth Service to Data Service');
      console.log(`Expected company: ${updatePayload.company}`);
      console.log(`Actual company: ${dataUserResult.company}`);
      console.log('🔍 This explains why user data resets - auth service is not updating data service');
    }
    
    console.log('\n✅ Complete integration test finished!');
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testCompleteAuthFlow();

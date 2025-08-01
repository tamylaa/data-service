#!/usr/bin/env node
/**
 * Test Auth Service Session-based Integration
 */

const AUTH_SERVICE_URL = 'https://auth.tamyla.com';
const DATA_SERVICE_URL = 'https://data-service.tamylatrading.workers.dev';

async function testSessionBasedAuth() {
  try {
    console.log('\n🧪 Testing Session-based Auth Service Integration\n');
    
    const testEmail = 'session-test@example.com';
    const testName = 'Session Test User';
    
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
    
    // Step 2: Follow magic link and capture session
    console.log('\n🔄 Step 2: Following magic link to get session...');
    const verifyResponse = await fetch(magicLink, {
      method: 'GET',
      redirect: 'manual'
    });
    
    // Extract session from redirect URL and cookies
    const location = verifyResponse.headers.get('location');
    const sessionFromUrl = new URL(location).searchParams.get('session');
    const cookies = verifyResponse.headers.get('set-cookie');
    
    console.log(`✅ Session ID: ${sessionFromUrl}`);
    console.log(`Cookies: ${cookies}`);
    
    // Step 3: Test session exchange endpoint
    console.log('\n🔄 Step 3: Testing session exchange...');
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
    
    console.log(`Session Exchange Status: ${sessionExchangeResponse.status}`);
    const sessionResult = await sessionExchangeResponse.text();
    console.log(`Session Exchange Response:`, sessionResult);
    
    let jwtToken, userId;
    try {
      const parsed = JSON.parse(sessionResult);
      jwtToken = parsed.token;
      userId = parsed.user?.id;
    } catch (e) {
      console.log('Could not parse session exchange response');
    }
    
    if (jwtToken && userId) {
      console.log(`✅ JWT Token: ${jwtToken.substring(0, 50)}...`);
      console.log(`✅ User ID: ${userId}`);
      
      // Step 4: Test profile update through auth-service
      console.log('\n🔄 Step 4: Testing profile update through Auth Service...');
      const updatePayload = {
        name: testName + ' (Updated via Session)',
        company: 'Session Test Company',
        position: 'Session Test Position'
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
      
      // Step 5: Check if update propagated to data-service
      console.log('\n🔄 Step 5: Checking Data Service for updated user...');
      const dataUserResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.tamyla.com'
        }
      });
      
      console.log(`Data User Status: ${dataUserResponse.status}`);
      const dataUserResult = await dataUserResponse.text();
      console.log(`Data User Response:`, dataUserResult);
      
      // Step 6: Compare data
      console.log('\n🔄 Step 6: Analyzing data propagation...');
      try {
        const dataUser = JSON.parse(dataUserResult);
        
        console.log('Data Service User Data:');
        console.log(`  ID: ${dataUser.id}`);
        console.log(`  Name: ${dataUser.name}`);
        console.log(`  Company: ${dataUser.company}`);
        console.log(`  Position: ${dataUser.position}`);
        console.log(`  Updated At: ${dataUser.updatedAt}`);
        
        if (dataUser.company === updatePayload.company) {
          console.log('\n✅ SUCCESS: Auth Service update propagated to Data Service!');
        } else {
          console.log('\n❌ FAILURE: Auth Service update did NOT propagate to Data Service');
          console.log(`Expected company: ${updatePayload.company}`);
          console.log(`Actual company: ${dataUser.company}`);
        }
        
      } catch (e) {
        console.log('Could not parse data service response');
      }
      
    } else {
      console.log('❌ Could not get JWT token or user ID from session exchange');
    }
    
    console.log('\n✅ Session-based integration test completed!');
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSessionBasedAuth();

#!/usr/bin/env node
/**
 * Test Auth Service to Data Service Integration
 * This script tests the complete flow from auth-service to data-service
 */

const AUTH_SERVICE_URL = 'https://auth.tamyla.com';
const DATA_SERVICE_URL = 'https://data-service.tamylatrading.workers.dev';

async function testAuthToDataServiceFlow() {
  try {
    console.log('\n🧪 Testing Auth Service → Data Service Integration\n');
    
    const testEmail = 'integration-test@example.com';
    const testName = 'Integration Test User';
    
    console.log(`📧 Testing with email: ${testEmail}\n`);
    
    // Step 1: Request magic link through auth-service
    console.log('🔄 Step 1: Requesting magic link through Auth Service...');
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
    
    console.log(`Magic Link Status: ${magicLinkResponse.status}`);
    const magicLinkResult = await magicLinkResponse.text();
    console.log(`Magic Link Response:`, magicLinkResult);
    
    let magicLink;
    try {
      const parsed = JSON.parse(magicLinkResult);
      magicLink = parsed.debug?.magicLink || parsed.magicLink;
    } catch (e) {
      console.log('Could not parse magic link response as JSON');
    }
    
    if (magicLink) {
      console.log(`✅ Magic Link: ${magicLink}`);
      
      // Step 2: Follow the magic link to get a JWT token
      console.log('\n🔄 Step 2: Following magic link to get JWT...');
      const verifyResponse = await fetch(magicLink, {
        method: 'GET',
        redirect: 'manual'
      });
      
      console.log(`Verify Status: ${verifyResponse.status}`);
      console.log('Verify Headers:');
      for (const [key, value] of verifyResponse.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      
      const verifyBody = await verifyResponse.text();
      console.log(`Verify Response Body:`, verifyBody);
      
      // Check if there's a redirect with token
      const location = verifyResponse.headers.get('location');
      let jwtToken;
      
      if (location) {
        console.log(`Redirect to: ${location}`);
        const urlParams = new URLSearchParams(location.split('?')[1]);
        jwtToken = urlParams.get('token');
      }
      
      if (jwtToken) {
        console.log(`✅ JWT Token received: ${jwtToken.substring(0, 50)}...`);
        
        // Step 3: Use JWT to access auth-service user endpoint
        console.log('\n🔄 Step 3: Testing Auth Service user endpoint with JWT...');
        const authUserResponse = await fetch(`${AUTH_SERVICE_URL}/auth/user`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
            'Origin': 'https://www.tamyla.com'
          }
        });
        
        console.log(`Auth User Status: ${authUserResponse.status}`);
        const authUserResult = await authUserResponse.text();
        console.log(`Auth User Response:`, authUserResult);
        
        let userId;
        try {
          const parsed = JSON.parse(authUserResult);
          userId = parsed.user?.id || parsed.id;
        } catch (e) {
          console.log('Could not parse auth user response as JSON');
        }
        
        if (userId) {
          console.log(`✅ User ID from Auth Service: ${userId}`);
          
          // Step 4: Check if the same user exists in data-service
          console.log('\n🔄 Step 4: Checking if user exists in Data Service...');
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
          
          // Step 5: Test updating through auth-service and check data-service
          console.log('\n🔄 Step 5: Testing profile update through Auth Service...');
          const updatePayload = {
            name: testName + ' (Updated via Auth)',
            company: 'Auth Service Test Company',
            position: 'Auth Service Test Position'
          };
          
          const authUpdateResponse = await fetch(`${AUTH_SERVICE_URL}/auth/profile`, {
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
          
          // Step 6: Verify update in data-service
          console.log('\n🔄 Step 6: Verifying update in Data Service...');
          const verifyUpdateResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'https://www.tamyla.com'
            }
          });
          
          console.log(`Verify Update Status: ${verifyUpdateResponse.status}`);
          const verifyUpdateResult = await verifyUpdateResponse.text();
          console.log(`Verify Update Response:`, verifyUpdateResult);
          
          // Step 7: Compare timestamps and data
          console.log('\n🔄 Step 7: Analysis...');
          try {
            const authUser = JSON.parse(authUserResult);
            const dataUser = JSON.parse(verifyUpdateResult);
            
            console.log('Comparison:');
            console.log(`  Auth Service User ID: ${authUser.user?.id || authUser.id}`);
            console.log(`  Data Service User ID: ${dataUser.id}`);
            console.log(`  Data Service Updated At: ${dataUser.updatedAt}`);
            console.log(`  Company in Data Service: ${dataUser.company}`);
            console.log(`  Position in Data Service: ${dataUser.position}`);
            
            if (dataUser.company === updatePayload.company) {
              console.log('✅ Update successfully propagated from Auth Service to Data Service!');
            } else {
              console.log('❌ Update did NOT propagate from Auth Service to Data Service');
            }
            
          } catch (e) {
            console.log('Could not parse responses for comparison');
          }
          
        } else {
          console.log('❌ Could not extract user ID from auth service');
        }
        
      } else {
        console.log('❌ No JWT token received from magic link verification');
      }
      
    } else {
      console.log('❌ No magic link received');
    }
    
    console.log('\n✅ Integration test completed!');
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAuthToDataServiceFlow();

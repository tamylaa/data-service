/**
 * Test Simplified Auth Service
 * Tests the new modular architecture
 */

const AUTH_SERVICE_URL = 'https://auth.tamyla.com';
const DATA_SERVICE_URL = 'https://data-service.tamylatrading.workers.dev';

async function testSimplifiedAuth() {
  console.log('🔄 Testing Simplified Auth Service Architecture\n');
  
  const testEmail = `simple-test-${Date.now()}@example.com`;
  console.log(`📧 Testing with email: ${testEmail}`);
  
  try {
    // Step 1: Test magic link endpoint
    console.log('\n🔄 Step 1: Testing magic link generation...');
    const magicResponse = await fetch(`${AUTH_SERVICE_URL}/auth/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'Simple Test User'
      })
    });
    
    console.log(`Magic Link Status: ${magicResponse.status}`);
    const magicResult = await magicResponse.text();
    console.log(`Magic Link Response: ${magicResult}`);
    
    if (magicResponse.ok) {
      const parsed = JSON.parse(magicResult);
      console.log(`✅ Magic link generated: ${parsed.magicLink}`);
      
      // Step 2: Follow magic link
      console.log('\n🔄 Step 2: Following magic link...');
      const verifyResponse = await fetch(parsed.magicLink, {
        method: 'GET',
        redirect: 'manual'
      });
      
      console.log(`Verify Status: ${verifyResponse.status}`);
      const location = verifyResponse.headers.get('location');
      console.log(`Redirect Location: ${location}`);
      
      if (location) {
        const url = new URL(location);
        const sessionId = url.searchParams.get('session');
        console.log(`✅ Session ID: ${sessionId}`);
        
        // Step 3: Exchange session for JWT
        console.log('\n🔄 Step 3: Testing session exchange...');
        const sessionResponse = await fetch(`${AUTH_SERVICE_URL}/auth/session-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://www.tamyla.com'
          },
          body: JSON.stringify({
            sessionToken: sessionId
          })
        });
        
        console.log(`Session Exchange Status: ${sessionResponse.status}`);
        const sessionResult = await sessionResponse.text();
        console.log(`Session Exchange Response: ${sessionResult}`);
        
        if (sessionResponse.ok) {
          const sessionData = JSON.parse(sessionResult);
          const jwtToken = sessionData.token;
          const userId = sessionData.user?.id;
          
          console.log(`✅ JWT Token: ${jwtToken ? jwtToken.substring(0, 50) + '...' : 'undefined'}`);
          console.log(`✅ User ID: ${userId}`);
          
          if (jwtToken) {
            // Step 4: Test profile operations through auth-service
            console.log('\n🔄 Step 4: Testing profile GET through auth-service...');
            const getProfileResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Origin': 'https://www.tamyla.com'
              }
            });
            
            console.log(`Profile GET Status: ${getProfileResponse.status}`);
            const getProfileResult = await getProfileResponse.text();
            console.log(`Profile GET Response: ${getProfileResult}`);
            
            // Step 5: Test profile update through auth-service
            console.log('\n🔄 Step 5: Testing profile UPDATE through auth-service...');
            const updatePayload = {
              name: 'Simple Test User Updated',
              phone: '+1-555-123-4567',
              company: 'Simplified Test Company',
              position: 'Simplified Test Position'
            };
            
            const updateProfileResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json',
                'Origin': 'https://www.tamyla.com'
              },
              body: JSON.stringify(updatePayload)
            });
            
            console.log(`Profile UPDATE Status: ${updateProfileResponse.status}`);
            const updateProfileResult = await updateProfileResponse.text();
            console.log(`Profile UPDATE Response: ${updateProfileResult}`);
            
            // Step 6: Verify data persistence
            console.log('\n🔄 Step 6: Checking data persistence...');
            const checkDataResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`);
            
            console.log(`Data Check Status: ${checkDataResponse.status}`);
            const checkDataResult = await checkDataResponse.text();
            console.log(`Data Check Response: ${checkDataResult}`);
            
            if (checkDataResponse.ok) {
              const userData = JSON.parse(checkDataResult);
              console.log('\n📊 FINAL ANALYSIS:');
              if (userData.company === updatePayload.company) {
                console.log('✅ SUCCESS: Simplified auth-service is working correctly!');
                console.log('✅ Profile updates are properly forwarded to data-service!');
              } else {
                console.log('❌ ISSUE: Profile updates are not persisting properly');
                console.log(`Expected: ${updatePayload.company}`);
                console.log(`Actual: ${userData.company}`);
              }
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  console.log('\n✅ Simplified auth test completed!');
}

testSimplifiedAuth();

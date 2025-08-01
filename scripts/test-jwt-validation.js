/**
 * Test JWT Token Validation
 * Tests if the JWT token from session exchange is valid for auth service calls
 */

const AUTH_SERVICE_URL = 'https://auth.tamyla.com';

async function testJWTValidation() {
  console.log('🔐 Testing JWT Token Validation Flow');
  
  const testEmail = `jwt-test-${Date.now()}@example.com`;
  console.log(`📧 Testing with email: ${testEmail}`);
  
  try {
    // Step 1: Request magic link
    console.log('\n🔄 Step 1: Requesting magic link...');
    const magicLinkResponse = await fetch(`${AUTH_SERVICE_URL}/auth/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      },
      body: JSON.stringify({
        email: testEmail,
        name: 'JWT Test User'
      })
    });
    
    const magicLinkResult = await magicLinkResponse.json();
    console.log('Magic Link Response:', magicLinkResult);
    const magicLink = magicLinkResult.magicLink || magicLinkResult.magic_link;
    console.log(`✅ Magic Link: ${magicLink}`);
    
    // Step 2: Extract token and follow the magic link
    console.log('\n🔄 Step 2: Following magic link...');
    const url = new URL(magicLink);
    const token = url.searchParams.get('token');
    
    const verifyResponse = await fetch(`${AUTH_SERVICE_URL}/auth/verify?token=${token}`, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tamyla.com'
      },
      redirect: 'manual'
    });
    
    const sessionId = verifyResponse.headers.get('set-cookie')
      ?.match(/session=([^;]+)/)?.[1];
    
    console.log(`✅ Session ID: ${sessionId}`);
    
    // Step 3: Exchange session for JWT
    console.log('\n🔄 Step 3: Exchanging session for JWT...');
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
    
    const sessionResult = await sessionResponse.json();
    console.log('Session Response:', sessionResult);
    const jwtToken = sessionResult.token;
    console.log(`✅ JWT Token: ${jwtToken ? jwtToken.substring(0, 50) + '...' : 'undefined'}`);
    
    // Step 4: Test JWT with different endpoints
    console.log('\n🔄 Step 4: Testing JWT validation...');
    
    // Test 1: Profile endpoint (GET)
    const getProfileResponse = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Origin': 'https://www.tamyla.com'
      }
    });
    
    console.log(`Profile GET Status: ${getProfileResponse.status}`);
    if (getProfileResponse.ok) {
      const profileData = await getProfileResponse.json();
      console.log(`✅ Profile GET successful: ${JSON.stringify(profileData, null, 2)}`);
    } else {
      const errorText = await getProfileResponse.text();
      console.log(`❌ Profile GET failed: ${errorText}`);
    }
    
    // Test 2: Profile update endpoint (PUT)
    const updatePayload = {
      name: 'JWT Test User (Updated)',
      phone: '+1234567890',
      company: 'JWT Test Company',
      position: 'JWT Test Position'
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
    if (updateProfileResponse.ok) {
      const updateResult = await updateProfileResponse.json();
      console.log(`✅ Profile UPDATE successful: ${JSON.stringify(updateResult, null, 2)}`);
    } else {
      const errorText = await updateProfileResponse.text();
      console.log(`❌ Profile UPDATE failed: ${errorText}`);
    }
    
    console.log('\n📊 JWT Validation Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testJWTValidation();

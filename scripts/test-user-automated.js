#!/usr/bin/env node
/**
 * Test User Operations in Data Service - Automated Test
 */

const DATA_SERVICE_URL = 'https://data-service.tamylatrading.workers.dev';

async function testUserOperations() {
  try {
    console.log('\n🧪 Testing Data Service User Operations\n');
    
    const testEmail = 'test@example.com';
    const testName = 'Test User';
    
    console.log(`📧 Testing with email: ${testEmail}, name: ${testName}\n`);
    
    // 1. Test creating a user
    console.log('🔄 Step 1: Creating/Finding User...');
    const createUserResponse = await fetch(`${DATA_SERVICE_URL}/users`, {
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
    
    console.log(`Create User Status: ${createUserResponse.status}`);
    const createResult = await createUserResponse.text();
    console.log(`Create User Response:`, createResult);
    
    let userId;
    try {
      const parsed = JSON.parse(createResult);
      userId = parsed.user?.id || parsed.id;
    } catch (e) {
      console.log('Could not parse create user response as JSON');
    }
    
    if (userId) {
      console.log(`✅ User ID: ${userId}`);
      
      // 2. Test getting the user
      console.log('\n🔄 Step 2: Retrieving User...');
      const getUserResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.tamyla.com'
        }
      });
      
      console.log(`Get User Status: ${getUserResponse.status}`);
      const getResult = await getUserResponse.text();
      console.log(`Get User Response:`, getResult);
      
      // 3. Test updating the user
      console.log('\n🔄 Step 3: Updating User...');
      const updateData = {
        name: testName + ' (Updated)',
        company: 'Test Company',
        position: 'Test Position'
      };
      
      const updateResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.tamyla.com'
        },
        body: JSON.stringify(updateData)
      });
      
      console.log(`Update User Status: ${updateResponse.status}`);
      const updateResult = await updateResponse.text();
      console.log(`Update User Response:`, updateResult);
      
      // 4. Test getting the user again to verify update
      console.log('\n🔄 Step 4: Verifying Update...');
      const verifyResponse = await fetch(`${DATA_SERVICE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://www.tamyla.com'
        }
      });
      
      console.log(`Verify Status: ${verifyResponse.status}`);
      const verifyResult = await verifyResponse.text();
      console.log(`Verify Response:`, verifyResult);
      
    } else {
      console.log('❌ Could not extract user ID, skipping subsequent tests');
    }
    
    // 5. Test finding user by email
    console.log('\n🔄 Step 5: Finding User by Email...');
    const findResponse = await fetch(`${DATA_SERVICE_URL}/users/email/${encodeURIComponent(testEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.tamyla.com'
      }
    });
    
    console.log(`Find User Status: ${findResponse.status}`);
    const findResult = await findResponse.text();
    console.log(`Find User Response:`, findResult);
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testUserOperations();

#!/usr/bin/env node

/**
 * Test Profile Update Functionality
 * Tests the complete profile update flow including new fields
 */

import fetch from 'node-fetch';

const API_BASE = 'https://data-service.tamylatrading.workers.dev';

async function testProfileUpdate() {
  console.log('🧪 Testing Profile Update Functionality');
  console.log('=======================================');
  
  try {
    // Step 1: Generate magic link
    console.log('\n1. Generating magic link...');
    const magicResponse = await fetch(`${API_BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'profile-test@example.com',
        name: 'Profile Test User'
      })
    });
    
    const magicData = await magicResponse.json();
    console.log('✅ Magic link generated:', magicData.token);
    
    // Step 2: Verify magic link and get auth token
    console.log('\n2. Verifying magic link...');
    const verifyResponse = await fetch(`${API_BASE}/auth/magic-link/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magicData.token })
    });
    
    const verifyData = await verifyResponse.json();
    const authToken = verifyData.token;
    console.log('✅ Auth token obtained');
    
    // Step 3: Get current user (before update)
    console.log('\n3. Getting current user (before update)...');
    const beforeResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const beforeUser = await beforeResponse.json();
    console.log('📋 User before update:', JSON.stringify(beforeUser, null, 2));
    
    // Step 4: Update profile with new fields
    console.log('\n4. Updating profile with new fields...');
    const updateData = {
      name: 'Updated Profile User',
      phone: '+1-555-123-4567',
      company: 'Test Company Inc.',
      position: 'Senior Developer'
    };
    
    const updateResponse = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}` 
      },
      body: JSON.stringify(updateData)
    });
    
    if (updateResponse.status !== 200) {
      const errorText = await updateResponse.text();
      throw new Error(`Profile update failed: ${updateResponse.status} - ${errorText}`);
    }
    
    const updateResult = await updateResponse.json();
    console.log('✅ Profile update response:', JSON.stringify(updateResult, null, 2));
    
    // Step 5: Get current user (after update)
    console.log('\n5. Getting current user (after update)...');
    const afterResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const afterUser = await afterResponse.json();
    console.log('📋 User after update:', JSON.stringify(afterUser, null, 2));
    
    // Step 6: Verify all fields were updated
    console.log('\n6. Verifying profile fields...');
    const checks = [
      { field: 'name', expected: updateData.name, actual: afterUser.name },
      { field: 'phone', expected: updateData.phone, actual: afterUser.phone },
      { field: 'company', expected: updateData.company, actual: afterUser.company },
      { field: 'position', expected: updateData.position, actual: afterUser.position }
    ];
    
    let allPassed = true;
    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`✅ ${check.field}: ${check.actual}`);
      } else {
        console.log(`❌ ${check.field}: expected "${check.expected}", got "${check.actual}"`);
        allPassed = false;
      }
    }
    
    if (allPassed) {
      console.log('\n🎉 ALL PROFILE UPDATE TESTS PASSED!');
    } else {
      console.log('\n❌ Some profile update tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Profile update test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testProfileUpdate();

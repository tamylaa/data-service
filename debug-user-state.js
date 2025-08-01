// Debug script to check user state in production database
const email = 'productbees1@gmail.com';

console.log('=== DATABASE SCHEMA CHECK ===');

// First, let's check the table schema
const schemaResult = await env.PROD_DB.prepare(`
  PRAGMA table_info(users)
`).all();

console.log('Users table schema:', schemaResult);

// Check if our user exists and what fields they have
const userResult = await env.PROD_DB.prepare(`
  SELECT * FROM users WHERE email = ?
`).bind(email).first();

console.log('User record for', email, ':', userResult);

// Check what happens during an update
const updateTest = await env.PROD_DB.prepare(`
  UPDATE users 
  SET phone = ?, company = ?, position = ?, updated_at = ? 
  WHERE email = ?
`).bind('+971585841933', 'super', 'super', new Date().toISOString(), email).run();

console.log('Update test result:', updateTest);

// Check user again after update
const userAfterUpdate = await env.PROD_DB.prepare(`
  SELECT * FROM users WHERE email = ?
`).bind(email).first();

console.log('User record after manual update:', userAfterUpdate);

return new Response(JSON.stringify({
  schema: schemaResult,
  originalUser: userResult,
  updateResult: updateTest,
  updatedUser: userAfterUpdate
}, null, 2), {
  headers: { 'Content-Type': 'application/json' }
});

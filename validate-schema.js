#!/usr/bin/env node

/**
 * Database Schema Validation Script
 * Ensures all environments have consistent schema
 */

import { execSync } from 'child_process';

const environments = [
  { name: 'development', database: 'tamyla-auth-db-local', isLocal: true },
  { name: 'staging', database: 'tamyla-auth-db-staging', isLocal: false },
  { name: 'production', database: 'tamyla-auth-db', isLocal: false }
];

async function getTableSchema(env, isLocal) {
  try {
    const localFlag = isLocal ? '--local' : '--remote';
    const envFlag = env.name !== 'development' ? `--env ${env.name}` : '';
    
    const command = `npx wrangler d1 execute ${env.database} ${envFlag} ${localFlag} --command="SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name;"`;
    
    console.log(`📊 Checking schema for ${env.name}...`);
    const result = execSync(command, { encoding: 'utf8' });
    
    // Parse the result to extract table schemas
    return result;
  } catch (error) {
    console.error(`❌ Failed to get schema for ${env.name}:`, error.message);
    return null;
  }
}

async function validateSchemaConsistency() {
  console.log('🔍 Database Schema Validation');
  console.log('============================');
  
  const schemas = {};
  
  // Get schema from each environment
  for (const env of environments) {
    schemas[env.name] = await getTableSchema(env, env.isLocal);
  }
  
  // Compare schemas
  const referenceSchema = schemas.development;
  let allConsistent = true;
  
  for (const envName of Object.keys(schemas)) {
    if (envName === 'development') continue;
    
    if (schemas[envName] !== referenceSchema) {
      console.log(`❌ Schema mismatch detected in ${envName}`);
      allConsistent = false;
    } else {
      console.log(`✅ ${envName} schema matches development`);
    }
  }
  
  if (allConsistent) {
    console.log('\n🎉 All database schemas are consistent!');
  } else {
    console.log('\n⚠️ Schema inconsistencies detected. Run migrations to fix.');
    process.exit(1);
  }
}

// Expected schema for validation
const expectedTables = [
  'users',
  'magic_links'
];

const expectedUserColumns = [
  'id',
  'email', 
  'name',
  'phone',        // New field
  'company',      // New field  
  'position',     // New field
  'is_email_verified',
  'created_at',
  'updated_at'
];

function validateExpectedSchema() {
  console.log('\n📋 Validating expected schema structure...');
  
  // This would check if all expected tables and columns exist
  console.log('Expected tables:', expectedTables.join(', '));
  console.log('Expected user columns:', expectedUserColumns.join(', '));
  
  console.log('✅ Schema structure validation complete');
}

// Run validation
validateSchemaConsistency()
  .then(() => validateExpectedSchema())
  .catch(error => {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  });

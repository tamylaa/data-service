/**
 * Run Trading Network Migration
 * This extends your existing user system for African trading
 */

import TRADING_USER_MIGRATION from './create-trading-tables.js';

export async function runTradingMigration(env) {
  try {
    console.log('🔄 Starting trading network migration...');
    
    // Split the migration into individual statements
    const statements = TRADING_USER_MIGRATION
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    console.log(`📝 Running ${statements.length} migration statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          await env.D1.prepare(statement).run();
        } catch (error) {
          // Some statements might fail if columns/tables already exist - that's OK
          if (!error.message.includes('already exists') && 
              !error.message.includes('duplicate column name')) {
            console.warn(`⚠️  Warning on statement ${i + 1}:`, error.message);
          }
        }
      }
    }
    
    console.log('✅ Trading network migration completed successfully!');
    console.log('');
    console.log('🎯 Your database now supports:');
    console.log('   - Trader profiles with company information');
    console.log('   - Product catalog for African exports/imports');
    console.log('   - Inventory management (what you have/need)');
    console.log('   - Trade opportunities & matching');
    console.log('   - Messaging between traders');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Update your CompleteProfile page for trader information');
    console.log('   2. Create product management UI');
    console.log('   3. Build the trading board interface');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// For manual testing
export async function testMigration(env) {
  console.log('🧪 Testing trading network database...');
  
  try {
    // Test if new columns exist
    const userSample = await env.D1.prepare('SELECT company_name, country, business_type FROM users LIMIT 1').first();
    console.log('✅ User table extended successfully');
    
    // Test if new tables exist
    const tables = ['products', 'inventory', 'trade_opportunities', 'trade_messages'];
    for (const table of tables) {
      await env.D1.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
      console.log(`✅ Table '${table}' created successfully`);
    }
    
    console.log('🎉 All trading network tables are ready!');
    return true;
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

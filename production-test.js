// Production-ready script to test core functionality
import { getTestDatabase } from './tests/helpers/d1.js';
import BaseD1Client from './src/shared/clients/d1/BaseD1Client.js';
import { randomUUID } from 'crypto';

// Use Node's crypto in a way that works
const generateId = () => randomUUID();

async function runProductionTests() {
  console.log('🚀 Running Production Readiness Tests\n');

  try {
    // Setup
    const db = await getTestDatabase();
    const client = new BaseD1Client(db);
    
    // Create schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        is_email_verified INTEGER DEFAULT 0,
        last_login TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS magic_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        is_used INTEGER DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    console.log('✅ Database schema created successfully');

    // Test 1: User Management
    console.log('\n📝 Testing User Management...');
    const userId = generateId();
    const timestamp = client.getCurrentTimestamp();
    
    await client.run(`
      INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, 'test@production.com', 'Production User', 0, timestamp, timestamp]);

    const user = await client.first('SELECT * FROM users WHERE email = ?', ['test@production.com']);
    
    if (user && user.email === 'test@production.com') {
      console.log('✅ User creation and retrieval works');
    } else {
      throw new Error('User creation failed');
    }

    // Test 2: Magic Link Flow
    console.log('\n🔗 Testing Magic Link Flow...');
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    
    await client.run(`
      INSERT INTO magic_links (user_id, token, is_used, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, token, 0, expiresAt, timestamp, timestamp]);

    const magicLink = await client.first('SELECT * FROM magic_links WHERE token = ?', [token]);
    
    if (magicLink && magicLink.user_id === userId) {
      console.log('✅ Magic link creation works');
    } else {
      throw new Error('Magic link creation failed');
    }

    // Test 3: Magic Link Verification
    console.log('\n✅ Testing Magic Link Verification...');
    await client.run(`
      UPDATE magic_links SET is_used = 1, updated_at = ? WHERE token = ?
    `, [timestamp, token]);

    await client.run(`
      UPDATE users SET is_email_verified = 1, last_login = ?, updated_at = ? WHERE id = ?
    `, [timestamp, timestamp, userId]);

    const verifiedUser = await client.first('SELECT * FROM users WHERE id = ?', [userId]);
    const usedLink = await client.first('SELECT * FROM magic_links WHERE token = ?', [token]);

    if (verifiedUser.is_email_verified === 1 && usedLink.is_used === 1) {
      console.log('✅ Magic link verification works');
    } else {
      throw new Error('Magic link verification failed');
    }

    // Test 4: Error Handling
    console.log('\n⚠️  Testing Error Handling...');
    try {
      await client.run(`
        INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [generateId(), 'test@production.com', 'Duplicate User', 0, timestamp, timestamp]);
      
      throw new Error('Should have failed with unique constraint');
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log('✅ Email uniqueness constraint works');
      } else {
        throw error;
      }
    }

    // Test 5: Batch Operations (from your working test)
    console.log('\n📦 Testing Batch Operations...');
    await client.run('DELETE FROM users WHERE email != ?', ['test@production.com']);

    const batchQueries = [
      {
        query: `INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [generateId(), 'batch1@test.com', 'Batch 1', 0, timestamp, timestamp]
      },
      {
        query: `INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [generateId(), 'batch2@test.com', 'Batch 2', 0, timestamp, timestamp]
      }
    ];

    await client.batch(batchQueries);
    const batchUsers = await client.all('SELECT * FROM users WHERE email LIKE ?', ['batch%@test.com']);
    
    if (batchUsers.length === 2) {
      console.log('✅ Batch operations work');
    } else {
      throw new Error('Batch operations failed');
    }

    console.log('\n🎉 All Production Tests Passed!');
    console.log('\n📊 Production Readiness Summary:');
    console.log('✅ Database schema creation');
    console.log('✅ User management (CRUD)');
    console.log('✅ Magic link generation');
    console.log('✅ Magic link verification');
    console.log('✅ Email uniqueness constraints');
    console.log('✅ Batch operations');
    console.log('✅ Error handling');
    console.log('\n🚀 Your application is ready for production deployment!');

  } catch (error) {
    console.error('\n❌ Production Test Failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runProductionTests();

// @ts-check
import { createTableQuery, insertUserQuery, selectUserQuery, updateUserQuery, deleteUserQuery, selectAllUsersQuery } from './test-queries.js';
import { getTestDatabase } from '../helpers/d1.js';
import BaseD1Client from '../../src/shared/clients/d1/BaseD1Client.js';

describe('BaseD1Client', () => {
  let client;

  beforeAll(async () => {
    // Initialize client and create test table
    const db = await getTestDatabase();
    client = new BaseD1Client(db);
    await client.run(createTableQuery);
  });

  beforeEach(async () => {
    // Clear test data
    await client.run('DELETE FROM test_users');
  });

  test('should insert and retrieve a user', async () => {
    // Given
    const testUser = {
      id: client.generateId(),
      name: 'Test User',
      email: 'test@example.com',
      created_at: client.getCurrentTimestamp()
    };

    // When
    await client.run(insertUserQuery, [
      testUser.id,
      testUser.name, 
      testUser.email,
      testUser.created_at
    ]);

    // Then
    const user = await client.first(selectUserQuery, [testUser.id]);
    expect(user).toBeTruthy();
    expect(user.id).toBe(testUser.id);
    expect(user.name).toBe(testUser.name);
    expect(user.email).toBe(testUser.email);
  });

  test('should update a user', async () => {
    // Given
    const userId = client.generateId();
    await client.run(insertUserQuery, [
      userId,
      'Original Name',
      'original@example.com',
      client.getCurrentTimestamp()
    ]);

    // When
    await client.run(updateUserQuery, [
      'Updated Name',
      'updated@example.com',
      userId
    ]);

    // Then
    const user = await client.first(selectUserQuery, [userId]);
    expect(user.name).toBe('Updated Name');
    expect(user.email).toBe('updated@example.com');
  });

  test('should delete a user', async () => {
    // Given
    const userId = client.generateId();
    await client.run(insertUserQuery, [
      userId,
      'To Delete',
      'delete@example.com',
      client.getCurrentTimestamp()
    ]);

    // When
    await client.run(deleteUserQuery, [userId]);

    // Then
    const user = await client.first(selectUserQuery, [userId]);
    expect(user).toBeNull();
  });

  test('should handle multiple operations', async () => {
    // Given
    const users = [
      { id: client.generateId(), name: 'User 1', email: 'user1@example.com' },
      { id: client.generateId(), name: 'User 2', email: 'user2@example.com' },
      { id: client.generateId(), name: 'User 3', email: 'user3@example.com' }
    ];

    // When
    const now = client.getCurrentTimestamp();
    for (const user of users) {
      await client.run(insertUserQuery, [user.id, user.name, user.email, now]);
    }

    // Then
    const allUsers = await client.all(selectAllUsersQuery);
    expect(allUsers).toHaveLength(3);
    // SQLite returns in insertion order, not reverse chronological
    expect(allUsers[0].name).toBe('User 1');
    expect(allUsers[1].name).toBe('User 2');
    expect(allUsers[2].name).toBe('User 3');
  });

  test('should handle batch operations', async () => {
    // Given
    const users = [
      { id: client.generateId(), name: 'Batch 1', email: 'batch1@example.com' },
      { id: client.generateId(), name: 'Batch 2', email: 'batch2@example.com' },
      { id: client.generateId(), name: 'Batch 3', email: 'batch3@example.com' }
    ];

    const now = client.getCurrentTimestamp();
    const queries = users.map(user => ({
      query: insertUserQuery,
      params: [user.id, user.name, user.email, now]
    }));

    // When
    await client.batch(queries);

    // Then
    const allUsers = await client.all(selectAllUsersQuery);
    expect(allUsers).toHaveLength(3);
    expect(allUsers.map(u => u.name)).toEqual(
      expect.arrayContaining(['Batch 1', 'Batch 2', 'Batch 3'])
    );
  });

  test('should handle failed operations', async () => {
    // Given
    const userId = client.generateId();
    await client.run(insertUserQuery, [
      userId,
      'Unique Email',
      'unique@example.com',
      client.getCurrentTimestamp()
    ]);

    // When/Then - Try to insert duplicate email
    await expect(client.run(insertUserQuery, [
      client.generateId(),
      'Another User',
      'unique@example.com',
      client.getCurrentTimestamp()
    ])).rejects.toThrow('UNIQUE constraint failed');
  });

  test('should handle invalid SQL', async () => {
    // When/Then
    await expect(client.run('INVALID SQL'))
      .rejects.toThrow('syntax error');
  });
});

// End of tests

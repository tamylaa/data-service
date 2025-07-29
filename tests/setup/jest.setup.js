import { jest, describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from '@jest/globals';

// Expose Jest globals to the global scope for ESM compatibility
Object.assign(global, {
  jest,
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach
});

// Mock crypto for generateId
global.crypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

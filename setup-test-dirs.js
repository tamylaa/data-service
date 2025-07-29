import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testDirs = [
  'tests/setup',
  'tests/unit',
  'tests/integration',
  'tests/e2e',
  'tests/helpers'
];

console.log('Creating test directory structure...');

testDirs.forEach(dir => {
  const fullPath = join(__dirname, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`ℹ️  Directory already exists: ${dir}`);
  }
});

console.log('\nTest directory structure setup complete!');
console.log('\nNext steps:');
console.log('1. Move test files to their respective directories');
console.log('2. Update import paths in test files');
console.log('3. Update package.json test scripts if needed');

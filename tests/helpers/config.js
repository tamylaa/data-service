import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from '@iarna/toml';

/**
 * Get wrangler configuration for the current environment
 */
export async function getWranglerConfig() {
  const wranglerPath = join(process.cwd(), 'wrangler.toml');
  const content = await readFile(wranglerPath, 'utf-8');
  return parse(content);
}

// Use Web Crypto API directly, available in both Node.js and Cloudflare Workers
const crypto = globalThis.crypto;

if (!crypto?.getRandomValues) {
  throw new Error('Web Crypto API is not available in this environment');
}

/**
 * Generates a cryptographically secure random string
 * @param {number} length - Length of the random string to generate (default: 32)
 * @returns {string} Random hexadecimal string
 */
export function generateRandomString(length = 32) {
  const byteLength = Math.ceil(length / 2); // Each byte gives us 2 hex chars
  const randomBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(randomBytes);
  
  // Convert to hex string
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, length);
}

/**
 * Generate a JWT token using Web Crypto API
 * @param {Object} payload - The payload to include in the token
 * @param {string} secret - The secret key to sign the token with
 * @param {string} expiresIn - Token expiration time (e.g., '7d', '24h')
 * @returns {Promise<string>} The generated JWT token
 */
export async function generateToken(payload, secret, expiresIn = '7d') {
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  // Calculate expiration time
  let expiresInMs = 7 * 24 * 60 * 60 * 1000; // Default to 7 days
  
  if (expiresIn) {
    const value = parseInt(expiresIn);
    if (expiresIn.endsWith('d')) {
      expiresInMs = value * 24 * 60 * 60 * 1000; // days
    } else if (expiresIn.endsWith('h')) {
      expiresInMs = value * 60 * 60 * 1000; // hours
    } else if (expiresIn.endsWith('m')) {
      expiresInMs = value * 60 * 1000; // minutes
    } else if (expiresIn.endsWith('s')) {
      expiresInMs = value * 1000; // seconds
    } else {
      expiresInMs = value; // assume milliseconds
    }
  }

  const header = {
    alg: 'HS256', // HMAC-SHA256
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);
  
  const data = {
    ...payload,
    iat: now,
    exp
  };

  // Base64Url encode
  const base64UrlEncode = (obj) => {
    const str = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...new Uint8Array(data)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedData = base64UrlEncode(data);
  
  // Create HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(`${encodedHeader}.${encodedData}`)
  );
  
  // Convert ArrayBuffer to base64url
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${encodedHeader}.${encodedData}.${signatureBase64}`;
}

/**
 * Verify a JWT token using Web Crypto API
 * @param {string} token - The JWT token to verify
 * @param {string} secret - The secret key to verify the token with
 * @returns {Promise<Object>} The decoded token payload if verification is successful
 * @throws {Error} If the token is invalid or expired
 */
export async function verifyToken(token, secret) {
  if (!token) {
    throw new Error('No token provided');
  }

  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const [encodedHeader, encodedData, signature] = token.split('.');
  
  if (!encodedHeader || !encodedData || !signature) {
    throw new Error('Invalid token format');
  }

  // Create HMAC signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  // Convert base64url to Uint8Array
  const signatureBytes = new Uint8Array(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(c => c.charCodeAt(0))
  );
  
  // Verify the signature
  const data = encoder.encode(`${encodedHeader}.${encodedData}`);
  const isValid = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
    signatureBytes,
    data
  );
  
  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const base64UrlDecode = (str) => {
    // Add padding if needed
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const payload = base64UrlDecode(encodedData);
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}

import { jsonResponse } from '../utils/response.js';
import { generateToken, verifyToken } from '../utils/token.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handle authentication requests
 * @param {Request} request - The incoming request
 * @param {D1Client} d1Client - The D1 database client
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The authentication response
 */
export async function handleAuth(request, d1Client, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Handle different auth endpoints
    if (path === '/auth/magic-link' && request.method === 'POST') {
      return await handleMagicLink(request, d1Client, env);
    } else if (path === '/auth/magic-link/verify' && request.method === 'POST') {
      return await handleVerifyMagicLink(request, d1Client, env);
    } else if (path === '/auth/me' && request.method === 'GET') {
      return await handleGetCurrentUser(request, d1Client, env);
    } else if (path === '/register' && request.method === 'POST') {
      return await handleRegister(request, d1Client, env);
    } else if (path === '/health' && request.method === 'GET') {
      return await handleHealth(request, d1Client, env);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  } catch (error) {
    console.error('Auth error:', error);
    return jsonResponse(
      { error: 'Authentication failed', message: error.message },
      error.statusCode || 500
    );
  }
}

/**
 * Handle magic link generation
 */
async function handleMagicLink(request, d1Client, env) {
  try {
    console.log('=== Starting magic link generation ===');
    console.log('Request URL:', request.url);
    
    const requestBody = await request.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { email, name } = requestBody;
    
    if (!email) {
      console.error('Email is required but not provided');
      throw { statusCode: 400, message: 'Email is required' };
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw { statusCode: 400, message: 'A valid email address is required' };
    }

    console.log(`[Magic Link] Starting generation for email: ${email}`);
    
    // First, create or get the user
    console.log(`[Magic Link] Looking up user by email: ${email}`);
    let user;
    try {
      user = await d1Client.first('SELECT * FROM users WHERE email = ?', [email]);
      console.log(`[Magic Link] User lookup result:`, user ? 'found' : 'not found');
    } catch (error) {
      console.error('[Magic Link] Error finding user by email:', error);
      throw error;
    }
    
    if (!user) {
      // Create new user
      const userId = d1Client.generateId();
      const timestamp = d1Client.getCurrentTimestamp();
      
      await d1Client.run(`
        INSERT INTO users (id, email, name, is_email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, email, name || '', 0, timestamp, timestamp]);
      
      user = { id: userId, email, name: name || '', is_email_verified: 0 };
    }
    
    // Generate magic link token
    const magicToken = crypto.randomUUID();
    const linkExpiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const createTimestamp = d1Client.getCurrentTimestamp();
    
    // Create magic link
    await d1Client.run(`
      INSERT INTO magic_links (user_id, token, is_used, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id, magicToken, 0, linkExpiresAt, createTimestamp, createTimestamp]);
    
    console.log(`Magic link generated for user ${user.id} (${user.email})`);

    // Get FRONTEND_URL from environment variables
    const frontendUrl = env?.FRONTEND_URL || 'http://localhost:3000';
    const magicLink = `${frontendUrl}/auth/verify?token=${magicToken}`;
    
    console.log('Magic link generation successful');
    
    // For development and test, return the magic link and token in the response
    const isDevOrTest = env?.NODE_ENV === 'development' || env?.NODE_ENV === 'test';
    
    return jsonResponse({
      success: true,
      message: 'Magic link generated successfully',
      // Include token in test/development for automated testing
      token: isDevOrTest ? magicToken : undefined,
      // Include magic link in development for manual testing
      magicLink: isDevOrTest ? magicLink : undefined,
      expiresAt: linkExpiresAt
    });
    
  } catch (error) {
    console.error('Error in handleMagicLink:', {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500
    });
    
    // Re-throw to be caught by the outer try-catch
    throw {
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to generate magic link'
    };
  }
}

/**
 * Handle magic link verification
 */
async function handleVerifyMagicLink(request, d1Client, env) {
  const { token } = await request.json();
  
  if (!token) {
    throw { statusCode: 400, message: 'Token is required' };
  }

  // Find the magic link
  const magicLink = await d1Client.first(`
    SELECT * FROM magic_links 
    WHERE token = ? AND is_used = 0
  `, [token]);
  
  if (!magicLink) {
    throw { statusCode: 400, message: 'Invalid or used magic link' };
  }
  
  // Check if expired
  const now = new Date();
  const expiresAt = new Date(magicLink.expires_at);
  if (now > expiresAt) {
    throw { statusCode: 400, message: 'Magic link has expired' };
  }
  
  // Mark the magic link as used
  await d1Client.run(`
    UPDATE magic_links 
    SET is_used = 1, updated_at = ? 
    WHERE token = ?
  `, [d1Client.getCurrentTimestamp(), token]);
  
  // Get the user and mark email as verified
  await d1Client.run(`
    UPDATE users 
    SET is_email_verified = 1, last_login = ?, updated_at = ? 
    WHERE id = ?
  `, [d1Client.getCurrentTimestamp(), d1Client.getCurrentTimestamp(), magicLink.user_id]);
  
  const user = await d1Client.first('SELECT * FROM users WHERE id = ?', [magicLink.user_id]);
  
  if (!user) {
    console.error(`[handleVerifyMagicLink] User not found for magic link: ${token}, user_id: ${magicLink.user_id}`);
    throw { statusCode: 404, message: 'User not found' };
  }
  
  // Generate JWT token
  const authToken = await generateToken(
    { userId: user.id, email: user.email },
    env.JWT_SECRET || 'test-secret',
    '7d' // 7 days expiration
  );

  return jsonResponse({
    success: true,
    token: authToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_email_verified: user.is_email_verified
    }
  });
}

/**
 * Handle user registration
 */
async function handleRegister(request, d1Client, env) {
  try {
    const { email, password, name } = await request.json();
    
    if (!email || !password) {
      return jsonResponse({ error: 'Email and password are required' }, 400);
    }

    // Check if user already exists
    const existingUser = await d1Client.users.findByEmail(email);
    if (existingUser) {
      return jsonResponse({ error: 'User already exists' }, 409);
    }

    // Create new user
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    const user = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      is_email_verified: 0,
      created_at: now,
      updated_at: now
    };

    // In a real app, you would hash the password here
    // For now, we'll store it as is (NOT RECOMMENDED FOR PRODUCTION)
    await d1Client.users.create({
      ...user,
      password_hash: password // This should be hashed in production
    });

    // Generate auth token
    const token = generateToken(user, env.JWT_SECRET);

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        is_email_verified: user.is_email_verified
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return jsonResponse(
      { error: 'Registration failed', message: error.message },
      500
    );
  }
}

/**
 * Get current authenticated user
 */
async function handleGetCurrentUser(request, d1Client, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = await verifyToken(token, env.JWT_SECRET);
  
  const user = await d1Client.users.findById(decoded.userId);
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  return jsonResponse({
    id: user.id,
    email: user.email,
    name: user.name,
    is_email_verified: user.is_email_verified,
    lastLogin: user.lastLogin
  });
}

/**
 * Handle health check requests
 * @param {Request} request - The incoming request
 * @param {D1Client} d1Client - The D1 database client
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The health check response
 */
export async function handleHealth(request, d1Client, env) {
  try {
    // Test database connectivity
    const dbTest = await d1Client.prepare('SELECT 1 as test').first();
    
    return jsonResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'unknown',
      database: dbTest ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    return jsonResponse({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    }, 503);
  }
}

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
    } else if (path === '/auth/me' && request.method === 'PUT') {
      return await handleUpdateCurrentUser(request, d1Client, env);
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
    
    // Create magic link using the proper MagicLinkClient
    console.log(`[Magic Link] Creating magic link for user ${user.id} (${user.email})`);
    const magicLinkRecord = await d1Client.magicLinks.create({
      userId: user.id,
      email: user.email,
      name: user.name || name || ''
    });
    
    console.log(`Magic link generated:`, {
      id: magicLinkRecord.id,
      token: magicLinkRecord.token,
      expiresAt: magicLinkRecord.expiresAt
    });
    
    console.log('Magic link generation successful');
    
    // Return magic link data - auth service will construct the proper URL
    return jsonResponse({
      success: true,
      message: 'Magic link generated successfully',
      id: magicLinkRecord.id,
      token: magicLinkRecord.token, // Auth service needs this to construct the magic link
      expiresAt: magicLinkRecord.expiresAt
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
 * Handle current user profile update
 * @param {Request} request - The incoming request
 * @param {D1Client} d1Client - The D1 database client
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The user update response
 */
export async function handleUpdateCurrentUser(request, d1Client, env) {
  try {
    console.log('=== Starting user profile update ===');
    
    // Get the authorization token from the header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization token required' }, 401);
    }

    const token = authHeader.substring(7);
    console.log('Token received for profile update');

    // Verify the JWT token
    let decoded;
    try {
      decoded = verifyToken(token, env);
      console.log('Token verified successfully for user:', decoded.email);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError.message);
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Get the profile data from the request body
    const profileData = await request.json();
    console.log('Profile update data received:', JSON.stringify(profileData, null, 2));
    
    // Validate required fields
    if (!profileData.name || !profileData.phone) {
      return jsonResponse({ error: 'Name and phone are required' }, 400);
    }

    // Prepare update data
    const updateData = {
      name: profileData.name.trim(),
      phone: profileData.phone.trim(),
      company: profileData.company ? profileData.company.trim() : '',
      position: profileData.position ? profileData.position.trim() : '',
      updated_at: new Date().toISOString()
    };

    console.log('Updating user profile for user ID:', decoded.userId);

    // Update the user in the database
    const updateResult = await d1Client.prepare(`
      UPDATE users 
      SET name = ?, phone = ?, company = ?, position = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      updateData.name,
      updateData.phone,
      updateData.company,
      updateData.position,
      updateData.updated_at,
      decoded.userId
    ).run();

    if (!updateResult.success) {
      console.error('Database update failed:', updateResult);
      return jsonResponse({ error: 'Failed to update user profile' }, 500);
    }

    console.log('User profile updated successfully, changes:', updateResult.changes);

    // Fetch the updated user data
    const updatedUser = await d1Client.prepare(`
      SELECT id, email, name, phone, company, position, is_email_verified, created_at, updated_at
      FROM users WHERE id = ?
    `).bind(decoded.userId).first();

    if (!updatedUser) {
      return jsonResponse({ error: 'User not found after update' }, 404);
    }

    console.log('Updated user data retrieved:', updatedUser.email);

    // Check if profile is complete (has required fields)
    const profileComplete = !!(updatedUser.name && updatedUser.phone);

    // Return the updated user data
    return jsonResponse({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        company: updatedUser.company || '',
        position: updatedUser.position || '',
        isEmailVerified: !!updatedUser.is_email_verified,
        profileComplete: profileComplete,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return jsonResponse(
      { 
        error: 'Failed to update profile',
        message: error.message,
        details: env.NODE_ENV === 'development' ? error.stack : undefined
      },
      500
    );
  }
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

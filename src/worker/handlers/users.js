import { jsonResponse } from '../utils/response.js';

/**
 * Handle user-related requests
 * @param {Request} request - The incoming request
 * @param {D1Client} d1Client - The D1 database client
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The user response
 */
export async function handleUsers(request, d1Client, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/users', '').replace('/users', '');
  const userId = path.split('/')[1]; // Extract user ID from path if present

  try {
    // Handle different user endpoints
    if (request.method === 'GET') {
      if (path === '' || path === '/') {
        // List users (for admin purposes)
        return await listUsers(d1Client);
      } else if (userId) {
        // Get specific user
        return await getUser(userId, d1Client);
      }
    } else if (request.method === 'POST' && (path === '' || path === '/')) {
      // Create new user
      return await createUser(request, d1Client);
    } else if (request.method === 'PUT' && userId) {
      // Update user
      return await updateUser(request, userId, d1Client);
    } else if (request.method === 'DELETE' && userId) {
      // Delete user
      return await deleteUser(userId, d1Client);
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  } catch (error) {
    console.error('User handler error:', error);
    return jsonResponse(
      { error: 'User operation failed', message: error.message },
      error.statusCode || 500
    );
  }
}

/**
 * List all users (paginated)
 */
async function listUsers(d1Client) {
  const users = await d1Client.db.prepare(
    'SELECT id, email, name, is_email_verified, last_login, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 100'
  ).all();
  
  return jsonResponse(users.results || []);
}

/**
 * Get a specific user by ID
 */
async function getUser(userId, d1Client) {
  const user = await d1Client.findUserById(userId);
  
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  // Don't return sensitive information
  const { password, ...userData } = user;
  return jsonResponse(userData);
}

/**
 * Create a new user
 */
async function createUser(request, d1Client) {
  const { email, name, password } = await request.json();
  
  if (!email) {
    throw { statusCode: 400, message: 'Email is required' };
  }

  // In a real app, you would hash the password before storing it
  const user = await d1Client.createUser({ email, name });
  
  return jsonResponse(user, 201);
}

/**
 * Update an existing user
 */
async function updateUser(request, userId, d1Client) {
  const updates = await request.json();
  
  if (!updates || Object.keys(updates).length === 0) {
    throw { statusCode: 400, message: 'No updates provided' };
  }
  
  try {
    // Use the D1Client's updateUser method to handle the update
    const updatedUser = await d1Client.updateUser(userId, updates);
    
    if (!updatedUser) {
      throw { statusCode: 404, message: 'User not found' };
    }
    
    // Remove sensitive information before returning
    const { password, ...userData } = updatedUser;
    
    return jsonResponse(userData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw { statusCode: error.statusCode || 500, message: error.message };
  }
}

/**
 * Delete a user
 */
async function deleteUser(userId, d1Client) {
  // In a real app, you would soft delete the user
  const result = await d1Client.db.prepare(
    'DELETE FROM users WHERE id = ? RETURNING id'
  ).bind(userId).run();
  
  if (!result.results.length) {
    throw { statusCode: 404, message: 'User not found' };
  }

  return jsonResponse({ success: true, message: 'User deleted' });
}

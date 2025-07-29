import { getD1Client } from '../clients/d1/index.js';

/**
 * Find a user by ID
 * @param {string} userId - The user ID to find
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The user object or null if not found
 */
export async function findUserById(userId, request = {}) {
  const client = getD1Client(request);
  return await client.findUserById(userId);
}

/**
 * Find a user by email
 * @param {string} email - The email to search for
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The user object or null if not found
 */
export async function findUserByEmail(email, request = {}) {
  const client = getD1Client(request);
  return await client.findUserByEmail(email);
}

/**
 * Create a new user
 * @param {Object} userData - The user data
 * @param {string} userData.email - User's email
 * @param {string} [userData.name] - User's name (optional)
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The created user
 */
export async function createUser({ email, name = '' }, request = {}) {
  const client = getD1Client(request);
  return await client.createUser({ email, name });
}

/**
 * Update a user
 * @param {string} userId - The ID of the user to update
 * @param {Object} updates - The updates to apply
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The updated user
 */
export async function updateUser(userId, updates, request = {}) {
  const client = getD1Client(request);
  return await client.updateUser(userId, updates);
}

/**
 * Create a magic link for a user
 * @param {string} userId - The ID of the user
 * @param {Object} [options] - Options for the magic link
 * @param {string} [options.email] - Email for new user creation if user doesn't exist
 * @param {string} [options.name] - Name for new user creation
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The magic link data
 */
/**
 * Create a magic link for a user
 * @param {string} userId - The ID of the user (optional if email is provided)
 * @param {Object} [options] - Options for the magic link
 * @param {string} [options.email] - Email for new user creation if user doesn't exist
 * @param {string} [options.name] - Name for new user creation
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The magic link data
 */
export async function createMagicLink(userId, { email, name } = {}, request = {}) {
  const client = getD1Client(request);
  
  // If userId is not provided but email is, we'll let D1Client handle user creation
  const magicLinkData = await client.createMagicLink({
    userId,
    email,
    name
  });
  
  return {
    token: magicLinkData.token,
    expiresAt: magicLinkData.expiresAt,
    user: magicLinkData.user
  };
}

/**
 * Verify a magic link token
 * @param {string} token - The magic link token to verify
 * @param {Object} [request] - The request object for environment variables
 * @returns {Promise<Object>} The user data if verification is successful
 * @throws {Error} If token is invalid or verification fails
 */
export async function verifyMagicLink(token, request = {}) {
  if (!token) {
    throw new Error('Token is required for verification');
  }
  
  const client = getD1Client(request);
  try {
    const verificationResult = await client.verifyMagicLink(token);
    
    if (!verificationResult || !verificationResult.user) {
      throw new Error('Invalid or expired token');
    }
    
    return {
      user: verificationResult.user,
      token: verificationResult.token
    };
  } catch (error) {
    console.error('Error verifying magic link:', error);
    throw new Error(error.message || 'Failed to verify magic link');
  }
}

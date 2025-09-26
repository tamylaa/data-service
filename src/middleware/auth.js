/**
 * Reusable Authentication Module for Data Service
 * Provides consistent authentication across all endpoints
 */

/**
 * Check if token looks like a service API key vs JWT
 * @param {string} token - The token to check
 * @param {Object} env - Environment variables
 * @returns {boolean} True if it's a service API key
 */
function isServiceApiKey(token, env) {
  // JWTs have 3 parts separated by dots
  if (token.split('.').length === 3) {
    return false; // It's a JWT
  }
  
  // Check if it matches any known service API key patterns
  const serviceKeys = [
    env.CONTENT_SKIMMER_API_KEY,
    env.LOGGER_SERVICE_API_KEY, 
    env.AUTH_SERVICE_API_KEY
  ].filter(Boolean);
  
  return serviceKeys.includes(token);
}

/**
 * Validate service API key
 * @param {string} apiKey - The API key to validate
 * @param {Object} env - Environment variables  
 * @param {string} pathname - Request path for logging
 * @param {string} serviceName - Name of the calling service
 * @returns {Promise<Object>} Validation result
 */
async function validateServiceApiKey(apiKey, env, pathname, serviceName = 'unknown') {
  // Define valid service API keys
  const validServices = {
    [env.CONTENT_SKIMMER_API_KEY]: { 
      name: 'content-skimmer', 
      permissions: ['webhook:write', 'files:read'] 
    },
    [env.LOGGER_SERVICE_API_KEY]: { 
      name: 'logger-service', 
      permissions: ['users:read', 'search:read'] 
    },
    [env.AUTH_SERVICE_API_KEY]: { 
      name: 'auth-service', 
      permissions: ['users:write', 'users:read'] 
    }
  };

  const service = validServices[apiKey];
  if (!service) {
    console.error(`[Auth] Invalid service API key for ${pathname}`);
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Invalid service API key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log(`[Auth] Validated service ${service.name} (reported as: ${serviceName}) for ${pathname}`);
  return { 
    success: true, 
    service: service.name,
    serviceName: serviceName,
    permissions: service.permissions 
  };
}

/**
 * Authenticate incoming requests with multiple auth types
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @param {string} pathname - The request pathname for logging
 * @param {Object} options - Authentication options
 * @returns {Promise<Object>} Authentication result
 */
export async function authenticateRequest(request, env, pathname, options = {}) {
  const { 
    authType = 'jwt',           // 'jwt' or 'webhook'
    customErrorMessage = null,
    allowAnonymous = false
  } = options;

  const authHeader = request.headers.get('Authorization');
  const serviceKeyHeader = request.headers.get('X-Service-Key');
  
  // Handle anonymous access
  if (allowAnonymous && !authHeader && !serviceKeyHeader) {
    return { success: true, user: null, anonymous: true };
  }

  // Check for service key authentication first (preferred for services)
  if (serviceKeyHeader) {
    const serviceName = request.headers.get('X-Service-Name') || 'unknown';
    return await validateServiceApiKey(serviceKeyHeader, env, pathname, serviceName);
  }

  // Require authentication
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[Auth] Blocked unauthenticated request to protected endpoint: ${pathname}`);
    return {
      success: false,
      response: new Response(
        JSON.stringify({ 
          error: customErrorMessage || 'Authentication required for this endpoint' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

      // JWT Authentication (User tokens)
      if (authType === 'jwt') {
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        
        // First, check if this looks like a service API key instead of JWT
        if (isServiceApiKey(token, env)) {
          return await validateServiceApiKey(token, env, pathname);
        }
        
        // It's a JWT token - validate it
        try {
          const { verifyToken } = await import('./utils/token.js');
          const payload = await verifyToken(token, env.AUTH_JWT_SECRET);
          console.log(`[Auth] Verified user for ${pathname}: ${payload.user?.id || payload.sub || 'unknown'}`);
          
          // Add user info to request for handlers to use
          request.authUser = payload.user || { id: payload.sub };
          return { success: true, user: request.authUser };
        } catch (authError) {
          console.error(`[Auth] JWT verification failed for ${pathname}:`, authError.message);
          return {
            success: false,
            response: new Response(
              JSON.stringify({ error: 'Invalid or expired JWT token' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } }
            )
          };
        }
      }  // Webhook Authentication
  if (authType === 'webhook') {
    try {
      const { validateWebhookAuth } = await import('./handlers/webhook.js');
      if (!validateWebhookAuth(request, env)) {
        console.log(`[Auth] Invalid webhook signature for ${pathname}`);
        return {
          success: false,
          response: new Response(
            JSON.stringify({ error: 'Invalid webhook signature' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        };
      }
      return { success: true, webhookValid: true };
    } catch (error) {
      console.error(`[Auth] Webhook validation error for ${pathname}:`, error.message);
      return {
        success: false,
        response: new Response(
          JSON.stringify({ error: 'Webhook validation failed' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      };
    }
  }

  return {
    success: false,
    response: new Response(
      JSON.stringify({ error: 'Unknown authentication type' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  };
}

/**
 * Check if an endpoint requires authentication
 * @param {string} pathname - The request pathname
 * @returns {boolean} Whether the endpoint requires authentication
 */
export function requiresAuthentication(pathname) {
  const protectedPaths = ['/users', '/search/', '/files'];
  const publicPaths = ['/health', '/webhook/health'];
  
  // Always allow public paths
  if (publicPaths.includes(pathname)) {
    return false;
  }
  
  // Check if path matches any protected patterns
  return protectedPaths.some(path => pathname.startsWith(path));
}

/**
 * Middleware-style authentication wrapper
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @param {Object} options - Authentication options
 * @returns {Promise<Response|null>} Response if auth failed, null if success
 */
export async function requireAuth(request, env, options = {}) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (!requiresAuthentication(pathname)) {
    return null; // Continue processing
  }
  
  const authResult = await authenticateRequest(request, env, pathname, options);
  
  if (!authResult.success) {
    return authResult.response;
  }
  
  return null; // Continue processing
}
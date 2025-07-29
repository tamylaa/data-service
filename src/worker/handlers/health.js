/**
 * Health check handler
 * @param {Request} request - The incoming request
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The health check response
 */
export async function handleHealth(request, env) {
  console.log('[Health] Handling health check request');
  
  // Create a basic response object with detailed logging
  const createResponse = (status, data = {}, statusCode = 200) => {
    try {
      const responseData = {
        status,
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV || 'development',
        ...data
      };

      // Add debug info in development/test mode
      if (env.NODE_ENV !== 'production') {
        responseData.debug = {
          NODE_ENV: env.NODE_ENV,
          DB_BINDING_AVAILABLE: !!env.DB,
          DB_BINDING_TYPE: env.DB ? typeof env.DB : 'not available',
          DB_KEYS: env.DB ? Object.keys(env) : [],
          TIMESTAMP: new Date().toISOString(),
          RUNTIME: 'Cloudflare Workers',
          REQUEST_METHOD: request.method,
          REQUEST_URL: request.url,
          ENV_KEYS: Object.keys(env).filter(k => !k.startsWith('_'))
        };
        
        console.log('[Health] Debug info:', JSON.stringify(responseData.debug, null, 2));
      }

      const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Worker-Environment': env.NODE_ENV || 'development'
      };

      console.log(`[Health] Sending ${status} response with status code ${statusCode}`);
      return new Response(JSON.stringify(responseData, null, 2), {
        status: statusCode,
        headers
      });
    } catch (error) {
      console.error('[Health] Error creating response:', error);
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Failed to create response',
          message: error.message,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };

  try {
    console.log('[Health] Handling health check request');
    
    // Skip database checks in test mode or if DB binding is not available
    if (env.NODE_ENV === 'test' || !env?.DB) {
      console.log('[Health] Running in test mode or no DB binding - skipping DB check');
      return createResponse('ok', {
        services: {
          api: 'ok',
          database: 'skipped'
        }
      });
    }

    // For non-test environments with DB binding
    try {
      // Use dynamic import to avoid circular dependencies
      const { getD1Client } = await import('../../shared/db/index.js');
      
      if (!env.DB) {
        throw new Error('DB binding is not available in the environment');
      }
      
      // Initialize D1 client
      const d1Client = getD1Client(env.DB);
      
      // Test database connection with a simple query
      const testQuery = await d1Client.db.prepare('SELECT 1 as test').first();
      
      if (!testQuery || testQuery.test !== 1) {
        throw new Error('Database test query failed');
      }
      
      return createResponse('ok', {
        services: {
          api: 'ok',
          database: 'ok'
        }
      });
    } catch (dbError) {
      console.error('[Health] Database health check failed:', dbError);
      return createResponse('degraded', {
        error: 'Database health check failed',
        message: dbError.message,
        services: {
          api: 'ok',
          database: 'unavailable'
        }
      }, 503);
    }
    } catch (error) {
      console.error('[Health] Health check handler error:', error);
      return createResponse('error', {
        error: 'Health check failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        services: {
          api: 'error',
          database: 'unknown'
        }
      }, 500);
    }
}

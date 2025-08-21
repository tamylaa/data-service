import { initD1Client, getD1Client } from '../shared/clients/d1/index.js';
import { handleAuth } from './handlers/auth.js';
import { handleUsers } from './handlers/users.js';
import { handleHealth } from './handlers/health.js';
import * as fileHandlers from './handlers/files.js';
import { getEnv, isDevelopment, isTest, isProduction } from './utils/env.js';

// Simple in-memory cache for development
const devCache = new Map();

// Track initialization state
let isInitialized = false;

/**
 * Handle incoming HTTP requests
 * @param {Request} request - The incoming request
 * @param {Object} env - The Cloudflare Workers environment
 * @param {Object} ctx - The Cloudflare Workers context
 * @returns {Promise<Response>} The response to the request
 */
export default {
  async fetch(request, env, ctx) {
    // Get environment information
    const nodeEnv = getEnv(env, 'NODE_ENV', 'development');
    const workerName = getEnv(env, 'WORKER_NAME', 'data-service');
    
    // Log detailed environment information for debugging
    console.log('=== Worker Request Start ===');
    console.log('Request URL:', request.url);
    console.log('Request Method:', request.method);
    console.log('Environment:', {
      NODE_ENV: nodeEnv,
      WORKER_NAME: workerName,
      isDevelopment: isDevelopment(env),
      isTest: isTest(env),
      isProduction: isProduction(env)
    });
    
    // Log DB binding information
    console.log('DB Binding Info:', {
      available: !!env.DB,
      type: env.DB ? typeof env.DB : 'not available',
      hasPrepare: env.DB && typeof env.DB.prepare === 'function',
      hasExec: env.DB && typeof env.DB.exec === 'function',
      keys: env.DB ? Object.keys(env.DB) : 'N/A'
    });

    try {
      // Initialize D1 client if not already done
      if (!isInitialized) {
        try {
          await initD1Client(env);
          isInitialized = true;
          
          // Log database info after successful initialization
          const d1Client = getD1Client();
          console.log('Database Info:', {
            type: typeof d1Client.db,
            prepareAvailable: typeof d1Client.db.prepare === 'function',
            execAvailable: typeof d1Client.db.exec === 'function',
            environment: env.NODE_ENV || 'development'
          });
        } catch (error) {
          console.error('❌ Failed to initialize D1 client:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Failed to initialize database',
              details: env.NODE_ENV === 'development' ? error.message : undefined
            }), 
            { 
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }
      
      // Get the initialized D1 client
      const d1Client = getD1Client();
      
      // Route the request to the appropriate handler
      const url = new URL(request.url);
      console.log(`[${new Date().toISOString()}] Received request: ${request.method} ${url.pathname}`);
      
      // Health check endpoint
      if (url.pathname === '/health' && request.method === 'GET') {
        console.log('Handling health check request');
        try {
          const healthResponse = await handleHealth(request, env);
          console.log('Health check response:', {
            status: healthResponse.status,
            statusText: healthResponse.statusText,
            headers: Object.fromEntries(healthResponse.headers.entries())
          });
          return healthResponse;
        } catch (error) {
          console.error('Error in health check handler:', error);
          return new Response(
            JSON.stringify({
              status: 'error',
              error: 'Health check failed',
              message: error.message
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Route handling with new endpoint structure
      const { pathname } = url;
      
      // Auth endpoints
      if (pathname === '/register' && request.method === 'POST') {
        return handleAuth(request, d1Client, env);
      }
      
      // Auth endpoints
      if (pathname.startsWith('/auth/')) {
        // Create a clean environment object with only the variables we need
        const workerEnv = {
          // Core environment
          NODE_ENV: env.NODE_ENV || 'development',
          
          // Authentication
          AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
          
          // Frontend
          FRONTEND_URL: env.FRONTEND_URL || 'http://localhost:3000',
          
          // Rate limiting
          RATE_LIMIT_WINDOW_MS: parseInt(env.RATE_LIMIT_WINDOW_MS || '900000', 10),
          RATE_LIMIT_MAX: parseInt(env.RATE_LIMIT_MAX || '100', 10)
        };
        
        // Debug log the environment (but don't log sensitive values in production)
        if (workerEnv.NODE_ENV !== 'production') {
          console.log('Environment variables:', {
            ...workerEnv,
            AUTH_JWT_SECRET: workerEnv.AUTH_JWT_SECRET ? '[REDACTED]' : 'NOT SET'
          });
        }
        
        // Ensure AUTH_JWT_SECRET is set
        if (!workerEnv.AUTH_JWT_SECRET) {
          console.error('AUTH_JWT_SECRET is not set in environment variables');
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Server configuration error',
              message: 'AUTH_JWT_SECRET is not configured',
              envKeys: Object.keys(env).filter(k => !k.startsWith('_'))
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        return handleAuth(request, d1Client, workerEnv);
      }
      
      // Files endpoints - require authentication
      if (pathname.startsWith('/files')) {
        // Check for authentication on all /files endpoints
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Missing or invalid authorization header' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Verify JWT token
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        try {
          const { verifyToken } = await import('./utils/token.js');
          const payload = await verifyToken(token, env.AUTH_JWT_SECRET);
          console.log(`[Auth] Verified user: ${payload.user?.id || payload.sub || 'unknown'}`);
          
          // Add user info to request for handlers to use
          request.authUser = payload.user || { id: payload.sub };
        } catch (authError) {
          console.error('[Auth] Token verification failed:', authError.message);
          return new Response(
            JSON.stringify({ error: 'Invalid or expired token' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (pathname === '/files' && request.method === 'GET') {
        // List files
        const files = await fileHandlers.listFiles(request, d1Client);
        return new Response(JSON.stringify(files), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (pathname === '/files' && request.method === 'POST') {
        // Use modular handler for POST /files
        const { handleFilesPost } = await import('./handlers/files-post.js');
        return handleFilesPost(request, d1Client);
      }
      if (pathname.startsWith('/files/') && request.method === 'GET') {
        // Get file metadata by ID
        const id = pathname.split('/')[2];
        const file = await fileHandlers.getFileById(id, d1Client);
        if (!file) return new Response('Not Found', { status: 404 });
        return new Response(JSON.stringify(file), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (pathname.startsWith('/files/') && request.method === 'PATCH') {
        // Update file metadata
        const id = pathname.split('/')[2];
        const updates = await request.json();
        const file = await fileHandlers.updateFileMetadata(id, updates, d1Client);
        return new Response(JSON.stringify(file), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (pathname.startsWith('/files/') && request.method === 'DELETE') {
        // Delete file metadata
        const id = pathname.split('/')[2];
        await fileHandlers.deleteFileMetadata(id, d1Client);
        return new Response(JSON.stringify({ id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Webhook endpoints - for receiving callbacks from other services
      if (pathname.startsWith('/webhook/')) {
        const { handleSkimmerWebhook, validateWebhookAuth, handleWebhookHealth, getWebhookActivity } = await import('./handlers/webhook.js');
        
        // Webhook health check
        if (pathname === '/webhook/health' && request.method === 'GET') {
          return handleWebhookHealth(request);
        }
        
        // Webhook activity log (for debugging)
        if (pathname === '/webhook/activity' && request.method === 'GET') {
          return getWebhookActivity(request, d1Client);
        }
        
        // Content-skimmer completion webhook
        if (pathname === '/webhook/skimmer-complete' && request.method === 'POST') {
          // Optional: Validate webhook authentication
          // if (!validateWebhookAuth(request, env)) {
          //   return new Response(
          //     JSON.stringify({ success: false, error: 'Unauthorized webhook request' }),
          //     { status: 401, headers: { 'Content-Type': 'application/json' } }
          //   );
          // }
          
          return handleSkimmerWebhook(request, d1Client);
        }
        
        return new Response(
          JSON.stringify({ success: false, error: 'Webhook endpoint not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Search endpoints (query learning)
      if (pathname.startsWith('/search/')) {
        const { handleSearch } = await import('./handlers/search.js');
        return handleSearch(request, env);
      }

      // Users endpoints - handle both /api/users and /users
      if (pathname.startsWith('/users')) {
        return handleUsers(request, d1Client, env);
      }

      // Return 404 for all other routes
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Error handling request:', error);
      let errorDetails = {
        success: false,
        error: 'Internal Server Error',
        message: error && error.message ? error.message : String(error)
      };
      if (error && error.stack) errorDetails.stack = error.stack;
      // If error is an object with more info, include it
      if (typeof error === 'object') {
        for (const k of Object.keys(error)) {
          if (!(k in errorDetails)) errorDetails[k] = error[k];
        }
      }
      return new Response(
        JSON.stringify(errorDetails),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
};

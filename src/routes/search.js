// Cloudflare Worker handler for query learning endpoints
import { getD1Client } from '../shared/db/D1Client.js';
import { QueryEventModel, QuerySessionModel, QueryPatternModel } from '../shared/db/models/queryLearning.js';

/**
 * Handle search-related requests (query learning)
 * @param {Request} request - The incoming request
 * @param {Object} env - The Cloudflare Workers environment
 * @returns {Promise<Response>} The response
 */
export async function handleSearch(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  try {
    const d1Client = getD1Client();
    
    // POST /search/query-events - log a query event
    if (pathname === '/search/query-events' && method === 'POST') {
      const body = await request.json();
      const model = new QueryEventModel(d1Client.db);
      const result = await model.create(body);
      return new Response(JSON.stringify({ success: true, result }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /search/query-events/:id/interactions - update query event with interactions
    if (pathname.startsWith('/search/query-events/') && pathname.endsWith('/interactions') && method === 'PUT') {
      const body = await request.json();
      const eventId = pathname.split('/')[3];
      const model = new QueryEventModel(d1Client.db);
      const { resultsClicked, followUpQuery, taskCompleted } = body;
      const sql = `UPDATE query_events SET results_clicked = ?, follow_up_queries = ?, task_completed = ? WHERE id = ?`;
      await model.run(sql, [JSON.stringify(resultsClicked || []), followUpQuery || null, taskCompleted || false, eventId]);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /search/query-events/recent?userId=...
    if (pathname === '/search/query-events/recent' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      const days = parseInt(url.searchParams.get('days') || '30');
      const model = new QueryEventModel(d1Client.db);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const sql = `SELECT * FROM query_events WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC LIMIT 50`;
      const results = await model.all(sql, [userId, cutoff]);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /search/query-patterns?userId=...
    if (pathname === '/search/query-patterns' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const model = new QueryPatternModel(d1Client.db);
      const results = await model.findByUser(userId, limit);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /search/query-sessions - create session
    if (pathname === '/search/query-sessions' && method === 'POST') {
      const body = await request.json();
      const model = new QuerySessionModel(d1Client.db);
      const result = await model.create(body);
      return new Response(JSON.stringify({ success: true, result }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /search/query-sessions/active?userId=...
    if (pathname === '/search/query-sessions/active' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      const limit = parseInt(url.searchParams.get('limit') || '1');
      const model = new QuerySessionModel(d1Client.db);
      const results = await model.findByUser(userId, limit);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Route not found
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Search endpoint not found',
      pathname,
      method 
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in search handler:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

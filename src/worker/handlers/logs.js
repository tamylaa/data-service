/**
 * Log Handlers - Handle log storage and retrieval requests
 * Provides endpoints for logger-service integration
 */

/**
 * Store a log entry from logger-service
 * POST /api/logs/store
 */
export async function handleLogStore(request, d1Client) {
  try {
    const logData = await request.json();
    
    // Validate required fields
    if (!logData.id || !logData.message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: id, message' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare data for storage
    const now = new Date().toISOString();
    const logEntry = {
      id: logData.id,
      timestamp: logData.timestamp || Date.now(),
      severity: logData.severity || 'info',
      category: logData.category || null,
      source: logData.source || null,
      component: logData.component || null,
      endpoint: logData.endpoint || null,
      environment: logData.environment || 'unknown',
      message: logData.message,
      error_type: logData.errorType || null,
      error_code: logData.errorCode || null,
      stack_trace: logData.stackTrace || null,
      user_id: logData.userId || null,
      session_id: logData.sessionId || null,
      request_id: logData.requestId || null,
      ip_address: logData.ipAddress || null,
      user_agent: logData.userAgent || null,
      metadata: JSON.stringify(logData.metadata || {}),
      tags: JSON.stringify(logData.tags || []),
      duration: logData.duration || null,
      memory_usage: logData.memoryUsage || null,
      feature: logData.feature || null,
      workflow: logData.workflow || null,
      version: logData.version || null,
      processed_at: logData.processedAt || now,
      processing_time: logData.processingTime || null,
      categorization_confidence: logData.categorizationConfidence || null,
      patterns: JSON.stringify(logData.patterns || []),
      triage_level: logData.triageLevel || null,
      triage_actions: JSON.stringify(logData.triageActions || []),
      created_at: now,
      updated_at: now
    };

    // Insert into database
    const sql = `
      INSERT INTO logs (
        id, timestamp, severity, category, source, component, endpoint, environment,
        message, error_type, error_code, stack_trace, user_id, session_id,
        request_id, ip_address, user_agent, metadata, tags, duration,
        memory_usage, feature, workflow, version, processed_at, processing_time,
        categorization_confidence, patterns, triage_level, triage_actions,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const stmt = d1Client.db.prepare(sql);
    const result = await stmt.bind(
      logEntry.id, logEntry.timestamp, logEntry.severity, logEntry.category,
      logEntry.source, logEntry.component, logEntry.endpoint, logEntry.environment,
      logEntry.message, logEntry.error_type, logEntry.error_code, logEntry.stack_trace,
      logEntry.user_id, logEntry.session_id, logEntry.request_id, logEntry.ip_address,
      logEntry.user_agent, logEntry.metadata, logEntry.tags, logEntry.duration,
      logEntry.memory_usage, logEntry.feature, logEntry.workflow, logEntry.version,
      logEntry.processed_at, logEntry.processing_time, logEntry.categorization_confidence,
      logEntry.patterns, logEntry.triage_level, logEntry.triage_actions,
      logEntry.created_at, logEntry.updated_at
    ).run();

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          id: logData.id,
          stored: true,
          timestamp: logEntry.timestamp
        }
      }), 
      { 
        status: 201, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error storing log:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to store log',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Retrieve logs with filtering and pagination
 * GET /api/logs
 */
export async function handleLogQuery(request, d1Client) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    
    // Parse query parameters
    const {
      page = 1,
      limit = 50,
      severity,
      category,
      component,
      environment,
      startTime,
      endTime,
      userId,
      sessionId,
      search
    } = params;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build WHERE clause
    const conditions = [];
    const bindings = [];
    
    if (severity) {
      conditions.push('severity = ?');
      bindings.push(severity);
    }
    
    if (category) {
      conditions.push('category = ?');
      bindings.push(category);
    }
    
    if (component) {
      conditions.push('component = ?');
      bindings.push(component);
    }
    
    if (environment) {
      conditions.push('environment = ?');
      bindings.push(environment);
    }
    
    if (userId) {
      conditions.push('user_id = ?');
      bindings.push(userId);
    }
    
    if (sessionId) {
      conditions.push('session_id = ?');
      bindings.push(sessionId);
    }
    
    if (startTime) {
      conditions.push('timestamp >= ?');
      bindings.push(parseInt(startTime));
    }
    
    if (endTime) {
      conditions.push('timestamp <= ?');
      bindings.push(parseInt(endTime));
    }
    
    if (search) {
      conditions.push('(message LIKE ? OR component LIKE ? OR category LIKE ?)');
      const searchTerm = `%${search}%`;
      bindings.push(searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count total records
    const countSql = `SELECT COUNT(*) as total FROM logs ${whereClause}`;
    const countResult = await d1Client.db.prepare(countSql).bind(...bindings).first();
    const total = countResult?.total || 0;
    
    // Get logs with pagination
    const sql = `
      SELECT * FROM logs 
      ${whereClause} 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const result = await d1Client.db.prepare(sql)
      .bind(...bindings, parseInt(limit), offset)
      .all();
    
    const logs = result.results?.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      patterns: JSON.parse(row.patterns || '[]'),
      triage_actions: JSON.parse(row.triage_actions || '[]')
    })) || [];

    return new Response(
      JSON.stringify({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
          hasMore: offset + parseInt(limit) < total
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error querying logs:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to query logs',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get log analytics and aggregations
 * GET /api/logs/analytics
 */
export async function handleLogAnalytics(request, d1Client) {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    
    const {
      timeRange = '24h',
      groupBy = 'severity',
      environment,
      component
    } = params;
    
    // Calculate time range
    const now = Date.now();
    const timeRanges = {
      '1h': now - (60 * 60 * 1000),
      '24h': now - (24 * 60 * 60 * 1000),
      '7d': now - (7 * 24 * 60 * 60 * 1000),
      '30d': now - (30 * 24 * 60 * 60 * 1000)
    };
    
    const startTime = timeRanges[timeRange] || timeRanges['24h'];
    
    // Build conditions
    const conditions = ['timestamp >= ?'];
    const bindings = [startTime];
    
    if (environment) {
      conditions.push('environment = ?');
      bindings.push(environment);
    }
    
    if (component) {
      conditions.push('component = ?');
      bindings.push(component);
    }
    
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // Get aggregated data
    const sql = `
      SELECT 
        ${groupBy},
        COUNT(*) as count,
        AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_duration,
        MAX(timestamp) as latest_timestamp
      FROM logs 
      ${whereClause}
      GROUP BY ${groupBy}
      ORDER BY count DESC
    `;
    
    const result = await d1Client.db.prepare(sql).bind(...bindings).all();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          analytics: result.results || [],
          timeRange,
          groupBy,
          filters: { environment, component }
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error getting log analytics:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to get analytics',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
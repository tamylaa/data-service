// Webhook handler for content-skimmer callbacks
// File: data-service/src/worker/handlers/webhook.js

import { FileModel } from '../../shared/db/models/file.js';

/**
 * Handle webhook from content-skimmer when processing completes
 * 
 * Expected payload:
 * {
 *   fileId: string,
 *   jobId: string,
 *   status: 'completed' | 'failed',
 *   result?: { summary, contentType, extractedText, metadata },
 *   error?: string,
 *   timestamp: string
 * }
 */
export async function handleSkimmerWebhook(request, d1Client) {
  try {
    const body = await request.json();
    console.log('[Webhook] Received skimmer callback:', JSON.stringify(body, null, 2));
    
    // Validate webhook payload
    const { fileId, jobId, status, result, error, metadata } = body;
    
    if (!fileId || !jobId || !status) {
      console.error('[Webhook] Missing required fields:', { fileId, jobId, status });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: fileId, jobId, status' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate status
    if (!['completed', 'failed', 'processing'].includes(status)) {
      console.error('[Webhook] Invalid status:', status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid status. Must be: completed, failed, or processing' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if file exists
    const fileModel = new FileModel(d1Client.db);
    const existingFile = await fileModel.getById(fileId);
    
    if (!existingFile) {
      console.error('[Webhook] File not found:', fileId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `File not found: ${fileId}` 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare updates
    const updates = {
      processing_status: status,
      last_callback_at: new Date().toISOString(),
      callback_attempts: (existingFile.callback_attempts || 0) + 1
    };
    
    // Set completion timestamp for final statuses
    if (status === 'completed' || status === 'failed') {
      updates.processing_completed_at = new Date().toISOString();
    }
    
    // Add result data if successful
    if (status === 'completed' && result) {
      updates.analysis_result = JSON.stringify(result);
      updates.analysis_summary = result.summary || null;
      updates.content_type_detected = result.contentType || null;
      updates.extraction_status = 'success';
      
      console.log(`[Webhook] Processing completed for file ${fileId}:`, {
        summary: result.summary,
        contentType: result.contentType
      });
    }
    
    // Add error data if failed
    if (status === 'failed') {
      const errorData = { error: error || 'Processing failed' };
      updates.analysis_result = JSON.stringify(errorData);
      updates.extraction_status = 'failed';
      
      console.log(`[Webhook] Processing failed for file ${fileId}:`, error);
    }
    
    // Update skimmer job ID if provided
    if (jobId && jobId !== existingFile.skimmer_job_id) {
      updates.skimmer_job_id = jobId;
    }
    
    // Update the file record
    const updatedFile = await fileModel.update(fileId, updates);
    
    console.log(`[Webhook] Successfully updated file ${fileId} with status: ${status}`);
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        fileId,
        status,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Webhook] Error processing skimmer callback:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Validate webhook authentication using secret header
 * Optional security measure for webhook endpoints
 */
export function validateWebhookAuth(request, env) {
  const authHeader = request.headers.get('X-Webhook-Secret');
  const expectedSecret = env.WEBHOOK_SECRET || 'default-webhook-secret';
  
  if (!authHeader) {
    console.warn('[Webhook] Missing X-Webhook-Secret header');
    return false;
  }
  
  if (authHeader !== expectedSecret) {
    console.warn('[Webhook] Invalid webhook secret');
    return false;
  }
  
  return true;
}

/**
 * Handle health check for webhook endpoints
 */
export async function handleWebhookHealth(request) {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Webhook endpoint is healthy',
      endpoints: [
        'POST /webhook/skimmer-complete'
      ],
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * List recent webhook activity (for debugging)
 */
export async function getWebhookActivity(request, d1Client) {
  try {
    const fileModel = new FileModel(d1Client.db);
    
    // Get files with recent callback activity
    const rows = await d1Client.db.prepare(`
      SELECT id, original_filename, processing_status, last_callback_at, 
             callback_attempts, skimmer_job_id, extraction_status
      FROM files 
      WHERE last_callback_at IS NOT NULL 
      ORDER BY last_callback_at DESC 
      LIMIT 50
    `).all();
    
    return new Response(
      JSON.stringify({
        success: true,
        activity: rows.results,
        count: rows.results.length,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Webhook] Error getting webhook activity:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve webhook activity',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

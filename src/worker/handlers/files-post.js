// handlers/files-post.js
// POST /files endpoint handler with validation and robust error handling
import { createFileMetadata } from './files.js';
import { validateFilePayload } from '../utils/validateFilePayload.js';
import { errorResponse, successResponse } from '../utils/response.js';

export async function handleFilesPost(request, d1Client) {
  try {
    const data = await request.json();
    console.log('[POST /files] Incoming payload:', JSON.stringify(data, null, 2));
    const validation = validateFilePayload(data);
    if (!validation.valid) {
      console.error('[POST /files] Validation error:', validation.errors);
      return errorResponse('Invalid file metadata', 400, { errors: validation.errors });
    }
    try {
      const file = await createFileMetadata(data, d1Client);
      console.log('[POST /files] Created file:', JSON.stringify(file, null, 2));
      return successResponse(file, 201);
    } catch (dbErr) {
      console.error('[POST /files] DB error:', dbErr && dbErr.message ? dbErr.message : dbErr);
      if (dbErr && dbErr.stack) console.error('[POST /files] DB Stack:', dbErr.stack);
      return errorResponse('Database error creating file metadata', 500, {
        message: dbErr && dbErr.message ? dbErr.message : String(dbErr),
        stack: dbErr && dbErr.stack ? dbErr.stack : undefined,
        payload: data
      });
    }
  } catch (err) {
    console.error('[POST /files] Error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error('[POST /files] Stack:', err.stack);
    return errorResponse('Failed to process file metadata request', 500, {
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined
    });
  }
}

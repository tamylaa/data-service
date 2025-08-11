import { fromRow } from '../../shared/db/models/file.js';
import { FileModel } from '../../shared/db/models/file.js';

/**
 * List all files (with optional filters, pagination)
 */
export async function listFiles(request, d1Client) {
  // Use FileModel for listing files (simple version, add filters/pagination as needed)
  const fileModel = new FileModel(d1Client.db); // Pass raw DB, not wrapper
  // For now, just return all files
  const rows = await d1Client.db.prepare('SELECT * FROM files ORDER BY created_at DESC LIMIT 100').all();
  return { files: rows.results.map(fromRow) };

}

/**
 * Get a file by ID
 */
export async function getFileById(id, d1Client) {
  const fileModel = new FileModel(d1Client.db); // Pass raw DB, not wrapper
  return fileModel.getById(id);
}

/**
 * Create a new file metadata record
 */
export async function createFileMetadata(fileData, d1Client) {
  const fileModel = new FileModel(d1Client.db); // Pass raw DB, not wrapper
  return fileModel.create(fileData);
}

/**
 * Update file metadata (partial update)
 */
export async function updateFileMetadata(id, updates, d1Client) {
  const fileModel = new FileModel(d1Client.db); // Pass raw DB, not wrapper
  return fileModel.update(id, updates);
}

/**
 * Delete a file metadata record
 */
export async function deleteFileMetadata(id, d1Client) {
  const fileModel = new FileModel(d1Client.db); // Pass raw DB, not wrapper
  return fileModel.delete(id);
}

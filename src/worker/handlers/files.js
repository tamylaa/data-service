import { fromRow } from '../../shared/db/models/file.js';

/**
 * List all files (with optional filters, pagination)
 */
export async function listFiles(request, db) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
  const offset = (page - 1) * pageSize;
  const ownerId = url.searchParams.get('owner_id');
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');

  let where = [];
  let params = [];
  if (ownerId) {
    where.push('owner_id = ?');
    params.push(ownerId);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(original_filename LIKE ? OR mime_type LIKE ? OR category LIKE ? OR checksum LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT * FROM files ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const rows = await db.prepare(sql).bind(...params, pageSize, offset).all();
  // Get total count for pagination
  const countSql = `SELECT COUNT(*) as count FROM files ${whereClause}`;
  const countResult = await db.prepare(countSql).bind(...params).first();
  return {
    page,
    pageSize,
    total: countResult.count,
    files: rows.results.map(fromRow)
  };

}

/**
 * Get a file by ID
 */
export async function getFileById(id, db) {
  const row = await db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
  return fromRow(row);
}

/**
 * Create a new file metadata record
 */
export async function createFileMetadata(fileData, db) {
  const fields = [
    'id', 'original_filename', 'file_size', 'mime_type', 'created_at',
    'owner_id', 'storage_path', 'is_public', 'category', 'checksum',
    'last_accessed_at', 'download_count'
  ];
  const values = fields.map(f => fileData[f] ?? null);
  const placeholders = fields.map(() => '?').join(', ');
  await db.prepare(
    `INSERT INTO files (${fields.join(', ')}) VALUES (${placeholders})`
  ).bind(...values).run();
  return getFileById(fileData.id, db);
}

/**
 * Update file metadata (partial update)
 */
export async function updateFileMetadata(id, updates, db) {
  const fields = Object.keys(updates);
  if (!fields.length) return getFileById(id, db);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f]);
  values.push(id);
  await db.prepare(`UPDATE files SET ${setClause} WHERE id = ?`).bind(...values).run();
  return getFileById(id, db);
}

/**
 * Delete a file metadata record
 */
export async function deleteFileMetadata(id, db) {
  await db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
  return { id };
}

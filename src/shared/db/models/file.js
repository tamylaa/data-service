// ...existing code...
import { BaseD1Client } from './base-d1-client';

export class FileModel extends BaseD1Client {
  constructor(db) {
    super(db, 'files');
  }

  // Normalize file metadata (e.g., trim filename, lowercase mime_type)
  normalize(fileData) {
    if (fileData.original_filename) fileData.original_filename = fileData.original_filename.trim();
    if (fileData.mime_type) fileData.mime_type = fileData.mime_type.toLowerCase();
    return fileData;
  }

  // Sanitize file object for API response (remove internal fields if needed)
  sanitize(file) {
    // For now, just return all fields; customize if you want to hide internal info
    return { ...file };
  }

  async create(fileData) {
    // Normalize input
    fileData = this.normalize(fileData);
    // Check for duplicate id
    const existingById = await this.getById(fileData.id);
    if (existingById) {
      throw new Error('File with this id already exists');
    }
    // Check for duplicate storage_path
    const existingByPath = await this.findByStoragePath(fileData.storage_path);
    if (existingByPath) {
      throw new Error('File with this storage_path already exists');
    }
    // Ensure required and optional fields
    const fields = [
      'id', 'original_filename', 'file_size', 'mime_type', 'created_at',
      'owner_id', 'storage_path', 'is_public', 'category', 'checksum',
      'last_accessed_at', 'download_count'
    ];
    if (fileData.last_accessed_at === undefined) fileData.last_accessed_at = null;
    if (fileData.download_count === undefined) fileData.download_count = 0;
    const values = fields.map(f => fileData[f] ?? null);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO files (${fields.join(', ')}) VALUES (${placeholders})`;
    try {
      const result = await this.db.prepare(sql).bind(...values).run();
      if (!result.success) {
        throw new Error('Failed to insert file metadata');
      }
      const file = await this.getById(fileData.id);
      return this.sanitize(file);
    } catch (err) {
      console.error('[FileModel] Insert error:', err.message, 'Values:', values);
      throw err;
    }
  }

  async getById(id) {
    const row = await this.db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first();
    return row ? this.sanitize(fromRow(row)) : null;
  }

  async findByStoragePath(storagePath) {
    const row = await this.db.prepare('SELECT * FROM files WHERE storage_path = ?').bind(storagePath).first();
    return row ? this.sanitize(fromRow(row)) : null;
  }

  async findByOwnerId(ownerId) {
    const rows = await this.db.prepare('SELECT * FROM files WHERE owner_id = ?').bind(ownerId).all();
    return rows.results.map(r => this.sanitize(fromRow(r)));
  }

  async update(id, updates) {
    // Normalize updates
    updates = this.normalize(updates);
    // Prevent changing to duplicate storage_path
    if (updates.storage_path) {
      const existing = await this.findByStoragePath(updates.storage_path);
      if (existing && existing.id !== id) {
        throw new Error('Another file with this storage_path already exists');
      }
    }
    const fields = Object.keys(updates);
    if (!fields.length) return this.getById(id);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    values.push(id);
    const sql = `UPDATE files SET ${setClause} WHERE id = ?`;
    await this.db.prepare(sql).bind(...values).run();
    return this.getById(id);
  }

  async delete(id) {
    await this.db.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
    return { id };
  }
}
// File Metadata Model
// Represents a file and its metadata in the database.
export class File {
  constructor({
    id,
    original_filename,
    file_size,
    mime_type,
    created_at,
    owner_id,
    storage_path,
    is_public = false,
    category = null,
    checksum = null,
    last_accessed_at = null,
    download_count = 0
  }) {
    this.id = id;
    this.original_filename = original_filename;
    this.file_size = file_size;
    this.mime_type = mime_type;
    this.created_at = created_at;
    this.owner_id = owner_id;
    this.storage_path = storage_path;
    this.is_public = is_public;
    this.category = category;
    this.checksum = checksum;
    this.last_accessed_at = last_accessed_at;
    this.download_count = download_count;
  }
}

// Convert a DB row to a File instance
export function fromRow(row) {
  if (!row) return null;
  return new File({
    id: row.id,
    original_filename: row.original_filename,
    file_size: row.file_size,
    mime_type: row.mime_type,
    created_at: row.created_at,
    owner_id: row.owner_id,
    storage_path: row.storage_path,
    is_public: !!row.is_public,
    category: row.category,
    checksum: row.checksum,
    last_accessed_at: row.last_accessed_at,
    download_count: row.download_count
  });
}

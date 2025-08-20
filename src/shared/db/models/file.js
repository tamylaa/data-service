// ...existing code...
import { BaseD1Client } from '../../clients/d1/BaseD1Client.js';

export class FileModel extends BaseD1Client {
  constructor(db) {
    super(db);
    this.tableName = 'files';
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

  /**
   * Update processing status for a file
   */
  async updateProcessingStatus(id, status, metadata = {}) {
    const updates = {
      processing_status: status,
      ...metadata
    };
    
    if (status === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updates.processing_completed_at = new Date().toISOString();
    }
    
    return this.update(id, updates);
  }

  /**
   * Get files by processing status
   */
  async getByProcessingStatus(status) {
    const rows = await this.db.prepare(
      'SELECT * FROM files WHERE processing_status = ? ORDER BY created_at DESC'
    ).bind(status).all();
    return rows.results.map(r => this.sanitize(fromRow(r)));
  }

  /**
   * Get pending files that need processing
   */
  async getPendingFiles() {
    return this.getByProcessingStatus('pending');
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    const rows = await this.db.prepare(`
      SELECT processing_status, COUNT(*) as count 
      FROM files 
      WHERE processing_status IS NOT NULL 
      GROUP BY processing_status
    `).all();
    
    const stats = {};
    rows.results.forEach(row => {
      stats[row.processing_status] = row.count;
    });
    
    return stats;
  }

  /**
   * Mark file for skimmer processing
   */
  async markForSkimming(id, jobId) {
    return this.update(id, {
      processing_status: 'processing',
      skimmer_job_id: jobId,
      processing_started_at: new Date().toISOString()
    });
  }

  /**
   * Get files with analysis results
   */
  async getAnalyzedFiles(limit = 50) {
    const rows = await this.db.prepare(`
      SELECT * FROM files 
      WHERE processing_status = 'completed' AND analysis_result IS NOT NULL 
      ORDER BY processing_completed_at DESC 
      LIMIT ?
    `).bind(limit).all();
    
    return rows.results.map(r => {
      const file = this.sanitize(fromRow(r));
      // Parse analysis_result JSON if it exists
      if (file.analysis_result) {
        try {
          file.analysis_data = JSON.parse(file.analysis_result);
        } catch (e) {
          console.warn(`Failed to parse analysis_result for file ${file.id}`);
        }
      }
      return file;
    });
  }

  /**
   * Get files that failed processing
   */
  async getFailedFiles(limit = 50) {
    const rows = await this.db.prepare(`
      SELECT * FROM files 
      WHERE processing_status = 'failed' 
      ORDER BY processing_completed_at DESC 
      LIMIT ?
    `).bind(limit).all();
    
    return rows.results.map(r => this.sanitize(fromRow(r)));
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
    download_count = 0,
    processing_status = 'pending',
    processing_started_at = null,
    processing_completed_at = null,
    analysis_result = null,
    analysis_summary = null,
    content_type_detected = null,
    extraction_status = null,
    skimmer_job_id = null,
    callback_attempts = 0,
    last_callback_at = null
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
    this.processing_status = processing_status;
    this.processing_started_at = processing_started_at;
    this.processing_completed_at = processing_completed_at;
    this.analysis_result = analysis_result;
    this.analysis_summary = analysis_summary;
    this.content_type_detected = content_type_detected;
    this.extraction_status = extraction_status;
    this.skimmer_job_id = skimmer_job_id;
    this.callback_attempts = callback_attempts;
    this.last_callback_at = last_callback_at;
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
    download_count: row.download_count,
    processing_status: row.processing_status || 'pending',
    processing_started_at: row.processing_started_at,
    processing_completed_at: row.processing_completed_at,
    analysis_result: row.analysis_result,
    analysis_summary: row.analysis_summary,
    content_type_detected: row.content_type_detected,
    extraction_status: row.extraction_status,
    skimmer_job_id: row.skimmer_job_id,
    callback_attempts: row.callback_attempts || 0,
    last_callback_at: row.last_callback_at
  });
}

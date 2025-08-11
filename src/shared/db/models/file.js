/**
 * File Metadata Model
 * Represents a file and its metadata in the database.
 */

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

/**
 * Convert a DB row to a File instance
 */
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

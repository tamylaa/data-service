// utils/validateFilePayload.js
// Validate file metadata payload for POST /files

const REQUIRED_FIELDS = [
  'id', 'original_filename', 'file_size', 'mime_type', 'created_at',
  'owner_id', 'storage_path', 'is_public', 'category', 'checksum'
];

export function validateFilePayload(data) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`Missing or empty required field: ${field}`);
    }
  }
  if (typeof data.file_size !== 'number' || data.file_size < 0) {
    errors.push('file_size must be a non-negative number');
  }
  if (!(typeof data.is_public === 'boolean' || data.is_public === 0 || data.is_public === 1)) {
    errors.push('is_public must be a boolean or 0/1 integer');
  }
  // Add more type checks as needed
  return {
    valid: errors.length === 0,
    errors
  };
}

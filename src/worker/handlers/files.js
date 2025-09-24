import { fromRow } from '../../shared/db/models/file.js';
import { FileModel } from '../../shared/db/models/file.js';

/**
 * List files for a specific user with enhanced pagination and filtering
 * This is the optimized endpoint called by content-store-service
 */
export async function listFiles(request, d1Client) {
  const url = new URL(request.url);
  const authUser = request.authUser;
  
  // Parse query parameters
  const options = {
    page: parseInt(url.searchParams.get('page')) || 1,
    limit: Math.min(parseInt(url.searchParams.get('limit')) || 20, 100), // Max 100 items
    period: url.searchParams.get('period') || 'all',
    category: url.searchParams.get('category') || 'all',
    search: url.searchParams.get('search') || '',
    sort: url.searchParams.get('sort') || 'recent',
    userId: url.searchParams.get('userId') || authUser?.id
  };

  console.log('Enhanced listFiles request:', { options, authUser: authUser?.id });

  try {
    const fileModel = new FileModel(d1Client.db);
    
    // Build the query with user filtering and pagination
    let query = 'SELECT * FROM files WHERE owner_id = ?';
    let params = [options.userId];
    
    // Add period filtering
    if (options.period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (options.period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }
    }
    
    // Add category filtering
    if (options.category !== 'all') {
      query += ' AND category = ?';
      params.push(options.category);
    }
    
    // Add search filtering
    if (options.search) {
      query += ' AND (original_filename LIKE ? OR category LIKE ?)';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }
    
    // Add sorting
    switch (options.sort) {
      case 'name':
        query += ' ORDER BY original_filename ASC';
        break;
      case 'size':
        query += ' ORDER BY file_size DESC';
        break;
      case 'oldest':
        query += ' ORDER BY created_at ASC';
        break;
      case 'recent':
      default:
        query += ' ORDER BY created_at DESC';
        break;
    }
    
    // Get total count for pagination (before adding LIMIT)
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await d1Client.db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    
    // Add pagination
    const offset = (options.page - 1) * options.limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(options.limit, offset);
    
    console.log('Executing query:', query, 'with params:', params);
    
    // Execute the main query
    const result = await d1Client.db.prepare(query).bind(...params).all();
    const files = result.results?.map(fromRow) || [];
    
    console.log(`Found ${files.length} files for user ${options.userId} (total: ${total})`);
    
    return {
      files,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        hasNext: offset + files.length < total,
        hasPrev: options.page > 1
      },
      options: options // Return applied options for debugging
    };
    
  } catch (error) {
    console.error('Enhanced listFiles error:', error);
    throw error;
  }
}

/**
 * Get file statistics for a user
 */
export async function getFileStats(request, d1Client) {
  const authUser = request.authUser;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || authUser?.id;
  
  console.log('Getting file stats for user:', userId);
  
  try {
    const queries = [
      // Total files count
      d1Client.db.prepare('SELECT COUNT(*) as total FROM files WHERE owner_id = ?').bind(userId),
      
      // Total file size
      d1Client.db.prepare('SELECT SUM(file_size) as totalSize FROM files WHERE owner_id = ?').bind(userId),
      
      // Files by category
      d1Client.db.prepare(`
        SELECT category, COUNT(*) as count, SUM(file_size) as size 
        FROM files 
        WHERE owner_id = ? 
        GROUP BY category 
        ORDER BY count DESC
      `).bind(userId),
      
      // Recent activity (last 7 days)
      d1Client.db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM files 
        WHERE owner_id = ? AND created_at >= datetime('now', '-7 days')
        GROUP BY DATE(created_at) 
        ORDER BY date DESC
      `).bind(userId)
    ];
    
    const [totalResult, sizeResult, categoriesResult, activityResult] = await Promise.all([
      queries[0].first(),
      queries[1].first(),
      queries[2].all(),
      queries[3].all()
    ]);
    
    const stats = {
      totalFiles: totalResult?.total || 0,
      totalSize: sizeResult?.totalSize || 0,
      categories: categoriesResult.results || [],
      recentActivity: activityResult.results || [],
      userId
    };
    
    console.log('File stats for user', userId, ':', stats);
    return stats;
    
  } catch (error) {
    console.error('getFileStats error:', error);
    throw error;
  }
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

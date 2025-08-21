import { BaseD1Client } from '../../clients/d1/BaseD1Client.js';

export class QueryEventModel extends BaseD1Client {
  constructor(db) {
    super(db);
    this.tableName = 'query_events';
  }

  async create(event) {
    // event: {id, user_id, session_id, query_text, search_engine, timestamp, result_count, response_time, results_clicked, follow_up_queries, task_completed}
    const fields = [
      'id', 'user_id', 'session_id', 'query_text', 'search_engine', 'timestamp',
      'result_count', 'response_time', 'results_clicked', 'follow_up_queries', 'task_completed'
    ];
    const values = fields.map(f => event[f]);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO query_events (${fields.join(', ')}) VALUES (${placeholders})`;
    return this.run(sql, values);
  }

  async findByUser(user_id, limit = 20) {
    const sql = `SELECT * FROM query_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`;
    return this.all(sql, [user_id, limit]);
  }

  // Add more methods as needed (update, delete, etc.)
}

export class QuerySessionModel extends BaseD1Client {
  constructor(db) {
    super(db);
    this.tableName = 'query_sessions';
  }

  async create(session) {
    const fields = [
      'id', 'user_id', 'start_time', 'end_time', 'status', 'task_context'
    ];
    const values = fields.map(f => session[f]);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO query_sessions (${fields.join(', ')}) VALUES (${placeholders})`;
    return this.run(sql, values);
  }

  async findByUser(user_id, limit = 10) {
    const sql = `SELECT * FROM query_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?`;
    return this.all(sql, [user_id, limit]);
  }
}

export class QueryPatternModel extends BaseD1Client {
  constructor(db) {
    super(db);
    this.tableName = 'query_patterns';
  }

  async create(pattern) {
    const fields = [
      'id', 'user_id', 'pattern_text', 'frequency', 'success_rate', 'avg_response_time', 'last_updated'
    ];
    const values = fields.map(f => pattern[f]);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO query_patterns (${fields.join(', ')}) VALUES (${placeholders})`;
    return this.run(sql, values);
  }

  async findByUser(user_id, limit = 10) {
    const sql = `SELECT * FROM query_patterns WHERE user_id = ? ORDER BY frequency DESC LIMIT ?`;
    return this.all(sql, [user_id, limit]);
  }
}

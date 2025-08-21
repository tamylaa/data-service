// QueryLearningService: Facade for query learning models
import { QueryEventModel, QuerySessionModel, QueryPatternModel } from '../shared/db/models/queryLearning.js';

export class QueryLearningService {
  constructor(db) {
    this.queryEvents = new QueryEventModel(db);
    this.querySessions = new QuerySessionModel(db);
    this.queryPatterns = new QueryPatternModel(db);
  }
}

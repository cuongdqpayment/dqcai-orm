// ./src/query/query-builder.ts

import { IAdapter } from '../interfaces/adapter.interface';
import { JoinClause, QueryFilter, QueryOptions,SortDirection } from '../types/orm.types';
import { QueryHelper } from '../utils/query-helper';

/**
 * Query Builder for constructing complex queries
 */
export class QueryBuilder<T = any> {
  private tableName = '';
  private selectFields: string[] = ['*'];
  private whereConditions: QueryFilter = {};
  private joinClauses: JoinClause[] = [];
  private orderByFields: Record<string, SortDirection> = {};
  private groupByFields: string[] = [];
  private havingConditions: QueryFilter = {};
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private distinctFlag: boolean = false;
  private adapter?: IAdapter;

  constructor(adapter?: IAdapter) {
    this.adapter = adapter;
  }

  /**
   * Create a new query builder for a table
   */
  static table<T = any>(name: string, adapter?: IAdapter): QueryBuilder<T> {
    const builder = new QueryBuilder<T>(adapter);
    builder.tableName = name;
    return builder;
  }

  /**
   * Set the adapter
   */
  setAdapter(adapter: IAdapter): this {
    this.adapter = adapter;
    return this;
  }

  /**
   * Select specific fields
   */
  select(...fields: (keyof T | string)[]): this {
    this.selectFields = fields.map(f => String(f));
    return this;
  }

  /**
   * Select distinct records
   */
  distinct(): this {
    this.distinctFlag = true;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(field: keyof T | string, operator: string, value: any): this;
  where(filter: QueryFilter<T>): this;
  where(fieldOrFilter: any, operator?: string, value?: any): this {
    if (typeof fieldOrFilter === 'object') {
      this.whereConditions = { ...this.whereConditions, ...fieldOrFilter };
    } else if (operator && value !== undefined) {
      const opMap: Record<string, string> = {
        '=': '$eq',
        '!=': '$ne',
        '>': '$gt',
        '>=': '$gte',
        '<': '$lt',
        '<=': '$lte',
        'in': '$in',
        'like': '$like'
      };
      
      const mongoOp = opMap[operator.toLowerCase()] || '$eq';
      this.whereConditions[fieldOrFilter] = { [mongoOp]: value };
    }
    return this;
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(field: keyof T | string, values: any[]): this {
    this.whereConditions[field as string] = { $in: values };
    return this;
  }

  /**
   * Add WHERE NOT IN condition
   */
  whereNotIn(field: keyof T | string, values: any[]): this {
    this.whereConditions[field as string] = { $nin: values };
    return this;
  }

  /**
   * Add WHERE LIKE condition
   */
  whereLike(field: keyof T | string, pattern: string): this {
    this.whereConditions[field as string] = { $like: pattern };
    return this;
  }

  /**
   * Add WHERE BETWEEN condition
   */
  whereBetween(field: keyof T | string, min: any, max: any): this {
    this.whereConditions[field as string] = { $between: [min, max] };
    return this;
  }

  /**
   * Add WHERE NULL condition
   */
  whereNull(field: keyof T | string): this {
    this.whereConditions[field as string] = { $exists: false };
    return this;
  }

  /**
   * Add WHERE NOT NULL condition
   */
  whereNotNull(field: keyof T | string): this {
    this.whereConditions[field as string] = { $exists: true };
    return this;
  }

  /**
   * Add OR WHERE condition
   */
  orWhere(filters: QueryFilter<T>[]): this {
    if (!this.whereConditions.$or) {
      this.whereConditions.$or = [];
    }
    (this.whereConditions.$or as any[]).push(...filters);
    return this;
  }

  /**
   * Add AND WHERE condition
   */
  andWhere(filters: QueryFilter<T>[]): this {
    if (!this.whereConditions.$and) {
      this.whereConditions.$and = [];
    }
    (this.whereConditions.$and as any[]).push(...filters);
    return this;
  }

  /**
   * Add JOIN clause
   */
  join(table: string, condition: string, type: JoinClause['type'] = 'INNER'): this {
    this.joinClauses.push({ type, table, on: condition });
    return this;
  }

  /**
   * Add LEFT JOIN
   */
  leftJoin(table: string, condition: string): this {
    return this.join(table, condition, 'LEFT');
  }

  /**
   * Add RIGHT JOIN
   */
  rightJoin(table: string, condition: string): this {
    return this.join(table, condition, 'RIGHT');
  }

  /**
   * Add INNER JOIN
   */
  innerJoin(table: string, condition: string): this {
    return this.join(table, condition, 'INNER');
  }

  /**
   * Add ORDER BY
   */
  orderBy(field: keyof T | string, direction: SortDirection = 'ASC'): this {
    this.orderByFields[String(field)] = direction;
    return this;
  }

  /**
   * Add GROUP BY
   */
  groupBy(...fields: (keyof T | string)[]): this {
    this.groupByFields.push(...fields.map(f => String(f)));
    return this;
  }

  /**
   * Add HAVING condition
   */
  having(filter: QueryFilter): this {
    this.havingConditions = { ...this.havingConditions, ...filter };
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set OFFSET
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Set SKIP (alias for offset)
   */
  skip(count: number): this {
    return this.offset(count);
  }

  /**
   * Pagination helper
   */
  paginate(page: number, perPage: number): this {
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
    return this;
  }

  /**
   * Build query options
   */
  buildOptions(): QueryOptions {
    return {
      select: this.selectFields.includes('*') ? undefined : this.selectFields,
      sort: Object.keys(this.orderByFields).length > 0 ? this.orderByFields : undefined,
      limit: this.limitValue || undefined,
      offset: this.offsetValue || undefined,
      joins: this.joinClauses.length > 0 ? this.joinClauses : undefined,
      groupBy: this.groupByFields.length > 0 ? this.groupByFields : undefined,
      having: Object.keys(this.havingConditions).length > 0 ? this.havingConditions : undefined,
      distinct: this.distinctFlag
    };
  }

  /**
   * Convert to SQL query (for SQL databases)
   */
  toSQL(): { sql: string; params: any[] } {
    if (!this.adapter || this.adapter.type === 'mongodb') {
      throw new Error('toSQL() requires a SQL adapter');
    }

    const dbType = this.adapter.type;
    const selectPrefix = this.distinctFlag ? 'SELECT DISTINCT' : 'SELECT';
    const selectFields = QueryHelper.buildSelectFields(this.selectFields, dbType);
    
    let sql = `${selectPrefix} ${selectFields} FROM ${QueryHelper.quoteIdentifier(this.tableName, dbType)}`;

    // JOINs
    if (this.joinClauses.length > 0) {
      for (const join of this.joinClauses) {
        sql += ` ${join.type} JOIN ${QueryHelper.quoteIdentifier(join.table, dbType)} ON ${join.on}`;
      }
    }

    // WHERE
    const { clause, params } = QueryHelper.buildWhereClause(this.whereConditions, dbType);
    if (clause !== '1=1') {
      sql += ` WHERE ${clause}`;
    }

    // GROUP BY
    if (this.groupByFields.length > 0) {
      const groupBy = this.groupByFields
        .map(f => QueryHelper.quoteIdentifier(f, dbType))
        .join(', ');
      sql += ` GROUP BY ${groupBy}`;
    }

    // HAVING
    if (Object.keys(this.havingConditions).length > 0) {
      const { clause: havingClause, params: havingParams } = QueryHelper.buildWhereClause(
        this.havingConditions,
        dbType,
        params.length + 1
      );
      sql += ` HAVING ${havingClause}`;
      params.push(...havingParams);
    }

    // ORDER BY
    if (Object.keys(this.orderByFields).length > 0) {
      const orderBy = QueryHelper.buildOrderBy(this.orderByFields, dbType);
      sql += ` ORDER BY ${orderBy}`;
    }

    // LIMIT
    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`;
    }

    // OFFSET
    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  /**
   * Convert to MongoDB aggregation pipeline
   */
  toPipeline(): any[] {
    if (!this.adapter || this.adapter.type !== 'mongodb') {
      throw new Error('toPipeline() requires MongoDB adapter');
    }

    const pipeline: any[] = [];

    // $match (WHERE)
    if (Object.keys(this.whereConditions).length > 0) {
      pipeline.push({ $match: this.whereConditions });
    }

    // $lookup (JOIN) - MongoDB style
    for (const join of this.joinClauses) {
      pipeline.push({
        $lookup: {
          from: join.table,
          localField: '_id',
          foreignField: 'parentId',
          as: join.alias || join.table
        }
      });
    }

    // $group (GROUP BY)
    if (this.groupByFields.length > 0) {
      const groupId: any = {};
      for (const field of this.groupByFields) {
        groupId[field] = `$${field}`;
      }
      pipeline.push({ $group: { _id: groupId } });
    }

    // $match (HAVING)
    if (Object.keys(this.havingConditions).length > 0) {
      pipeline.push({ $match: this.havingConditions });
    }

    // $sort (ORDER BY)
    if (Object.keys(this.orderByFields).length > 0) {
      const sort: any = {};
      for (const [field, direction] of Object.entries(this.orderByFields)) {
        sort[field] = direction === 'ASC' || direction === 1 ? 1 : -1;
      }
      pipeline.push({ $sort: sort });
    }

    // $limit
    if (this.limitValue !== null) {
      pipeline.push({ $limit: this.limitValue });
    }

    // $skip (OFFSET)
    if (this.offsetValue !== null) {
      pipeline.push({ $skip: this.offsetValue });
    }

    // $project (SELECT)
    if (!this.selectFields.includes('*')) {
      const project: any = {};
      for (const field of this.selectFields) {
        project[field] = 1;
      }
      pipeline.push({ $project: project });
    }

    return pipeline;
  }

  /**
   * Execute the query
   */
  async execute(): Promise<T[]> {
    if (!this.adapter) {
      throw new Error('Adapter is required to execute query');
    }

    return this.adapter.find(this.tableName, this.whereConditions, this.buildOptions()) as Promise<T[]>;
  }

  /**
   * Execute and get first result
   */
  async first(): Promise<T | null> {
    if (!this.adapter) {
      throw new Error('Adapter is required to execute query');
    }

    this.limitValue = 1;
    return this.adapter.findOne(this.tableName, this.whereConditions, this.buildOptions()) as Promise<T | null>;
  }

  /**
   * Count records
   */
  async count(): Promise<number> {
    if (!this.adapter) {
      throw new Error('Adapter is required to execute query');
    }

    return this.adapter.count(this.tableName, this.whereConditions);
  }

  /**
   * Check if records exist
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Clone the query builder
   */
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>(this.adapter);
    cloned.tableName = this.tableName;
    cloned.selectFields = [...this.selectFields];
    cloned.whereConditions = { ...this.whereConditions };
    cloned.joinClauses = [...this.joinClauses];
    cloned.orderByFields = { ...this.orderByFields };
    cloned.groupByFields = [...this.groupByFields];
    cloned.havingConditions = { ...this.havingConditions };
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.distinctFlag = this.distinctFlag;
    return cloned;
  }
}


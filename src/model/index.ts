// ========================
// src/model/index.ts
// ========================

import { IAdapter } from "../interfaces/adapter.interface";
import { QueryBuilder } from "../query/query-builder";
import {
  SchemaDefinition,
  QueryFilter,
  QueryOptions,
  Transaction,
  SortDirection,
} from "../types/orm.types";

/**
 * Model class for database operations
 */
export class Model<T = any> {
  constructor(
    private tableName: string,
    private schema: SchemaDefinition,
    private adapter: IAdapter
  ) {}

  /**
   * Get table/collection name
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get schema definition
   */
  getSchema(): SchemaDefinition {
    return this.schema;
  }

  /**
   * Get adapter
   */
  getAdapter(): IAdapter {
    return this.adapter;
  }

  /**
   * Create table/collection
   */
  async createTable(): Promise<void> {
    return this.adapter.createTable(this.tableName, this.schema);
  }

  /**
   * Drop table/collection
   */
  async dropTable(): Promise<void> {
    return this.adapter.dropTable(this.tableName);
  }

  /**
   * Truncate table/collection
   */
  async truncate(): Promise<void> {
    return this.adapter.truncateTable(this.tableName);
  }

  /**
   * Check if table exists
   */
  async exists(): Promise<boolean> {
    return this.adapter.tableExists(this.tableName);
  }

  /**
   * Create a new query builder
   */
  query(): QueryBuilder<T> {
    return QueryBuilder.table<T>(this.tableName, this.adapter);
  }

  /**
   * Create one record
   */
  async create(data: Partial<T>): Promise<T> {
    return this.adapter.insertOne(this.tableName, data) as Promise<T>;
  }

  /**
   * Create many records
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    return this.adapter.insertMany(this.tableName, data) as Promise<T[]>;
  }

  /**
   * Find records
   */
  async find(
    filter: QueryFilter<T> = {},
    options?: QueryOptions
  ): Promise<T[]> {
    return this.adapter.find(this.tableName, filter, options) as Promise<T[]>;
  }

  /**
   * Find one record
   */
  async findOne(
    filter: QueryFilter<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return this.adapter.findOne(
      this.tableName,
      filter,
      options
    ) as Promise<T | null>;
  }

  /**
   * Find by ID
   */
  async findById(id: any): Promise<T | null> {
    return this.adapter.findById(this.tableName, id) as Promise<T | null>;
  }

  /**
   * Update records
   */
  async update(filter: QueryFilter<T>, data: Partial<T>): Promise<number> {
    return this.adapter.update(this.tableName, filter, data);
  }

  /**
   * Update one record
   */
  async updateOne(filter: QueryFilter<T>, data: Partial<T>): Promise<boolean> {
    return this.adapter.updateOne(this.tableName, filter, data);
  }

  /**
   * Update by ID
   */
  async updateById(id: any, data: Partial<T>): Promise<boolean> {
    return this.adapter.updateById(this.tableName, id, data);
  }

  /**
   * Upsert (update or insert)
   */
  async upsert(filter: QueryFilter<T>, data: Partial<T>): Promise<T> {
    return this.adapter.upsert(this.tableName, filter, data) as Promise<T>;
  }

  /**
   * Delete records
   */
  async delete(filter: QueryFilter<T>): Promise<number> {
    return this.adapter.delete(this.tableName, filter);
  }

  /**
   * Delete one record
   */
  async deleteOne(filter: QueryFilter<T>): Promise<boolean> {
    return this.adapter.deleteOne(this.tableName, filter);
  }

  /**
   * Delete by ID
   */
  async deleteById(id: any): Promise<boolean> {
    return this.adapter.deleteById(this.tableName, id);
  }

  /**
   * Count records
   */
  async count(filter?: QueryFilter<T>): Promise<number> {
    return this.adapter.count(this.tableName, filter);
  }

  /**
   * Check if records exist
   */
  async recordExists(filter: QueryFilter<T>): Promise<boolean> {
    return this.adapter.exists(this.tableName, filter);
  }

  /**
   * Get distinct values
   */
  async distinct(
    field: keyof T | string,
    filter?: QueryFilter<T>
  ): Promise<any[]> {
    return this.adapter.distinct(this.tableName, String(field), filter);
  }

  /**
   * Aggregate (MongoDB only)
   */
  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.adapter.aggregate(this.tableName, pipeline);
  }

  /**
   * Bulk write operations
   */
  async bulkWrite(operations: any[]): Promise<any> {
    return this.adapter.bulkWrite(this.tableName, operations);
  }

  /**
   * Execute raw query
   */
  async raw(query: string | any, params?: any[]): Promise<any> {
    return this.adapter.raw(query, params);
  }

  /**
   * Begin transaction
   */
  async transaction(): Promise<Transaction> {
    return this.adapter.beginTransaction();
  }

  /**
   * Find with pagination
   */
  async paginate(
    filter: QueryFilter<T>,
    page: number = 1,
    perPage: number = 10,
    options?: QueryOptions
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  }> {
    const total = await this.count(filter);
    const offset = (page - 1) * perPage;

    const data = await this.find(filter, {
      ...options,
      limit: perPage,
      offset,
    });

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  /**
   * Find all records
   */
  async all(options?: QueryOptions): Promise<T[]> {
    return this.find({}, options);
  }

  /**
   * Find first record
   */
  async first(
    filter?: QueryFilter<T>,
    options?: QueryOptions
  ): Promise<T | null> {
    return this.findOne(filter || {}, { ...options, limit: 1 });
  }

  /**
   * Find last record (requires sort)
   */
  async last(
    sortField: keyof T = "id" as keyof T,
    filter?: QueryFilter<T>
  ): Promise<T | null> {
    return this.findOne(filter || {}, {
      sort: { [sortField]: -1 } as { [key: string]: SortDirection },
      limit: 1,
    });
  }

  /**
   * Pluck specific field values
   */
  async pluck(
    field: keyof T | string,
    filter?: QueryFilter<T>
  ): Promise<any[]> {
    const records = await this.find(filter || {}, {
      select: [String(field)],
    });
    return records.map((r: any) => r[field as string]);
  }

  /**
   * Find or create
   */
  async findOrCreate(filter: QueryFilter<T>, data: Partial<T>): Promise<T> {
    const existing = await this.findOne(filter);
    if (existing) {
      return existing;
    }
    return this.create({ ...(filter as any), ...data });
  }

  /**
   * Update or create
   */
  async updateOrCreate(filter: QueryFilter<T>, data: Partial<T>): Promise<T> {
    return this.upsert(filter, data);
  }

  /**
   * Soft delete (if schema has deletedAt field)
   */
  async softDelete(filter: QueryFilter<T>): Promise<number> {
    return this.update(filter, { deletedAt: new Date() } as any);
  }

  /**
   * Restore soft deleted records
   */
  async restore(filter: QueryFilter<T>): Promise<number> {
    return this.update(filter, { deletedAt: null } as any);
  }

  /**
   * Find with relations (populate)
   */
  async findWithRelations(
    filter: QueryFilter<T>,
    relations: string[],
    options?: QueryOptions
  ): Promise<T[]> {
    return this.find(filter, {
      ...options,
      populate: relations,
    });
  }

  /**
   * Increment field value
   */
  async increment(
    filter: QueryFilter<T>,
    field: keyof T,
    amount: number = 1
  ): Promise<number> {
    // This would need special handling per adapter
    const records = await this.find(filter);
    let updated = 0;

    for (const record of records) {
      const currentValue = (record as any)[field] || 0;
      const success = await this.updateOne(
        { id: (record as any).id } as QueryFilter<T>,
        { [field]: currentValue + amount } as any
      );
      if (success) updated++;
    }

    return updated;
  }

  /**
   * Decrement field value
   */
  async decrement(
    filter: QueryFilter<T>,
    field: keyof T,
    amount: number = 1
  ): Promise<number> {
    return this.increment(filter, field, -amount);
  }
}

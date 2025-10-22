// ========================
// src/interfaces/adapter.interface.ts
// ========================

import {
  BulkOperation,
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  IConnection,
  IndexDefinition,
  IResult,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "../types/orm.types";

/**
 * Database Adapter Interface
 */
export interface IAdapter<TConnection extends IConnection = IConnection> {
  type: DatabaseType;
  databaseType: DatabaseType; // Alias for type

  // Connection Management
  connect(config: DbConfig): Promise<TConnection>;
  disconnect(): Promise<void>;
  disconnectAll(): Promise<void>;
  isConnected(): boolean;
  isSupported(): boolean;
  getConnection(): TConnection | null;

  // Schema Management
  createTable(tableName: string, schema: SchemaDefinition): Promise<void>;
  alterTable(tableName: string, changes: SchemaDefinition): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  truncateTable(tableName: string): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;
  getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null>;

  // Index Management
  createIndex(tableName: string, indexDef: IndexDefinition): Promise<void>;
  dropIndex(tableName: string, indexName: string): Promise<void>;

  // CRUD Operations
  insertOne(tableName: string, data: any): Promise<any>;
  insertMany(tableName: string, data: any[]): Promise<any[]>;

  find(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]>;
  findOne(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null>;
  findById(tableName: string, id: any): Promise<any | null>;

  update(tableName: string, filter: QueryFilter, data: any): Promise<number>;
  updateOne(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean>;
  updateById(tableName: string, id: any, data: any): Promise<boolean>;
  upsert(tableName: string, filter: QueryFilter, data: any): Promise<any>;

  delete(tableName: string, filter: QueryFilter): Promise<number>;
  deleteOne(tableName: string, filter: QueryFilter): Promise<boolean>;
  deleteById(tableName: string, id: any): Promise<boolean>;

  count(tableName: string, filter?: QueryFilter): Promise<number>;
  exists(tableName: string, filter: QueryFilter): Promise<boolean>;

  // Advanced Operations
  aggregate(tableName: string, pipeline: any[]): Promise<any[]>;
  distinct(
    tableName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]>;
  bulkWrite(tableName: string, operations: BulkOperation[]): Promise<IResult>;

  // Raw Query
  execute(
    connection: TConnection,
    query: string | any,
    params?: any[]
  ): Promise<IResult>;
  raw(query: string | any, params?: any[]): Promise<any>;

  // Transaction Management
  beginTransaction(): Promise<Transaction>;

  // Utility
  sanitize(value: any): any;
}

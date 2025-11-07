// ========================
// src/interfaces/adapter.interface.ts
// ========================

import {
  BulkOperation,
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  IResult,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "@/types/orm.types";

/**
 * Database Adapter Interface
 */
export interface IAdapter<TConnection extends IConnection = IConnection> {
  type: DatabaseType;
  databaseType: DatabaseType;

  // Connection Management
  connect(schemaKey?: string): Promise<TConnection>;
  disconnect(): Promise<void>;
  disconnectAll(): Promise<void>;
  isConnected(): boolean;
  isSupported(): boolean;
  getConnection(): TConnection | null;
  getDbConfig(): DbConfig | null;

  // Schema Management
  createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[]
  ): Promise<void>;
  alterTable(tableName: string, changes: SchemaDefinition): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  truncateTable(tableName: string): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;
  getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null>;

  // Index Management
  createIndex(tableName: string, indexDef: IndexDefinition): Promise<void>;
  dropIndex(tableName: string, indexName: string): Promise<void>;

  // Foreign Key Management
  createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void>;
  dropForeignKey(tableName: string, foreignKeyName: string): Promise<void>;
  getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]>;

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
  upsert(tableName: string, data: any, filter?: QueryFilter): Promise<any>;

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

  // Required methods from IAdapter
  executeRaw(query: string | any, params?: any[]): Promise<any>;
  tableExists(tableName: string): Promise<boolean>;
  getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null>;

  // Transaction Management
  beginTransaction(): Promise<Transaction>;

  // Utility
  sanitize(value: any): any;
}

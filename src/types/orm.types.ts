// ========================
// src/types/orm.types.ts - Core Types & Interfaces
// ========================

/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'sqlserver' | 'mongodb' | 'oracle';

/**
 * Field types for schema definition
 */
export type FieldType = 
  | 'string' | 'text' | 'varchar' | 'char'
  | 'number' | 'integer' | 'int' | 'bigint' | 'float' | 'double' | 'decimal'
  | 'boolean' | 'bool'
  | 'date' | 'datetime' | 'timestamp' | 'time'
  | 'json' | 'jsonb' | 'array' | 'object'
  | 'uuid' | 'binary' | 'blob';

/**
 * Field definition in schema
 */
export interface FieldDefinition {
  name?: string; // Auto-fill from key if not provided
  type: FieldType;
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: any;
  primaryKey?: boolean;
  primary_key?: boolean; // Alias for compatibility
  autoIncrement?: boolean;
  auto_increment?: boolean; // Alias for compatibility
  length?: number;
  precision?: number;
  scale?: number;
  index?: boolean;
  enum?: string[] | number[];
  comment?: string;
  references?: {
    table: string;
    field: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

/**
 * Schema definition for a collection/table
 */
export interface SchemaDefinition {
  [fieldName: string]: FieldDefinition;
}

/**
 * Entity schema definition (for DatabaseSchema)
 */
export interface EntitySchemaDefinition {
  name: string; // Table/Collection name
  cols: FieldDefinition[]; // Columns/Fields
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
  options?: TableOptions;
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string;
  fields: string[];
  unique?: boolean;
  type?: 'BTREE' | 'HASH' | 'GIST' | 'GIN';
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
  name: string;
  fields: string[];
  references: {
    table: string;
    fields: string[];
  };
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Table options
 */
export interface TableOptions {
  engine?: string; // MySQL: InnoDB, MyISAM
  charset?: string;
  collation?: string;
  comment?: string;
}

/**
 * Database schema
 */
export interface DatabaseSchema {
  version: string;
  database_type: DatabaseType;
  database_name: string;
  schemas: Record<string, EntitySchemaDefinition>;
  type_mapping?: Record<string, string>;
  description?: string;
}

/**
 * Query operators
 */
export type QueryOperator = 
  | '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' 
  | '$in' | '$nin' | '$like' | '$ilike' | '$regex' 
  | '$and' | '$or' | '$not' | '$exists'
  | '$between' | '$notBetween';

/**
 * Query filter
 */
export type QueryFilter<T = any> = {
  [K in keyof T]?: T[K] | {
    [Op in QueryOperator]?: any;
  };
} & {
  $and?: QueryFilter<T>[];
  $or?: QueryFilter<T>[];
  $not?: QueryFilter<T>;
};

/**
 * Sort direction
 */
export type SortDirection = 1 | -1 | 'ASC' | 'DESC';

/**
 * Join type
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';

/**
 * Join clause
 */
export interface JoinClause {
  type: JoinType;
  table: string;
  on: string;
  alias?: string;
}

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  skip?: number; // Alias for offset (MongoDB style)
  sort?: { [key: string]: SortDirection };
  orderBy?: { [key: string]: SortDirection }; // Alias for sort
  select?: string[];
  fields?: string[]; // Alias for select
  populate?: string[] | PopulateOptions[];
  joins?: JoinClause[];
  groupBy?: string[];
  having?: QueryFilter;
  distinct?: boolean;
}

/**
 * Populate options
 */
export interface PopulateOptions {
  path: string;
  select?: string[];
  match?: QueryFilter;
  populate?: PopulateOptions[];
}

/**
 * Transaction interface
 */
export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

/**
 * Database configuration
 */
export interface DbConfig {
  databaseType: DatabaseType;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  dbName?: string; // Alias for database
  username?: string;
  user?: string; // Alias for username
  password?: string;
  dbDirectory?: string; // For SQLite
  options?: Record<string, any>;
  ssl?: boolean | object;
  poolSize?: number;
  timeout?: number;
}

/**
 * Connection interface
 */
export interface IConnection {
  rawConnection: any;
  isConnected: boolean;
  close(): Promise<void>;
}

/**
 * Result interface
 */
export interface IResult {
  rows: any[];
  rowsAffected: number;
  lastInsertId?: any;
  insertedIds?: any[];
  metadata?: any;
}

/**
 * Aggregate options
 */
export interface AggregateOptions {
  pipeline: any[];
  allowDiskUse?: boolean;
  maxTimeMS?: number;
}

/**
 * Bulk operation
 */
export interface BulkOperation {
  insertOne?: { document: any };
  updateOne?: { filter: QueryFilter; update: any; upsert?: boolean };
  updateMany?: { filter: QueryFilter; update: any; upsert?: boolean };
  deleteOne?: { filter: QueryFilter };
  deleteMany?: { filter: QueryFilter };
  replaceOne?: { filter: QueryFilter; replacement: any; upsert?: boolean };
}

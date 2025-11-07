// ========================
// src/types/orm.types.ts - Core Types & Interfaces
// ========================

/**
 * Supported database types
 */
export type DatabaseType =
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "sqlite"
  | "sqlserver"
  | "mongodb"
  | "oracle";

/**
 * Field types for schema definition
 */
export type FieldType =
  | "string"
  | "text"
  | "varchar"
  | "char"
  | "number"
  | "integer"
  | "int"
  | "bigint"
  | "float"
  | "double"
  | "decimal"
  | "boolean"
  | "bool"
  | "date"
  | "datetime"
  | "timestamp"
  | "time"
  | "json"
  | "jsonb"
  | "array"
  | "object"
  | "uuid"
  | "binary"
  | "blob"
  | "email"
  | "objectid"
  | "url"
  | "smallint"
  | "tinyint"
  | "numeric";

/**
 *Kiểu mapping csdl với kiểu
 */
export interface TypeMappingConfig {
  type_mapping: {
    [targetType: string]: {
      [sourceType: string]: string;
    };
  };
}

/**
 * Field definition in schema
 */
export interface FieldDefinition {
  name?: string; // Auto-fill from key if not provided
  type: FieldType;
  option_key?: string;
  description?: string;
  constraints?: string;
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
  name?: string; // Table/Collection name Same key
  cols: FieldDefinition[];
  indexes?: IndexDefinition[];
  foreign_keys?: ForeignKeyDefinition[];
  options?: TableOptions;
  description?: string;
}

/**
 * Index definition
 */
interface IndexDefinitionBase {
  name: string;
  fields: string[];
  clustered?: boolean;
  unique?: boolean;
  type?: "BTREE" | "HASH" | "GIST" | "GIN" | "BITMAP" | "TEXT";
  description?: string;
}

export type IndexDefinition = IndexDefinitionBase;

/**
 * Foreign key definition
 */
type References = {
  table: string;
  fields: string[];
};

// Định nghĩa base cho ForeignKeyDefinition
export interface ForeignKeyDefinition {
  name: string;
  fields: string[];
  references: References;
  on_delete?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  on_update?: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  description?: string;
}
/**
 * Foreign Key Actions
 */
export enum ForeignKeyAction {
  CASCADE = "CASCADE",
  SET_NULL = "SET NULL",
  SET_DEFAULT = "SET DEFAULT",
  RESTRICT = "RESTRICT",
  NO_ACTION = "NO ACTION",
}

/**
 * Foreign Key Information
 */
export interface ForeignKeyInfo {
  name: string; // Tên foreign key
  tableName: string; // Bảng chứa foreign key
  columns: string[]; // Cột(s) trong bảng hiện tại
  referencedTable: string; // Bảng được tham chiếu
  referencedColumns: string[]; // Cột(s) trong bảng được tham chiếu
  onDelete?: ForeignKeyAction; // Hành động khi DELETE
  onUpdate?: ForeignKeyAction; // Hành động khi UPDATE
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
  database_type?: DatabaseType;
  database_name: string;
  schemas: Record<string, EntitySchemaDefinition>;
  type_mapping?: TypeMappingConfig["type_mapping"];
  description?: string;
}

/**
 * Query operators
 */
export type QueryOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$in"
  | "$nin"
  | "$like"
  | "$ilike"
  | "$regex"
  | "$and"
  | "$or"
  | "$not"
  | "$exists"
  | "$between"
  | "$notBetween";

/**
 * Query filter
 */
export type QueryFilter<T = any> = {
  [K in keyof T]?:
    | T[K]
    | {
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
export type SortDirection = 1 | -1 | "ASC" | "DESC";

/**
 * Join type
 */
export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";

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
  options?: Record<string, any> | string;
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

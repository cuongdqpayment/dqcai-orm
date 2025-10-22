// src/index.ts - Main Export File

// Core Types
export * from "./types";

// Core Classes
export { BaseAdapter } from "./core/base-adapter";
export { UniversalDAO } from "./core/universal-dao";
export { DatabaseFactory } from "./core/database-factory";
export { DatabaseManager } from "./core/database-manager";
export { BaseService } from "./core/base-service";
export { ServiceManager, serviceManager } from "./core/service-manager";

// Adapters
export { PostgreSQLAdapter } from "./adapters/postgresql-adapter";
export type { PostgreSQLConfig } from "./adapters/postgresql-adapter";
export { MySQLAdapter } from "./adapters/mysql-adapter";
export type { MySQLConfig } from "./adapters/mysql-adapter";
export { MariaDBAdapter } from "./adapters/mariadb-adapter";
export { SQLiteAdapter } from "./adapters/sqlite-adapter";
export type { SQLiteConfig } from "./adapters/sqlite-adapter";
export { MongoDBAdapter } from "./adapters/mongodb-adapter";
export type { MongoDBConfig } from "./adapters/mongodb-adapter";
export { SQLServerAdapter } from "./adapters/sqlserver-adapter";
export type { SQLServerConfig } from "./adapters/sqlserver-adapter";

// Query & Model
export { QueryBuilder } from "./query/query-builder";
export { Model } from "./model";
export { ORM } from "./orm";

// Utilities
export { TypeMapper } from "./utils/type-mapper";
export { QueryHelper } from "./utils/query-helper";

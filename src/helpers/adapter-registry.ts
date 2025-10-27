// ========================
// src/helpers/adapter-registry.ts
// ========================

import { AdapterHelper } from "./adapter-helper";
import { PostgreSQLConnectionFactory } from "../factories/postgresql-connection.factory";
import { MySQLConnectionFactory } from "../factories/mysql-connection.factory";
import { MariaDBConnectionFactory } from "../factories/maria-connection.factory";
import { MongoDBConnectionFactory } from "../factories/mongodb-connection.factory";
import { SQLiteConnectionFactory } from "../factories/sqlite-connection.factory";
import { OracleConnectionFactory } from "../factories/oracle-connection.factory";
import { SQLServerConnectionFactory } from "../factories/sqlserver-connection.factory";
import { PostgreSQLAdapter } from "../adapters/postgresql-adapter";
import { MySQLAdapter } from "../adapters/mysql-adapter";
import { MariaDBAdapter } from "../adapters/mariadb-adapter";
import { MongoDBAdapter } from "../adapters/mongodb-adapter";
import { SQLiteAdapter } from "../adapters/sqlite-adapter";
import { OracleAdapter } from "../adapters/oracle-adapter";
import { SQLServerAdapter } from "../adapters/sqlserver-adapter";

/**
 * Auto-register tất cả adapters và factories
 * Import file này để tự động đăng ký tất cả
 */
export function registerAllAdapters(): void {
  // PostgreSQL
  AdapterHelper.register(
    "postgresql",
    new PostgreSQLConnectionFactory(),
    PostgreSQLAdapter as any
  );

  // MySQL
  AdapterHelper.register(
    "mysql",
    new MySQLConnectionFactory(),
    MySQLAdapter as any
  );

  // MariaDB
  AdapterHelper.register(
    "mariadb",
    new MariaDBConnectionFactory(),
    MariaDBAdapter as any
  );

  // MongoDB
  AdapterHelper.register(
    "mongodb",
    new MongoDBConnectionFactory(),
    MongoDBAdapter as any
  );

  // SQLite
  AdapterHelper.register(
    "sqlite",
    new SQLiteConnectionFactory(),
    SQLiteAdapter as any
  );

  // Oracle
  AdapterHelper.register(
    "oracle",
    new OracleConnectionFactory(),
    OracleAdapter as any
  );

  // SQL Server
  AdapterHelper.register(
    "sqlserver",
    new SQLServerConnectionFactory(),
    SQLServerAdapter as any
  );
}


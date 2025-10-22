// src/logger/index.ts
import {
  BaseModule,
  LoggerConfigBuilder,
  CommonModules,
  CommonLoggerConfig,
  createModuleLogger,
} from "@dqcai/logger";

const ORMModules = {
  ...CommonModules,
  DATABASE_MANAGER: "DatabaseManager",
  DATABASE_FACTORY: "DatabaseFactory",
  UNIVERSAL_DAO: "UniversalDAO",
  BASE_SERVICE: "BaseService",
  SERVICE_MANAGER: "ServiceManager",
  QUERY_BUILDER: "QueryBuilder",
  BASE_ADAPTER: "BaseAdapter",
  POSTGRESQL_ADAPTER: "PostgreSQLAdapter",
  MYSQL_ADAPTER: "MySQLAdapter",
  MARIADB_ADAPTER: "MariaDBAdapter",
  MONGODB_ADAPTER: "MongoDbAdapter",
  SQLITE3_ADAPTER: "Sqlite3Adapter",
  SQLSERVER_ADAPTER: "SQLServerAdapter",
  ORACLE_ADAPTER: "OracleAdapter",
};

const config = new LoggerConfigBuilder()
  .setEnabled(true)
  .setDefaultLevel("warn")
  .build();

CommonLoggerConfig.updateConfiguration(config);

export { BaseModule, createModuleLogger, ORMModules, CommonLoggerConfig };
// ========================
// src/types/database-config-types.ts
// ========================

import { DbConfig } from "./orm.types";

/**
 * PostgreSQL Configuration
 * Requires: pg package (npm install pg)
 *
 * @example
 * ```typescript
 * const config: PostgreSQLConfig = {
 *   host: "localhost",
 *   port: 5432,
 *   database: "mydb",
 *   user: "postgres",
 *   password: "password",
 *   ssl: false,
 *   max: 10
 * };
 * ```
 */
export interface PostgreSQLConfig extends DbConfig {
  /** Database host (default: localhost) */
  host?: string;

  /** Database port (default: 5432) */
  port?: number;

  /** Database name */
  database?: string;

  /** Database user (pg uses 'user' not 'username') */
  user?: string;

  /** Database password */
  password?: string;

  /** Enable SSL connection (default: false) */
  ssl?:
    | boolean
    | {
        rejectUnauthorized?: boolean;
        ca?: string | Buffer;
        key?: string | Buffer;
        cert?: string | Buffer;
      };

  /** Maximum number of clients in the pool (default: 10) */
  max?: number;

  /** Minimum number of clients in the pool (default: 0) */
  min?: number;

  /** Connection timeout in milliseconds (default: 0 = no timeout) */
  connectionTimeoutMillis?: number;

  /** Idle timeout in milliseconds (default: 10000) */
  idleTimeoutMillis?: number;

  /** Max time to wait for connection (ms) (default: 0 = disabled) */
  acquireTimeoutMillis?: number;

  /** Statement timeout in milliseconds */
  statement_timeout?: number | false;

  /** Query timeout in milliseconds */
  query_timeout?: number;

  /** Application name for logging */
  application_name?: string;

  /** Keep alive enabled (default: false) */
  keepAlive?: boolean;

  /** Keep alive initial delay (ms) */
  keepAliveInitialDelayMillis?: number;

  /** Allow exiting on idle (default: false) */
  allowExitOnIdle?: boolean;
}

/**
 * MySQL Configuration
 * Requires: mysql2 package (npm install mysql2)
 *
 * @example
 * ```typescript
 * const config: MySQLConfig = {
 *   host: "localhost",
 *   port: 3306,
 *   database: "mydb",
 *   user: "root",
 *   password: "password",
 *   charset: "utf8mb4",
 *   timezone: "+00:00"
 * };
 * ```
 */
export interface MySQLConfig extends DbConfig {
  /** Database host (default: localhost) */
  host: string;

  /** Database port (default: 3306) */
  port?: number;

  /** Database name */
  database: string;

  /** Database user */
  user: string;

  /** Database password */
  password: string;

  /** Character set (default: utf8mb4) */
  charset?: string;

  /** Timezone (default: local) */
  timezone?: string;

  /** Connection limit (default: 10) */
  connectionLimit?: number;

  /** Wait for connections (default: true) */
  waitForConnections?: boolean;

  /** Queue limit (default: 0 = unlimited) */
  queueLimit?: number;

  /** Enable multiple statements (default: false) */
  multipleStatements?: boolean;

  /** Connect timeout in milliseconds (default: 10000) */
  connectTimeout?: number;

  /** Socket path for Unix socket connection */
  socketPath?: string;

  /** SSL configuration */
  ssl?: {
    ca?: string;
    key?: string;
    cert?: string;
    rejectUnauthorized?: boolean;
  };
}

/**
 * MariaDB Configuration
 * Requires: mariadb or mysql2 package (npm install mariadb OR npm install mysql2)
 *
 * @example
 * ```typescript
 * const config: MariaDBConfig = {
 *   host: "localhost",
 *   port: 3306,
 *   database: "mydb",
 *   user: "root",
 *   password: "password",
 *   charset: "utf8mb4",
 *   connectionLimit: 5
 * };
 * ```
 */
export interface MariaDBConfig extends DbConfig {
  /** Database host (default: localhost) */
  host: string;

  /** Database port (default: 3306) */
  port?: number;

  /** Database name */
  database: string;

  /** Database user */
  user: string;

  /** Database password */
  password: string;

  /** Character set (default: utf8mb4) */
  charset?: string;

  /** Timezone (default: local) */
  timezone?: string;

  /** Connection limit (default: 10) */
  connectionLimit?: number;

  /** Minimum connections (default: 0) */
  minimumIdle?: number;

  /** Idle timeout in seconds (default: 1800) */
  idleTimeout?: number;

  /** Connection timeout in milliseconds (default: 10000) */
  connectTimeout?: number;

  /** Enable multiple statements (default: false) */
  multipleStatements?: boolean;

  /** Socket path for Unix socket connection */
  socketPath?: string;

  /** SSL configuration */
  ssl?:
    | boolean
    | {
        ca?: string;
        key?: string;
        cert?: string;
        rejectUnauthorized?: boolean;
      };

  /** Enable compression (default: false) */
  compress?: boolean;
  // autoCreateDatabase?: boolean; // Default: true
}

/**
 * MongoDB Configuration
 * Requires: mongodb package (npm install mongodb)
 *
 * @example
 * ```typescript
 * const config: MongoDBConfig = {
 *   url: "mongodb://localhost:27017",
 *   database: "mydb",
 *   options: {
 *     maxPoolSize: 10,
 *     minPoolSize: 2
 *   }
 * };
 * ```
 */
export interface MongoDBConfig extends DbConfig {
  /**
   * MongoDB connection URL
   * @example "mongodb://localhost:27017"
   * @example "mongodb+srv://username:password@cluster.mongodb.net"
   */
  url?: string;

  /**
   * Alternative to url
   * @example "mongodb://localhost:27017"
   */
  connectionString?: string;

  /** Database name */
  database: string;

  /** MongoDB connection options */
  options?: {
    /** Maximum number of connections in pool (default: 100) */
    maxPoolSize?: number;

    /** Minimum number of connections in pool (default: 0) */
    minPoolSize?: number;

    /** Maximum time a connection can be idle before being closed (ms) */
    maxIdleTimeMS?: number;

    /** Server selection timeout (ms) (default: 30000) */
    serverSelectionTimeoutMS?: number;

    /** Socket timeout (ms) (default: 0 = no timeout) */
    socketTimeoutMS?: number;

    /** Enable SSL/TLS (default: false) */
    tls?: boolean;

    /** TLS certificate authority */
    tlsCAFile?: string;

    /** TLS certificate */
    tlsCertificateFile?: string;

    /** TLS private key */
    tlsCertificateKeyFile?: string;

    /** Allow invalid certificates (default: false) */
    tlsAllowInvalidCertificates?: boolean;

    /** Allow invalid hostnames (default: false) */
    tlsAllowInvalidHostnames?: boolean;

    /** Authentication mechanism */
    authMechanism?: "SCRAM-SHA-1" | "SCRAM-SHA-256" | "MONGODB-X509" | "PLAIN";

    /** Authentication source database */
    authSource?: string;

    /** Replica set name */
    replicaSet?: string;

    /** Read preference */
    readPreference?:
      | "primary"
      | "primaryPreferred"
      | "secondary"
      | "secondaryPreferred"
      | "nearest";

    /** Write concern */
    w?: number | "majority";

    /** Journal write concern (default: false) */
    journal?: boolean;

    /** Write timeout (ms) */
    wtimeoutMS?: number;

    /** Enable retry writes (default: true) */
    retryWrites?: boolean;

    /** Enable retry reads (default: true) */
    retryReads?: boolean;

    /** Application name for logging */
    appName?: string;

    /** Direct connection (default: false) */
    directConnection?: boolean;

    /** Compression algorithms */
    compressors?: ("snappy" | "zlib" | "zstd")[];
  };
}

/**
 * SQLite Configuration
 * Requires: better-sqlite3 package (npm install better-sqlite3)
 *
 * @example
 * ```typescript
 * // File-based database
 * const config: SQLiteConfig = {
 *   filename: "./data/mydb.sqlite"
 * };
 *
 * // In-memory database
 * const config: SQLiteConfig = {
 *   memory: true
 * };
 * ```
 */
export interface SQLiteConfig extends DbConfig {
  /**
   * Database file path
   * @example "./data/mydb.sqlite"
   * @example "/absolute/path/to/mydb.db"
   */
  filename?: string;

  /** Database directory (used with database name if filename not provided) */
  dbDirectory?: string;

  /** Use in-memory database (default: false) */
  memory?: boolean;

  /** Enable read-only mode (default: false) */
  readonly?: boolean;

  /** Enable file creation if not exists (default: true) */
  fileMustExist?: boolean;

  /** Connection timeout in milliseconds (default: 5000) */
  timeout?: number;

  /** Enable verbose mode for debugging (default: false) */
  verbose?: boolean;

  /** Custom PRAGMA statements */
  pragma?: {
    /** Journal mode: DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF */
    journal_mode?: "DELETE" | "TRUNCATE" | "PERSIST" | "MEMORY" | "WAL" | "OFF";

    /** Synchronous mode: OFF, NORMAL, FULL, EXTRA */
    synchronous?: "OFF" | "NORMAL" | "FULL" | "EXTRA";

    /** Foreign keys enforcement (default: false) */
    foreign_keys?: boolean;

    /** Cache size in pages (negative = KB) */
    cache_size?: number;

    /** Page size in bytes */
    page_size?: number;

    /** Temp store: DEFAULT, FILE, MEMORY */
    temp_store?: "DEFAULT" | "FILE" | "MEMORY";

    /** Locking mode: NORMAL, EXCLUSIVE */
    locking_mode?: "NORMAL" | "EXCLUSIVE";

    /** Auto vacuum: NONE, FULL, INCREMENTAL */
    auto_vacuum?: "NONE" | "FULL" | "INCREMENTAL";
  };
}

/**
 * Oracle Database Configuration
 * Requires: oracledb package (npm install oracledb)
 * Note: May require Oracle Instant Client installation
 *
 * @example
 * ```typescript
 * // Using connection string
 * const config: OracleConfig = {
 *   user: "system",
 *   password: "oracle",
 *   connectString: "localhost:1521/XE"
 * };
 *
 * // Using separate components
 * const config: OracleConfig = {
 *   user: "hr",
 *   password: "hr",
 *   host: "localhost",
 *   port: 1521,
 *   serviceName: "ORCL"
 * };
 * ```
 */
export interface OracleConfig extends DbConfig {
  /** Database user */
  user: string;

  /** Alternative to user */
  username?: string;

  /** Database password */
  password: string;

  /**
   * Connection string (Easy Connect format)
   * @example "localhost:1521/XEPDB1"
   * @example "host:port/service_name"
   * @example "host:port:SID"
   */
  connectString?: string;

  /** Alternative to connectString */
  connectionString?: string;

  /** Database host (used if connectString not provided) */
  host?: string;

  /** Database port (default: 1521) */
  port?: number;

  /** Service name (used with host:port) */
  serviceName?: string;

  /** SID (System Identifier) - alternative to serviceName */
  sid?: string;

  /** Minimum number of connections in pool (default: 2) */
  poolMin?: number;

  /** Maximum number of connections in pool (default: 10) */
  poolMax?: number;

  /** Connection pool increment (default: 1) */
  poolIncrement?: number;

  /** Pool timeout in seconds (default: 60) */
  poolTimeout?: number;

  /** Connection timeout in seconds (default: 60) */
  connectTimeout?: number;

  /** Database edition for edition-based redefinition */
  edition?: string;

  /** Use external authentication (default: false) */
  externalAuth?: boolean;

  /**
   * Connection privilege
   * SYSDBA = 2, SYSOPER = 4, SYSASM = 32768, SYSBACKUP = 131072, SYSDG = 262144, SYSKM = 524288
   */
  privilege?: number;

  /** Enable events mode (default: false) */
  events?: boolean;

  /** Statement cache size (default: 30) */
  stmtCacheSize?: number;

  /** Prefetch rows (default: 2) */
  prefetchRows?: number;

  /** Fetch array size (default: 100) */
  fetchArraySize?: number;

  /** Queue timeout for getting connection from pool (ms) */
  queueTimeout?: number;

  /** Pool alias name */
  poolAlias?: string;

  /** Enable query result set caching */
  resultSetCacheSize?: number;
}

/**
 * SQL Server Configuration
 * Requires: mssql package (npm install mssql)
 * Compatible với mssql.config
 *
 * @example
 * ```typescript
 * const config: SQLServerConfig = {
 *   server: "localhost",
 *   port: 1433,
 *   database: "mydb",
 *   user: "sa",
 *   password: "YourStrong@Passw0rd",
 *   options: {
 *     encrypt: true,
 *     trustServerCertificate: true
 *   }
 * };
 *
 * // Windows Authentication
 * const config: SQLServerConfig = {
 *   server: "localhost",
 *   database: "mydb",
 *   options: {
 *     trustedConnection: true
 *   }
 * };
 * ```
 */
export interface SQLServerConfig extends DbConfig {
  /** SQL Server instance name or IP address */
  server: string;

  /** SQL Server port (default: 1433) */
  port?: number;

  /** Database name */
  database?: string;

  /** SQL Server user (not needed for Windows Auth) */
  user?: string;

  /** SQL Server password (not needed for Windows Auth) */
  password?: string;

  /** Domain for Windows Authentication */
  domain?: string;

  /** Connection timeout in milliseconds (default: 15000) */
  connectionTimeout?: number;

  /** Request timeout in milliseconds (default: 15000) */
  requestTimeout?: number;

  /** Stream data (default: false) */
  stream?: boolean;

  /** Parse JSON columns (default: false) */
  parseJSON?: boolean;

  /** Connection pool min size (default: 0) */
  pool?: {
    /** Maximum number of connections (default: 10) */
    max?: number;

    /** Minimum number of connections (default: 0) */
    min?: number;

    /** Idle timeout in milliseconds (default: 30000) */
    idleTimeoutMillis?: number;
  };

  /** SQL Server connection options */
  options?: {
    /** Enable encryption (default: true for Azure) */
    encrypt?: boolean;

    /** Trust server certificate (default: false) */
    trustServerCertificate?: boolean;

    /** Use Windows Authentication (default: false) */
    trustedConnection?: boolean;

    /** Enable Multiple Active Result Sets (default: false) */
    enableArithAbort?: boolean;

    /** Application name for SQL Server logs */
    appName?: string;

    /** Instance name (for named instances) */
    instanceName?: string;

    /** Abort transaction on error (default: true) */
    abortTransactionOnError?: boolean;

    /** Use UTC for dates (default: true) */
    useUTC?: boolean;

    /**
     * Connection isolation level (use ISOLATION_LEVEL constants from mssql)
     * ISOLATION_LEVEL.READ_UNCOMMITTED = 0x01
     * ISOLATION_LEVEL.READ_COMMITTED = 0x02
     * ISOLATION_LEVEL.REPEATABLE_READ = 0x03
     * ISOLATION_LEVEL.SERIALIZABLE = 0x04
     * ISOLATION_LEVEL.SNAPSHOT = 0x05
     */
    isolationLevel?: number;

    /** Read-only intent (default: false) */
    readOnlyIntent?: boolean;

    /** Request timeout in milliseconds */
    requestTimeout?: number;

    /** Cancel timeout in milliseconds (default: 5000) */
    cancelTimeout?: number;

    /** Packet size in bytes (default: 4096) */
    packetSize?: number;

    /** Use column names as keys (default: false) */
    useColumnNames?: boolean;

    /** Camel case column names (default: false) */
    camelCaseColumns?: boolean;

    /** Row collection on request completion (default: false) */
    rowCollectionOnRequestCompletion?: boolean;

    /** Row collection on done (default: false) */
    rowCollectionOnDone?: boolean;

    /** TDS version (default: 7_4) */
    tdsVersion?: string;

    /** Enable numeric roundabort (default: false) */
    enableNumericRoundabort?: boolean;

    /** Fallback to default database on error (default: false) */
    fallbackToDefaultDb?: boolean;

    /** Enable ANSI null default (default: true) */
    enableAnsiNullDefault?: boolean;

    /** Enable ANSI null (default: true) */
    enableAnsiNull?: boolean;

    /** Enable ANSI padding (default: true) */
    enableAnsiPadding?: boolean;

    /** Enable ANSI warnings (default: true) */
    enableAnsiWarnings?: boolean;

    /** Enable cursor close on commit (default: null) */
    enableCursorCloseOnCommit?: boolean | null;

    /** Enable implicit transactions (default: false) */
    enableImplicitTransactions?: boolean;

    /** Enable concat null yields null (default: true) */
    enableConcatNullYieldsNull?: boolean;

    /** Enable quoted identifier (default: true) */
    enableQuotedIdentifier?: boolean;

    /** Date first (default: 7) */
    datefirst?: number;

    /** Date format */
    dateFormat?: string;

    /** Language */
    language?: string;

    /** Lock timeout in milliseconds (default: -1 = no timeout) */
    lockTimeout?: number;

    /** Text size */
    textsize?: number;

    /** Transaction isolation level (deprecated, use isolationLevel) */
    transactionIsolationLevel?: number;

    /** Max rows */
    maxRetriesOnTransientErrors?: number;

    /** Connection retry interval in milliseconds */
    connectionRetryInterval?: number;

    /** Multisubnet failover (default: false) */
    multiSubnetFailover?: boolean;
  };

  /** Connection string (alternative to individual properties) */
  connectionString?: string;

  /** Array pool (default: false) */
  arrayRowMode?: boolean;

  /** Before connect callback */
  beforeConnect?: (conn: any) => void | Promise<void>;

  /** để SQL Server tự động rollback nếu query bên trong fail. */
  abortTransactionOnError?: boolean;
}

/**
 * Union type of all database configurations
 */
export type DatabaseConfig =
  | PostgreSQLConfig
  | MySQLConfig
  | MariaDBConfig
  | MongoDBConfig
  | SQLiteConfig
  | OracleConfig
  | SQLServerConfig;

/**
 * Type guard to check if config is PostgreSQL
 */
export function isPostgreSQLConfig(
  config: DatabaseConfig
): config is PostgreSQLConfig {
  return (
    "user" in config &&
    "host" in config &&
    !("serviceName" in config) &&
    !("server" in config)
  );
}

/**
 * Type guard to check if config is MySQL
 */
export function isMySQLConfig(config: DatabaseConfig): config is MySQLConfig {
  return "user" in config && "host" in config && !("serviceName" in config);
}

/**
 * Type guard to check if config is MariaDB
 */
export function isMariaDBConfig(
  config: DatabaseConfig
): config is MariaDBConfig {
  return "user" in config && "host" in config && "minimumIdle" in config;
}

/**
 * Type guard to check if config is MongoDB
 */
export function isMongoDBConfig(
  config: DatabaseConfig
): config is MongoDBConfig {
  return "url" in config || "connectionString" in config;
}

/**
 * Type guard to check if config is SQLite
 */
export function isSQLiteConfig(config: DatabaseConfig): config is SQLiteConfig {
  return "filename" in config || "memory" in config;
}

/**
 * Type guard to check if config is Oracle
 */
export function isOracleConfig(config: DatabaseConfig): config is OracleConfig {
  return (
    "connectString" in config || "serviceName" in config || "sid" in config
  );
}

/**
 * Type guard to check if config is SQL Server
 */
export function isSQLServerConfig(
  config: DatabaseConfig
): config is SQLServerConfig {
  return "server" in config;
}

/**
 * Helper function to validate database configuration
 */
export function validateDatabaseConfig(
  config: DatabaseConfig,
  type: string
): boolean {
  switch (type.toLowerCase()) {
    case "postgresql":
      return isPostgreSQLConfig(config) && !!config.database && !!config.user;
    case "mysql":
      return isMySQLConfig(config) && !!config.database && !!config.user;
    case "mariadb":
      return isMariaDBConfig(config) && !!config.database && !!config.user;
    case "mongodb":
      return isMongoDBConfig(config) && !!config.database;
    case "sqlite":
      return isSQLiteConfig(config) && (!!config.filename || !!config.memory);
    case "oracle":
      return isOracleConfig(config) && !!config.user && !!config.password;
    case "sqlserver":
      return isSQLServerConfig(config) && !!config.server && !!config.database;
    default:
      return false;
  }
}

/**
 * Example configurations for each database type
 */
export const DatabaseConfigExamples = {
  postgresql: {
    host: "localhost",
    port: 5432,
    database: "mydb",
    user: "postgres",
    password: "password",
    ssl: false,
    max: 10,
  } as PostgreSQLConfig,

  mysql: {
    host: "localhost",
    port: 3306,
    database: "mydb",
    user: "root",
    password: "password",
    charset: "utf8mb4",
    connectionLimit: 10,
  } as MySQLConfig,

  mariadb: {
    host: "localhost",
    port: 3306,
    database: "mydb",
    user: "root",
    password: "password",
    connectionLimit: 10,
  } as MariaDBConfig,

  mongodb: {
    url: "mongodb://localhost:27017",
    database: "mydb",
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
    },
  } as MongoDBConfig,

  sqlite: {
    filename: "./data/mydb.sqlite",
  } as SQLiteConfig,

  sqliteMemory: {
    memory: true,
  } as SQLiteConfig,

  oracle: {
    user: "system",
    password: "oracle",
    connectString: "localhost:1521/XE",
    poolMin: 2,
    poolMax: 10,
  } as OracleConfig,

  sqlserver: {
    server: "localhost",
    port: 1433,
    database: "mydb",
    user: "sa",
    password: "YourStrong@Passw0rd",
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  } as SQLServerConfig,
};

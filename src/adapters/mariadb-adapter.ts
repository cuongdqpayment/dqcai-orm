// ========================
// src/adapters/mariadb-adapter.ts
// ========================

import { DatabaseType, DbConfig, IConnection } from "@/types/orm.types";
import { MySQLAdapter } from "./mysql-adapter";
import { createModuleLogger, ORMModules } from "@/logger";
import { MariaDBConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.MARIADB_ADAPTER);

export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";

  constructor(config: DbConfig) {
    super(config);
  }

  isSupported(): boolean {
    // Đã check và cache rồi
    if (this.dbModule !== null) {
      return true;
    }

    if (this.isConnected()) {
      return true;
    }

    logger.trace("=== Checking MariaDB support ===");

    // Try mariadb (preferred)
    try {
      this.dbModule = this.require("mariadb");
      logger.debug("✓ Using 'mariadb' module");
      return true;
    } catch (error) {
      logger.trace("✗ mariadb module not available:", (error as Error).message);
    }

    // Try mysql2 (fallback)
    try {
      this.dbModule = this.require("mysql2");
      logger.debug("✓ Using 'mysql2' fallback module");
      return true;
    } catch (error) {
      logger.trace("✗ mysql2 module not available:", (error as Error).message);
    }

    logger.debug("✗ No MariaDB modules supported");
    return false;
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");

    const config = {
      ...this.dbConfig,
      database: schemaKey || this.dbConfig.database, // ưu tiên lấy database thuộc schemaConfig
    } as MariaDBConfig;

    logger.debug("Connecting to MariaDB", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 3306,
    });

    try {
      let pool;
      let usingMariaDBDriver = false;

      try {
        logger.trace("Dynamically importing 'mariadb' module");
        const mariadb = await import("mariadb");
        logger.trace("Creating MariaDB connection pool");
        pool = mariadb.createPool(config);
        usingMariaDBDriver = true;
      } catch {
        logger.debug("MariaDB module not available, falling back to mysql2");
        logger.trace("Dynamically importing 'mysql2/promise' module");
        const mysql = await import("mysql2/promise");
        logger.trace("Creating MySQL2 connection pool as fallback");
        pool = mysql.createPool(config as any);
        usingMariaDBDriver = false;
      }

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MariaDB connection pool");
          await pool.end();
        },
      };

      this.pool = pool;
      this.connection = connection;
      this.config = config;

      // ✅ Store which driver we're using
      (this as any)._usingMariaDBDriver = usingMariaDBDriver;

      logger.info("MariaDB connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        driver: usingMariaDBDriver ? "mariadb" : "mysql2",
      });

      return connection;
    } catch (error) {
      logger.error("MariaDB connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        error: (error as Error).message,
      });

      throw new Error(`MariaDB connection failed: ${error}`);
    }
  }

  // ==========================================
  // ✅ OVERRIDE: executeRaw() - Handle MariaDB driver differences
  // ==========================================
  async executeRaw(query: string, params?: any[]): Promise<any> {
    const sanitizedParamsForLogging = params?.map((p) =>
      typeof p === "bigint" ? p.toString() : p
    );

    logger.trace("Executing raw MariaDB query", {
      querySnippet:
        query.substring(0, Math.min(100, query.length)) +
        (query.length > 100 ? "..." : ""),
      paramsCount: params?.length || 0,
      params: sanitizedParamsForLogging,
    });

    if (!this.pool) {
      logger.error("Not connected to MariaDB");
      throw new Error("Not connected to MariaDB");
    }

    const sanitizedParams = params?.map((p) => {
      if (typeof p === "bigint") {
        const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
        const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
        return p <= MAX_SAFE && p >= MIN_SAFE ? Number(p) : p.toString();
      }
      return p;
    });

    const usingMariaDBDriver = (this as any)._usingMariaDBDriver;

    if (usingMariaDBDriver) {
      // Use sanitized params
      const result = await this.pool.query(query, sanitizedParams);

      if (Array.isArray(result)) {
        const resultData = {
          rows: result,
          rowCount: result.length,
          rowsAffected: result.length,
        };
        logger.trace("SELECT query executed (MariaDB driver)", {
          rowCount: result.length,
        });
        return resultData;
      } else {
        const resultData = {
          rows: [],
          rowCount: result.affectedRows || 0,
          rowsAffected: result.affectedRows || 0,
          insertId: result.insertId,
        };
        logger.trace("Non-SELECT query executed (MariaDB driver)", {
          affectedRows: result.affectedRows,
          insertId: result.insertId,
        });
        return resultData;
      }
    } else {
      const [rows, fields] = await this.pool.query(query, sanitizedParams);

      if (Array.isArray(rows)) {
        const result = {
          rows,
          rowCount: rows.length,
          rowsAffected: rows.length,
        };
        logger.trace("SELECT query executed (MySQL2 driver)", {
          rowCount: rows.length,
        });
        return result;
      } else {
        const result = {
          rows: [],
          rowCount: (rows as any).affectedRows || 0,
          rowsAffected: (rows as any).affectedRows || 0,
          insertId: (rows as any).insertId,
        };
        logger.trace("Non-SELECT query executed (MySQL2 driver)", {
          affectedRows: result.rowsAffected,
          insertId: result.insertId,
        });
        return result;
      }
    }
  }
}

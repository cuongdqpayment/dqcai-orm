// ========================
// src/adapters/mariadb-adapter.ts - FIXED
// ========================

import { DatabaseType, IConnection } from "../types/orm.types";
import { MySQLAdapter } from "./mysql-adapter";
import { createModuleLogger, ORMModules } from "../logger";
import { MariaDBConfig } from "../types";
const logger = createModuleLogger(ORMModules.MARIADB_ADAPTER);

export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";

  isSupported(): boolean {
    if (this.isConnected()) {
      return true;
    }

    logger.trace("Checking MariaDB support");

    try {
      require.resolve("mariadb");
      logger.debug("MariaDB module 'mariadb' is supported");
      return true;
    } catch {
      logger.trace("MariaDB module not available, checking mysql2");
      try {
        require.resolve("mysql2");
        logger.debug("MariaDB fallback module 'mysql2' is supported");
        return true;
      } catch {
        logger.debug("No MariaDB modules supported");
        return false;
      }
    }
  }

  async connect(config: MariaDBConfig): Promise<IConnection> {
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
        driver: usingMariaDBDriver ? 'mariadb' : 'mysql2'
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
    logger.trace("Executing raw MariaDB query", {
      querySnippet:
        query.substring(0, Math.min(100, query.length)) +
        (query.length > 100 ? "..." : ""),
      paramsCount: params?.length || 0,
    });

    if (!this.pool) {
      logger.error("Not connected to MariaDB");
      throw new Error("Not connected to MariaDB");
    }

    const usingMariaDBDriver = (this as any)._usingMariaDBDriver;

    if (usingMariaDBDriver) {
      // ✅ MariaDB driver (mariadb package)
      // Returns result directly, NOT as [rows, fields] tuple
      const result = await this.pool.query(query, params);

      // MariaDB result structure:
      // - For SELECT: result is array of rows + metadata
      // - For INSERT/UPDATE/DELETE: result has affectedRows, insertId
      
      if (Array.isArray(result)) {
        // SELECT query
        const resultData = {
          rows: result,
          rowCount: result.length,
          rowsAffected: result.length,
        };
        logger.trace("SELECT query executed (MariaDB driver)", { 
          rowCount: result.length 
        });
        return resultData;
      } else {
        // INSERT/UPDATE/DELETE query
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
      const [rows, fields] = await this.pool.query(query, params);

      if (Array.isArray(rows)) {
        const result = {
          rows,
          rowCount: rows.length,
          rowsAffected: rows.length,
        };
        logger.trace("SELECT query executed (MySQL2 driver)", { 
          rowCount: rows.length 
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

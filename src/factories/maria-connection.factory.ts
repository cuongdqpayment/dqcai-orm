// ========================
// src/factories/mariadb-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { MariaDBConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.MARIADB_CONNECTION_FACTORY);

export class MariaDBConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
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

  async connect(adapter: BaseAdapter, config: MariaDBConfig): Promise<IConnection> {
    logger.debug("Connecting to MariaDB", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 3306
    });

    try {
      // Try mariadb first
      let pool;
      try {
        logger.trace("Dynamically importing 'mariadb' module");

        const mariadb = await import("mariadb");
        logger.trace("Creating MariaDB connection pool");

        pool = mariadb.createPool(config);
      } catch {
        logger.debug("MariaDB module not available, falling back to mysql2");

        // Fallback to mysql2
        logger.trace("Dynamically importing 'mysql2/promise' module");

        const mysql = await import("mysql2/promise");
        logger.trace("Creating MySQL2 connection pool as fallback");

        pool = mysql.createPool(config as any);
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

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("MariaDB connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306
      });

      return connection;
    } catch (error) {
      logger.error("MariaDB connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        error: (error as Error).message
      });

      throw new Error(`MariaDB connection failed: ${error}`);
    }
  }
}
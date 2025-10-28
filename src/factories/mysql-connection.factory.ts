// ========================
// src/factories/mysql-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { MySQLConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.MYSQL_CONNECTION_FACTORY);

export class MySQLConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking MySQL support");

    try {
      require.resolve("mysql2");
      logger.debug("MySQL module 'mysql2' is supported");

      return true;
    } catch {
      logger.debug("MySQL module 'mysql2' is not supported");

      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: MySQLConfig): Promise<IConnection> {
    logger.debug("Connecting to MySQL", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 3306
    });

    try {
      logger.trace("Dynamically importing 'mysql2/promise' module");

      const mysql = await import("mysql2/promise");
      
      logger.trace("Creating MySQL connection pool");

      const pool = mysql.createPool(config);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MySQL connection pool");
          await pool.end();
        },
      };

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("MySQL connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306
      });

      return connection;
    } catch (error) {
      logger.error("MySQL connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        error: (error as Error).message
      });

      throw new Error(`MySQL connection failed: ${error}`);
    }
  }
}
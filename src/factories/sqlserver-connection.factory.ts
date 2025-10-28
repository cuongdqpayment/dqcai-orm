// ========================
// src/factories/sqlserver-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { SQLServerConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.SQLSERVER_CONNECTION_FACTORY);

export class SQLServerConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking SQL Server support");

    try {
      require.resolve("mssql");
      logger.debug("SQL Server module 'mssql' is supported");

      return true;
    } catch {
      logger.debug("SQL Server module 'mssql' is not supported");

      return false;
    }
  }

  async connect(
    adapter: BaseAdapter,
    config: SQLServerConfig
  ): Promise<IConnection> {
    logger.debug("Connecting to SQL Server", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 1433
    });

    try {
      logger.trace("Dynamically importing 'mssql' module");

      const sql = await import("mssql");
      
      logger.trace("Connecting to SQL Server pool");

      const pool = await sql.connect(config);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing SQL Server connection pool");
          await pool.close();
        },
      };

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("SQL Server connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1433
      });

      return connection;
    } catch (error) {
      logger.error("SQL Server connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1433,
        error: (error as Error).message
      });

      throw new Error(`SQL Server connection failed: ${error}`);
    }
  }
}
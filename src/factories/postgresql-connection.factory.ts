// ========================
// src/factories/postgresql-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { PostgreSQLConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.POSTGRESQL_CONNECTION_FACTORY);

export class PostgreSQLConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking PostgreSQL support");

    try {
      require.resolve("pg");
      logger.debug("PostgreSQL module 'pg' is supported");

      return true;
    } catch {
      logger.debug("PostgreSQL module 'pg' is not supported");

      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: PostgreSQLConfig): Promise<IConnection> {
    logger.debug("Connecting to PostgreSQL", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 5432
    });

    try {
      logger.trace("Dynamically importing 'pg' module");

      const { Pool } = await import("pg");
      
      logger.trace("Creating PostgreSQL Pool instance");

      const pool = new Pool(config as any);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing PostgreSQL connection pool");
          await pool.end();
        },
      };

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("PostgreSQL connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 5432
      });

      return connection;
    } catch (error) {
      logger.error("PostgreSQL connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 5432,
        error: (error as Error).message
      });

      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }
}
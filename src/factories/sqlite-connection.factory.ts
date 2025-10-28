// ========================
// src/factories/sqlite-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { SQLiteConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.SQLITE3_CONNECTION_FACTORY);

export class SQLiteConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking SQLite support");

    try {
      require.resolve("better-sqlite3");
      logger.debug("better-sqlite3 module is supported");

      return true;
    } catch {
      logger.trace("better-sqlite3 not available, checking sqlite3");

      try {
        require.resolve("sqlite3");
        logger.debug("sqlite3 module is supported");

        return true;
      } catch {
        logger.debug("No SQLite modules supported");

        return false;
      }
    }
  }

  async connect(adapter: BaseAdapter, config: SQLiteConfig): Promise<IConnection> {
    logger.debug("Connecting to SQLite", {
      database: config.database,
      memory: config.memory,
      dbDirectory: config.dbDirectory
    });

    try {
      logger.trace("Dynamically importing better-sqlite3");

      const Database = (await import("better-sqlite3")).default;
      const filename = config.memory
        ? ":memory:"
        : config.filename || `${config.dbDirectory || "."}/${config.database || "database"}.db`;

      logger.trace("Creating SQLite database", { filename });

      const db = new Database(filename);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: db,
        isConnected: true,
        close: async () => {
          logger.trace("Closing SQLite connection");
          db.close();
        },
      };

      (adapter as any).db = db;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("SQLite connection established successfully", {
        database: config.database,
        filename,
        memory: config.memory
      });

      return connection;
    } catch (error) {
      logger.error("SQLite connection failed", {
        database: config.database,
        memory: config.memory,
        error: (error as Error).message
      });

      throw new Error(`SQLite connection failed: ${error}`);
    }
  }
}
// ========================
// src/factories/sqlite-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { SQLiteConfig } from "../types/database-config-types";

export class SQLiteConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("better-sqlite3");
      return true;
    } catch {
      try {
        require.resolve("sqlite3");
        return true;
      } catch {
        return false;
      }
    }
  }

  async connect(adapter: BaseAdapter, config: SQLiteConfig): Promise<IConnection> {
    try {
      const Database = (await import("better-sqlite3")).default;
      const filename = config.memory
        ? ":memory:"
        : config.filename || `${config.dbDirectory || "."}/${config.database || "database"}.db`;

      const db = new Database(filename);

      const connection: IConnection = {
        rawConnection: db,
        isConnected: true,
        close: async () => {
          db.close();
        },
      };

      (adapter as any).db = db;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`SQLite connection failed: ${error}`);
    }
  }
}
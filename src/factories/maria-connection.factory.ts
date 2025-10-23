// ========================
// src/factories/mariadb-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { MariaDBConfig } from "../types/database-config-types";

export class MariaDBConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("mariadb");
      return true;
    } catch {
      try {
        require.resolve("mysql2");
        return true;
      } catch {
        return false;
      }
    }
  }

  async connect(adapter: BaseAdapter, config: MariaDBConfig): Promise<IConnection> {
    try {
      // Try mariadb first
      let pool;
      try {
        const mariadb = await import("mariadb");
        pool = mariadb.createPool(config);
      } catch {
        // Fallback to mysql2
        const mysql = await import("mysql2/promise");
        pool = mysql.createPool(config as any);
      }

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          await pool.end();
        },
      };

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`MariaDB connection failed: ${error}`);
    }
  }
}

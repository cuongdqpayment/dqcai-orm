
// ========================
// src/factories/mysql-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DbConfig, IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";

export class MySQLConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("mysql2");
      return true;
    } catch {
      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: DbConfig): Promise<IConnection> {
    try {
      const mysql = await import("mysql2/promise");
      const pool = mysql.createPool(config as any);

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
      throw new Error(`MySQL connection failed: ${error}`);
    }
  }
}



// ========================
// src/factories/postgresql-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DbConfig, IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";

/**
 * PostgreSQL Connection Factory
 * File này sẽ được import trong ứng dụng người dùng, không nằm trong core library
 */
export class PostgreSQLConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("pg");
      return true;
    } catch {
      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: DbConfig): Promise<IConnection> {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(config as any);

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          await pool.end();
        },
      };

      // Set connection vào adapter
      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }
}

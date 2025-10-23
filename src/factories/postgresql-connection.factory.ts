// ========================
// src/factories/postgresql-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { PostgreSQLConfig } from "../types/database-config-types";
import { PoolConfig } from "pg";

export class PostgreSQLConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("pg");
      return true;
    } catch {
      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: PostgreSQLConfig): Promise<IConnection> {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool(config as PoolConfig);

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
      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }
}

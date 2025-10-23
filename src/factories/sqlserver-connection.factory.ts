// ========================
// src/factories/sqlserver-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { SQLServerConfig } from "../types/database-config-types";

export class SQLServerConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("mssql");
      return true;
    } catch {
      return false;
    }
  }

  async connect(
    adapter: BaseAdapter,
    config: SQLServerConfig
  ): Promise<IConnection> {
    try {
      const sql = await import("mssql");
      const pool = await sql.connect(config);

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          await pool.close();
        },
      };

      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`SQL Server connection failed: ${error}`);
    }
  }
}

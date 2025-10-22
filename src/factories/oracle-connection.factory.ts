// ========================
// src/factories/oracle-connection.factory.ts
// ========================
import { OracleConfig } from "../adapters/oracle-adapter";
import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";

/**
 * PostgreSQL Connection Factory
 * File này sẽ được import trong ứng dụng người dùng, không nằm trong core library
 */
export class OracleConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("oracledb");
      return true;
    } catch {
      return false;
    }
  }

  async connect(
    adapter: BaseAdapter,
    config: OracleConfig
  ): Promise<IConnection> {
    try {
      const oracledb = await import("oracledb");
      // Set default fetch options
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = [oracledb.CLOB];
      oracledb.fetchAsBuffer = [oracledb.BLOB];

      // Build connection string
      const connectString = this.buildConnectString(config);

      let pool = await oracledb.createPool({
        user: config.user || config.username,
        password: config.password,
        connectString: connectString,
        poolMin: config.poolMin || 2,
        poolMax: config.poolMax || 10,
        poolIncrement: config.poolIncrement || 1,
        poolTimeout: config.poolTimeout || 60,
        edition: config.edition,
        externalAuth: config.externalAuth,
        privilege: config.privilege,
      });

      const connection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          if (pool) {
            await pool.close(0);
          }
        },
      };

      // Set connection vào adapter
      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`Oracle connection failed: ${error}`);
    }
  }

  private buildConnectString(config: OracleConfig): string {
    // If connectString or connectionString is provided, use it
    if (config.connectString) {
      return config.connectString;
    }
    if (config.connectionString) {
      return config.connectionString;
    }

    // Build from components
    const host = config.host || "localhost";
    const port = config.port || 1521;

    if (config.serviceName) {
      return `${host}:${port}/${config.serviceName}`;
    }

    if (config.sid) {
      return `${host}:${port}:${config.sid}`;
    }

    // Default
    return `${host}:${port}/XE`;
  }
}

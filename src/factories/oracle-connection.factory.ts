// ========================
// src/factories/oracle-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { OracleConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.ORACLE_CONNECTION_FACTORY);

export class OracleConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking Oracle support");

    try {
      require.resolve("oracledb");
      logger.debug("Oracle module 'oracledb' is supported");

      return true;
    } catch {
      logger.debug("Oracle module 'oracledb' is not supported");

      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: OracleConfig): Promise<IConnection> {
    logger.debug("Connecting to Oracle", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 1521
    });

    try {
      logger.trace("Dynamically importing 'oracledb' module");

      const oracledb = await import("oracledb");

      logger.trace("Configuring oracledb settings");

      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = [oracledb.CLOB];
      oracledb.fetchAsBuffer = [oracledb.BLOB];

      const connectString = this.buildConnectString(config);

      logger.trace("Creating Oracle connection pool", { connectStringSnippet: connectString.substring(0, 20) + (connectString.length > 20 ? '...' : '') });

      const pool = await oracledb.createPool({
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

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing Oracle connection pool");
          if (pool) {
            await pool.close(0);
          }
        },
      };

      (adapter as any).oracledb = oracledb;
      (adapter as any).pool = pool;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("Oracle connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1521
      });

      return connection;
    } catch (error) {
      logger.error("Oracle connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1521,
        error: (error as Error).message
      });

      throw new Error(`Oracle connection failed: ${error}`);
    }
  }

  private buildConnectString(config: any): string {
    logger.trace("Building Oracle connect string", { 
      hasConnectString: !!config.connectString,
      hasServiceName: !!config.serviceName,
      hasSid: !!config.sid
    });

    if (config.connectString) {
      logger.trace("Using provided connectString");
      return config.connectString;
    }
    if (config.connectionString) {
      logger.trace("Using provided connectionString");
      return config.connectionString;
    }

    const host = config.host || "localhost";
    const port = config.port || 1521;

    if (config.serviceName) {
      const connectString = `${host}:${port}/${config.serviceName}`;
      logger.trace("Built connect string with serviceName", { connectStringSnippet: connectString.substring(0, 20) + (connectString.length > 20 ? '...' : '') });
      return connectString;
    }

    if (config.sid) {
      const connectString = `${host}:${port}:${config.sid}`;
      logger.trace("Built connect string with SID", { connectStringSnippet: connectString.substring(0, 20) + (connectString.length > 20 ? '...' : '') });
      return connectString;
    }

    const defaultConnectString = `${host}:${port}/XE`;
    logger.trace("Using default connect string", { defaultConnectString });

    return defaultConnectString;
  }
}
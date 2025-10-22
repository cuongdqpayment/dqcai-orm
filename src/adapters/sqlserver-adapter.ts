// ========================
// src/adapters/sqlserver-adapter.ts
// ========================

import { createRequire } from "module";
import {
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  IConnection,
} from "../types/orm.types";
import { BaseAdapter } from "../core/base-adapter";

/**
 * SQL Server Configuration
 */
export interface SQLServerConfig extends DbConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

/**
 * SQL Server Adapter
 * Requires: mssql package
 */
export class SQLServerAdapter extends BaseAdapter {
  type: DatabaseType = "sqlserver";
  databaseType: DatabaseType = "sqlserver";

  private pool: any = null;

  async connect(config: SQLServerConfig): Promise<IConnection> {
    try {
      const sql = await import("mssql");
      this.pool = await sql.connect(config);

      this.connection = {
        rawConnection: this.pool,
        isConnected: true,
        close: async () => {
          if (this.pool) {
            await this.pool.close();
            this.connection = null;
          }
        },
      };

      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`SQL Server connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error("Not connected to SQL Server");
    }

    const request = this.pool.request();
    params?.forEach((param, index) => {
      request.input(`p${index + 1}`, param);
    });
    const result = await request.query(query);
    return { rows: result.recordset, rowCount: result.rowsAffected[0] || 0 };
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @p1
    `;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.count > 0;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @p1
      ORDER BY ORDINAL_POSITION
    `;

    const result = await this.executeRaw(query, [tableName]);

    if (result.rows.length === 0) {
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === "YES",
      default: row.COLUMN_DEFAULT,
    }));

    return {
      name: tableName,
      cols,
    };
  }

  protected getParamPlaceholder(index: number): string {
    return `@p${index + 1}`;
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    return `${name} ${type} IDENTITY(1,1)`;
  }

  isSupported(): boolean {
    // const require = createRequire(import.meta.url);
    try {
      require.resolve("mssql");
      return true;
    } catch {
      return false;
    }
  }
}

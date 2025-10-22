// ========================
// src/adapters/mysql-adapter.ts
// ========================

import { createRequire } from "module";
import { DatabaseType, DbConfig, EntitySchemaDefinition, IConnection } from "../types/orm.types";
import { BaseAdapter } from "../core/base-adapter";

/**
 * MySQL Configuration
 */
export interface MySQLConfig extends DbConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  charset?: string;
  timezone?: string;
}

/**
 * MySQL Adapter
 * Requires: mysql2 package
 */
export class MySQLAdapter extends BaseAdapter {
  type: DatabaseType = "mysql";
  databaseType: DatabaseType = "mysql";

  private pool: any = null;

  async connect(config: MySQLConfig): Promise<IConnection> {
    try {
      const mysql = await import("mysql2/promise");
      this.pool = mysql.createPool(config as any);

      this.connection = {
        rawConnection: this.pool,
        isConnected: true,
        close: async () => {
          if (this.pool) {
            await this.pool.end();
            this.connection = null;
          }
        },
      };

      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error}`);
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
      throw new Error("Not connected to MySQL");
    }

    const [rows, fields] = await this.pool.query(query, params);
    return { rows, rowCount: rows.length || (rows as any).affectedRows || 0 };
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = ?
    `;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.count > 0;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default, column_key
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      AND table_name = ?
      ORDER BY ordinal_position
    `;

    const result = await this.executeRaw(query, [tableName]);

    if (result.rows.length === 0) {
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
      primaryKey: row.column_key === "PRI",
    }));

    return {
      name: tableName,
      cols,
    };
  }

  protected getParamPlaceholder(index: number): string {
    return "?";
  }

  isSupported(): boolean {
    // const require = createRequire(import.meta.url);
    try {
      require.resolve("mysql2");
      return true;
    } catch {
      return false;
    }
  }
}

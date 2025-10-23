// ========================
// src/adapters/mysql-adapter.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";

export class MySQLAdapter extends BaseAdapter {
  type: DatabaseType = "mysql";
  databaseType: DatabaseType = "mysql";
  private pool: any = null;

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Not connected to MySQL");
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
    if (result.rows.length === 0) return null;

    const cols = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
      primaryKey: row.column_key === "PRI",
    }));

    return { name: tableName, cols };
  }

  protected getParamPlaceholder(index: number): string {
    return "?";
  }
}

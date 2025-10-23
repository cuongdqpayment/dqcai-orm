// ========================
// src/adapters/postgresql-adapter.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";

export class PostgreSQLAdapter extends BaseAdapter {
  type: DatabaseType = "postgresql";
  databaseType: DatabaseType = "postgresql";
  private pool: any = null;

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Not connected to PostgreSQL");
    const result = await this.pool.query(query, params);
    return result;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) as exists`;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.exists || false;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    const result = await this.executeRaw(query, [tableName]);
    if (result.rows.length === 0) return null;

    const cols = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
    }));

    return { name: tableName, cols };
  }

  protected getParamPlaceholder(index: number): string {
    return `$${index}`;
  }
}

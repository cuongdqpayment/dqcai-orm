// ========================
// src/adapters/sqlite-adapter.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";

export class SQLiteAdapter extends BaseAdapter {
  type: DatabaseType = "sqlite";
  databaseType: DatabaseType = "sqlite";
  private db: any = null;

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.db) throw new Error("Not connected to SQLite");
    if (query.trim().toUpperCase().startsWith("SELECT")) {
      const rows = this.db.prepare(query).all(params);
      return { rows, rowCount: rows.length };
    } else {
      const info = this.db.prepare(query).run(params);
      return {
        rows: [],
        rowCount: info.changes,
        lastInsertId: info.lastInsertRowid,
      };
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.count > 0;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `PRAGMA table_info(${tableName})`;
    const result = await this.executeRaw(query);
    if (result.rows.length === 0) return null;

    const cols = result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      default: row.dflt_value,
      primaryKey: row.pk === 1,
    }));

    return { name: tableName, cols };
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    return `${name} INTEGER PRIMARY KEY AUTOINCREMENT`;
  }

  protected getParamPlaceholder(index: number): string {
    return "?";
  }
}

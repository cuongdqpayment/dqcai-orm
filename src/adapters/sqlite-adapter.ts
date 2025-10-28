// ========================
// src/adapters/sqlite-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

export class SQLiteAdapter extends BaseAdapter {
  type: DatabaseType = "sqlite";
  databaseType: DatabaseType = "sqlite";
  private db: any = null;

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ SQLITE: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String (TEXT)
   * - Boolean → 1/0 (INTEGER)
   * - Object/Array → JSON String
   */
  protected sanitizeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects → ISO String
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle boolean → 1/0
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    // Handle arrays/objects → JSON stringify
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }

    // Handle strings (escape single quotes)
    if (typeof value === "string") {
      return value.replace(/'/g, "''");
    }

    return value;
  }

  /**
   * ✅ SQLITE: Ánh xạ kiểu dữ liệu
   * SQLite chỉ có: NULL, INTEGER, REAL, TEXT, BLOB
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    const typeMap: Record<string, string> = {
      // String types
      string: length ? `VARCHAR(${length})` : "TEXT",
      varchar: length ? `VARCHAR(${length})` : "TEXT",
      text: "TEXT",
      char: length ? `CHAR(${length})` : "TEXT",

      // Number types
      number: "REAL",
      integer: "INTEGER",
      int: "INTEGER",
      bigint: "INTEGER",
      float: "REAL",
      double: "REAL",
      decimal: "REAL",
      numeric: "REAL",

      // Boolean → INTEGER
      boolean: "INTEGER",
      bool: "INTEGER",

      // Date/Time → TEXT (ISO 8601)
      date: "TEXT",
      datetime: "TEXT",
      timestamp: "TEXT",
      time: "TEXT",

      // JSON → TEXT
      json: "TEXT",
      jsonb: "TEXT",
      array: "TEXT",
      object: "TEXT",

      // Binary
      uuid: "TEXT",
      binary: "BLOB",
      blob: "BLOB",
    };

    return typeMap[fieldType.toLowerCase()] || "TEXT";
  }

  /**
   * ✅ SQLITE: Xử lý kết quả INSERT
   * SQLite không hỗ trợ RETURNING, phải query lại
   */
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    const lastInsertId = result.lastInsertId || result.lastInsertRowid;

    if (!lastInsertId) {
      return data; // Fallback nếu không có ID
    }

    // Query lại bản ghi vừa insert
    const pkField = primaryKeys?.[0] || "id";
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

    const selectResult = await this.executeRaw(query, [lastInsertId]);
    return selectResult.rows?.[0] || { ...data, [pkField]: lastInsertId };
  }

  /**
   * ✅ SQLITE: Placeholder = ?
   */
  protected getPlaceholder(index: number): string {
    return "?";
  }

  // ==========================================
  // SQLITE-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.db) throw new Error("Not connected to SQLite");

    // Sanitize params trước khi execute
    const sanitizedParams = params?.map((p) => this.sanitizeValue(p));

    if (query.trim().toUpperCase().startsWith("SELECT")) {
      const rows = this.db.prepare(query).all(sanitizedParams);
      return { rows, rowCount: rows.length };
    } else {
      const info = this.db.prepare(query).run(sanitizedParams);
      return {
        rows: [],
        rowCount: info.changes,
        rowsAffected: info.changes,
        lastInsertId: info.lastInsertRowid,
        lastInsertRowid: info.lastInsertRowid,
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

  // ==========================================
  // OVERRIDE INSERT ONE (với RETURNING fallback)
  // ==========================================

  /**
   * 🔄 OVERRIDE: SQLite cần xử lý đặc biệt cho RETURNING
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize all values
    const values = Object.values(data).map((v) => this.sanitizeValue(v));

    const placeholders = keys.map(() => "?").join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // SQLite 3.35.0+ hỗ trợ RETURNING, nhưng để an toàn ta không dùng
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders})`;

    const result = await this.executeRaw(query, values);

    // ✅ Process result (query lại)
    return this.processInsertResult(tableName, result, data, ["id"]);
  }
}
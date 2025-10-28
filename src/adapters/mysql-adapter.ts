// ========================
// src/adapters/mysql-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

export class MySQLAdapter extends BaseAdapter {
  type: DatabaseType = "mysql";
  databaseType: DatabaseType = "mysql";
  private pool: any = null;

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ MYSQL: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String hoặc MySQL datetime format
   * - Boolean → 1/0 (TINYINT)
   * - Object/Array → JSON stringify
   */
  protected sanitizeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects → MySQL datetime format
    if (value instanceof Date) {
      return value.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Handle boolean → 1/0
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    // Handle arrays/objects → JSON stringify
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }

    // Handle strings (escape)
    if (typeof value === "string") {
      return value.replace(/'/g, "''");
    }

    return value;
  }

  /**
   * ✅ MYSQL: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    const typeMap: Record<string, string> = {
      // String types
      string: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "TEXT",
      char: length ? `CHAR(${length})` : "CHAR(1)",

      // Number types
      number: "DECIMAL(10,2)",
      integer: "INT",
      int: "INT",
      bigint: "BIGINT",
      float: "FLOAT",
      double: "DOUBLE",
      decimal: "DECIMAL",
      numeric: "DECIMAL",

      // Boolean → TINYINT(1)
      boolean: "TINYINT(1)",
      bool: "TINYINT(1)",

      // Date/Time
      date: "DATE",
      datetime: "DATETIME",
      timestamp: "TIMESTAMP",
      time: "TIME",

      // JSON (MySQL 5.7+)
      json: "JSON",
      jsonb: "JSON",
      array: "JSON",
      object: "JSON",

      // Others
      uuid: "CHAR(36)",
      binary: "BLOB",
      blob: "BLOB",
    };

    return typeMap[fieldType.toLowerCase()] || "VARCHAR(255)";
  }

  /**
   * ✅ MYSQL: Xử lý kết quả INSERT
   * MySQL không hỗ trợ RETURNING, phải query lại
   */
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    // MySQL trả về insertId
    const lastInsertId = result.insertId;

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
   * ✅ MYSQL: Placeholder = ?
   */
  protected getPlaceholder(index: number): string {
    return "?";
  }

  // ==========================================
  // MYSQL-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Not connected to MySQL");

    const [rows, fields] = await this.pool.query(query, params);

    // Xử lý kết quả
    if (Array.isArray(rows)) {
      return {
        rows,
        rowCount: rows.length,
        rowsAffected: rows.length,
      };
    } else {
      // INSERT/UPDATE/DELETE result
      return {
        rows: [],
        rowCount: (rows as any).affectedRows || 0,
        rowsAffected: (rows as any).affectedRows || 0,
        insertId: (rows as any).insertId,
      };
    }
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

  // ==========================================
  // OVERRIDE INSERT ONE (không có RETURNING)
  // ==========================================

  /**
   * 🔄 OVERRIDE: MySQL không hỗ trợ RETURNING
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

    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders})`;

    const result = await this.executeRaw(query, values);

    // ✅ Process result (query lại)
    return this.processInsertResult(tableName, result, data, ["id"]);
  }
}

// ========================
// src/adapters/mariadb-adapter.ts (REFACTORED)
// ========================

/**
 * MariaDB hoàn toàn tương thích với MySQL
 * Chỉ cần thay đổi type identifier
 */
export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";
}
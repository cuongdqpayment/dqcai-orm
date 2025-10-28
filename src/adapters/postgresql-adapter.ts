// ========================
// src/adapters/postgresql-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

export class PostgreSQLAdapter extends BaseAdapter {
  type: DatabaseType = "postgresql";
  databaseType: DatabaseType = "postgresql";
  private pool: any = null;

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ POSTGRESQL: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String (Postgres driver tự xử lý)
   * - Boolean → true/false (native support)
   * - Object/Array → JSON stringify
   */
  protected sanitizeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // PostgreSQL hỗ trợ Date native, nhưng để đồng nhất ta convert
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Boolean: Postgres hỗ trợ native
    if (typeof value === "boolean") {
      return value;
    }

    // Arrays/Objects → JSON
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }

    // Strings: escape single quotes
    if (typeof value === "string") {
      return value.replace(/'/g, "''");
    }

    return value;
  }

  /**
   * ✅ POSTGRESQL: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    const typeMap: Record<string, string> = {
      // String types
      string: length ? `VARCHAR(${length})` : "TEXT",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "TEXT",
      char: length ? `CHAR(${length})` : "CHAR(1)",

      // Number types
      number: "NUMERIC",
      integer: "INTEGER",
      int: "INTEGER",
      bigint: "BIGINT",
      float: "REAL",
      double: "DOUBLE PRECISION",
      decimal: "DECIMAL",
      numeric: "NUMERIC",

      // Boolean → BOOLEAN (native)
      boolean: "BOOLEAN",
      bool: "BOOLEAN",

      // Date/Time
      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP",
      time: "TIME",

      // JSON (native support)
      json: "JSON",
      jsonb: "JSONB",
      array: "JSONB",
      object: "JSONB",

      // Others
      uuid: "UUID",
      binary: "BYTEA",
      blob: "BYTEA",
    };

    return typeMap[fieldType.toLowerCase()] || "TEXT";
  }

  /**
   * ✅ POSTGRESQL: Xử lý kết quả INSERT
   * PostgreSQL hỗ trợ RETURNING * nên đơn giản
   */
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    // PostgreSQL trả về row trực tiếp qua RETURNING *
    return result.rows?.[0] || data;
  }

  /**
   * ✅ POSTGRESQL: Placeholder = $1, $2, $3...
   */
  protected getPlaceholder(index: number): string {
    return `${index}`;
  }

  // ==========================================
  // POSTGRESQL-SPECIFIC IMPLEMENTATIONS
  // ==========================================

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

  // ==========================================
  // OVERRIDE INSERT ONE (với RETURNING *)
  // ==========================================

  /**
   * 🔄 OVERRIDE: PostgreSQL hỗ trợ RETURNING *
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize all values
    const values = Object.values(data).map((v) => this.sanitizeValue(v));

    const placeholders = keys.map((_, i) => `${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // PostgreSQL hỗ trợ RETURNING *
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;

    const result = await this.executeRaw(query, values);

    // ✅ Process result
    return this.processInsertResult(tableName, result, data, ["id"]);
  }
}
// ========================
// src/adapters/sqlserver-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

export class SQLServerAdapter extends BaseAdapter {
  type: DatabaseType = "sqlserver";
  databaseType: DatabaseType = "sqlserver";
  private pool: any = null;

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ SQL SERVER: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String hoặc SQL Server datetime format
   * - Boolean → 1/0 (BIT)
   * - Object/Array → JSON stringify (NVARCHAR(MAX))
   */
  protected sanitizeValue(value: any): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects → SQL Server datetime format
    if (value instanceof Date) {
      // SQL Server prefers 'YYYY-MM-DD HH:MM:SS.mmm'
      return value.toISOString().slice(0, 23).replace('T', ' ');
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
   * ✅ SQL SERVER: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    const typeMap: Record<string, string> = {
      // String types
      string: length ? `NVARCHAR(${length})` : "NVARCHAR(255)",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "NVARCHAR(MAX)",
      char: length ? `CHAR(${length})` : "CHAR(1)",

      // Number types
      number: "DECIMAL(18,2)",
      integer: "INT",
      int: "INT",
      bigint: "BIGINT",
      float: "FLOAT",
      double: "FLOAT(53)",
      decimal: "DECIMAL",
      numeric: "NUMERIC",

      // Boolean → BIT
      boolean: "BIT",
      bool: "BIT",

      // Date/Time
      date: "DATE",
      datetime: "DATETIME2",
      timestamp: "DATETIME2",
      time: "TIME",

      // JSON → NVARCHAR(MAX) (SQL Server 2016+ có FOR JSON)
      json: "NVARCHAR(MAX)",
      jsonb: "NVARCHAR(MAX)",
      array: "NVARCHAR(MAX)",
      object: "NVARCHAR(MAX)",

      // Others
      uuid: "UNIQUEIDENTIFIER",
      binary: "VARBINARY(MAX)",
      blob: "VARBINARY(MAX)",
    };

    return typeMap[fieldType.toLowerCase()] || "NVARCHAR(255)";
  }

  /**
   * ✅ SQL SERVER: Xử lý kết quả INSERT
   * SQL Server hỗ trợ OUTPUT INSERTED.*
   */
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    // Nếu có OUTPUT INSERTED.*, result sẽ chứa row
    if (result.rows && result.rows.length > 0) {
      return result.rows[0];
    }

    // Fallback: Query lại bằng SCOPE_IDENTITY()
    const pkField = primaryKeys?.[0] || "id";
    
    // Lấy SCOPE_IDENTITY() (last inserted ID)
    const identityQuery = `SELECT SCOPE_IDENTITY() AS id`;
    const identityResult = await this.executeRaw(identityQuery);
    const lastInsertId = identityResult.rows[0]?.id;

    if (!lastInsertId) {
      return data;
    }

    // Query lại bản ghi
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = @p1`;

    const selectResult = await this.executeRaw(query, [lastInsertId]);
    return selectResult.rows?.[0] || { ...data, [pkField]: lastInsertId };
  }

  /**
   * ✅ SQL SERVER: Placeholder = @p1, @p2, @p3...
   */
  protected getPlaceholder(index: number): string {
    return `@p${index}`;
  }

  // ==========================================
  // SQL SERVER-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Not connected to SQL Server");
    
    const request = this.pool.request();
    
    // Bind parameters
    params?.forEach((param, index) => {
      request.input(`p${index + 1}`, param);
    });
    
    const result = await request.query(query);
    
    return {
      rows: result.recordset || [],
      rowCount: result.rowsAffected?.[0] || 0,
      rowsAffected: result.rowsAffected?.[0] || 0,
    };
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @p1`;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.count > 0;
  }

  async getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @p1
      ORDER BY ORDINAL_POSITION
    `;
    const result = await this.executeRaw(query, [tableName]);
    if (result.rows.length === 0) return null;

    const cols = result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === "YES",
      default: row.COLUMN_DEFAULT,
    }));

    return { name: tableName, cols };
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    return `${name} ${type} IDENTITY(1,1)`;
  }

  // ==========================================
  // OVERRIDE INSERT ONE (với OUTPUT INSERTED.*)
  // ==========================================

  /**
   * 🔄 OVERRIDE: SQL Server hỗ trợ OUTPUT INSERTED.*
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize all values
    const values = Object.values(data).map((v) => this.sanitizeValue(v));

    const placeholders = keys.map((_, i) => `@p${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // SQL Server hỗ trợ OUTPUT INSERTED.*
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) OUTPUT INSERTED.* VALUES (${placeholders})`;

    const result = await this.executeRaw(query, values);

    // ✅ Process result
    return this.processInsertResult(tableName, result, data, ["id"]);
  }
}
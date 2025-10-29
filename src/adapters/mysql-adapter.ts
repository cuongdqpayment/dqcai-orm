// ========================
// src/adapters/mysql-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.MYSQL_ADAPTER);

export class MySQLAdapter extends BaseAdapter {
  type: DatabaseType = "mysql";
  databaseType: DatabaseType = "mysql";
  private pool: any = null;

  // chuyển các hàm của hỗ trợ sang adapter để được sử dụng khi gọi thay vì gọi trong connection
  isSupported(): boolean {
    // Nếu đã connect → supported
    if (this.pool || this.isConnected()) {
      return true;
    }

    logger.trace("Checking MySQL support");

    try {
      require.resolve("mysql2");
      logger.debug("MySQL module 'mysql2' is supported");

      return true;
    } catch {
      logger.debug("MySQL module 'mysql2' is not supported");

      return false;
    }
  }
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
    logger.trace("Sanitizing value", { valueType: typeof value });

    // Handle null/undefined
    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    // Handle Date objects → MySQL datetime format
    if (value instanceof Date) {
      const formattedDate = value.toISOString().slice(0, 19).replace("T", " ");
      logger.trace("Converted Date to MySQL datetime format");
      return formattedDate;
    }

    // Handle boolean → 1/0
    if (typeof value === "boolean") {
      const numericValue = value ? 1 : 0;
      logger.trace("Converted Boolean to numeric", {
        original: value,
        converted: numericValue,
      });
      return numericValue;
    }

    // Handle arrays/objects → JSON stringify
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      logger.trace("Converted object/array to JSON string", {
        length: jsonString.length,
      });
      return jsonString;
    }

    // Handle strings (escape)
    if (typeof value === "string") {
      const escapedValue = value.replace(/'/g, "''");
      logger.trace("Escaped string value");
      return escapedValue;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  /**
   * ✅ MYSQL: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to MySQL", { fieldType, length });

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

    const mappedType = typeMap[fieldType.toLowerCase()] || "VARCHAR(255)";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
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
    logger.debug("Processing insert result", {
      tableName,
      hasInsertId: !!result.insertId,
    });

    // MySQL trả về insertId
    const lastInsertId = result.insertId;

    if (!lastInsertId) {
      logger.warn("No insert ID available, returning original data");
      return data; // Fallback nếu không có ID
    }

    // Query lại bản ghi vừa insert
    const pkField = primaryKeys?.[0] || "id";
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

    logger.trace("Executing select query for inserted record", {
      pkField,
      lastInsertId,
    });

    const selectResult = await this.executeRaw(query, [lastInsertId]);
    const insertedRecord = selectResult.rows?.[0] || {
      ...data,
      [pkField]: lastInsertId,
    };

    logger.trace("Insert result processed", {
      tableName,
      pkField,
      lastInsertId,
    });

    return insertedRecord;
  }

  /**
   * ✅ MYSQL: Placeholder = ?
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting MySQL placeholder", { index });
    return "?";
  }

  // ==========================================
  // MYSQL-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw MySQL query", {
      querySnippet:
        query.substring(0, Math.min(100, query.length)) +
        (query.length > 100 ? "..." : ""),
      paramsCount: params?.length || 0,
    });

    if (!this.pool) {
      logger.error("Not connected to MySQL");
      throw new Error("Not connected to MySQL");
    }

    const [rows, fields] = await this.pool.query(query, params);

    // Xử lý kết quả
    if (Array.isArray(rows)) {
      const result = {
        rows,
        rowCount: rows.length,
        rowsAffected: rows.length,
      };
      logger.trace("SELECT query executed", { rowCount: rows.length });
      return result;
    } else {
      // INSERT/UPDATE/DELETE result
      const result = {
        rows: [],
        rowCount: (rows as any).affectedRows || 0,
        rowsAffected: (rows as any).affectedRows || 0,
        insertId: (rows as any).insertId,
      };
      logger.trace("Non-SELECT query executed", {
        affectedRows: result.rowsAffected,
        insertId: result.insertId,
      });
      return result;
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });

    const query = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = ?
    `;
    const result = await this.executeRaw(query, [tableName]);
    const exists = result.rows[0]?.count > 0;

    logger.trace("Table existence check result", { tableName, exists });

    return exists;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.debug("Getting table info", { tableName });

    const query = `
      SELECT column_name, data_type, is_nullable, column_default, column_key
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      AND table_name = ?
      ORDER BY ordinal_position
    `;
    const result = await this.executeRaw(query, [tableName]);
    if (result.rows.length === 0) {
      logger.debug("No table info found", { tableName });
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      default: row.column_default,
      primaryKey: row.column_key === "PRI",
    }));

    const tableInfo = { name: tableName, cols };

    logger.debug("Table info retrieved", {
      tableName,
      columnCount: cols.length,
    });

    return tableInfo;
  }

  // ==========================================
  // OVERRIDE INSERT ONE (không có RETURNING)
  // ==========================================

  /**
   * 🔄 OVERRIDE: MySQL không hỗ trợ RETURNING
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", {
      tableName,
      dataKeys: Object.keys(data),
    });

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

    logger.trace("Executing insert query", {
      tableName,
      keyCount: keys.length,
      placeholderCount: placeholders.split(",").length,
    });

    const result = await this.executeRaw(query, values);

    // ✅ Process result (query lại)
    const insertedRecord = await this.processInsertResult(
      tableName,
      result,
      data,
      ["id"]
    );

    logger.info("Inserted one record successfully", {
      tableName,
      insertedId: insertedRecord.id,
    });

    return insertedRecord;
  }
}

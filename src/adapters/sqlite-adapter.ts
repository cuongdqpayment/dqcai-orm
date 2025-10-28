// ========================
// src/adapters/sqlite-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, EntitySchemaDefinition } from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.SQLITE3_ADAPTER);

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
    logger.trace("Sanitizing value", { valueType: typeof value, value: value });

    // Handle null/undefined
    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    // Handle Date objects → ISO String
    if (value instanceof Date) {
      const isoString = value.toISOString();
      logger.trace("Converted Date to ISO string");
      return isoString;
    }

    // Handle boolean → 1/0
    if (typeof value === "boolean") {
      const numericValue = value ? 1 : 0;
      logger.trace("Converted Boolean to numeric", { original: value, converted: numericValue });
      return numericValue;
    }

    // Handle arrays/objects → JSON stringify
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      logger.trace("Converted object/array to JSON string", { length: jsonString.length });
      return jsonString;
    }

    // Handle strings (escape single quotes)
    if (typeof value === "string") {
      const escapedValue = value.replace(/'/g, "''");
      logger.trace("Escaped string value");
      return escapedValue;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  /**
   * ✅ SQLITE: Ánh xạ kiểu dữ liệu
   * SQLite chỉ có: NULL, INTEGER, REAL, TEXT, BLOB
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to SQLite", { fieldType, length });

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

    const mappedType = typeMap[fieldType.toLowerCase()] || "TEXT";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
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
    logger.debug("Processing insert result", { 
      tableName, 
      hasLastInsertId: !!result.lastInsertId || !!result.lastInsertRowid 
    });

    const lastInsertId = result.lastInsertId || result.lastInsertRowid;

    if (!lastInsertId) {
      logger.warn("No last insert ID available, returning original data");
      return data; // Fallback nếu không có ID
    }

    // Query lại bản ghi vừa insert
    const pkField = primaryKeys?.[0] || "id";
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

    logger.trace("Executing select query for inserted record", { pkField, lastInsertId });

    const selectResult = await this.executeRaw(query, [lastInsertId]);
    const insertedRecord = selectResult.rows?.[0] || { ...data, [pkField]: lastInsertId };

    logger.trace("Insert result processed", { 
      tableName, 
      pkField, 
      lastInsertId 
    });

    return insertedRecord;
  }

  /**
   * ✅ SQLITE: Placeholder = ?
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting SQLite placeholder", { index });
    return "?";
  }

  // ==========================================
  // SQLITE-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw SQLite query", { 
      querySnippet: query.substring(0, Math.min(100, query.length)) + (query.length > 100 ? '...' : ''), 
      paramsCount: params?.length || 0 
    });

    if (!this.db) {
      logger.error("Not connected to SQLite");
      throw new Error("Not connected to SQLite");
    }

    // Sanitize params trước khi execute
    const sanitizedParams = params?.map((p) => this.sanitizeValue(p));

    if (query.trim().toUpperCase().startsWith("SELECT")) {
      logger.trace("Executing SELECT query");
      const rows = this.db.prepare(query).all(sanitizedParams);
      const result = { rows, rowCount: rows.length };
      logger.trace("SELECT query executed", { rowCount: rows.length });
      return result;
    } else {
      logger.trace("Executing non-SELECT query");
      const info = this.db.prepare(query).run(sanitizedParams);
      const result = {
        rows: [],
        rowCount: info.changes,
        rowsAffected: info.changes,
        lastInsertId: info.lastInsertRowid,
        lastInsertRowid: info.lastInsertRowid,
      };
      logger.trace("Non-SELECT query executed", { 
        changes: info.changes, 
        lastInsertRowid: info.lastInsertRowid 
      });
      return result;
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });

    const query = `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`;
    const result = await this.executeRaw(query, [tableName]);
    const exists = result.rows[0]?.count > 0;

    logger.trace("Table existence check result", { tableName, exists });

    return exists;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.debug("Getting table info", { tableName });

    const query = `PRAGMA table_info(${tableName})`;
    const result = await this.executeRaw(query);
    if (result.rows.length === 0) {
      logger.debug("No table info found");
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      default: row.dflt_value,
      primaryKey: row.pk === 1,
    }));

    const tableInfo = { name: tableName, cols };

    logger.debug("Table info retrieved", { 
      tableName, 
      columnCount: cols.length 
    });

    return tableInfo;
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    logger.trace("Building auto-increment column", { name, type });
    const autoIncrementColumn = `${name} INTEGER PRIMARY KEY AUTOINCREMENT`;
    logger.trace("Auto-increment column built", { autoIncrementColumn });
    return autoIncrementColumn;
  }

  // ==========================================
  // OVERRIDE INSERT ONE (với RETURNING fallback)
  // ==========================================

  /**
   * 🔄 OVERRIDE: SQLite cần xử lý đặc biệt cho RETURNING
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", { 
      tableName, 
      dataKeys: Object.keys(data) 
    });

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

    logger.trace("Executing insert query", { 
      tableName, 
      keyCount: keys.length,
      placeholderCount: placeholders.split(',').length 
    });

    const result = await this.executeRaw(query, values);

    // ✅ Process result (query lại)
    const insertedRecord = await this.processInsertResult(tableName, result, data, ["id"]);

    logger.info("Inserted one record successfully", { 
      tableName, 
      insertedId: insertedRecord.id 
    });

    return insertedRecord;
  }
}
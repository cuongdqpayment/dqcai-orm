// ========================
// src/adapters/postgresql-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import {
  DatabaseType,
  EntitySchemaDefinition,
  IConnection,
} from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";
import { createModuleLogger, ORMModules } from "../logger";
import { PostgreSQLConfig } from "../types";
const logger = createModuleLogger(ORMModules.POSTGRESQL_ADAPTER);

export class PostgreSQLAdapter extends BaseAdapter {
  type: DatabaseType = "postgresql";
  databaseType: DatabaseType = "postgresql";
  private pool: any = null;

  /*
  Chuyển 2 hàm isSupported và connect về luôn Adapter, không cần tạo connection nữa
  */
  isSupported(): boolean {
    // Nếu đã connect → supported
    if (this.pool || this.isConnected()) {
      return true;
    }

    logger.trace("Checking PostgreSQL support");

    try {
      require.resolve("pg");
      logger.debug("PostgreSQL module 'pg' is supported");

      return true;
    } catch {
      logger.debug("PostgreSQL module 'pg' is not supported");

      return false;
    }
  }

  async connect(config: PostgreSQLConfig): Promise<IConnection> {
    logger.debug("Connecting to PostgreSQL", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 5432,
    });

    try {
      logger.trace("Dynamically importing 'pg' module");

      const { Pool } = await import("pg");

      logger.trace("Creating PostgreSQL Pool instance");

      const pool = new Pool(config as any);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing PostgreSQL connection pool");
          await pool.end();
        },
      };

      this.pool = pool;
      this.connection = connection;
      this.config = config;

      logger.info("PostgreSQL connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 5432,
      });

      return connection;
    } catch (error) {
      logger.error("PostgreSQL connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 5432,
        error: (error as Error).message,
      });

      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }
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
    logger.trace("Sanitizing value", { valueType: typeof value });

    // Handle null/undefined
    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    // PostgreSQL hỗ trợ Date native, nhưng để đồng nhất ta convert
    if (value instanceof Date) {
      const isoString = value.toISOString();
      logger.trace("Converted Date to ISO string");
      return isoString;
    }

    // Boolean: Postgres hỗ trợ native
    if (typeof value === "boolean") {
      logger.trace("Value is Boolean, keeping native");
      return value;
    }

    // Arrays/Objects → JSON
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      logger.trace("Converted object/array to JSON string", {
        length: jsonString.length,
      });
      return jsonString;
    }

    // Strings: escape single quotes
    if (typeof value === "string") {
      const escapedValue = value.replace(/'/g, "''");
      logger.trace("Escaped string value");
      return escapedValue;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  /**
   * ✅ POSTGRESQL: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to PostgreSQL", { fieldType, length });

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

    const mappedType = typeMap[fieldType.toLowerCase()] || "TEXT";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
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
    logger.trace("Processing insert result", {
      tableName,
      hasRows: !!result.rows?.length,
    });

    // PostgreSQL trả về row trực tiếp qua RETURNING *
    const processedResult = result.rows?.[0] || data;

    logger.trace("Insert result processed", {
      tableName,
      resultKeys: Object.keys(processedResult),
    });

    return processedResult;
  }

  /**
   * ✅ POSTGRESQL: Placeholder = $1, $2, $3...
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting PostgreSQL placeholder", { index });
    return `${index}`;
  }

  // ==========================================
  // POSTGRESQL-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw PostgreSQL query", {
      querySnippet:
        query.substring(0, Math.min(100, query.length)) +
        (query.length > 100 ? "..." : ""),
      paramsCount: params?.length || 0,
    });

    if (!this.pool) {
      logger.error("Not connected to PostgreSQL");
      throw new Error("Not connected to PostgreSQL");
    }
    const result = await this.pool.query(query, params);
    logger.trace("Raw query executed", {
      rowCount: result.rowCount,
      command: result.command,
    });

    return result;
  }

  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });

    const query = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1) as exists`;
    const result = await this.executeRaw(query, [tableName]);
    const exists = result.rows[0]?.exists || false;

    logger.trace("Table existence check result", { tableName, exists });

    return exists;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.debug("Getting table info", { tableName });

    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
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
    }));

    const tableInfo = { name: tableName, cols };

    logger.debug("Table info retrieved", {
      tableName,
      columnCount: cols.length,
    });

    return tableInfo;
  }

  // ==========================================
  // OVERRIDE INSERT ONE (với RETURNING *)
  // ==========================================

  /**
   * 🔄 OVERRIDE: PostgreSQL hỗ trợ RETURNING *
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

    const placeholders = keys.map((_, i) => `${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // PostgreSQL hỗ trợ RETURNING *
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;

    logger.trace("Executing insert query", {
      tableName,
      keyCount: keys.length,
      placeholderCount: placeholders.split(",").length,
    });

    const result = await this.executeRaw(query, values);

    // ✅ Process result
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

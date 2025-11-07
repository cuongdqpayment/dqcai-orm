// ========================
// src/adapters/sqlite-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import {
  DatabaseType,
  EntitySchemaDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  SchemaDefinition,
} from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";
import { createModuleLogger, ORMModules } from "../logger";
import { SQLiteConfig } from "../types";
import { log } from "console";
const logger = createModuleLogger(ORMModules.SQLITE_ADAPTER);

export class SQLiteAdapter extends BaseAdapter {
  type: DatabaseType = "sqlite";
  databaseType: DatabaseType = "sqlite";
  private db: any = null;

  /*
  Chuyển 2 hàm isSupported và connect về luôn Adapter, không cần tạo connection nữa
  */
  isSupported(): boolean {
    // Nếu đã connect → supported
    if (this.db || this.isConnected()) {
      return true;
    }

    // Check better-sqlite3
    try {
      require.resolve("better-sqlite3");
      return true;
    } catch {
      // Check sqlite3 (fallback)
      try {
        require.resolve("sqlite3");
        return true;
      } catch {
        return false;
      }
    }
  }

  async connect(config: SQLiteConfig): Promise<IConnection> {
    logger.debug("Connecting to SQLite", {
      database: config.database,
      memory: config.memory,
      dbDirectory: config.dbDirectory,
    });

    try {
      logger.trace("Dynamically importing better-sqlite3");

      const Database = (await import("better-sqlite3")).default;
      const filename = config.memory
        ? ":memory:"
        : config.filename ||
          `${config.dbDirectory || "."}/${config.database || "database"}.db`;

      logger.trace("Creating SQLite database", { filename });

      const db = new Database(filename);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: db,
        isConnected: true,
        close: async () => {
          logger.trace("Closing SQLite connection");
          db.close();
        },
      };

      this.db = db;
      this.connection = connection;
      this.config = config;

      logger.info("SQLite connection established successfully", {
        database: config.database,
        filename,
        memory: config.memory,
      });

      return connection;
    } catch (error) {
      logger.error("SQLite connection failed", {
        database: config.database,
        memory: config.memory,
        error: (error as Error).message,
      });

      throw new Error(`SQLite connection failed: ${error}`);
    }
  }
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
    // logger.trace("Mapping field type to SQLite", { fieldType, length });

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
    // logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
  }

  /**
   * ✅ SQLITE: Xử lý kết quả INSERT
   * SQLite không hỗ trợ RETURNING, phải query lại
   */
  // sqlite-adapter.ts
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    logger.debug("Processing insert result", {
      tableName,
      hasLastInsertId: !!result.lastInsertId || !!result.lastInsertRowid,
    });

    const lastInsertId = result.lastInsertId || result.lastInsertRowid;

    let pkField: string;

    if (primaryKeys && primaryKeys.length > 0) {
      pkField = primaryKeys[0];
    } else {
      // ✅ Tìm PK trong data (ưu tiên các pattern phổ biến)
      const possiblePKs = Object.keys(data).filter((key) => {
        const lowerKey = key.toLowerCase();
        return (
          lowerKey === "id" ||
          lowerKey.endsWith("_id") ||
          lowerKey.endsWith("_name") ||
          lowerKey.endsWith("_code") ||
          lowerKey.includes("primary")
        );
      });

      if (possiblePKs.length > 0) {
        pkField = possiblePKs[0];
        logger.debug("Auto-detected primary key from data", {
          tableName,
          pkField,
          possibleKeys: possiblePKs,
        });
      } else {
        // Fallback: dùng key đầu tiên
        pkField = Object.keys(data)[0] || "id";
        logger.warn("Could not detect primary key, using first field", {
          tableName,
          pkField,
        });
      }
    }

    const pkValue = data[pkField];

    // ✅ CASE 1: Không có lastInsertId (ví dụ: UUID, string PK)
    if (!lastInsertId) {
      logger.debug("No lastInsertId, using data value", {
        tableName,
        pkField,
        pkValue,
      });

      if (pkValue !== undefined) {
        try {
          const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
            tableName,
            this.type
          )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

          logger.trace("Querying inserted record by data PK", {
            pkField,
            pkValue,
          });

          const selectResult = await this.executeRaw(query, [pkValue]);
          return selectResult.rows?.[0] || data;
        } catch (error) {
          logger.warn(
            "Failed to query inserted record, returning original data",
            {
              tableName,
              error: (error as Error).message,
            }
          );
          return data;
        }
      }

      logger.warn("No PK value in data, returning original data", {
        tableName,
      });
      return data;
    }

    // ✅ CASE 2: Có lastInsertId NHƯNG PK là string (như UUID)
    // → Không thể dùng lastInsertId để query
    if (typeof pkValue === "string" && pkValue !== String(lastInsertId)) {
      logger.debug(
        "PK is string type, using data value instead of lastInsertId",
        {
          tableName,
          pkField,
          pkValue,
          lastInsertId,
        }
      );

      try {
        const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
          tableName,
          this.type
        )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

        logger.trace("Querying inserted record by data PK (string)", {
          pkField,
          pkValue,
        });

        const selectResult = await this.executeRaw(query, [pkValue]);
        return selectResult.rows?.[0] || data;
      } catch (error) {
        logger.warn(
          "Failed to query inserted record, returning original data",
          {
            tableName,
            error: (error as Error).message,
          }
        );
        return data;
      }
    }

    // ✅ CASE 3: Có lastInsertId VÀ PK là numeric → Dùng lastInsertId
    try {
      const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = ?`;

      logger.trace("Querying inserted record by lastInsertId", {
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
    } catch (error) {
      logger.warn("Failed to query by lastInsertId, returning data with ID", {
        tableName,
        error: (error as Error).message,
      });
      return {
        ...data,
        [pkField]: lastInsertId,
      };
    }
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
      query,
      params,
    });

    if (!this.db) {
      logger.error("Not connected to SQLite");
      throw new Error("Not connected to SQLite");
    }

    // Sanitize params trước khi execute
    const hasParams = params && params.length > 0;
    const sanitizedParams = hasParams
      ? params.map((p) => this.sanitizeValue(p))
      : undefined;

    try {
      const upperQuery = query.trim().toUpperCase();
      const isSelect = upperQuery.startsWith("SELECT");
      const isPragma = upperQuery.startsWith("PRAGMA ");

      if (isSelect) {
        // SELECT query: Always returns rows
        logger.trace("Executing SELECT query");
        const rows = hasParams
          ? this.db.prepare(query).all(sanitizedParams)
          : this.db.prepare(query).all();
        logger.trace("Query execution SELECT result", { rows });
        return { rows, rowCount: rows.length };
      } else if (isPragma) {
        // PRAGMA: Distinguish between Query (no '=') and Statement (with '=')
        const trimmedQuery = query.trim();
        const hasEquals = trimmedQuery.includes("=");
        const queryType = hasEquals ? "PRAGMA Statement" : "PRAGMA Query";

        logger.trace(`Executing ${queryType} query`);

        if (hasEquals) {
          // PRAGMA Statement: Use .run() (no rows returned)
          const info = hasParams
            ? this.db.prepare(query).run(sanitizedParams)
            : this.db.prepare(query).run();
          logger.trace("Query execution PRAGMA Statement result", { info });
          return {
            rows: [],
            rowCount: info.changes,
            rowsAffected: info.changes,
            lastInsertId: info.lastInsertRowid,
            lastInsertRowid: info.lastInsertRowid,
          };
        } else {
          // PRAGMA Query: Use .all() (returns rows)
          const rows = hasParams
            ? this.db.prepare(query).all(sanitizedParams)
            : this.db.prepare(query).all();
          logger.trace("Query execution PRAGMA Query result", { rows });
          return { rows, rowCount: rows.length };
        }
      } else {
        // Non-SELECT, non-PRAGMA query (INSERT, UPDATE, DELETE, CREATE, etc.)
        logger.trace("Executing non-SELECT query");
        const info = hasParams
          ? this.db.prepare(query).run(sanitizedParams)
          : this.db.prepare(query).run();

        logger.trace("Query execution RUN result", { info });

        return {
          rows: [],
          rowCount: info.changes,
          rowsAffected: info.changes,
          lastInsertId: info.lastInsertRowid,
          lastInsertRowid: info.lastInsertRowid,
        };
      }
    } catch (error) {
      logger.error("Query execution failed", {
        query: query.substring(0, 200),
        hasParams,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
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
      columnCount: cols.length,
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
  // OVERRIDE DLL methodes
  // ==========================================

  // Trong file: sqlite-adapter.ts
  // Override createTable để xử lý foreign keys đúng cách cho SQLite

  async createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[]
  ): Promise<void> {
    logger.debug("Creating SQLite table with foreign keys", { tableName });

    this.ensureConnected();

    // ⚠️ Bật PRAGMA foreign_keys cho SQLite
    await this.executeRaw("PRAGMA foreign_keys = ON", []);

    const columns: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      columns.push(columnDef);
    }

    // ✅ Build inline foreign key constraints
    const constraints = this.buildInlineConstraints(
      tableName,
      foreignKeys || []
    );
    const allColumns = [...columns, ...constraints].join(", ");

    const query = this.buildCreateTableQuery(tableName, allColumns);

    await this.executeRaw(query, []);

    logger.info("SQLite table created with foreign keys", {
      tableName,
      foreignKeyCount: constraints.length,
    });
  }

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (SQLite)", {
      tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const indexName =
      indexDef.name || `idx_${tableName}_${indexDef.fields.join("_")}`;
    const unique = indexDef.unique ? "UNIQUE " : "";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");

    const query = `CREATE ${unique}INDEX IF NOT EXISTS ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(tableName, this.type)} (${fields})`;

    await this.executeRaw(query, []);
    logger.info("Index created successfully (SQLite)", {
      tableName,
      indexName,
    });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (SQLite)", { tableName, indexName });
    this.ensureConnected();

    const query = `DROP INDEX IF EXISTS ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )}`;
    await this.executeRaw(query, []);
    logger.info("Index dropped successfully (SQLite)", {
      tableName,
      indexName,
    });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.warn(
      "SQLite does not support adding foreign keys to existing tables",
      { tableName }
    );
    throw new Error(
      "SQLite does not support ALTER TABLE ADD FOREIGN KEY. Foreign keys must be defined during table creation."
    );
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.warn("SQLite does not support dropping foreign keys", { tableName });
    throw new Error(
      "SQLite does not support ALTER TABLE DROP FOREIGN KEY. You need to recreate the table."
    );
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (SQLite)", { tableName });
    this.ensureConnected();

    const query = `PRAGMA foreign_key_list(${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )})`;
    const result = await this.executeRaw(query, []);

    return (result.rows || []).map((row: any) => ({
      constraintName: `fk_${tableName}_${row.from}`,
      columnName: row.from,
      referencedTable: row.table,
      referencedColumn: row.to,
      onDelete: row.on_delete || "NO ACTION",
      onUpdate: row.on_update || "NO ACTION",
    }));
  }

  async alterTable(
    tableName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    logger.warn("SQLite has limited ALTER TABLE support", { tableName });

    // SQLite chỉ hỗ trợ ADD COLUMN và RENAME
    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD COLUMN ${columnDef}`;

      try {
        await this.executeRaw(query, []);
        logger.info("Column added successfully (SQLite)", {
          tableName,
          fieldName,
        });
      } catch (error: any) {
        logger.error("Failed to alter table (SQLite)", {
          tableName,
          error: error.message,
        });
        throw error;
      }
    }
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

    // SQLite 3.35.0+ hỗ trợ RETURNING, nhưng để an toàn ta không dùng
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

    logger.info("Inserted one record RESULT:", {
      result,
    });

    // ✅ Process result (query lại)
    const insertedRecord = await this.processInsertResult(
      tableName,
      result,
      data
      // ["id"]
    );

    logger.info("Inserted one record successfully", {
      tableName,
      insertedId: insertedRecord.id,
    });

    return insertedRecord;
  }
}

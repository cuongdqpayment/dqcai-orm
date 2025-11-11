// ========================
// src/adapters/mysql-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "@/core/base-adapter";
import {
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  SchemaDefinition,
} from "@/types/orm.types";
import { MySQLConfig } from "@/types/database-config-types";
import { QueryHelper } from "@/utils/query-helper";

import { createModuleLogger, ORMModules } from "@/logger";

const logger = createModuleLogger(ORMModules.MYSQL_ADAPTER);

export class MySQLAdapter extends BaseAdapter {
  type: DatabaseType = "mysql";
  databaseType: DatabaseType = "mysql";
  pool: any = null;

  constructor(config: DbConfig) {
    super(config);
  }

  isSupported(): boolean {
    // Đã check và cache rồi
    if (this.dbModule !== null) {
      return true;
    }

    if (this.isConnected()) {
      return true;
    }

    logger.trace("=== Checking MySQLDatabase support ===");

    // Try mysql2
    try {
      this.dbModule = this.require("mysql2");
      logger.debug("✓ Using 'mysql2' fallback module");
      return true;
    } catch (error) {
      logger.trace("✗ mysql2 module not available:", (error as Error).message);
    }

    logger.debug("✗ No MySQLDatabase modules supported");
    return false;
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    this.dbName = schemaKey || this.dbConfig.database || "default";
    const config = {
      ...this.dbConfig,
      database: this.dbName,
    } as MySQLConfig;

    logger.debug("Connecting to MySQL", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 3306,
    });

    try {
      logger.trace("Dynamically importing 'mysql2/promise' module");
      const mysql = await import("mysql2/promise");

      // ✅ STEP 1: Connect to default database to check/create target database
      logger.trace("Checking if target database exists");
      const checkPool = mysql.createPool({
        ...config,
        database: undefined, // ⚠️ Connect without specifying database
      } as any);

      try {
        // Check if database exists
        const [rows] = await checkPool.query(
          "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
          [config.database]
        );

        if ((rows as any[]).length === 0) {
          // ✅ Database doesn't exist, create it
          logger.info("Target database does not exist, creating it", {
            database: config.database,
          });

          // ⚠️ Escape database name to prevent SQL injection
          const safeDatabaseName = config.database?.replace(
            /[^a-zA-Z0-9_]/g,
            ""
          );
          await checkPool.query(`CREATE DATABASE \`${safeDatabaseName}\``);

          logger.info("Database created successfully", {
            database: config.database,
          });
        } else {
          logger.trace("Target database already exists", {
            database: config.database,
          });
        }
      } finally {
        await checkPool.end();
      }

      // ✅ STEP 2: Connect to target database
      logger.trace("Creating MySQL connection pool for target database");
      const pool = mysql.createPool(config);

      logger.trace("Creating IConnection object");
      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MySQL connection pool");
          await pool.end();
        },
      };

      this.pool = pool;
      this.connection = connection;
      this.config = config;

      logger.info("MySQL connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
      });

      return connection;
    } catch (error) {
      logger.error("MySQL connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        error: (error as Error).message,
      });

      throw new Error(`MySQL connection failed: ${error}`);
    }
  }

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================
  protected sanitizeValue(value: any): any {
    logger.trace("Sanitizing value", {
      valueType: typeof value,
      isNull: value === null || value === undefined,
      isBigInt: typeof value === "bigint",
      isDate: value instanceof Date,
      isBuffer: Buffer.isBuffer(value),
    });

    if (typeof value === "bigint") {
      const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
      const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);

      if (value <= MAX_SAFE_INTEGER && value >= MIN_SAFE_INTEGER) {
        return Number(value);
      } else {
        return value.toString();
      }
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      const formattedDate = value.toISOString().slice(0, 19).replace("T", " ");
      return formattedDate;
    }

    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      return jsonString;
    }

    if (typeof value === "string") {
      const iso8601Pattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

      if (iso8601Pattern.test(value)) {
        const mysqlFormat = value
          .replace("T", " ")
          .replace(/\.\d{3}Z?$/, "")
          .replace("Z", "");
        return mysqlFormat;
      }

      const escapedValue = value.replace(/'/g, "''");
      return escapedValue;
    }

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
    logger.trace("Executing raw MySQL query", { query, params });

    if (!this.pool) {
      logger.error("Not connected to MySQL");
      throw new Error("Not connected to MySQL");
    }

    try {
      const [rows, fields] = await this.pool.query(query, params);

      // Xử lý kết quả
      if (Array.isArray(rows)) {
        const result = {
          rows,
          rowCount: rows.length,
          rowsAffected: rows.length,
        };
        logger.trace("SELECT query executed", { result });
        return result;
      } else {
        // INSERT/UPDATE/DELETE result
        const result = {
          rows: [],
          rowCount: (rows as any).affectedRows || 0,
          rowsAffected: (rows as any).affectedRows || 0,
          insertId: (rows as any).insertId,
        };
        logger.trace("Non-SELECT query executed", { result });
        return result;
      }
    } catch (error) {
      // ✅ Safe error logging
      logger.error("Query execution failed", {
        query: query.substring(0, 200),
        error: (error as Error).message,
        code: (error as any).code,
      });
      throw error;
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

  // ========================================
  // MYSQL ADAPTER - DDL Methods
  // ========================================

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (MySQL)", {
      tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const indexName =
      indexDef.name || `idx_${tableName}_${indexDef.fields.join("_")}`;
    const unique = indexDef.unique ? "UNIQUE " : "";
    const indexType = indexDef.type
      ? `USING ${indexDef.type.toUpperCase()}`
      : "";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");

    const query = `CREATE ${unique}INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ${indexType} ON ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${fields})`;

    await this.executeRaw(query, []);
    logger.info("Index created successfully (MySQL)", { tableName, indexName });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (MySQL)", { tableName, indexName });
    this.ensureConnected();

    const query = `DROP INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(tableName, this.type)}`;

    await this.executeRaw(query, []);
    logger.info("Index dropped successfully (MySQL)", { tableName, indexName });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.info("Creating foreign key (MySQL)", {
      tableName,
      constraintName: foreignKeyDef.name,
    });
    this.ensureConnected();

    const constraintName =
      foreignKeyDef.name || `fk_${tableName}_${foreignKeyDef.fields.join("_")}`;
    const columns = foreignKeyDef.fields
      .map((c) => QueryHelper.quoteIdentifier(c, this.type))
      .join(", ");
    const refColumns = foreignKeyDef.references.fields
      .map((c) => QueryHelper.quoteIdentifier(c, this.type))
      .join(", ");

    let query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} 
      ADD CONSTRAINT ${QueryHelper.quoteIdentifier(constraintName, this.type)} 
      FOREIGN KEY (${columns}) 
      REFERENCES ${QueryHelper.quoteIdentifier(
        foreignKeyDef.references.table,
        this.type
      )} (${refColumns})`;

    if (foreignKeyDef.on_delete)
      query += ` ON DELETE ${foreignKeyDef.on_delete}`;
    if (foreignKeyDef.on_update)
      query += ` ON UPDATE ${foreignKeyDef.on_update}`;

    await this.executeRaw(query, []);
    logger.info("Foreign key created successfully (MySQL)", {
      tableName,
      constraintName,
    });
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.info("Dropping foreign key (MySQL)", { tableName, foreignKeyName });
    this.ensureConnected();

    const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} 
      DROP FOREIGN KEY ${QueryHelper.quoteIdentifier(
        foreignKeyName,
        this.type
      )}`;

    await this.executeRaw(query, []);
    logger.info("Foreign key dropped successfully (MySQL)", {
      tableName,
      foreignKeyName,
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (MySQL)", { tableName });
    this.ensureConnected();

    const query = `
    SELECT
      kcu.CONSTRAINT_NAME as constraint_name,
      kcu.COLUMN_NAME as column_name,
      kcu.REFERENCED_TABLE_NAME as referenced_table,
      kcu.REFERENCED_COLUMN_NAME as referenced_column,
      rc.DELETE_RULE as delete_rule,
      rc.UPDATE_RULE as update_rule
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = ?
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.ORDINAL_POSITION
  `;

    const result = await this.executeRaw(query, [tableName]);

    return (result.rows || []).map((row: any) => ({
      constraintName: row.constraint_name,
      columnName: row.column_name,
      referencedTable: row.referenced_table,
      referencedColumn: row.referenced_column,
      onDelete: row.delete_rule,
      onUpdate: row.update_rule,
    }));
  }

  async alterTable(
    tableName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    logger.info("Altering table (MySQL)", { tableName });
    this.ensureConnected();

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD COLUMN ${columnDef}`;

      await this.executeRaw(query, []);
      logger.info("Column added successfully (MySQL)", {
        tableName,
        fieldName,
      });
    }
  }

  // OVERRIDE createTable()
  /* async createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[]
  ): Promise<void> {
    logger.debug("Creating MySQL table with foreign keys", { tableName });

    this.ensureConnected();

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

    logger.info("MySQL table created with foreign keys", {
      tableName,
      foreignKeyCount: constraints.length,
    });
  } */

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
      keyCount: Object.keys(data).length,
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
      query: query.substring(0, 200),
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

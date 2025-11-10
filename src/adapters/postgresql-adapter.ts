// ========================
// src/adapters/postgresql-adapter.ts
// ========================

import { BaseAdapter } from "@/core/base-adapter";
import {
  DatabaseType,
  EntitySchemaDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  SchemaDefinition,
} from "@/types/orm.types";
import { QueryHelper } from "@/utils/query-helper";
import { createModuleLogger, ORMModules } from "@/logger";
import { PostgreSQLConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.POSTGRESQL_ADAPTER);

export class PostgreSQLAdapter extends BaseAdapter {
  type: DatabaseType = "postgresql";
  databaseType: DatabaseType = "postgresql";
  private pool: any = null;

  constructor(config: PostgreSQLConfig) {
    super(config);
  }

  isSupported(): boolean {
    if (this.dbModule !== null) {
      return true;
    }

    if (this.pool || this.isConnected()) {
      return true;
    }

    logger.trace("Checking PostgreSQL support");

    try {
      this.dbModule = this.require("pg");
      logger.debug("PostgreSQL module 'pg' is supported");
      return true;
    } catch {
      logger.debug("PostgreSQL module 'pg' is not supported");
      return false;
    }
  }

  // ==========================================
  // POSTGRESQL-SPECIFIC: AUTO CREATE DATABASE
  // ==========================================

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    const config = {
      ...this.dbConfig,
      database: schemaKey || this.dbConfig.database, // ưu tiên lấy database thuộc schemaConfig
    } as PostgreSQLConfig;

    logger.debug("Connecting to PostgreSQL", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 5432,
    });

    try {
      logger.trace("Dynamically importing 'pg' module");
      const { Pool } = await import("pg");

      // ✅ BƯỚC 1: Kết nối vào database mặc định để kiểm tra
      logger.trace("Checking if target database exists");
      const checkPool = new Pool({
        ...config,
        database: "postgres", // ⚠️ Kết nối vào DB mặc định
      } as any);

      try {
        // Kiểm tra database có tồn tại không
        const checkResult = await checkPool.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [config.database]
        );

        if (checkResult.rows.length === 0) {
          // ✅ Database chưa tồn tại, tạo mới
          logger.info("Target database does not exist, creating it", {
            database: config.database,
          });

          // ⚠️ Không thể dùng parameterized query cho CREATE DATABASE
          // Phải escape tên database để tránh SQL injection
          const safeDatabaseName = config.database?.replace(
            /[^a-zA-Z0-9_]/g,
            ""
          );
          await checkPool.query(`CREATE DATABASE ${safeDatabaseName}`);

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

      // ✅ BƯỚC 2: Kết nối vào database đích
      logger.trace("Creating PostgreSQL Pool instance for target database");
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

  protected sanitizeValue(value: any): any {
    logger.trace("Sanitizing value", { valueType: typeof value });

    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    if (value instanceof Date) {
      const isoString = value.toISOString();
      logger.trace("Converted Date to ISO string");
      return isoString;
    }

    if (typeof value === "boolean") {
      logger.trace("Value is Boolean, keeping native");
      return value;
    }

    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      logger.trace("Converted object/array to JSON string", {
        length: jsonString.length,
      });
      return jsonString;
    }

    if (typeof value === "string") {
      // ❌ KHÔNG ESCAPE ở đây vì pg driver sẽ handle
      // PostgreSQL driver tự động escape khi dùng parameterized queries
      logger.trace("String value, returning as-is for pg driver");
      return value;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to PostgreSQL", { fieldType, length });

    const typeMap: Record<string, string> = {
      string: length ? `VARCHAR(${length})` : "TEXT",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "TEXT",
      char: length ? `CHAR(${length})` : "CHAR(1)",

      number: "NUMERIC",
      integer: "INTEGER",
      int: "INTEGER",
      bigint: "BIGINT",
      float: "REAL",
      double: "DOUBLE PRECISION",
      decimal: "DECIMAL",
      numeric: "NUMERIC",

      boolean: "BOOLEAN",
      bool: "BOOLEAN",

      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP",
      time: "TIME",

      json: "JSON",
      jsonb: "JSONB",
      array: "JSONB",
      object: "JSONB",

      uuid: "UUID",
      binary: "BYTEA",
      blob: "BYTEA",
    };

    const mappedType = typeMap[fieldType.toLowerCase()] || "TEXT";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
  }

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

    const processedResult = result.rows?.[0] || data;

    logger.trace("Insert result processed", {
      tableName,
      resultKeys: Object.keys(processedResult),
    });

    return processedResult;
  }

  /**
   * ✅ FIX: PostgreSQL sử dụng $1, $2, $3... làm placeholder
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting PostgreSQL placeholder", { index });
    return `$${index}`; // ✅ PHẢI CÓ DẤU $
  }

  // ==========================================
  // POSTGRESQL-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw PostgreSQL query", {
      query,
      params,
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

  // ========================================
  // POSTGRESQL ADAPTER - DDL Methods
  // ========================================

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (PostgreSQL)", {
      tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const indexName =
      indexDef.name || `idx_${tableName}_${indexDef.fields.join("_")}`;
    const unique = indexDef.unique ? "UNIQUE " : "";
    const method = indexDef.type ? `USING ${indexDef.type.toUpperCase()}` : "";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");

    const query = `CREATE ${unique}INDEX IF NOT EXISTS ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} ${method} (${fields})`;

    await this.executeRaw(query, []);
    logger.info("Index created successfully (PostgreSQL)", {
      tableName,
      indexName,
    });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (PostgreSQL)", { tableName, indexName });
    this.ensureConnected();

    const query = `DROP INDEX IF EXISTS ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )}`;
    await this.executeRaw(query, []);
    logger.info("Index dropped successfully (PostgreSQL)", {
      tableName,
      indexName,
    });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.info("Creating foreign key (PostgreSQL)", {
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
    logger.info("Foreign key created successfully (PostgreSQL)", {
      tableName,
      constraintName,
    });
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.info("Dropping foreign key (PostgreSQL)", {
      tableName,
      foreignKeyName,
    });
    this.ensureConnected();

    const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} 
    DROP CONSTRAINT IF EXISTS ${QueryHelper.quoteIdentifier(
      foreignKeyName,
      this.type
    )}`;

    await this.executeRaw(query, []);
    logger.info("Foreign key dropped successfully (PostgreSQL)", {
      tableName,
      foreignKeyName,
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (PostgreSQL)", { tableName });
    this.ensureConnected();

    const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS referenced_table,
      ccu.column_name AS referenced_column,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
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
    logger.info("Altering table (PostgreSQL)", { tableName });
    this.ensureConnected();

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD COLUMN ${columnDef}`;

      await this.executeRaw(query, []);
      logger.info("Column added successfully (PostgreSQL)", {
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
    logger.debug("Creating PostgreSQL table with foreign keys", { tableName });

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

    logger.info("PostgreSQL table created with foreign keys", {
      tableName,
      foreignKeyCount: constraints.length,
    });
  } */

  // ==========================================
  // ✅ OVERRIDE INSERT ONE - Sử dụng RETURNING *
  // ==========================================

  /**
   * 🔄 OVERRIDE: PostgreSQL hỗ trợ RETURNING * để lấy record vừa insert
   * ⚠️ KHÔNG tự build placeholders, dùng getPlaceholder() từ parent class
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", {
      tableName,
      dataKeys: Object.keys(data),
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize all values
    const values = keys.map((key) => this.sanitizeValue(data[key]));

    // ✅ Dùng getPlaceholder() để đảm bảo đúng format $1, $2, $3...
    const placeholders = keys
      .map((_, i) => this.getPlaceholder(i + 1))
      .join(", ");

    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // ✅ PostgreSQL hỗ trợ RETURNING * để lấy record vừa tạo
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;

    logger.trace("Executing insert query", {
      tableName,
      query: query.substring(0, 150),
      keyCount: keys.length,
      valueCount: values.length,
    });

    const result = await this.executeRaw(query, values);

    // ✅ Process result using abstract method
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

  // ==========================================
  // ✅ OVERRIDE UPDATE - PostgreSQL specific
  // ==========================================

  async update(tableName: string, filter: any, data: any): Promise<number> {
    logger.debug("Updating records", {
      tableName,
      keys: Object.keys(data),
      filter,
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize values
    const values = keys.map((key) => this.sanitizeValue(data[key]));

    // ✅ Build SET clause với $1, $2, $3...
    const setClauses = keys
      .map(
        (key, i) =>
          `${QueryHelper.quoteIdentifier(
            key,
            this.type
          )} = ${this.getPlaceholder(i + 1)}`
      )
      .join(", ");

    // ✅ Build WHERE clause với placeholder bắt đầu từ index sau SET
    const { clause, params: whereParams } = QueryHelper.buildWhereClause(
      filter,
      this.type,
      keys.length + 1
    );

    const allParams = [...values, ...whereParams];

    let query = `UPDATE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} SET ${setClauses}`;

    if (clause !== "1=1") {
      query += ` WHERE ${clause}`;
    }

    logger.trace("Executing update query", {
      tableName,
      query: query.substring(0, 150),
      paramCount: allParams.length,
    });

    const result = await this.executeRaw(query, allParams);
    const affected = result.rowCount || 0;

    if (affected === 0) {
      logger.warn("No records updated", { tableName });
    } else {
      logger.info("Updated records successfully", { tableName, affected });
    }

    return affected;
  }

  // ==========================================
  // ✅ OVERRIDE DELETE
  // ==========================================

  async delete(tableName: string, filter: any): Promise<number> {
    logger.debug("Deleting records", { tableName, filter });

    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(filter, this.type);

    let query = `DELETE FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") {
      query += ` WHERE ${clause}`;
    }

    logger.trace("Executing delete query", {
      tableName,
      query,
      paramCount: params.length,
    });

    const result = await this.executeRaw(query, params);
    const affected = result.rowCount || 0;

    if (affected === 0) {
      logger.warn("No records deleted", { tableName });
    } else {
      logger.info("Deleted records successfully", { tableName, affected });
    }

    return affected;
  }
}

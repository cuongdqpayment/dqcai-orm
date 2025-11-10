// ========================
// src/adapters/sqlserver-adapter.ts
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
  Transaction,
} from "@/types/orm.types";
import { QueryHelper } from "@/utils/query-helper";
import { createModuleLogger, ORMModules } from "@/logger";
import { SQLServerConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.SQLSERVER_ADAPTER);

export class SQLServerAdapter extends BaseAdapter {
  type: DatabaseType = "sqlserver";
  databaseType: DatabaseType = "sqlserver";
  private pool: any = null;
  /**
   * ✅ Sử dụng sql.Transaction native để tránh mismatch error
   * Dự trữ connection riêng cho transaction scope
   */
  private currentTransaction: any = null; // Native mssql Transaction object

  constructor(config: DbConfig) {
    super(config);
  }

  isSupported(): boolean {
    if (this.dbModule !== null) {
      return true;
    }

    if (this.pool || this.isConnected()) {
      return true;
    }

    logger.trace("Checking SQL Server support");

    try {
      this.dbModule = this.require("mssql");
      logger.debug("SQL Server module 'mssql' is supported");
      return true;
    } catch {
      logger.debug("SQL Server module 'mssql' is not supported");
      return false;
    }
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    const config = {
      ...this.dbConfig,
      abortTransactionOnError: true,
      database: schemaKey || this.dbConfig.database,
    } as SQLServerConfig;

    logger.debug("Connecting to SQL Server", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 1433,
    });

    try {
      logger.trace("Dynamically importing 'mssql' module");
      const sqlModule = await import("mssql");
      const sql = sqlModule.default || sqlModule;

      if (typeof sql.connect !== "function") {
        throw new Error("mssql module does not have connect method");
      }

      // ✅ STEP 1: Connect to master database to check/create target database
      logger.trace("Checking if target database exists");
      const checkConfig = {
        ...config,
        database: "master",
      };

      const checkPool = await sql.connect(checkConfig);

      try {
        const checkRequest = checkPool.request();
        checkRequest.input("dbName", sql.VarChar, config.database);

        const result = await checkRequest.query(`
          SELECT name FROM sys.databases WHERE name = @dbName
        `);

        if (result.recordset.length === 0) {
          logger.info("Target database does not exist, creating it", {
            database: config.database,
          });

          const safeDatabaseName = config.database?.replace(
            /[^a-zA-Z0-9_]/g,
            ""
          );
          await checkPool
            .request()
            .query(`CREATE DATABASE [${safeDatabaseName}]`);

          logger.info("Database created successfully", {
            database: config.database,
          });
        } else {
          logger.trace("Target database already exists", {
            database: config.database,
          });
        }
      } finally {
        await checkPool.close();
      }

      // ✅ STEP 2: Connect to target database
      logger.trace("Connecting to SQL Server pool");
      const pool = await sql.connect(config);

      logger.trace("Creating IConnection object");
      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing SQL Server connection pool");
          await pool.close();
        },
      };

      this.pool = pool;
      this.connection = connection;
      this.config = config;

      logger.info("SQL Server connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1433,
      });

      return connection;
    } catch (error) {
      logger.error("SQL Server connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1433,
        error: (error as Error).message,
      });

      throw new Error(`SQL Server connection failed: ${error}`);
    }
  }

  // ==========================================
  // 🔧 OVERRIDE: buildCreateTableQuery - FIX FOR SQL SERVER
  // ==========================================

  /**
   * ✅ SQL Server không hỗ trợ "CREATE TABLE IF NOT EXISTS"
   * Phải dùng IF NOT EXISTS với sys.tables
   */
  protected buildCreateTableQuery(tableName: string, columns: string): string {
    logger.trace("Building SQL Server CREATE TABLE query (no IF EXISTS)", {
      tableName,
    });

    const quotedTableName = QueryHelper.quoteIdentifier(tableName, this.type);

    // ✅ Tách phần constraint ra
    const constraintRegex = /(CONSTRAINT\s+\[.*?\].*?REFERENCES.*?)(?:,|$)/g;
    const constraints: string[] = [];
    let pureColumns = columns.replace(constraintRegex, (_, c) => {
      constraints.push(c.trim());
      return "";
    });

    // ✅ Loại bỏ dấu phẩy dư trước dấu ngoặc đóng
    pureColumns = pureColumns.replace(/,\s*\)/g, ")");

    // ✅ Câu lệnh CREATE TABLE (không kiểm tra tồn tại)
    let query = `CREATE TABLE ${quotedTableName} (${pureColumns});`;

    // ✅ Nếu có constraint thì thêm ALTER TABLE sau khi CREATE TABLE
    if (constraints.length > 0) {
      for (const c of constraints) {
        query += `\nALTER TABLE ${quotedTableName} ADD ${c};`;
      }
    }

    logger.trace("SQL Server CREATE TABLE query built", {
      tableName,
      queryLength: query.length,
    });

    return query;
  }

  // ==========================================
  // 🔧 OVERRIDE: formatDefaultValue - FIX DEFAULT CURRENT_TIMESTAMP
  // ==========================================

  /**
   * ✅ SQL Server không hỗ trợ DEFAULT CURRENT_TIMESTAMP
   * Phải dùng GETDATE() hoặc SYSDATETIME()
   */
  protected formatDefaultValue(value: any): string {
    logger.trace("Formatting default value for SQL Server", {
      value,
      valueType: typeof value,
    });

    if (value === null) return "NULL";

    if (typeof value === "string") {
      // ✅ FIX: Convert CURRENT_TIMESTAMP to SQL Server equivalent
      const upperValue = value.toUpperCase();

      if (upperValue === "NOW()" || upperValue === "CURRENT_TIMESTAMP") {
        logger.trace("Converting CURRENT_TIMESTAMP to SYSDATETIME()");
        return "SYSDATETIME()";
      }

      if (upperValue === "GETDATE()") {
        return "GETDATE()";
      }

      if (upperValue === "SYSDATETIME()") {
        return "SYSDATETIME()";
      }

      // Escape single quotes for string values
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }

    return String(value);
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
      const formattedDate = value.toISOString().slice(0, 23).replace("T", " ");
      logger.trace("Converted Date to SQL Server datetime format");
      return formattedDate;
    }

    if (typeof value === "boolean") {
      const numericValue = value ? 1 : 0;
      logger.trace("Converted Boolean to numeric", {
        original: value,
        converted: numericValue,
      });
      return numericValue;
    }

    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      const jsonString = JSON.stringify(value);
      logger.trace("Converted object/array to JSON string", {
        length: jsonString.length,
      });
      return jsonString;
    }

    if (typeof value === "string") {
      const escapedValue = value.replace(/'/g, "''");
      logger.trace("Escaped string value");
      return escapedValue;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to SQL Server", { fieldType, length });

    const typeMap: Record<string, string> = {
      string: length ? `NVARCHAR(${length})` : "NVARCHAR(255)",
      varchar: length ? `VARCHAR(${length})` : "VARCHAR(255)",
      text: "NVARCHAR(MAX)",
      char: length ? `CHAR(${length})` : "CHAR(1)",
      number: "DECIMAL(18,2)",
      integer: "INT",
      int: "INT",
      bigint: "BIGINT",
      float: "FLOAT",
      double: "FLOAT(53)",
      decimal: "DECIMAL",
      numeric: "NUMERIC",
      boolean: "BIT",
      bool: "BIT",
      date: "DATE",
      datetime: "DATETIME2",
      timestamp: "DATETIME2",
      time: "TIME",
      json: "NVARCHAR(MAX)",
      jsonb: "NVARCHAR(MAX)",
      array: "NVARCHAR(MAX)",
      object: "NVARCHAR(MAX)",
      uuid: "UNIQUEIDENTIFIER",
      binary: "VARBINARY(MAX)",
      blob: "VARBINARY(MAX)",
    };

    const mappedType = typeMap[fieldType.toLowerCase()] || "NVARCHAR(255)";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
  }

  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    logger.debug("Processing insert result", {
      tableName,
      hasRows: !!result.rows?.length,
    });

    if (result.rows && result.rows.length > 0) {
      const processedRow = result.rows[0];
      logger.trace("Using OUTPUT INSERTED.* row");
      return processedRow;
    }

    const pkField = primaryKeys?.[0] || "id";
    const identityQuery = `SELECT SCOPE_IDENTITY() AS id`;
    logger.trace("Executing SCOPE_IDENTITY query");
    const identityResult = await this.executeRaw(identityQuery);
    const lastInsertId = identityResult.rows[0]?.id;

    if (!lastInsertId) {
      logger.warn("No insert ID available, returning original data", {
        tableName,
      });
      return data;
    }

    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = @p1`;

    logger.trace("Executing select query for inserted record", {
      pkField,
      lastInsertId,
    });

    const selectResult = await this.executeRaw(query, [lastInsertId]);
    const insertedRecord = selectResult.rows?.[0] || {
      ...data,
      [pkField]: lastInsertId,
    };

    logger.trace("Insert result processed via fallback query", {
      tableName,
      pkField,
      lastInsertId,
    });

    return insertedRecord;
  }

  protected getPlaceholder(index: number): string {
    logger.trace("Getting SQL Server placeholder", { index });
    return `@p${index}`;
  }

  // ==========================================
  // 🔧 OVERRIDE: buildAutoIncrementColumn
  // ==========================================

  /**
   * ✅ SQL Server sử dụng IDENTITY(1,1) cho auto increment
   * ⚠️ IDENTITY phải đi kèm PRIMARY KEY
   */
  protected buildAutoIncrementColumn(
    name: string,
    type: string,
    isPrimaryKey: boolean = true
  ): string {
    logger.trace("Building auto-increment column for SQL Server", {
      name,
      type,
      isPrimaryKey,
    });

    // ✅ SQL Server: IDENTITY phải có PRIMARY KEY
    if (isPrimaryKey) {
      const column = `${name} ${type} IDENTITY(1,1) PRIMARY KEY`;
      logger.trace("Auto-increment column with PRIMARY KEY", { column });
      return column;
    } else {
      // ⚠️ SQL Server yêu cầu IDENTITY phải có index
      const column = `${name} ${type} IDENTITY(1,1) UNIQUE`;
      logger.trace("Auto-increment column with UNIQUE constraint", { column });
      return column;
    }
  }

  // ==========================================
  // SQL SERVER-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  // ==========================================
  // 🔧 OVERRIDE: executeRaw - SUPPORT TRANSACTION SCOPING
  // ==========================================

  /**
   * ✅ Nếu có currentTransaction, dùng transaction.request() thay vì pool.request()
   * Đảm bảo tất cả query trong transaction scope an toàn
   */
  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw SQL Server query", {
      query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
      params: params?.length || 0,
      inTransaction: !!this.currentTransaction,
    });

    if (!this.pool) {
      logger.error("Not connected to SQL Server");
      throw new Error("Not connected to SQL Server");
    }

    let request: any;

    if (this.currentTransaction) {
      // ✅ Dùng transaction.request() cho scope
      request = new (this.dbModule as any).Request(this.currentTransaction);
      logger.trace("Using transaction request for query");
    } else {
      // Fallback: pool.request()
      request = this.pool.request();
      logger.trace("Using pool request for query");
    }

    // Bind params
    params?.forEach((param, index) => {
      const paramName = `p${index + 1}`;
      logger.trace("Binding parameter", { paramName, paramType: typeof param });
      request.input(paramName, param);
    });

    try {
      const result = await request.query(query);

      const formattedResult = {
        rows: result.recordset || [],
        rowCount: result.rowsAffected?.[0] || 0,
        rowsAffected: result.rowsAffected?.[0] || 0,
      };

      logger.trace("Raw query executed successfully", {
        rowCount: formattedResult.rows.length,
        rowsAffected: formattedResult.rowsAffected,
        inTransaction: !!this.currentTransaction,
      });

      return formattedResult;
    } catch (error) {
      logger.error("Raw query execution failed", {
        query: query.substring(0, 100) + "...",
        error: (error as Error).message,
        inTransaction: !!this.currentTransaction,
      });
      throw error;
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });

    const query = `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @p1`;
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
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @p1
      ORDER BY ORDINAL_POSITION
    `;
    const result = await this.executeRaw(query, [tableName]);

    if (result.rows.length === 0) {
      logger.debug("No table info found", { tableName });
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === "YES",
      default: row.COLUMN_DEFAULT,
    }));

    const tableInfo = { name: tableName, cols };

    logger.debug("Table info retrieved", {
      tableName,
      columnCount: cols.length,
    });

    return tableInfo;
  }

  // ========================================
  // SQL SERVER ADAPTER - DDL Methods
  // ========================================

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (SQL Server)", {
      tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const indexName =
      indexDef.name || `idx_${tableName}_${indexDef.fields.join("_")}`;
    const unique = indexDef.unique ? "UNIQUE " : "";
    const clustered = indexDef.clustered ? "CLUSTERED " : "NONCLUSTERED ";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");

    const query = `CREATE ${unique}${clustered}INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(tableName, this.type)} (${fields})`;

    await this.executeRaw(query, []);
    logger.info("Index created successfully (SQL Server)", {
      tableName,
      indexName,
    });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (SQL Server)", { tableName, indexName });
    this.ensureConnected();

    const query = `DROP INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(tableName, this.type)}`;

    await this.executeRaw(query, []);
    logger.info("Index dropped successfully (SQL Server)", {
      tableName,
      indexName,
    });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.info("Creating foreign key (SQL Server)", {
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
    logger.info("Foreign key created successfully (SQL Server)", {
      tableName,
      constraintName,
    });
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.info("Dropping foreign key (SQL Server)", {
      tableName,
      foreignKeyName,
    });
    this.ensureConnected();

    const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} 
    DROP CONSTRAINT ${QueryHelper.quoteIdentifier(foreignKeyName, this.type)}`;

    await this.executeRaw(query, []);
    logger.info("Foreign key dropped successfully (SQL Server)", {
      tableName,
      foreignKeyName,
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (SQL Server)", { tableName });
    this.ensureConnected();

    const query = `
      SELECT
        fk.name AS constraint_name,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column,
        fk.delete_referential_action_desc AS delete_rule,
        fk.update_referential_action_desc AS update_rule
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fkc
        ON fk.object_id = fkc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = @p1
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
    logger.info("Altering table (SQL Server)", { tableName });
    this.ensureConnected();

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD ${columnDef}`;

      await this.executeRaw(query, []);
      logger.info("Column added successfully (SQL Server)", {
        tableName,
        fieldName,
      });
    }
  }

  // ==========================================
  // OVERRIDE INSERT ONE (với OUTPUT INSERTED.*)
  // ==========================================

  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", {
      tableName,
      dataKeys: Object.keys(data),
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    const values = Object.values(data).map((v) => this.sanitizeValue(v));

    const placeholders = keys.map((_, i) => `@p${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) OUTPUT INSERTED.* VALUES (${placeholders})`;

    logger.trace("Executing insert query", {
      tableName,
      keyCount: keys.length,
      placeholderCount: placeholders.split(",").length,
    });

    const result = await this.executeRaw(query, values);

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
  // 🔧 OVERRIDE: find() - FIX LIMIT/OFFSET FOR SQL SERVER
  // ==========================================

  /**
   * ✅ SQL Server không hỗ trợ LIMIT/OFFSET
   * Phải dùng TOP hoặc OFFSET...FETCH NEXT
   */
  async find(tableName: string, filter: any, options?: any): Promise<any[]> {
    logger.trace("Finding records (SQL Server)", {
      tableName,
      filter,
      options,
    });

    this.ensureConnected();

    const { clause, params } = QueryHelper.buildWhereClause(filter, this.type);
    const selectFields = QueryHelper.buildSelectFields(
      options?.select || options?.fields || [],
      this.type
    );

    let query = `SELECT ${selectFields} FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") query += ` WHERE ${clause}`;

    // ✅ Handle ORDER BY
    let hasOrderBy = false;
    if (options?.sort || options?.orderBy) {
      const orderBy = QueryHelper.buildOrderBy(
        options.sort || options.orderBy || {},
        this.type
      );
      query += ` ORDER BY ${orderBy}`;
      hasOrderBy = true;
    }

    // ✅ SQL Server PAGINATION:
    // Option 1: TOP (simple, for limit only without offset)
    // Option 2: OFFSET...FETCH NEXT (requires ORDER BY)

    const limit = options?.limit;
    const offset = options?.offset || options?.skip || 0;

    if (limit || offset > 0) {
      if (offset > 0) {
        // ✅ OFFSET...FETCH NEXT requires ORDER BY
        if (!hasOrderBy) {
          // Add default ORDER BY if not specified
          query += ` ORDER BY (SELECT NULL)`;
        }

        query += ` OFFSET ${offset} ROWS`;

        if (limit) {
          query += ` FETCH NEXT ${limit} ROWS ONLY`;
        }
      } else if (limit) {
        // ✅ Use TOP for simple limit without offset
        // Rebuild query with TOP
        query = `SELECT TOP ${limit} ${selectFields} FROM ${QueryHelper.quoteIdentifier(
          tableName,
          this.type
        )}`;

        if (clause !== "1=1") query += ` WHERE ${clause}`;

        if (hasOrderBy) {
          const orderBy = QueryHelper.buildOrderBy(
            options.sort || options.orderBy || {},
            this.type
          );
          query += ` ORDER BY ${orderBy}`;
        }
      }
    }

    logger.trace("Executing find query (SQL Server)", {
      tableName,
      query: query.substring(0, 200),
      params,
    });

    const result = await this.executeRaw(query, params);

    logger.trace("Found records (SQL Server)", {
      tableName,
      count: result.rows?.length || 0,
    });

    return result.rows || [];
  }

  // ==========================================
  // 🔧 OVERRIDE: findOne() - OPTIMIZED FOR SQL SERVER
  // ==========================================

  /**
   * ✅ Tối ưu findOne() cho SQL Server với TOP 1
   */
  async findOne(
    tableName: string,
    filter: any,
    options?: any
  ): Promise<any | null> {
    logger.trace("Finding one record (SQL Server)", { tableName, filter });

    const results = await this.find(tableName, filter, {
      ...options,
      limit: 1,
    });

    logger.trace("Found one record (SQL Server)", {
      tableName,
      found: !!results[0],
    });

    return results[0] || null;
  }

  // ==========================================
  // 🔧 OVERRIDE: count() - OPTIMIZED FOR SQL SERVER
  // ==========================================

  /**
   * ✅ SQL Server count() không có vấn đề, nhưng override để logging
   */
  async count(tableName: string, filter?: any): Promise<number> {
    logger.trace("Counting records (SQL Server)", { tableName, filter });

    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(
      filter || {},
      this.type
    );

    let query = `SELECT COUNT(*) as count FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") query += ` WHERE ${clause}`;

    const result = await this.executeRaw(query, params);
    const countValue = parseInt(result.rows?.[0]?.count || "0");

    logger.trace("Counted records (SQL Server)", {
      tableName,
      count: countValue,
    });

    return countValue;
  }

  // TRANSACTIONS
  // ==========================================
  // 🔧 OVERRIDE: beginTransaction - FIX FOR SQL SERVER
  // ==========================================

  /**
   * ✅ SQL Server sử dụng BEGIN TRANSACTION thay vì BEGIN
   * ⚠️ COMMIT và ROLLBACK có thể dùng đơn lẻ, nhưng dùng đầy đủ cho nhất quán
   */
  async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning SQL Server transaction (native API)", {
      type: this.type,
    });

    this.ensureConnected();

    try {
      const sql = this.dbModule; // mssql module đã load trong connect()
      const transaction = new sql.Transaction(this.pool);

      // Bắt đầu transaction async
      await new Promise<void>((resolve, reject) => {
        transaction.begin((err: any) => {
          if (err) {
            logger.error("Failed to begin SQL Server transaction", {
              error: err.message,
            });
            reject(err);
          } else {
            logger.trace("SQL Server transaction begun successfully");
            resolve();
          }
        });
      });

      // Gán vào currentTransaction để scoping
      this.currentTransaction = transaction;

      let active = true;

      const txObj: Transaction = {
        commit: async () => {
          if (!active) throw new Error("Transaction already completed");
          active = false;

          try {
            await new Promise<void>((resolve, reject) => {
              transaction.commit((err: any) => {
                if (err) {
                  logger.error("Failed to commit SQL Server transaction", {
                    error: err.message,
                  });
                  reject(err);
                } else {
                  logger.info("SQL Server transaction committed successfully");
                  resolve();
                }
              });
            });
          } finally {
            // Clear scoping sau commit
            this.currentTransaction = null;
          }
        },
        rollback: async () => {
          if (!active) throw new Error("Transaction already completed");
          active = false;

          try {
            await new Promise<void>((resolve, reject) => {
              transaction.rollback((err: any) => {
                if (err) {
                  logger.error("Failed to rollback SQL Server transaction", {
                    error: err.message,
                  });
                  reject(err);
                } else {
                  logger.info(
                    "SQL Server transaction rolled back successfully"
                  );
                }
                resolve(); // Luôn resolve sau rollback để cleanup
              });
            });
          } finally {
            // Clear scoping sau rollback
            this.currentTransaction = null;
          }
        },
        isActive: () => active,
      };

      // Listen for auto-rollback (nếu config abortTransactionOnError: true)
      transaction.on("rollback", (aborted: boolean) => {
        if (aborted) {
          logger.warn("SQL Server transaction auto-rolled back due to error");
          this.currentTransaction = null;
        }
      });

      return txObj;
    } catch (error) {
      logger.error("Error initializing SQL Server transaction", {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

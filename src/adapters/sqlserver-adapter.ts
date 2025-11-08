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
} from "@/types/orm.types";
import { QueryHelper } from "@/utils/query-helper";
import { createModuleLogger, ORMModules } from "@/logger";
import { SQLServerConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.SQLSERVER_ADAPTER);

export class SQLServerAdapter extends BaseAdapter {
  type: DatabaseType = "sqlserver";
  databaseType: DatabaseType = "sqlserver";
  private pool: any = null;
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
      database: schemaKey || this.dbConfig.database, // ưu tiên lấy database thuộc schemaConfig
    } as SQLServerConfig;

    logger.debug("Connecting to SQL Server", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 1433,
    });

    try {
      logger.trace("Dynamically importing 'mssql' module");

      const sql = await import("mssql");

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
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ SQL SERVER: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String hoặc SQL Server datetime format
   * - Boolean → 1/0 (BIT)
   * - Object/Array → JSON stringify (NVARCHAR(MAX))
   */
  protected sanitizeValue(value: any): any {
    logger.trace("Sanitizing value", { valueType: typeof value });

    // Handle null/undefined
    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    // Handle Date objects → SQL Server datetime format
    if (value instanceof Date) {
      const formattedDate = value.toISOString().slice(0, 23).replace("T", " ");
      logger.trace("Converted Date to SQL Server datetime format");
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
   * ✅ SQL SERVER: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to SQL Server", { fieldType, length });

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

    const mappedType = typeMap[fieldType.toLowerCase()] || "NVARCHAR(255)";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
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
    logger.debug("Processing insert result", {
      tableName,
      hasRows: !!result.rows?.length,
    });

    // Nếu có OUTPUT INSERTED.*, result sẽ chứa row
    if (result.rows && result.rows.length > 0) {
      const processedRow = result.rows[0];
      logger.trace("Using OUTPUT INSERTED.* row");
      return processedRow;
    }

    // Fallback: Query lại bằng SCOPE_IDENTITY()
    const pkField = primaryKeys?.[0] || "id";

    // Lấy SCOPE_IDENTITY() (last inserted ID)
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

    // Query lại bản ghi
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

  /**
   * ✅ SQL SERVER: Placeholder = @p1, @p2, @p3...
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting SQL Server placeholder", { index });
    return `@p${index}`;
  }

  // ==========================================
  // SQL SERVER-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw SQL Server query", {
      querySnippet:
        query.substring(0, Math.min(100, query.length)) +
        (query.length > 100 ? "..." : ""),
      paramsCount: params?.length || 0,
    });

    if (!this.pool) {
      logger.error("Not connected to SQL Server");
      throw new Error("Not connected to SQL Server");
    }

    const request = this.pool.request();

    // Bind parameters
    params?.forEach((param, index) => {
      logger.trace("Binding parameter", {
        index: index + 1,
        paramType: typeof param,
      });
      request.input(`p${index + 1}`, param);
    });

    const result = await request.query(query);

    const formattedResult = {
      rows: result.recordset || [],
      rowCount: result.rowsAffected?.[0] || 0,
      rowsAffected: result.rowsAffected?.[0] || 0,
    };

    logger.trace("Raw query executed", {
      rowCount: formattedResult.rows.length,
      rowsAffected: formattedResult.rowsAffected,
    });

    return formattedResult;
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

  protected buildAutoIncrementColumn(name: string, type: string): string {
    logger.trace("Building auto-increment column", { name, type });
    const autoIncrementColumn = `${name} ${type} IDENTITY(1,1)`;
    logger.trace("Auto-increment column built", { autoIncrementColumn });
    return autoIncrementColumn;
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
    WHERE OBJECT_NAME(fk.parent_object_id) = @tableName
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

  // OVERRIDE createTable() của base-adapter
  /* async createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[]
  ): Promise<void> {
    logger.debug("Creating SQL Server table with foreign keys", { tableName });

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

    logger.info("SQL Server table created with foreign keys", {
      tableName,
      foreignKeyCount: constraints.length,
    });
  } */

  // ==========================================
  // OVERRIDE INSERT ONE (với OUTPUT INSERTED.*)
  // ==========================================

  /**
   * 🔄 OVERRIDE: SQL Server hỗ trợ OUTPUT INSERTED.*
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

    const placeholders = keys.map((_, i) => `@p${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // SQL Server hỗ trợ OUTPUT INSERTED.*
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

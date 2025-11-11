// ========================
// src/adapters/oracle-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "@/core/base-adapter";
import {
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  FieldDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  SchemaDefinition,
} from "@/types/orm.types";
import { QueryHelper } from "@/utils/query-helper";
import { createModuleLogger, ORMModules } from "@/logger";
import { OracleConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.ORACLE_ADAPTER);

export class OracleAdapter extends BaseAdapter {
  type: DatabaseType = "oracle";
  databaseType: DatabaseType = "oracle";
  private oracledb: any = null;
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

    logger.trace("Checking Oracle support");

    try {
      this.dbModule = this.require("oracledb");
      logger.debug("Oracle module 'oracledb' is supported");

      return true;
    } catch {
      logger.debug("Oracle module 'oracledb' is not supported");

      return false;
    }
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    this.dbName = schemaKey || this.dbConfig.database || "default";
    const config = {
      ...this.dbConfig,
      database: this.dbName,
    } as OracleConfig;

    logger.debug("Connecting to Oracle", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 1521,
    });

    try {
      logger.trace("Dynamically importing 'oracledb' module");
      const oracledb = await import("oracledb");

      logger.trace("Configuring oracledb settings");
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = [oracledb.CLOB];
      oracledb.fetchAsBuffer = [oracledb.BLOB];

      const connectString = this.buildConnectString(config);

      // ✅ Oracle approach: Check/create SCHEMA (user)
      // Note: Oracle schemas are typically created by DBAs
      // We'll attempt to create tablespace if user has privileges

      logger.trace("Creating Oracle connection pool", {
        connectStringSnippet:
          connectString.substring(0, 20) +
          (connectString.length > 20 ? "..." : ""),
      });

      const pool = await oracledb.createPool({
        user: config.user || config.username,
        password: config.password,
        connectString: connectString,
        poolMin: config.poolMin || 2,
        poolMax: config.poolMax || 10,
        poolIncrement: config.poolIncrement || 1,
        poolTimeout: config.poolTimeout || 60,
        edition: config.edition,
        externalAuth: config.externalAuth,
        privilege: config.privilege,
      });

      // ✅ Optional: Try to create schema if using system/admin privileges
      if (schemaKey && config.privilege === oracledb.SYSDBA) {
        try {
          const conn = await pool.getConnection();
          try {
            // Check if user/schema exists
            const result = await conn.execute(
              `SELECT username FROM all_users WHERE username = UPPER(:1)`,
              [schemaKey]
            );

            if (result.rows && result.rows.length === 0) {
              logger.info(
                "Target schema does not exist, attempting to create",
                {
                  schema: schemaKey,
                }
              );

              // Create user/schema with basic privileges
              const safeSchemaName = schemaKey.replace(/[^a-zA-Z0-9_]/g, "");
              await conn.execute(
                `CREATE USER ${safeSchemaName} IDENTIFIED BY ${safeSchemaName}_pwd`
              );
              await conn.execute(
                `GRANT CONNECT, RESOURCE TO ${safeSchemaName}`
              );
              await conn.execute(
                `GRANT UNLIMITED TABLESPACE TO ${safeSchemaName}`
              );

              logger.info("Schema created successfully", {
                schema: schemaKey,
              });
            } else {
              logger.trace("Target schema already exists", {
                schema: schemaKey,
              });
            }
          } finally {
            await conn.close();
          }
        } catch (schemaError) {
          logger.warn(
            "Could not auto-create schema (requires DBA privileges)",
            {
              schema: schemaKey,
              error: (schemaError as Error).message,
            }
          );
        }
      }

      logger.trace("Creating IConnection object");
      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing Oracle connection pool");
          if (pool) {
            await pool.close(0);
          }
        },
      };

      this.oracledb = oracledb;
      this.pool = pool;
      this.connection = connection;
      this.config = config;

      logger.info("Oracle connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1521,
      });

      return connection;
    } catch (error) {
      logger.error("Oracle connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 1521,
        error: (error as Error).message,
      });

      throw new Error(`Oracle connection failed: ${error}`);
    }
  }

  private buildConnectString(config: any): string {
    logger.trace("Building Oracle connect string", {
      hasConnectString: !!config.connectString,
      hasServiceName: !!config.serviceName,
      hasSid: !!config.sid,
    });

    if (config.connectString) {
      logger.trace("Using provided connectString");
      return config.connectString;
    }
    if (config.connectionString) {
      logger.trace("Using provided connectionString");
      return config.connectionString;
    }

    const host = config.host || "localhost";
    const port = config.port || 1521;

    if (config.serviceName) {
      const connectString = `${host}:${port}/${config.serviceName}`;
      logger.trace("Built connect string with serviceName", {
        connectStringSnippet:
          connectString.substring(0, 20) +
          (connectString.length > 20 ? "..." : ""),
      });
      return connectString;
    }

    if (config.sid) {
      const connectString = `${host}:${port}:${config.sid}`;
      logger.trace("Built connect string with SID", {
        connectStringSnippet:
          connectString.substring(0, 20) +
          (connectString.length > 20 ? "..." : ""),
      });
      return connectString;
    }

    const defaultConnectString = `${host}:${port}/XE`;
    logger.trace("Using default connect string", { defaultConnectString });

    return defaultConnectString;
  }
  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ ORACLE: Chuyển đổi kiểu dữ liệu
   * - Date → ISO String hoặc Oracle DATE format
   * - Boolean → 1/0 (NUMBER(1))
   * - Object/Array → JSON stringify (CLOB)
   */
  protected sanitizeValue(value: any): any {
    logger.trace("Sanitizing value", { valueType: typeof value });

    // Handle null/undefined
    if (value === null || value === undefined) {
      logger.trace("Value is null/undefined, returning null");
      return null;
    }

    // Handle Date objects → Oracle DATE format
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

    // Handle arrays/objects → JSON stringify (CLOB)
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
   * ✅ ORACLE: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to Oracle", { fieldType, length });

    const typeMap: Record<string, string> = {
      // String types
      string: length ? `VARCHAR2(${length})` : "VARCHAR2(255)",
      varchar: length ? `VARCHAR2(${length})` : "VARCHAR2(255)",
      text: "CLOB",
      char: length ? `CHAR(${length})` : "CHAR(1)",

      // Number types
      number: "NUMBER",
      integer: "NUMBER(10)",
      int: "NUMBER(10)",
      bigint: "NUMBER(19)",
      float: "BINARY_FLOAT",
      double: "BINARY_DOUBLE",
      decimal: "NUMBER",
      numeric: "NUMBER",

      // Boolean → NUMBER(1)
      boolean: "NUMBER(1)",
      bool: "NUMBER(1)",

      // Date/Time
      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP",
      time: "TIMESTAMP",

      // JSON → CLOB
      json: "CLOB",
      jsonb: "CLOB",
      array: "CLOB",
      object: "CLOB",

      // Others
      uuid: "VARCHAR2(36)",
      binary: "BLOB",
      blob: "BLOB",
    };

    const mappedType = typeMap[fieldType.toLowerCase()] || "VARCHAR2(255)";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
  }

  /**
   * ✅ ORACLE: Xử lý kết quả INSERT
   * Oracle không hỗ trợ RETURNING dễ dàng, phải query lại
   */
  protected async processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    logger.debug("Processing insert result", {
      tableName,
      hasLastRowid: !!result.lastRowid || !!result.lastInsertId,
    });

    // Oracle trả về lastRowid
    const lastRowid = result.lastRowid || result.lastInsertId;

    if (!lastRowid) {
      logger.warn("No last rowid available, returning original data");
      return data; // Fallback
    }

    // Query lại bản ghi vừa insert
    const pkField = primaryKeys?.[0] || "id";
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = :1`;

    logger.trace("Executing select query for inserted record", {
      pkField,
      lastRowid,
    });

    const selectResult = await this.executeRaw(query, [lastRowid]);
    const insertedRecord = selectResult.rows?.[0] || {
      ...data,
      [pkField]: lastRowid,
    };

    logger.trace("Insert result processed", {
      tableName,
      pkField,
      lastRowid,
    });

    return insertedRecord;
  }

  /**
   * ✅ ORACLE: Placeholder = :1, :2, :3...
   */
  protected getPlaceholder(index: number): string {
    logger.trace("Getting Oracle placeholder", { index });
    return `:${index}`;
  }

  // ==========================================
  // ORACLE-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw Oracle query", {
      query,
      params,
    });

    if (!this.pool) {
      logger.error("Not connected to Oracle");
      throw new Error("Not connected to Oracle");
    }
    let conn;
    try {
      logger.trace("Getting connection from pool");
      conn = await this.pool.getConnection();
      const bindParams = this.convertParamsToBinds(params);
      const result = await conn.execute(query, bindParams, {
        outFormat: this.oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });
      const formattedResult = {
        rows: result.rows || [],
        rowsAffected: result.rowsAffected || 0,
        lastInsertId: result.lastRowid,
        lastRowid: result.lastRowid,
        metadata: result.metaData,
      };
      logger.trace("Raw query executed", {
        rowCount: formattedResult.rows.length,
        rowsAffected: formattedResult.rowsAffected,
      });
      return formattedResult;
    } catch (error) {
      logger.error("Oracle query execution failed", {
        querySnippet:
          query.substring(0, Math.min(100, query.length)) +
          (query.length > 100 ? "..." : ""),
        error: (error as Error).message,
      });
      throw new Error(`Oracle query execution failed: ${error}`);
    } finally {
      if (conn) {
        try {
          await conn.close();
          logger.trace("Connection returned to pool");
        } catch (err) {
          logger.error("Error closing Oracle connection", {
            error: (err as Error).message,
          });
        }
      }
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });

    const query = `SELECT COUNT(*) as COUNT FROM user_tables WHERE UPPER(table_name) = UPPER(:1)`;
    const result = await this.executeRaw(query, [tableName]);
    const exists = result.rows[0]?.COUNT > 0;

    logger.trace("Table existence check result", { tableName, exists });

    return exists;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.debug("Getting table info", { tableName });

    const query = `
      SELECT column_name, data_type, nullable, data_default, data_length, data_precision, data_scale
      FROM user_tab_columns
      WHERE UPPER(table_name) = UPPER(:1)
      ORDER BY column_id
    `;
    const result = await this.executeRaw(query, [tableName]);
    if (result.rows.length === 0) {
      logger.debug("No table info found", { tableName });
      return null;
    }

    const cols = result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: this.mapOracleTypeToFieldType(row.DATA_TYPE),
      nullable: row.NULLABLE === "Y",
      default: row.DATA_DEFAULT,
      length: row.DATA_LENGTH,
      precision: row.DATA_PRECISION,
      scale: row.DATA_SCALE,
    }));

    const tableInfo = { name: tableName, cols };

    logger.debug("Table info retrieved", {
      tableName,
      columnCount: cols.length,
    });

    return tableInfo;
  }

  // ==========================================
  // ORACLE-SPECIFIC: CREATE TABLE WITH SEQUENCES & FOREIGN KEYS
  // ==========================================
  async createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[] // ✅ THÊM tham số này
  ): Promise<void> {
    logger.debug("Creating Oracle table with foreign keys", {
      tableName,
      schemaKeys: Object.keys(schema),
      foreignKeyCount: foreignKeys?.length || 0,
    });

    this.ensureConnected();
    const columns: string[] = [];
    let sequenceName: string | null = null;
    let autoIncrementColumn: string | null = null;

    // ✅ Build columns
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const columnDef = this.buildOracleColumnDefinition(fieldName, fieldDef);
      columns.push(columnDef);

      if (fieldDef.autoIncrement || fieldDef.auto_increment) {
        autoIncrementColumn = fieldName;
        sequenceName = `${tableName}_${fieldName}_seq`;
      }
    }

    // ✅ Build inline foreign key constraints (giống các adapter khác)
    const constraints = this.buildInlineConstraints(
      tableName,
      foreignKeys || []
    );

    // ✅ Combine columns và constraints
    const allColumns = [...columns, ...constraints].join(", ");

    const createTableQuery = `CREATE TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${allColumns})`;

    await this.raw(createTableQuery);

    // ✅ Tạo sequence và trigger cho auto-increment (giữ nguyên logic cũ)
    if (autoIncrementColumn && sequenceName) {
      await this.createAutoIncrementSequence(
        tableName,
        autoIncrementColumn,
        sequenceName
      );
    }

    logger.info("Oracle table created with foreign keys", {
      tableName,
      foreignKeyCount: constraints.length,
    });
  }

  async dropTable(tableName: string): Promise<void> {
    logger.debug("Dropping table", { tableName });

    this.ensureConnected();
    const dropTableQuery = `DROP TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} CASCADE CONSTRAINTS`;
    try {
      await this.raw(dropTableQuery);
    } catch (error) {
      logger.warn("Table might not exist, skipping drop", {
        tableName,
        error: (error as Error).message,
      });
    }

    try {
      const sequences = await this.executeRaw(
        `SELECT sequence_name FROM user_sequences WHERE UPPER(sequence_name) LIKE UPPER(:1)`,
        [`${tableName}%_seq`]
      );
      for (const seq of sequences.rows) {
        await this.raw(`DROP SEQUENCE ${seq.SEQUENCE_NAME}`);
      }
    } catch (error) {
      logger.warn("Sequences might not exist, skipping drop", {
        tableName,
        error: (error as Error).message,
      });
    }

    logger.info("Table dropped successfully", { tableName });
  }

  // ========================================
  // ORACLE ADAPTER - DDL Methods
  // ========================================

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (Oracle)", {
      tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const indexName =
      indexDef.name || `idx_${tableName}_${indexDef.fields.join("_")}`;
    const unique = indexDef.unique ? "UNIQUE " : "";
    const bitmap = indexDef.type === "BITMAP" ? "BITMAP " : "";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");

    const query = `CREATE ${unique}${bitmap}INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )} ON ${QueryHelper.quoteIdentifier(tableName, this.type)} (${fields})`;

    await this.executeRaw(query, []);
    logger.info("Index created successfully (Oracle)", {
      tableName,
      indexName,
    });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (Oracle)", { tableName, indexName });
    this.ensureConnected();

    const query = `DROP INDEX ${QueryHelper.quoteIdentifier(
      indexName,
      this.type
    )}`;
    await this.executeRaw(query, []);
    logger.info("Index dropped successfully (Oracle)", {
      tableName,
      indexName,
    });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.info("Creating foreign key (Oracle)", {
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
    // Oracle không hỗ trợ ON UPDATE CASCADE

    await this.executeRaw(query, []);
    logger.info("Foreign key created successfully (Oracle)", {
      tableName,
      constraintName,
    });
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.info("Dropping foreign key (Oracle)", { tableName, foreignKeyName });
    this.ensureConnected();

    const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} 
    DROP CONSTRAINT ${QueryHelper.quoteIdentifier(foreignKeyName, this.type)}`;

    await this.executeRaw(query, []);
    logger.info("Foreign key dropped successfully (Oracle)", {
      tableName,
      foreignKeyName,
    });
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (Oracle)", { tableName });
    this.ensureConnected();

    const query = `
    SELECT
      a.constraint_name,
      a.column_name,
      c_pk.table_name AS referenced_table,
      b.column_name AS referenced_column,
      a.delete_rule
    FROM all_cons_columns a
    JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
    JOIN all_constraints c_pk ON c.r_owner = c_pk.owner AND c.r_constraint_name = c_pk.constraint_name
    JOIN all_cons_columns b ON c_pk.constraint_name = b.constraint_name AND b.position = a.position
    WHERE c.constraint_type = 'R'
      AND a.table_name = :tableName
  `;

    const result = await this.executeRaw(query, [tableName]);

    return (result.rows || []).map((row: any) => ({
      constraintName: row.constraint_name,
      columnName: row.column_name,
      referencedTable: row.referenced_table,
      referencedColumn: row.referenced_column,
      onDelete: row.delete_rule,
      onUpdate: "NO ACTION", // Oracle không hỗ trợ ON UPDATE
    }));
  }

  async alterTable(
    tableName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    logger.info("Altering table (Oracle)", { tableName });
    this.ensureConnected();

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD ${columnDef}`;

      await this.executeRaw(query, []);
      logger.info("Column added successfully (Oracle)", {
        tableName,
        fieldName,
      });
    }
  }
  // ==========================================
  // OVERRIDE INSERT ONE (với sequence handling)
  // ==========================================

  /**
   * 🔄 OVERRIDE: Oracle cần xử lý sequence
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

    const placeholders = keys.map((_, i) => `:${i + 1}`).join(", ");
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

    // ✅ Process result (query lại với ROWID)
    const selectQuery = `
      SELECT * FROM ${QueryHelper.quoteIdentifier(tableName, this.type)}
      WHERE ROWID = (SELECT MAX(ROWID) FROM ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )})
    `;
    const selectResult = await this.raw(selectQuery);
    const insertedRecord = selectResult.rows?.[0] || data;

    logger.info("Inserted one record successfully", {
      tableName,
      insertedId: insertedRecord.id,
    });

    return insertedRecord;
  }

  // ==========================================
  // ORACLE HELPER METHODS
  // ==========================================

  private buildOracleColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    logger.trace("Building Oracle column definition", {
      fieldName,
      fieldDefType: fieldDef.type,
    });

    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);
    let oracleType = this.mapFieldTypeToDBType(fieldDef.type, fieldDef.length);

    if (fieldDef.precision && fieldDef.scale !== undefined) {
      oracleType = `NUMBER(${fieldDef.precision}, ${fieldDef.scale})`;
    } else if (fieldDef.precision) {
      oracleType = `NUMBER(${fieldDef.precision})`;
    }

    let columnDef = `${quotedName} ${oracleType}`;

    if (fieldDef.primaryKey || fieldDef.primary_key) {
      columnDef += " PRIMARY KEY";
    }

    if (fieldDef.required && !(fieldDef.primaryKey || fieldDef.primary_key)) {
      columnDef += " NOT NULL";
    } else if (
      fieldDef.nullable === false &&
      !(fieldDef.primaryKey || fieldDef.primary_key)
    ) {
      columnDef += " NOT NULL";
    }

    if (fieldDef.unique && !(fieldDef.primaryKey || fieldDef.primary_key)) {
      columnDef += " UNIQUE";
    }

    if (fieldDef.default !== undefined && !fieldDef.autoIncrement) {
      columnDef += ` DEFAULT ${this.formatOracleDefaultValue(
        fieldDef.default
      )}`;
    }

    logger.trace("Oracle column definition built", {
      fieldName,
      columnDefSnippet:
        columnDef.substring(0, 50) + (columnDef.length > 50 ? "..." : ""),
    });

    return columnDef;
  }

  private async createAutoIncrementSequence(
    tableName: string,
    columnName: string,
    sequenceName: string
  ): Promise<void> {
    logger.trace("Creating auto-increment sequence", {
      tableName,
      columnName,
      sequenceName,
    });

    const createSeqQuery = `CREATE SEQUENCE ${sequenceName} START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`;
    await this.raw(createSeqQuery);

    const triggerName = `${tableName}_${columnName}_trg`;
    const createTriggerQuery = `
      CREATE OR REPLACE TRIGGER ${triggerName}
      BEFORE INSERT ON ${QueryHelper.quoteIdentifier(tableName, this.type)}
      FOR EACH ROW
      BEGIN
        IF :NEW.${QueryHelper.quoteIdentifier(
          columnName,
          this.type
        )} IS NULL THEN
          SELECT ${sequenceName}.NEXTVAL INTO :NEW.${QueryHelper.quoteIdentifier(
      columnName,
      this.type
    )} FROM DUAL;
        END IF;
      END;
    `;
    await this.raw(createTriggerQuery);

    logger.trace("Auto-increment sequence and trigger created", {
      sequenceName,
      triggerName,
    });
  }

  private mapOracleTypeToFieldType(oracleType: string): string {
    logger.trace("Mapping Oracle type to field type", { oracleType });

    const typeMap: Record<string, string> = {
      VARCHAR2: "string",
      CHAR: "string",
      CLOB: "text",
      NUMBER: "number",
      BINARY_FLOAT: "float",
      BINARY_DOUBLE: "double",
      DATE: "date",
      TIMESTAMP: "timestamp",
      BLOB: "binary",
    };
    const mappedType = typeMap[oracleType] || "string";

    logger.trace("Mapped Oracle type result", { oracleType, mappedType });

    return mappedType;
  }

  private convertParamsToBinds(params?: any[]): any {
    logger.trace("Converting params to Oracle binds", {
      paramsCount: params?.length || 0,
    });

    if (!params || params.length === 0) {
      logger.trace("No params to convert, returning empty object");
      return {};
    }
    const binds: any = {};
    params.forEach((param, index) => {
      binds[index + 1] = param;
    });
    logger.trace("Params converted to binds", {
      bindCount: Object.keys(binds).length,
    });

    return binds;
  }

  private formatOracleDefaultValue(value: any): string {
    logger.trace("Formatting Oracle default value", {
      valueType: typeof value,
    });

    if (value === null) {
      logger.trace("Default value is null");
      return "NULL";
    }
    if (typeof value === "string") {
      if (
        ["SYSDATE", "SYSTIMESTAMP", "CURRENT_TIMESTAMP"].includes(
          value.toUpperCase()
        )
      ) {
        logger.trace("Using Oracle timestamp function");
        return "SYSTIMESTAMP";
      }
      const formattedValue = `'${this.sanitize(value)}'`;
      logger.trace("Formatted string default value");
      return formattedValue;
    }
    if (typeof value === "boolean") {
      const formattedValue = value ? "1" : "0";
      logger.trace("Formatted boolean default value", { formattedValue });
      return formattedValue;
    }
    const stringValue = String(value);
    logger.trace("Formatted primitive default value", { stringValue });
    return stringValue;
  }
}

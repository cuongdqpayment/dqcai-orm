// ========================
// src/adapters/oracle-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import {
  DatabaseType,
  EntitySchemaDefinition,
  FieldDefinition,
  SchemaDefinition,
} from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.ORACLE_ADAPTER);

export class OracleAdapter extends BaseAdapter {
  type: DatabaseType = "oracle" as DatabaseType;
  databaseType: DatabaseType = "oracle" as DatabaseType;
  private oracledb: any = null;
  private pool: any = null;

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
      logger.trace("Converted Boolean to numeric", { original: value, converted: numericValue });
      return numericValue;
    }

    // Handle arrays/objects → JSON stringify (CLOB)
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
      hasLastRowid: !!result.lastRowid || !!result.lastInsertId 
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

    logger.trace("Executing select query for inserted record", { pkField, lastRowid });

    const selectResult = await this.executeRaw(query, [lastRowid]);
    const insertedRecord = selectResult.rows?.[0] || { ...data, [pkField]: lastRowid };

    logger.trace("Insert result processed", { 
      tableName, 
      pkField, 
      lastRowid 
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
      querySnippet: query.substring(0, Math.min(100, query.length)) + (query.length > 100 ? '...' : ''), 
      paramsCount: params?.length || 0 
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
      logger.trace("Raw query executed", { rowCount: formattedResult.rows.length, rowsAffected: formattedResult.rowsAffected });
      return formattedResult;
    } catch (error) {
      logger.error("Oracle query execution failed", { 
        querySnippet: query.substring(0, Math.min(100, query.length)) + (query.length > 100 ? '...' : ''), 
        error: (error as Error).message 
      });
      throw new Error(`Oracle query execution failed: ${error}`);
    } finally {
      if (conn) {
        try {
          await conn.close();
          logger.trace("Connection returned to pool");
        } catch (err) {
          logger.error("Error closing Oracle connection", { error: (err as Error).message });
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
      columnCount: cols.length 
    });

    return tableInfo;
  }

  // ==========================================
  // ORACLE-SPECIFIC: CREATE TABLE WITH SEQUENCES
  // ==========================================

  async createTable(
    tableName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    logger.debug("Creating table", { 
      tableName, 
      schemaKeys: Object.keys(schema) 
    });

    this.ensureConnected();
    const columns: string[] = [];
    const constraints: string[] = [];
    let sequenceName: string | null = null;
    let autoIncrementColumn: string | null = null;

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const columnDef = this.buildOracleColumnDefinition(fieldName, fieldDef);
      columns.push(columnDef);

      if (fieldDef.autoIncrement || fieldDef.auto_increment) {
        autoIncrementColumn = fieldName;
        sequenceName = `${tableName}_${fieldName}_seq`;
      }

      if (fieldDef.references) {
        constraints.push(this.buildForeignKeyConstraint(fieldName, fieldDef));
      }
    }

    const allColumns = [...columns, ...constraints].join(", ");
    const createTableQuery = `CREATE TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${allColumns})`;
    await this.raw(createTableQuery);

    if (autoIncrementColumn && sequenceName) {
      await this.createAutoIncrementSequence(
        tableName,
        autoIncrementColumn,
        sequenceName
      );
    }

    logger.info("Table created successfully", { tableName });
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
        error: (error as Error).message 
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
        error: (error as Error).message 
      });
    }

    logger.info("Table dropped successfully", { tableName });
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
      dataKeys: Object.keys(data) 
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
      placeholderCount: placeholders.split(',').length 
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
      insertedId: insertedRecord.id 
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
    logger.trace("Building Oracle column definition", { fieldName, fieldDefType: fieldDef.type });

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
    } else if (fieldDef.nullable === false) {
      columnDef += " NOT NULL";
    }

    if (fieldDef.unique) {
      columnDef += " UNIQUE";
    }

    if (fieldDef.default !== undefined && !fieldDef.autoIncrement) {
      columnDef += ` DEFAULT ${this.formatOracleDefaultValue(fieldDef.default)}`;
    }

    logger.trace("Oracle column definition built", { fieldName, columnDefSnippet: columnDef.substring(0, 50) + (columnDef.length > 50 ? '...' : '') });

    return columnDef;
  }

  private async createAutoIncrementSequence(
    tableName: string,
    columnName: string,
    sequenceName: string
  ): Promise<void> {
    logger.trace("Creating auto-increment sequence", { tableName, columnName, sequenceName });

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

    logger.trace("Auto-increment sequence and trigger created", { sequenceName, triggerName });
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
    logger.trace("Converting params to Oracle binds", { paramsCount: params?.length || 0 });

    if (!params || params.length === 0) {
      logger.trace("No params to convert, returning empty object");
      return {};
    }
    const binds: any = {};
    params.forEach((param, index) => {
      binds[index + 1] = param;
    });
    logger.trace("Params converted to binds", { bindCount: Object.keys(binds).length });

    return binds;
  }

  private formatOracleDefaultValue(value: any): string {
    logger.trace("Formatting Oracle default value", { valueType: typeof value });

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
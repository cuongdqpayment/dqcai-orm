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
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle Date objects → Oracle DATE format
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle boolean → 1/0
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    // Handle arrays/objects → JSON stringify (CLOB)
    if (typeof value === "object" && !Buffer.isBuffer(value)) {
      return JSON.stringify(value);
    }

    // Handle strings (escape single quotes)
    if (typeof value === "string") {
      return value.replace(/'/g, "''");
    }

    return value;
  }

  /**
   * ✅ ORACLE: Ánh xạ kiểu dữ liệu
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
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

    return typeMap[fieldType.toLowerCase()] || "VARCHAR2(255)";
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
    // Oracle trả về lastRowid
    const lastRowid = result.lastRowid || result.lastInsertId;

    if (!lastRowid) {
      return data; // Fallback
    }

    // Query lại bản ghi vừa insert
    const pkField = primaryKeys?.[0] || "id";
    const query = `SELECT * FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} WHERE ${QueryHelper.quoteIdentifier(pkField, this.type)} = :1`;

    const selectResult = await this.executeRaw(query, [lastRowid]);
    return selectResult.rows?.[0] || { ...data, [pkField]: lastRowid };
  }

  /**
   * ✅ ORACLE: Placeholder = :1, :2, :3...
   */
  protected getPlaceholder(index: number): string {
    return `:${index}`;
  }

  // ==========================================
  // ORACLE-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error("Not connected to Oracle");
    let conn;
    try {
      conn = await this.pool.getConnection();
      const bindParams = this.convertParamsToBinds(params);
      const result = await conn.execute(query, bindParams, {
        outFormat: this.oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
      });
      return {
        rows: result.rows || [],
        rowsAffected: result.rowsAffected || 0,
        lastInsertId: result.lastRowid,
        lastRowid: result.lastRowid,
        metadata: result.metaData,
      };
    } catch (error) {
      throw new Error(`Oracle query execution failed: ${error}`);
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {
          console.error("Error closing Oracle connection:", err);
        }
      }
    }
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `SELECT COUNT(*) as COUNT FROM user_tables WHERE UPPER(table_name) = UPPER(:1)`;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.COUNT > 0;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT column_name, data_type, nullable, data_default, data_length, data_precision, data_scale
      FROM user_tab_columns
      WHERE UPPER(table_name) = UPPER(:1)
      ORDER BY column_id
    `;
    const result = await this.executeRaw(query, [tableName]);
    if (result.rows.length === 0) return null;

    const cols = result.rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: this.mapOracleTypeToFieldType(row.DATA_TYPE),
      nullable: row.NULLABLE === "Y",
      default: row.DATA_DEFAULT,
      length: row.DATA_LENGTH,
      precision: row.DATA_PRECISION,
      scale: row.DATA_SCALE,
    }));

    return { name: tableName, cols };
  }

  // ==========================================
  // ORACLE-SPECIFIC: CREATE TABLE WITH SEQUENCES
  // ==========================================

  async createTable(
    tableName: string,
    schema: SchemaDefinition
  ): Promise<void> {
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
  }

  async dropTable(tableName: string): Promise<void> {
    this.ensureConnected();
    const dropTableQuery = `DROP TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} CASCADE CONSTRAINTS`;
    try {
      await this.raw(dropTableQuery);
    } catch (error) {
      // Table might not exist
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
      // Sequence might not exist
    }
  }

  // ==========================================
  // OVERRIDE INSERT ONE (với sequence handling)
  // ==========================================

  /**
   * 🔄 OVERRIDE: Oracle cần xử lý sequence
   */
  async insertOne(tableName: string, data: any): Promise<any> {
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
    return selectResult.rows?.[0] || data;
  }

  // ==========================================
  // ORACLE HELPER METHODS
  // ==========================================

  private buildOracleColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
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

    return columnDef;
  }

  private async createAutoIncrementSequence(
    tableName: string,
    columnName: string,
    sequenceName: string
  ): Promise<void> {
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
  }

  private mapOracleTypeToFieldType(oracleType: string): string {
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
    return typeMap[oracleType] || "string";
  }

  private convertParamsToBinds(params?: any[]): any {
    if (!params || params.length === 0) return {};
    const binds: any = {};
    params.forEach((param, index) => {
      binds[index + 1] = param;
    });
    return binds;
  }

  private formatOracleDefaultValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") {
      if (
        ["SYSDATE", "SYSTIMESTAMP", "CURRENT_TIMESTAMP"].includes(
          value.toUpperCase()
        )
      ) {
        return "SYSTIMESTAMP";
      }
      return `'${this.sanitize(value)}'`;
    }
    if (typeof value === "boolean") return value ? "1" : "0";
    return String(value);
  }
}
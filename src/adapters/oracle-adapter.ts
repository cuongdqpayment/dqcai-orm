// ========================
// src/adapters/oracle-adapter.ts
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
    const query = `SELECT COUNT(*) as count FROM user_tables WHERE UPPER(table_name) = UPPER(:1)`;
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

  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `:${i + 1}`).join(", ");
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");
    const simpleQuery = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders})`;
    await this.raw(simpleQuery, values);

    const selectQuery = `
      SELECT * FROM ${QueryHelper.quoteIdentifier(tableName, this.type)}
      WHERE ROWID = (SELECT MAX(ROWID) FROM ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )})
    `;
    const result = await this.raw(selectQuery);
    return result.rows?.[0] || data;
  }

  protected getParamPlaceholder(index: number): string {
    return `:${index}`;
  }

  protected buildOracleColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);
    let oracleType = this.mapTypeToOracle(fieldDef.type);

    if (
      fieldDef.length &&
      !fieldDef.type.includes("text") &&
      !fieldDef.type.includes("lob")
    ) {
      oracleType += `(${fieldDef.length})`;
    }

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
      columnDef += ` DEFAULT ${this.formatDefaultValue(fieldDef.default)}`;
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

  private mapTypeToOracle(fieldType: string): string {
    const typeMap: Record<string, string> = {
      string: "VARCHAR2",
      varchar: "VARCHAR2",
      text: "CLOB",
      char: "CHAR",
      number: "NUMBER",
      integer: "NUMBER",
      int: "NUMBER",
      bigint: "NUMBER(19)",
      float: "BINARY_FLOAT",
      double: "BINARY_DOUBLE",
      decimal: "NUMBER",
      numeric: "NUMBER",
      boolean: "NUMBER(1)",
      bool: "NUMBER(1)",
      date: "DATE",
      datetime: "TIMESTAMP",
      timestamp: "TIMESTAMP",
      time: "TIMESTAMP",
      json: "CLOB",
      jsonb: "CLOB",
      array: "CLOB",
      object: "CLOB",
      uuid: "VARCHAR2(36)",
      binary: "BLOB",
      blob: "BLOB",
    };
    return typeMap[fieldType.toLowerCase()] || "VARCHAR2";
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

  protected formatDefaultValue(value: any): string {
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

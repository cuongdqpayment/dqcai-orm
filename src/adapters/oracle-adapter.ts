// ========================
// src/adapters/oracle-adapter.ts
// ========================
import {
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  FieldDefinition,
  IConnection,
  SchemaDefinition,
} from "../types/orm.types";
import { BaseAdapter } from "../core/base-adapter";
import { QueryHelper } from "../utils/query-helper";
import { createRequire } from "module";

/**
 * Oracle Configuration
 */
export interface OracleConfig extends DbConfig {
  user: string;
  username?: string; // Alias for user
  password: string;
  connectString?: string; // host:port/serviceName or connectionString
  connectionString?: string; // Alias for connectString
  host?: string;
  port?: number;
  serviceName?: string;
  sid?: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
  poolTimeout?: number;
  edition?: string;
  externalAuth?: boolean;
  privilege?: number; // SYSDBA = 2, SYSOPER = 4
}

/**
 * Oracle Adapter
 * Requires: oracledb package
 *
 * Install: npm install oracledb
 * Note: May require Oracle Instant Client installation
 */
export class OracleAdapter extends BaseAdapter {
  type: DatabaseType = "oracle" as DatabaseType;
  databaseType: DatabaseType = "oracle" as DatabaseType;

  private oracledb: any = null;
  private pool: any = null;

  async connect(config: OracleConfig): Promise<IConnection> {
    try {
      this.oracledb = await import("oracledb");

      // Set default fetch options
      this.oracledb.outFormat = this.oracledb.OUT_FORMAT_OBJECT;
      this.oracledb.fetchAsString = [this.oracledb.CLOB];
      this.oracledb.fetchAsBuffer = [this.oracledb.BLOB];

      // Build connection string
      const connectString = this.buildConnectString(config);

      // Create connection pool
      this.pool = await this.oracledb.createPool({
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

      this.connection = {
        rawConnection: this.pool,
        isConnected: true,
        close: async () => {
          if (this.pool) {
            await this.pool.close(0); // Force close all connections
            this.pool = null;
            this.connection = null;
          }
        },
      };

      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`Oracle connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error("Not connected to Oracle");
    }

    let conn;
    try {
      conn = await this.pool.getConnection();

      // Convert params array to bind object for Oracle
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
    const query = `
      SELECT COUNT(*) as count
      FROM user_tables
      WHERE UPPER(table_name) = UPPER(:1)
    `;
    const result = await this.executeRaw(query, [tableName]);
    return result.rows[0]?.COUNT > 0;
  }

  async getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT 
        column_name,
        data_type,
        nullable,
        data_default,
        data_length,
        data_precision,
        data_scale
      FROM user_tab_columns
      WHERE UPPER(table_name) = UPPER(:1)
      ORDER BY column_id
    `;

    const result = await this.executeRaw(query, [tableName]);

    if (result.rows.length === 0) {
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

    return {
      name: tableName,
      cols,
    };
  }

  // Override createTable for Oracle-specific syntax
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

      // Track auto-increment for sequence/trigger creation
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

    // Create sequence and trigger for auto-increment
    if (autoIncrementColumn && sequenceName) {
      await this.createAutoIncrementSequence(
        tableName,
        autoIncrementColumn,
        sequenceName
      );
    }
  }

  // Override dropTable to also drop sequence
  async dropTable(tableName: string): Promise<void> {
    this.ensureConnected();

    // Drop table
    const dropTableQuery = `DROP TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} CASCADE CONSTRAINTS`;

    try {
      await this.raw(dropTableQuery);
    } catch (error) {
      // Table might not exist, ignore error
    }

    // Try to drop associated sequence
    try {
      const sequences = await this.executeRaw(
        `SELECT sequence_name FROM user_sequences WHERE UPPER(sequence_name) LIKE UPPER(:1)`,
        [`${tableName}%_seq`]
      );

      for (const seq of sequences.rows) {
        await this.raw(`DROP SEQUENCE ${seq.SEQUENCE_NAME}`);
      }
    } catch (error) {
      // Sequence might not exist, ignore error
    }
  }

  async truncateTable(tableName: string): Promise<void> {
    this.ensureConnected();
    const query = `TRUNCATE TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;
    await this.raw(query);
  }

  // Override insertOne to handle RETURNING clause
  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `:${i + 1}`).join(", ");

    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    // Oracle uses RETURNING INTO
    const query = `
      INSERT INTO ${QueryHelper.quoteIdentifier(tableName, this.type)} 
      (${quotedKeys}) 
      VALUES (${placeholders})
      RETURNING * INTO :returning
    `;

    // For simplicity, we'll use a separate SELECT to get the inserted row
    const simpleQuery = `
      INSERT INTO ${QueryHelper.quoteIdentifier(tableName, this.type)} 
      (${quotedKeys}) 
      VALUES (${placeholders})
    `;

    await this.raw(simpleQuery, values);

    // Get the last inserted row (assuming there's an ID column)
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

  // Override for Oracle-specific placeholder syntax
  protected getParamPlaceholder(index: number): string {
    return `:${index}`;
  }

  protected buildOracleColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);
    let oracleType = this.mapTypeToOracle(fieldDef.type);

    // Add length/precision
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

    // Primary key
    if (fieldDef.primaryKey || fieldDef.primary_key) {
      columnDef += " PRIMARY KEY";
    }

    // NOT NULL
    if (fieldDef.required && !(fieldDef.primaryKey || fieldDef.primary_key)) {
      columnDef += " NOT NULL";
    } else if (fieldDef.nullable === false) {
      columnDef += " NOT NULL";
    }

    // UNIQUE
    if (fieldDef.unique) {
      columnDef += " UNIQUE";
    }

    // DEFAULT
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
    // Create sequence
    const createSeqQuery = `
      CREATE SEQUENCE ${sequenceName}
      START WITH 1
      INCREMENT BY 1
      NOCACHE
      NOCYCLE
    `;
    await this.raw(createSeqQuery);

    // Create trigger
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
          SELECT ${sequenceName}.NEXTVAL
          INTO :NEW.${QueryHelper.quoteIdentifier(columnName, this.type)}
          FROM DUAL;
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
      json: "CLOB", // Oracle 21c+ supports JSON natively
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

  private buildConnectString(config: OracleConfig): string {
    // If connectString or connectionString is provided, use it
    if (config.connectString) {
      return config.connectString;
    }
    if (config.connectionString) {
      return config.connectionString;
    }

    // Build from components
    const host = config.host || "localhost";
    const port = config.port || 1521;

    if (config.serviceName) {
      return `${host}:${port}/${config.serviceName}`;
    }

    if (config.sid) {
      return `${host}:${port}:${config.sid}`;
    }

    // Default
    return `${host}:${port}/XE`;
  }

  private convertParamsToBinds(params?: any[]): any {
    if (!params || params.length === 0) {
      return {};
    }

    // Convert array to object with numeric keys
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
        value.toUpperCase() === "SYSDATE" ||
        value.toUpperCase() === "SYSTIMESTAMP" ||
        value.toUpperCase() === "CURRENT_TIMESTAMP"
      ) {
        return "SYSTIMESTAMP";
      }
      return `'${this.sanitize(value)}'`;
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    return String(value);
  }

  isSupported(): boolean {
    // const require = createRequire(import.meta.url);
    try {
      require.resolve("oracledb");
      return true;
    } catch {
      return false;
    }
  }
}

// ========================
// src/core/base-adapter.ts (FIXED)
// ========================
import { IAdapter } from "../interfaces/adapter.interface";
import {
  BulkOperation,
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  FieldDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  IResult,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "../types/orm.types";
import { QueryHelper } from "../utils/query-helper";

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.BASE_ADAPTER);

export abstract class BaseAdapter implements IAdapter {
  protected dbConfig: DbConfig;
  constructor(config: DbConfig) {
    this.dbConfig = config;
  }

  createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  dropForeignKey(tableName: string, foreignKeyName: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    throw new Error("Method not implemented.");
  }
  alterTable(tableName: string, changes: SchemaDefinition): Promise<void> {
    throw new Error("Method not implemented.");
  }
  aggregate(tableName: string, pipeline: any[]): Promise<any[]> {
    throw new Error("Method not implemented.");
  }
  bulkWrite(tableName: string, operations: BulkOperation[]): Promise<IResult> {
    throw new Error("Method not implemented.");
  }
  sanitize(value: any) {
    throw new Error("Method not implemented.");
  }

  abstract type: DatabaseType;
  abstract databaseType: DatabaseType;

  protected connection: IConnection | null = null;
  protected config: DbConfig | null = null;

  // ==========================================
  // 🆕 ABSTRACT METHODS - MUST IMPLEMENT
  // ==========================================

  protected abstract sanitizeValue(value: any): any;
  protected abstract mapFieldTypeToDBType(
    fieldType: string,
    length?: number
  ): string;
  protected abstract processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any>;
  protected abstract getPlaceholder(index: number): string;

  abstract createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void>;
  abstract dropIndex(tableName: string, indexName: string): Promise<void>;

  abstract executeRaw(query: string | any, params?: any[]): Promise<any>;
  abstract tableExists(tableName: string): Promise<boolean>;
  abstract getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null>;

  // ==========================================
  // 🔌 CONNECTION MANAGEMENT
  // ==========================================

  isSupported(): boolean {
    throw new Error(
      "isSupported method must be implemented by DatabaseAdapter"
    );
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    throw new Error("Connect method must be implemented by DatabaseAdapter");
  }

  async disconnect(): Promise<void> {
    logger.info("Disconnecting from database", { type: this.type });
    if (!this.connection) {
      logger.trace("No connection to disconnect");
      return;
    }

    if (!this.connection.isConnected) {
      logger.trace("Connection already disconnected");
      this.connection = null;
      return;
    }

    try {
      await this.connection.close();
      logger.info("Connection closed successfully", { type: this.type });
    } catch (error: any) {
      logger.info("Error during disconnect (might be already closed)", {
        type: this.type,
        error: error.message,
      });
    } finally {
      this.connection = null;
    }
  }

  async disconnectAll(): Promise<void> {
    await this.disconnect();
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.isConnected;
  }

  getConnection(): IConnection | null {
    return this.connection;
  }

  getDbConfig(): DbConfig | null {
    return this.config;
  }

  protected ensureConnected(): void {
    if (!this.isConnected()) {
      logger.error("Database connection not established", { type: this.type });
      throw new Error(`Not connected to ${this.type} database`);
    }
  }

  // ==========================================
  // 📋 SCHEMA MANAGEMENT
  // ==========================================
  protected buildInlineConstraints(
    tableName: string,
    foreignKeys: ForeignKeyDefinition[]
  ): string[] {
    const constraints: string[] = [];

    for (const fk of foreignKeys) {
      const constraint = this.buildForeignKeyConstraint(tableName, fk);
      if (constraint) {
        constraints.push(constraint);
      }
    }
    return constraints;
  }

  /**
   * Phương thức này hỗ trợ được cho các cơ sở dữ liệu:
   * mysql,
   * maria,
   * sqlserver,
   * postgresql
   * đều giống cùng câu lệnh tạo bảng kèm foreignkey
   * Riêng đối với SQLITE thì phải sử dụng thêm cờ PRAGMA foreign_keys = ON đúng cách nên phải overide để xử lý riêng
   * Riêng đối với ORACLE cũng sẽ có khác biệt về tạo bảng nên cũng phải overide hàm này xử lý riêng
   *
   * @param tableName
   * @param schema
   * @param foreignKeys
   */
  async createTable(
    tableName: string,
    schema: SchemaDefinition,
    foreignKeys?: ForeignKeyDefinition[]
  ): Promise<void> {
    logger.trace("Creating table", { tableName, schema });

    this.ensureConnected();
    const columns: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      columns.push(columnDef);
    }

    // ✅ Thêm constraints (bao gồm foreign keys)
    const constraints = this.buildInlineConstraints(
      tableName,
      foreignKeys || []
    );
    const allColumns = [...columns, ...constraints].join(", ");

    const query = this.buildCreateTableQuery(tableName, allColumns);

    await this.executeRaw(query, []);

    logger.info("Table created successfully", { tableName });
  }

  async dropTable(tableName: string): Promise<void> {
    logger.info("Dropping table", { tableName });

    this.ensureConnected();
    const query = `DROP TABLE IF EXISTS ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;
    await this.raw(query);

    logger.info("Table dropped successfully", { tableName });
  }

  async truncateTable(tableName: string): Promise<void> {
    logger.info("Truncating table", { tableName });

    this.ensureConnected();
    const query = `TRUNCATE TABLE ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;
    await this.raw(query);

    logger.info("Table truncated successfully", { tableName });
  }

  // ==========================================
  // 💾 CRUD OPERATIONS
  // ==========================================

  /**
   * ✅ INSERT ONE - Base implementation
   * ⚠️ Derived classes có thể override để tối ưu (như PostgreSQL RETURNING)
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", {
      tableName,
      dataKeys: Object.keys(data),
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize all values using abstract method
    const values = keys.map((key) => this.sanitizeValue(data[key]));

    // ✅ Build placeholders using abstract method
    const placeholders = keys
      .map((_, i) => this.getPlaceholder(i + 1))
      .join(", ");

    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");

    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders})`;

    logger.trace("Executing insert query", {
      tableName,
      query: query.substring(0, 150),
      valueCount: values.length,
    });

    const result = await this.executeRaw(query, values);

    // ✅ Process result using abstract method
    const inserted = await this.processInsertResult(tableName, result, data, [
      "id",
    ]);

    logger.info("Inserted one record successfully", { tableName });

    return inserted;
  }

  async insertMany(tableName: string, data: any[]): Promise<any[]> {
    logger.info("Inserting many records", { tableName, count: data.length });

    this.ensureConnected();
    if (data.length === 0) return [];

    const results = [];
    for (const item of data) {
      results.push(await this.insertOne(tableName, item));
    }
    return results;
  }

  /**
   * ✅ FIND
   */
  async find(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
    logger.trace("Finding records", { tableName, filter, options });

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

    if (options?.sort || options?.orderBy) {
      const orderBy = QueryHelper.buildOrderBy(
        options.sort || options.orderBy || {},
        this.type
      );
      query += ` ORDER BY ${orderBy}`;
    }

    if (options?.limit) query += ` LIMIT ${options.limit}`;
    if (options?.offset || options?.skip)
      query += ` OFFSET ${options.offset || options.skip}`;

    logger.trace("Executing find query", {
      tableName,
      query: query.substring(0, 150),
      params,
      // paramCount: params.length,
    });

    const result = await this.executeRaw(query, params);

    logger.trace("Found records", {
      tableName,
      count: result.rows?.length || 0,
    });

    return result.rows || [];
  }

  async findOne(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    logger.trace("Finding one record", { tableName, filter });

    const results = await this.find(tableName, filter, {
      ...options,
      limit: 1,
    });

    logger.trace("Found one record", { tableName, found: !!results[0] });

    return results[0] || null;
  }

  async findById(tableName: string, id: any): Promise<any | null> {
    logger.trace("Finding record by ID", { tableName, id });

    return this.findOne(tableName, { id } as QueryFilter);
  }

  /**
   * ✅ UPDATE
   */
  async update(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    logger.debug("Updating records", {
      tableName,
      dataKeys: Object.keys(data),
      filter,
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    // ✅ Sanitize values
    const values = keys.map((key) => this.sanitizeValue(data[key]));

    // ✅ Build SET clause with placeholders
    const setClauses = keys
      .map(
        (key, i) =>
          `${QueryHelper.quoteIdentifier(
            key,
            this.type
          )} = ${this.getPlaceholder(i + 1)}`
      )
      .join(", ");

    // ✅ Build WHERE clause (placeholders start after SET values)
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

    if (clause !== "1=1") query += ` WHERE ${clause}`;

    logger.trace("Executing update query", {
      tableName,
      query: query.substring(0, 150),
      paramCount: allParams.length,
    });

    const result = await this.executeRaw(query, allParams);

    // ✅ Handle different result formats
    const affected =
      result.rowCount || result.rowsAffected || result.changes || 0;

    if (affected === 0) {
      logger.warn("No records updated", { tableName });
    } else {
      logger.info("Updated records successfully", { tableName, affected });
    }

    return affected;
  }

  async updateOne(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    const count = await this.update(tableName, filter, data);
    return count > 0;
  }

  async updateById(tableName: string, id: any, data: any): Promise<boolean> {
    logger.debug("Updating record by ID", {
      tableName,
      id,
      dataKeys: Object.keys(data),
    });

    return this.updateOne(tableName, { id } as QueryFilter, data);
  }

  /**
   * ✅ DELETE
   */
  async delete(tableName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", { tableName, filter });

    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(filter, this.type);

    let query = `DELETE FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") query += ` WHERE ${clause}`;

    logger.trace("Executing delete query", {
      tableName,
      query,
      paramCount: params.length,
    });

    const result = await this.executeRaw(query, params);

    // ✅ Handle different result formats
    const affected =
      result.rowCount || result.rowsAffected || result.changes || 0;

    if (affected === 0) {
      logger.warn("No records deleted", { tableName });
    } else {
      logger.info("Deleted records successfully", { tableName, affected });
    }

    return affected;
  }

  async deleteOne(tableName: string, filter: QueryFilter): Promise<boolean> {
    const count = await this.delete(tableName, filter);
    return count > 0;
  }

  async deleteById(tableName: string, id: any): Promise<boolean> {
    logger.debug("Deleting record by ID", { tableName, id });

    return this.deleteOne(tableName, { id } as QueryFilter);
  }

  async count(tableName: string, filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", { tableName, filter });

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

    logger.trace("Counted records", { tableName, count: countValue });

    return countValue;
  }

  async raw(query: string | any, params?: any[]): Promise<any> {
    logger.trace("Executing raw query", {
      query:
        typeof query === "string"
          ? query.substring(0, 200) + (query.length > 200 ? "..." : "")
          : "Non-string query",
      paramCount: params?.length || 0,
    });

    this.ensureConnected();

    return this.executeRaw(query, params || []);
  }

  // ==========================================
  // 🔄 TRANSACTION MANAGEMENT
  // ==========================================

  async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning transaction", { type: this.type });

    this.ensureConnected();
    await this.executeRaw("BEGIN", []);
    let active = true;

    return {
      commit: async () => {
        if (!active) throw new Error("Transaction already completed");
        await this.executeRaw("COMMIT", []);
        active = false;
        logger.info("Transaction committed", { type: this.type });
      },
      rollback: async () => {
        if (!active) throw new Error("Transaction already completed");
        await this.executeRaw("ROLLBACK", []);
        active = false;
        logger.info("Transaction rolled back", { type: this.type });
      },
      isActive: () => active,
    };
  }

  // ==========================================
  // 🛠️ UTILITY METHODS
  // ==========================================

  protected buildColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    // logger.trace("Building column definition", { fieldName, fieldDef });

    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);
    let sqlType = this.mapFieldTypeToDBType(fieldDef.type, fieldDef.length);

    if (fieldDef.autoIncrement) {
      const autoIncrementDef = this.buildAutoIncrementColumn(
        quotedName,
        sqlType,
        fieldDef.primaryKey || false
      );

      let columnDef = autoIncrementDef;

      if (fieldDef.unique && !fieldDef.primaryKey) columnDef += " UNIQUE";

      return columnDef;
    }

    let columnDef = `${quotedName} ${sqlType}`;

    if (fieldDef.primaryKey) columnDef += " PRIMARY KEY";
    if (fieldDef.required && !fieldDef.primaryKey) columnDef += " NOT NULL";
    if (fieldDef.unique && !fieldDef.primaryKey) columnDef += " UNIQUE";
    if (fieldDef.default !== undefined)
      columnDef += ` DEFAULT ${this.formatDefaultValue(fieldDef.default)}`;

    return columnDef;
  }

  protected buildAutoIncrementColumn(
    name: string,
    type: string,
    isPrimaryKey: boolean = true // ✅ Thêm tham số
  ): string {
    switch (this.type) {
      case "postgresql":
        // PostgreSQL: SERIAL tự động là NOT NULL, thêm PRIMARY KEY nếu cần
        return isPrimaryKey ? `${name} SERIAL PRIMARY KEY` : `${name} SERIAL`;

      case "mysql":
      case "mariadb":
        // ✅ FIX: MySQL/MariaDB PHẢI có PRIMARY KEY với AUTO_INCREMENT
        if (isPrimaryKey) {
          return `${name} ${type} AUTO_INCREMENT PRIMARY KEY`;
        } else {
          // ⚠️ MySQL không cho phép AUTO_INCREMENT mà không có KEY
          // Fallback: tạo UNIQUE KEY
          return `${name} ${type} AUTO_INCREMENT UNIQUE`;
        }

      case "sqlite":
        // SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
        return `${name} INTEGER PRIMARY KEY AUTOINCREMENT`;

      case "sqlserver":
        // SQL Server: IDENTITY với PRIMARY KEY
        return isPrimaryKey
          ? `${name} ${type} IDENTITY(1,1) PRIMARY KEY`
          : `${name} ${type} IDENTITY(1,1)`;

      default:
        return `${name} ${type}`;
    }
  }

  protected buildForeignKeyConstraint(
    tableName: string,
    foreignKey: ForeignKeyDefinition
  ): string {
    logger.trace("Building foreign key constraint", {
      tableName,
      foreignKey,
    });

    if (!foreignKey || !foreignKey.references) return "";

    // Quote các field names trong bảng hiện tại
    const quotedFields = foreignKey.fields
      .map((field) => QueryHelper.quoteIdentifier(field, this.type))
      .join(", ");

    // Quote tên bảng được tham chiếu
    const quotedRefTable = QueryHelper.quoteIdentifier(
      foreignKey.references.table,
      this.type
    );

    // Quote các field names trong bảng được tham chiếu
    const quotedRefFields = foreignKey.references.fields
      .map((field) => QueryHelper.quoteIdentifier(field, this.type))
      .join(", ");

    // Tạo constraint với tên foreign key
    let constraint = `CONSTRAINT ${QueryHelper.quoteIdentifier(
      foreignKey.name,
      this.type
    )} `;
    constraint += `FOREIGN KEY (${quotedFields}) REFERENCES ${quotedRefTable}(${quotedRefFields})`;

    // Thêm ON DELETE action nếu có
    if (foreignKey.on_delete) {
      constraint += ` ON DELETE ${foreignKey.on_delete}`;
    }

    // Thêm ON UPDATE action nếu có
    if (foreignKey.on_update) {
      constraint += ` ON UPDATE ${foreignKey.on_update}`;
    }

    return constraint;
  }

  protected buildCreateTableQuery(tableName: string, columns: string): string {
    return `CREATE TABLE IF NOT EXISTS ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${columns})`;
  }

  protected formatDefaultValue(value: any): string {
    if (value === null) return "NULL";

    if (typeof value === "string") {
      if (
        value.toUpperCase() === "NOW()" ||
        value.toUpperCase() === "CURRENT_TIMESTAMP"
      ) {
        return "CURRENT_TIMESTAMP";
      }
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return String(value);
  }

  // ==========================================
  // 🔧 ADVANCED OPERATIONS
  // ==========================================

  async upsert(
    tableName: string,
    data: any,
    filter: QueryFilter
  ): Promise<any> {
    logger.debug("Performing upsert", {
      tableName,
      filter,
      dataKeys: Object.keys(data),
    });

    const existing = await this.findOne(tableName, filter);
    if (existing) {
      await this.updateOne(tableName, filter, data);
      logger.info("Upsert: updated existing record", { tableName });
      return { ...existing, ...data };
    } else {
      const inserted = await this.insertOne(tableName, { ...filter, ...data });
      logger.info("Upsert: inserted new record", { tableName });
      return inserted;
    }
  }

  async exists(tableName: string, filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", { tableName, filter });

    const count = await this.count(tableName, filter);
    const existsValue = count > 0;

    logger.trace("Existence check result", { tableName, exists: existsValue });

    return existsValue;
  }

  async distinct(
    tableName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
    logger.trace("Getting distinct values", { tableName, field, filter });

    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(
      filter || {},
      this.type
    );
    const quotedField = QueryHelper.quoteIdentifier(field, this.type);

    let query = `SELECT DISTINCT ${quotedField} FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") {
      query += ` WHERE ${clause}`;
    }

    const result = await this.executeRaw(query, params);
    const distinctValues = result.rows?.map((row: any) => row[field]) || [];

    logger.trace("Distinct values retrieved", {
      tableName,
      field,
      count: distinctValues.length,
    });

    return distinctValues;
  }

  async execute(
    connection: IConnection,
    query: string | any,
    params?: any[]
  ): Promise<IResult> {
    logger.trace("Executing query via connection", {
      query:
        typeof query === "string"
          ? query.substring(0, 200) + (query.length > 200 ? "..." : "")
          : "Non-string query",
    });

    const result = await this.executeRaw(query, params);
    return {
      rows: result.rows || [],
      rowsAffected:
        result.rowsAffected || result.rowCount || result.changes || 0,
      lastInsertId: result.lastInsertId || result.insertId,
      metadata: result,
    };
  }
}

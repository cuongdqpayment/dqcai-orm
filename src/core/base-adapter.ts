// ========================
// src/core/base-adapter.ts (FULLY REFACTORED)
// ========================
import { IAdapter } from "../interfaces/adapter.interface";
import {
  BulkOperation,
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  FieldDefinition,
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

/**
 * 🎯 Base Adapter - Học từ UniversalDAO của @dqcai/sqlite và @dqcai/mongo
 *
 * Key improvements:
 * 1. Sanitization đầy đủ cho từng loại DB
 * 2. Type mapping chính xác
 * 3. Insert result processing thống nhất
 * 4. Error handling tốt hơn
 */
export abstract class BaseAdapter implements IAdapter {
  alterTable(tableName: string, changes: SchemaDefinition): Promise<void> {
    throw new Error("Method not implemented.");
  }
  createIndex(tableName: string, indexDef: IndexDefinition): Promise<void> {
    throw new Error("Method not implemented.");
  }
  dropIndex(tableName: string, indexName: string): Promise<void> {
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

  /**
   * 🔄 Sanitize value theo từng loại database
   * - SQLite: Date → ISO string, Boolean → 0/1, Object → JSON string
   * - MongoDB: Giữ nguyên Date, Boolean, Object (BSON hỗ trợ native)
   * - PostgreSQL/MySQL: Xử lý timestamp, boolean theo SQL standard
   */
  protected abstract sanitizeValue(value: any): any;

  /**
   * 🗺️ Map từ generic type sang DB-specific type
   * - SQLite: TEXT, INTEGER, REAL, BLOB
   * - MongoDB: String, Number, Date, ObjectId, Object, Array
   * - PostgreSQL: VARCHAR, INTEGER, TIMESTAMP, JSONB
   */
  protected abstract mapFieldTypeToDBType(
    fieldType: string,
    length?: number
  ): string;

  /**
   * 📊 Process INSERT result để lấy bản ghi đã tạo
   * - SQLite: Dùng lastInsertRowid + SELECT lại
   * - MongoDB: Trả về document với _id từ insertedId
   * - PostgreSQL: Dùng RETURNING clause
   */
  protected abstract processInsertResult(
    tableName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any>;

  /**
   * 🔢 Placeholder cho parameters
   * - SQLite: ?
   * - PostgreSQL: $1, $2, $3...
   * - MySQL: ?
   * - MongoDB: không dùng (NoSQL)
   */
  protected abstract getPlaceholder(index: number): string;

  // Required methods from IAdapter
  abstract executeRaw(query: string | any, params?: any[]): Promise<any>;
  abstract tableExists(tableName: string): Promise<boolean>;
  abstract getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null>;

  // ==========================================
  // 🔌 CONNECTION MANAGEMENT (IMPROVED)
  // ==========================================

  async connect(config: DbConfig): Promise<IConnection> {
    throw new Error("Connect method must be implemented by ConnectionFactory");
  }

  async disconnect(): Promise<void> {
    logger.info("Disconnecting from database", { type: this.type });
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async disconnectAll(): Promise<void> {
    await this.disconnect();
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.isConnected;
  }

  isSupported(): boolean {
    return false;
  }

  getConnection(): IConnection | null {
    return this.connection;
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

  async createTable(
    tableName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    logger.trace("Creating table", { tableName, schema });

    this.ensureConnected();
    const columns: string[] = [];
    const constraints: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      columns.push(columnDef);

      if (fieldDef.references) {
        constraints.push(this.buildForeignKeyConstraint(fieldName, fieldDef));
      }
    }

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
  // 💾 CRUD OPERATIONS (REFACTORED WITH SANITIZATION)
  // ==========================================

  /**
   * ✅ INSERT ONE - Với sanitization và proper result processing
   */
  async insertOne(tableName: string, data: any): Promise<any> {
    logger.debug("Inserting one record", {
      tableName,
      keys: Object.keys(data),
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    // 🔄 Sanitize all values
    const values = keys.map((key) => this.sanitizeValue(data[key]));

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

    const result = await this.executeRaw(query, values);

    // 📊 Process result (DB-specific)
    const inserted = await this.processInsertResult(tableName, result, data, [
      "id",
    ]);

    logger.info("Inserted one record successfully", { tableName });

    return inserted;
  }

  /**
   * ✅ INSERT MANY - Batch insert với transaction
   */
  async insertMany(tableName: string, data: any[]): Promise<any[]> {
    logger.info("Inserting many records", { tableName, count: data.length });

    this.ensureConnected();
    if (data.length === 0) return [];

    // Nếu DB hỗ trợ bulk insert native, override method này
    const results = [];
    for (const item of data) {
      results.push(await this.insertOne(tableName, item));
    }
    return results;
  }

  /**
   * ✅ FIND - Query với filter
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

    const result = await this.raw(query, params);

    logger.trace("Found records", { tableName, count: result.length });

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
   * ✅ UPDATE - Với sanitization
   */
  async update(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    logger.debug("Updating records", {
      tableName,
      keys: Object.keys(data),
      filter,
    });

    this.ensureConnected();
    const keys = Object.keys(data);

    const values = keys.map((key) => this.sanitizeValue(data[key]));

    const setClauses = keys
      .map(
        (key, i) =>
          `${QueryHelper.quoteIdentifier(
            key,
            this.type
          )} = ${this.getPlaceholder(i + 1)}`
      )
      .join(", ");

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

    const result = await this.raw(query, allParams);
    const affected = result.rowsAffected || 0;

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
      keys: Object.keys(data),
    });

    return this.updateOne(tableName, { id } as QueryFilter, data);
  }

  async delete(tableName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", { tableName, filter });

    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(filter, this.type);

    let query = `DELETE FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") query += ` WHERE ${clause}`;

    const result = await this.raw(query, params);
    const affected = result.rowsAffected || 0;

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

    const result = await this.raw(query, params);
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
    await this.raw("BEGIN");
    let active = true;

    return {
      commit: async () => {
        if (!active) throw new Error("Transaction already completed");
        await this.raw("COMMIT");
        active = false;
        logger.info("Transaction committed", { type: this.type });
      },
      rollback: async () => {
        if (!active) throw new Error("Transaction already completed");
        await this.raw("ROLLBACK");
        active = false;
        logger.info("Transaction rolled back", { type: this.type });
      },
      isActive: () => active,
    };
  }

  // ==========================================
  // 🛠️ UTILITY METHODS
  // ==========================================

  /**
   * 🏗️ Build column definition với proper type mapping
   */
  protected buildColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    logger.trace("Building column definition", { fieldName, fieldDef });

    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);

    // 🗺️ Use abstract method for type mapping
    let sqlType = this.mapFieldTypeToDBType(fieldDef.type, fieldDef.length);

    let columnDef = `${quotedName} ${sqlType}`;

    if (fieldDef.primaryKey) columnDef += " PRIMARY KEY";
    if (fieldDef.autoIncrement)
      columnDef = this.buildAutoIncrementColumn(quotedName, sqlType);
    if (fieldDef.required && !fieldDef.primaryKey) columnDef += " NOT NULL";
    if (fieldDef.unique) columnDef += " UNIQUE";
    if (fieldDef.default !== undefined)
      columnDef += ` DEFAULT ${this.formatDefaultValue(fieldDef.default)}`;

    return columnDef;
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    switch (this.type) {
      case "postgresql":
        return `${name} SERIAL`;
      case "mysql":
      case "mariadb":
        return `${name} ${type} AUTO_INCREMENT`;
      case "sqlite":
        return `${name} INTEGER PRIMARY KEY AUTOINCREMENT`;
      case "sqlserver":
        return `${name} ${type} IDENTITY(1,1)`;
      default:
        return `${name} ${type}`;
    }
  }

  protected buildForeignKeyConstraint(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    logger.trace("Building foreign key constraint", {
      fieldName,
      references: fieldDef.references,
    });

    if (!fieldDef.references) return "";

    const quotedField = QueryHelper.quoteIdentifier(fieldName, this.type);
    const quotedRefTable = QueryHelper.quoteIdentifier(
      fieldDef.references.table,
      this.type
    );
    const quotedRefField = QueryHelper.quoteIdentifier(
      fieldDef.references.field,
      this.type
    );

    let constraint = `FOREIGN KEY (${quotedField}) REFERENCES ${quotedRefTable}(${quotedRefField})`;

    if (fieldDef.references.onDelete)
      constraint += ` ON DELETE ${fieldDef.references.onDelete}`;
    if (fieldDef.references.onUpdate)
      constraint += ` ON UPDATE ${fieldDef.references.onUpdate}`;

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
    filter: QueryFilter,
    data: any
  ): Promise<any> {
    logger.debug("Performing upsert", {
      tableName,
      filter,
      keys: Object.keys(data),
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

    const result = await this.raw(query, params);
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
      rowsAffected: result.rowsAffected || result.changes || 0,
      lastInsertId: result.lastInsertId || result.insertId,
      metadata: result,
    };
  }
}

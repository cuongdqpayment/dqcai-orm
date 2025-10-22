// ========================
// src/core/base-adapter.ts
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
import { TypeMapper } from "../utils/type-mapper";

/**
 * Base Adapter - Abstract implementation of IAdapter
 * Không chứa logic connect để tránh phụ thuộc vào thư viện database cụ thể
 */
export abstract class BaseAdapter implements IAdapter {
  abstract type: DatabaseType;
  abstract databaseType: DatabaseType;

  protected connection: IConnection | null = null;
  protected config: DbConfig | null = null;

  // Các phương thức abstract bắt buộc phải implement
  abstract executeRaw(query: string | any, params?: any[]): Promise<any>;
  abstract tableExists(tableName: string): Promise<boolean>;
  abstract getTableInfo(
    tableName: string
  ): Promise<EntitySchemaDefinition | null>;

  // Các phương thức connect được implement ở ConnectionFactory
  async connect(config: DbConfig): Promise<IConnection> {
    throw new Error("Connect method must be implemented by ConnectionFactory");
  }

  async disconnect(): Promise<void> {
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

  // Method này sẽ được override bởi ConnectionFactory
  isSupported(): boolean {
    return false;
  }

  getConnection(): IConnection | null {
    return this.connection;
  }

  beginTransaction(): Promise<Transaction> {
    throw new Error("Method not implemented.");
  }

  protected ensureConnected(): void {
    if (!this.isConnected()) {
      throw new Error(`Not connected to ${this.type} database`);
    }
  }

  // Schema Management
  async alterTable(
    tableName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    this.ensureConnected();

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const columnDef = this.buildColumnDefinition(fieldName, fieldDef);
      const query = `ALTER TABLE ${QueryHelper.quoteIdentifier(
        tableName,
        this.type
      )} ADD COLUMN ${columnDef}`;
      await this.raw(query);
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

  // Index Management

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    this.ensureConnected();

    const uniqueStr = indexDef.unique ? "UNIQUE" : "";
    const fields = indexDef.fields
      .map((f) => QueryHelper.quoteIdentifier(f, this.type))
      .join(", ");
    const query = `CREATE ${uniqueStr} INDEX ${
      indexDef.name
    } ON ${QueryHelper.quoteIdentifier(tableName, this.type)} (${fields})`;

    await this.raw(query);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    this.ensureConnected();
    const query = `DROP INDEX ${indexName}`;
    await this.raw(query);
  }

  // CRUD Operations

  async insertMany(tableName: string, data: any[]): Promise<any[]> {
    this.ensureConnected();

    if (data.length === 0) return [];

    const results = [];
    for (const item of data) {
      results.push(await this.insertOne(tableName, item));
    }

    return results;
  }

  async findOne(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    const results = await this.find(tableName, filter, {
      ...options,
      limit: 1,
    });
    return results[0] || null;
  }

  async findById(tableName: string, id: any): Promise<any | null> {
    return this.findOne(tableName, { id } as QueryFilter);
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
    return this.updateOne(tableName, { id } as QueryFilter, data);
  }

  async upsert(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<any> {
    const existing = await this.findOne(tableName, filter);

    if (existing) {
      await this.updateOne(tableName, filter, data);
      return { ...existing, ...data };
    } else {
      return await this.insertOne(tableName, { ...filter, ...data });
    }
  }

  async deleteOne(tableName: string, filter: QueryFilter): Promise<boolean> {
    const count = await this.delete(tableName, filter);
    return count > 0;
  }

  async deleteById(tableName: string, id: any): Promise<boolean> {
    return this.deleteOne(tableName, { id } as QueryFilter);
  }

  async count(tableName: string, filter?: QueryFilter): Promise<number> {
    this.ensureConnected();

    const { clause, params } = QueryHelper.buildWhereClause(
      filter || {},
      this.type
    );

    let query = `SELECT COUNT(*) as count FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;

    if (clause !== "1=1") {
      query += ` WHERE ${clause}`;
    }

    const result = await this.raw(query, params);
    return parseInt(result.rows?.[0]?.count || "0");
  }

  async exists(tableName: string, filter: QueryFilter): Promise<boolean> {
    const count = await this.count(tableName, filter);
    return count > 0;
  }

  // Advanced Operations

  async aggregate(tableName: string, pipeline: any[]): Promise<any[]> {
    throw new Error(
      "Aggregate not supported for SQL databases. Use raw queries instead."
    );
  }

  async distinct(
    tableName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
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
    return result.rows?.map((row: any) => row[field]) || [];
  }

  async bulkWrite(
    tableName: string,
    operations: BulkOperation[]
  ): Promise<IResult> {
    this.ensureConnected();

    let totalAffected = 0;
    const insertedIds: any[] = [];

    for (const op of operations) {
      if (op.insertOne) {
        const result = await this.insertOne(tableName, op.insertOne.document);
        insertedIds.push(result.id);
        totalAffected++;
      } else if (op.updateOne) {
        const updated = await this.updateOne(
          tableName,
          op.updateOne.filter,
          op.updateOne.update
        );
        if (updated) totalAffected++;
      } else if (op.updateMany) {
        const count = await this.update(
          tableName,
          op.updateMany.filter,
          op.updateMany.update
        );
        totalAffected += count;
      } else if (op.deleteOne) {
        const deleted = await this.deleteOne(tableName, op.deleteOne.filter);
        if (deleted) totalAffected++;
      } else if (op.deleteMany) {
        const count = await this.delete(tableName, op.deleteMany.filter);
        totalAffected += count;
      }
    }

    return {
      rows: [],
      rowsAffected: totalAffected,
      insertedIds,
    };
  }

  // Raw Query & Execute

  async execute(
    connection: IConnection,
    query: string | any,
    params?: any[]
  ): Promise<IResult> {
    const result = await this.executeRaw(query, params);

    return {
      rows: result.rows || [],
      rowsAffected: result.rowsAffected || result.changes || 0,
      lastInsertId: result.lastInsertId || result.insertId,
      metadata: result,
    };
  }

  async createTable(
    tableName: string,
    schema: SchemaDefinition
  ): Promise<void> {
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
    await this.raw(query);
  }

  async dropTable(tableName: string): Promise<void> {
    this.ensureConnected();
    const query = `DROP TABLE IF EXISTS ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;
    await this.raw(query);
  }

  async insertOne(tableName: string, data: any): Promise<any> {
    this.ensureConnected();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = this.buildPlaceholders(keys.length);
    const quotedKeys = keys
      .map((k) => QueryHelper.quoteIdentifier(k, this.type))
      .join(", ");
    const query = `INSERT INTO ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )} (${quotedKeys}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.raw(query, values);
    return result.rows?.[0] || data;
  }

  async find(
    tableName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
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
    return result.rows || [];
  }

  async update(
    tableName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    this.ensureConnected();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClauses = keys
      .map(
        (key, i) =>
          `${QueryHelper.quoteIdentifier(
            key,
            this.type
          )} = ${this.getParamPlaceholder(i + 1)}`
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
    return result.rowsAffected || 0;
  }

  async delete(tableName: string, filter: QueryFilter): Promise<number> {
    this.ensureConnected();
    const { clause, params } = QueryHelper.buildWhereClause(filter, this.type);
    let query = `DELETE FROM ${QueryHelper.quoteIdentifier(
      tableName,
      this.type
    )}`;
    if (clause !== "1=1") query += ` WHERE ${clause}`;
    const result = await this.raw(query, params);
    return result.rowsAffected || 0;
  }

  async raw(query: string | any, params?: any[]): Promise<any> {
    this.ensureConnected();
    return this.executeRaw(query, params);
  }

  protected buildColumnDefinition(
    fieldName: string,
    fieldDef: FieldDefinition
  ): string {
    const quotedName = QueryHelper.quoteIdentifier(fieldName, this.type);
    let sqlType = TypeMapper.mapType(fieldDef.type, this.type);
    if (fieldDef.length && !fieldDef.type.includes("text"))
      sqlType += `(${fieldDef.length})`;
    let columnDef = `${quotedName} ${sqlType}`;
    if (fieldDef.primaryKey) columnDef += " PRIMARY KEY";
    if (fieldDef.autoIncrement)
      columnDef = this.buildAutoIncrementColumn(quotedName, sqlType);
    if (fieldDef.required) columnDef += " NOT NULL";
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
      return `'${this.sanitize(value)}'`;
    }
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return String(value);
  }

  protected buildPlaceholders(count: number): string {
    const placeholders: string[] = [];
    for (let i = 1; i <= count; i++) {
      placeholders.push(this.getParamPlaceholder(i));
    }
    return placeholders.join(", ");
  }

  protected getParamPlaceholder(index: number): string {
    switch (this.type) {
      case "postgresql":
        return `$${index}`;
      case "mysql":
      case "mariadb":
      case "sqlite":
        return "?";
      case "sqlserver":
        return `@p${index}`;
      default:
        return "?";
    }
  }

  sanitize(value: any): any {
    if (typeof value === "string") return value.replace(/'/g, "''");
    return value;
  }
}

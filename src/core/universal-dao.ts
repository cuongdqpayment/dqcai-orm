// ========================
// src/core/universal-dao.ts
// ========================

import {
  IConnection,
  IResult,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  IndexDefinition,
  BulkOperation,
  Transaction,
  ForeignKeyDefinition,
} from "@/types/orm.types";
import { IDAO } from "@/interfaces/dao.interface";
import { IAdapter } from "@/interfaces/adapter.interface";
import { DatabaseSchema, DatabaseType, DbConfig } from "@/types/orm.types";
import { ServiceStatus } from "@/types/service.types";

import { createModuleLogger, ORMModules } from "@/logger";
const logger = createModuleLogger(ORMModules.UNIVERSAL_DAO);

/**
 * ✅ ENHANCED Universal Data Access Object with Advanced CRUD
 */
export class UniversalDAO<TConnection extends IConnection = IConnection>
  implements IDAO
{
  protected adapter: IAdapter<TConnection>;
  protected connection: TConnection | null = null;
  public readonly schema: DatabaseSchema;
  public readonly databaseName: string;
  public readonly databaseType: DatabaseType;
  private isConnected: boolean = false;

  // Reconnection tracking
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;

  /**
   * Khởi tạo đối tượng DAO cần thiết cung cấp các thông tin sau
   * @param adapter - Bộ adapter tương thích với csdl đang kết nối
   * @param schema  - Định nghĩa một Schema đơn lẻ chứa các bảng của nó Đối với SQLITE thì tương đương một file.
   *                  còn đối với các loại db còn lại thì nó là một database, hoặc owner(oracle)
   */
  constructor(adapter: IAdapter<TConnection>, schema: DatabaseSchema) {
    this.adapter = adapter;
    this.databaseType = adapter.databaseType;
    this.databaseName = schema.database_name;
    this.schema = schema;

    logger.debug("Creating UniversalDAO instance", {
      databaseName: this.databaseName,
      databaseType: this.databaseType,
    });
  }

  // ========================== CONNECTION MANAGEMENT ==========================
  async connect(): Promise<void> {
    logger.debug("Attempting to connect to database", {
      databaseName: this.databaseName,
    });
    if (this.isConnected && this.connection) {
      logger.debug("Connection already established, skipping", {
        databaseName: this.databaseName,
      });
      return;
    }

    try {
      // thực thi việc kết nối với csdl theo config được lập trong adapter
      // và tạo mới hoặc chuyển sang databaseName đúng trong cấu trúc
      this.connection = await this.adapter.connect(this.databaseName);
      this.isConnected = true;
      logger.info("Database connection established", {
        databaseName: this.databaseName,
      });
    } catch (error) {
      logger.error("Failed to connect to database", {
        databaseName: this.databaseName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    logger.debug("Attempting to disconnect from database", {
      databaseName: this.databaseName,
    });
    try {
      if (this.connection) {
        await this.adapter.disconnect();
        this.connection = null;
        this.isConnected = false;
        logger.info("Database connection closed", {
          databaseName: this.databaseName,
        });
      } else {
        logger.debug("No connection to close", {
          databaseName: this.databaseName,
        });
      }
    } catch (error) {
      logger.error("Error disconnecting from database", {
        databaseName: this.databaseName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  isConnectionOpen(): boolean {
    logger.trace("Checking connection status", {
      databaseName: this.databaseName,
    });
    return this.isConnected && !!this.connection;
  }

  /**
   * Bảo đảm kết nối trước khi thực thi
   * @returns
   */
  async ensureConnected(): Promise<TConnection> {
    logger.debug("Ensuring connection", {
      databaseName: this.schema.database_name,
      databaseType: this.databaseType,
      adapterConnected: this.adapter.isConnected(),
    });

    // vì lý do gì đó mà adapter đóng connection làm cho this.connection bị lỗi thì kiểm tra chái này
    const existingConnection = this.adapter.getConnection();
    if (existingConnection && existingConnection.isConnected) {
      logger.info("Adapter already has active connection, reusing it", {
        databaseName: this.schema.database_name,
      });
      this.connection = existingConnection as TConnection;
      return this.connection;
    }

    if (this.connection && this.connection.isConnected) {
      logger.trace("DAO connection already active");
      return this.connection;
    }

    if (this.connection && !this.connection.isConnected) {
      logger.debug("Stale connection detected, resetting");
      this.connection = null;
    }

    if (!this.adapter.isConnected()) {
      logger.info("Establishing new connection");

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < this.maxReconnectAttempts; attempt++) {
        try {
          this.connection = await this.adapter.connect(this.databaseName);
          this.reconnectAttempts = 0;
          logger.info("Connected successfully");
          return this.connection;
        } catch (error) {
          lastError = error as Error;
          this.reconnectAttempts++;
          logger.warn("Connection attempt failed", { attempt: attempt + 1 });

          if (attempt < this.maxReconnectAttempts - 1) {
            await this.sleep(this.reconnectDelay * (attempt + 1));
          }
        }
      }

      throw new Error(
        `Failed to connect after ${this.maxReconnectAttempts} attempts: ${lastError?.message}`
      );
    }

    const adapterConnection = this.adapter.getConnection();
    if (!adapterConnection) {
      throw new Error("Adapter is connected but has no connection object");
    }

    this.connection = adapterConnection as TConnection;
    return this.connection;
  }

  /**
   *
   * @param error
   * @returns
   */
  private isConnectionError(error: any): boolean {
    const connectionErrorMessages = [
      "connection",
      "timeout",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "socket",
      "closed",
      "lost",
    ];

    const errorMessage = error?.message?.toLowerCase() || "";
    return connectionErrorMessages.some((msg) => errorMessage.includes(msg));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== DLL====================
  async execute(query: string | any, params?: any[]): Promise<IResult> {
    logger.trace("Executing query");

    try {
      const connection = await this.ensureConnected();
      return await this.adapter.execute(connection, query, params);
    } catch (error) {
      if (this.isConnectionError(error)) {
        logger.warn("Connection error detected, attempting reconnect");
        this.connection = null;
        const connection = await this.ensureConnected();
        return await this.adapter.execute(connection, query, params);
      }
      throw error;
    }
  }

  // ==================== BASIC CRUD OPERATIONS ====================

  async find<T = any>(
    entityName: string,
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<T[]> {
    logger.trace("Finding records", { entityName });
    await this.ensureConnected();
    return this.adapter.find(entityName, query, options) as Promise<T[]>;
  }

  async findOne<T = any>(
    entityName: string,
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<T | null> {
    logger.trace("Finding one record", { entityName });
    await this.ensureConnected();
    return this.adapter.findOne(
      entityName,
      query,
      options
    ) as Promise<T | null>;
  }

  async findById<T = any>(entityName: string, id: any): Promise<T | null> {
    logger.trace("Finding record by ID", { entityName, id });
    await this.ensureConnected();
    return this.adapter.findById(entityName, id) as Promise<T | null>;
  }

  async insert<T = any>(entityName: string, data: Partial<T>): Promise<T> {
    logger.debug("Inserting record", { entityName });
    await this.ensureConnected();
    return this.adapter.insertOne(entityName, data) as Promise<T>;
  }

  async insertMany<T = any>(
    entityName: string,
    data: Partial<T>[]
  ): Promise<T[]> {
    logger.debug("Inserting many records", { entityName, count: data.length });
    await this.ensureConnected();
    return this.adapter.insertMany(entityName, data) as Promise<T[]>;
  }

  async update(
    entityName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    logger.debug("Updating records", { entityName });
    await this.ensureConnected();
    return this.adapter.update(entityName, filter, data);
  }

  async updateOne(
    entityName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    logger.trace("Updating one record", { entityName });
    await this.ensureConnected();
    return this.adapter.updateOne(entityName, filter, data);
  }

  async updateById(entityName: string, id: any, data: any): Promise<boolean> {
    logger.trace("Updating record by ID", { entityName, id });
    await this.ensureConnected();
    return this.adapter.updateById(entityName, id, data);
  }

  async delete(entityName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", { entityName });
    await this.ensureConnected();
    return this.adapter.delete(entityName, filter);
  }

  async deleteOne(entityName: string, filter: QueryFilter): Promise<boolean> {
    logger.trace("Deleting one record", { entityName });
    await this.ensureConnected();
    return this.adapter.deleteOne(entityName, filter);
  }

  async deleteById(entityName: string, id: any): Promise<boolean> {
    logger.trace("Deleting record by ID", { entityName, id });
    await this.ensureConnected();
    return this.adapter.deleteById(entityName, id);
  }

  async count(entityName: string, filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", { entityName });
    await this.ensureConnected();
    return this.adapter.count(entityName, filter);
  }

  // ==================== 🆕 ADVANCED CRUD OPERATIONS ====================

  /**
   * Upsert - Insert hoặc Update nếu đã tồn tại
   */
  async upsert<T = any>(
    entityName: string,
    data: Partial<T>,
    filter?: QueryFilter
  ): Promise<T> {
    logger.debug("Performing upsert", { entityName });
    await this.ensureConnected();
    return this.adapter.upsert(entityName, data, filter) as Promise<T>;
  }

  /**
   * Kiểm tra sự tồn tại của record
   */
  async exists(entityName: string, filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", { entityName });
    await this.ensureConnected();
    return this.adapter.exists(entityName, filter);
  }

  /**
   * Lấy các giá trị distinct của một field
   */
  async distinct<T = any>(
    entityName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<T[]> {
    logger.trace("Getting distinct values", { entityName, field });
    await this.ensureConnected();
    return this.adapter.distinct(entityName, field, filter) as Promise<T[]>;
  }

  /**
   * Bulk write operations (MongoDB-style)
   */
  async bulkWrite(
    entityName: string,
    operations: BulkOperation[]
  ): Promise<IResult> {
    logger.debug("Performing bulk write", {
      entityName,
      operationCount: operations.length,
    });
    await this.ensureConnected();
    return this.adapter.bulkWrite(entityName, operations);
  }

  /**
   * Aggregate operations (MongoDB-style pipeline)
   */
  async aggregate<T = any>(entityName: string, pipeline: any[]): Promise<T[]> {
    logger.debug("Performing aggregation", {
      entityName,
      pipelineStages: pipeline.length,
    });
    await this.ensureConnected();
    return this.adapter.aggregate(entityName, pipeline) as Promise<T[]>;
  }

  /**
   * Raw query execution
   */
  async raw<T = any>(query: string | any, params?: any[]): Promise<T> {
    logger.trace("Executing raw query");
    await this.ensureConnected();
    return this.adapter.raw(query, params) as Promise<T>;
  }

  // ==================== 🆕 SCHEMA MANAGEMENT ====================

  /**
   * Tạo table/collection
   * @param entityName
   * @param schema
   */
  async createTable(
    entityName: string,
    schema?: SchemaDefinition
  ): Promise<void> {
    logger.debug("Creating table with full schema", { entityName });
    await this.ensureConnected();

    let schemaDefinition: SchemaDefinition = schema || {};
    let indexes: IndexDefinition[] = [];
    let foreignKeys: ForeignKeyDefinition[] = [];

    if (!schema) {
      const entitySchema = this.schema.schemas[entityName];
      if (!entitySchema) {
        throw new Error(`Entity '${entityName}' not found in schema`);
      }

      // ✅ Build SchemaDefinition from cols
      for (const col of entitySchema.cols) {
        const fieldName = col.name || "";
        if (fieldName) {
          schemaDefinition[fieldName] = col;
        }
      }

      // ✅ Extract indexes from schema
      if (entitySchema.indexes && entitySchema.indexes.length > 0) {
        indexes = entitySchema.indexes.map((idx) => ({
          name: idx.name,
          fields: idx.fields,
          unique: idx.unique || false,
        }));
      }

      // ✅ Extract foreign keys from schema
      if (entitySchema.foreign_keys && entitySchema.foreign_keys.length > 0) {
        foreignKeys = entitySchema.foreign_keys.map((fk) => ({
          name: fk.name,
          fields: fk.fields,
          references: { ...fk.references },
          on_delete: fk.on_delete || "NO ACTION",
          on_update: fk.on_update || "NO ACTION",
        }));
      }
    }

    // ✅ 1. Tạo table với columns + foreign_keys include
    await this.adapter.createTable(entityName, schemaDefinition, foreignKeys);
    logger.info("Table structure created", { entityName });

    // ✅ 2. Tạo indexes (nếu có)
    if (indexes.length > 0) {
      logger.info("Creating indexes", { entityName, count: indexes.length });
      for (const indexDef of indexes) {
        try {
          await this.adapter.createIndex(entityName, indexDef);
          logger.debug("Index created successfully", {
            entityName,
            indexName: indexDef.name,
          });
        } catch (error) {
          logger.error("Failed to create index", {
            entityName,
            indexName: indexDef.name,
            error: (error as Error).message,
          });
          // Không throw, tiếp tục tạo các index khác
        }
      }
    }

    logger.info("Table created with full schema", {
      entityName,
      indexCount: indexes.length,
      foreignKeyCount: foreignKeys.length,
    });
  }

  /**
   * Drop table/collection
   */
  async dropTable(entityName: string): Promise<void> {
    logger.info("Dropping table", { entityName });
    await this.ensureConnected();
    await this.adapter.dropTable(entityName);
  }

  /**
   * Truncate table/collection
   */
  async truncateTable(entityName: string): Promise<void> {
    logger.info("Truncating table", { entityName });
    await this.ensureConnected();
    await this.adapter.truncateTable(entityName);
  }

  /**
   * Alter table structure
   */
  async alterTable(
    entityName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    logger.info("Altering table", { entityName });
    await this.ensureConnected();
    await this.adapter.alterTable(entityName, changes);
  }

  /**
   * Kiểm tra table/collection tồn tại
   */
  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", { tableName });
    await this.ensureConnected();
    return this.adapter.tableExists(tableName);
  }

  /**
   * Lấy thông tin table structure
   */
  async getTableInfo(tableName: string): Promise<any> {
    logger.trace("Getting table info", { tableName });
    await this.ensureConnected();
    return this.adapter.getTableInfo(tableName);
  }

  /**
   * Sync tất cả tables/collections từ schema
   */

  async syncAllTables(): Promise<void> {
    logger.info("Syncing all tables with dependencies", {
      databaseName: this.schema.database_name,
      tableCount: Object.keys(this.schema.schemas).length,
    });

    await this.ensureConnected();

    // ✅ 1. Tạo danh sách tables theo thứ tự dependency
    const tableOrder = this.resolveDependencyOrder();

    // ✅ 2. Tạo tables theo thứ tự
    for (const entityName of tableOrder) {
      const exists = await this.adapter.tableExists(entityName);

      if (!exists) {
        logger.info("Creating table with full schema", { entityName });
        await this.createTable(entityName);
      } else {
        logger.debug("Table already exists", { entityName });
      }
    }

    logger.info("All tables synced successfully");
  }

  // ==================== 🆕 INDEX MANAGEMENT ====================

  /**
   * Tạo index
   */
  async createIndex(
    entityName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index", { entityName, indexName: indexDef.name });
    await this.ensureConnected();
    await this.adapter.createIndex(entityName, indexDef);
  }

  /**
   * Drop index
   */
  async dropIndex(entityName: string, indexName: string): Promise<void> {
    logger.info("Dropping index", { entityName, indexName });
    await this.ensureConnected();
    await this.adapter.dropIndex(entityName, indexName);
  }

  /**
   * ✅ Giải quyết thứ tự tạo tables dựa trên foreign key dependencies
   */
  private resolveDependencyOrder(): string[] {
    const schemas = this.schema.schemas;
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (entityName: string) => {
      if (visited.has(entityName)) return;
      if (visiting.has(entityName)) {
        logger.warn("Circular dependency detected", { entityName });
        return;
      }

      visiting.add(entityName);

      const entitySchema = schemas[entityName];
      if (entitySchema?.foreign_keys) {
        for (const fk of entitySchema.foreign_keys) {
          const refTable = fk.references.table;
          if (schemas[refTable] && !visited.has(refTable)) {
            visit(refTable);
          }
        }
      }

      visiting.delete(entityName);
      visited.add(entityName);
      order.push(entityName);
    };

    // Visit tất cả entities
    for (const entityName of Object.keys(schemas)) {
      visit(entityName);
    }

    logger.debug("Resolved dependency order", { order });
    return order;
  }
  // ==================== 🆕 TRANSACTION MANAGEMENT ====================

  /**
   * Bắt đầu transaction
   */
  async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning transaction");
    await this.ensureConnected();
    return this.adapter.beginTransaction();
  }

  /**
   * Thực thi callback trong transaction với auto commit/rollback
   */
  async withTransaction<T>(callback: (dao: this) => Promise<T>): Promise<T> {
    logger.debug("Starting transaction callback");
    await this.ensureConnected();
    const tx = await this.adapter.beginTransaction();

    try {
      const result = await callback(this);
      await tx.commit();
      logger.info("Transaction committed successfully");
      return result;
    } catch (error) {
      await tx.rollback();
      logger.error("Transaction rolled back", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ==================== 🆕 UTILITY METHODS ====================

  /**
   * Sanitize giá trị trước khi insert/update
   */
  sanitize(value: any): any {
    return this.adapter.sanitize(value);
  }

  /**
   * Execute raw query (alias)
   */
  async executeRaw(query: string | any, params?: any[]): Promise<any> {
    return this.raw(query, params);
  }

  // ==================== LIFECYCLE ====================

  async close(): Promise<void> {
    logger.info("Closing DAO connection");
    if (this.connection && this.connection.isConnected) {
      await this.connection.close();
      this.connection = null;
    }
  }

  getStatus(entityName: string): Partial<ServiceStatus> {
    return {
      schemaName: this.schema.database_name,
      entityName: entityName,
      isOpened: !!this.connection && this.connection.isConnected,
      hasDao: true,
      isInitialized: true,
      connectionStatus: this.adapter.isConnected()
        ? "connected"
        : "disconnected",
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  getAdapter(): IAdapter<TConnection> {
    return this.adapter;
  }

  getSchema(): DatabaseSchema {
    return this.schema;
  }

  async healthCheck(): Promise<boolean> {
    logger.debug("Performing health check");
    try {
      await this.ensureConnected();
      return this.adapter.isConnected();
    } catch (error) {
      logger.warn("Health check failed", { error: (error as Error).message });
      return false;
    }
  }

  async reconnect(): Promise<void> {
    logger.info("Force reconnecting DAO");
    await this.close();
    this.connection = null;
    await this.ensureConnected();
  }
}

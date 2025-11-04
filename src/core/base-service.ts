// ========================
// src/core/base-service.ts
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseManager } from "./database-manager";
import {
  IResult,
  QueryFilter,
  QueryOptions,
  Transaction,
  SchemaDefinition,
  IndexDefinition,
  BulkOperation,
} from "@/types/orm.types";
import { ServiceStatus } from "@/types/service.types";
import { createModuleLogger, ORMModules } from "@/logger";
const logger = createModuleLogger(ORMModules.BASE_SERVICE);

/**
 * ✅ ENHANCED Base Service with Advanced CRUD Operations
 */
export abstract class BaseService<TModel = any> {
  protected dao: UniversalDAO<any> | null = null;
  protected schemaKey: string;
  protected entityName: string;
  protected isOpened: boolean = false;
  public lastAccess: number = Date.now();

  constructor(schemaKey: string, entityName: string) {
    this.schemaKey = schemaKey;
    this.entityName = entityName;

    logger.debug("Creating BaseService instance", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
    });
  }

  // ==================== INITIALIZATION ====================

  public async initialize(retries: number = 3): Promise<void> {
    this.lastAccess = Date.now();

    logger.info("Initializing service with adapter sharing", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      hasRegisteredAdapter: !!DatabaseManager.getAdapterInstance(
        this.schemaKey
      ),
    });

    if (this.dao && this.dao.getAdapter().isConnected()) {
      logger.debug("Service already initialized, skipping");
      return;
    }

    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        this.dao = await DatabaseManager.getDAO(this.schemaKey);
        this.isOpened = true;
        logger.info("Service initialized successfully");
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn("Initialization attempt failed", { attempt: i + 1 });
        if (i < retries - 1) {
          await this.sleep(1000 * (i + 1));
        }
      }
    }

    throw new Error(
      `Failed to initialize service ${this.schemaKey}:${this.entityName} after ${retries} retries: ${lastError}`
    );
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.dao || !this.isOpened) {
      await this.initialize();
      return;
    }

    if (!this.dao.getAdapter().isConnected()) {
      logger.warn("Connection lost, reinitializing");
      await this.initialize();
    }
  }

  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      throw new Error(
        `Service not initialized for ${this.schemaKey}:${this.entityName}. Call initialize() first.`
      );
    }
    return this.dao;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== PUBLIC DAO ACCESS ====================

  public async getUniversalDAO(): Promise<UniversalDAO<any>> {
    await this.ensureInitialized();
    return this.getDAO();
  }

  public async executeRaw(
    query: string | any,
    params?: any[]
  ): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  public async getAdapter(): Promise<any> {
    await this.ensureInitialized();
    return this.getDAO().getAdapter();
  }

  public getSchema(): any {
    return this.getDAO().getSchema();
  }

  // ==================== BASIC CRUD OPERATIONS ====================

  public async find(
    query: QueryFilter = {},
    options?: QueryOptions
  ): Promise<TModel[]> {
    logger.trace("Finding records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().find<TModel>(this.entityName, query, options);
  }

  public async findOne(
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<TModel | null> {
    logger.trace("Finding one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findOne<TModel>(this.entityName, query, options);
  }

  public async findById(id: any): Promise<TModel | null> {
    logger.trace("Finding record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    logger.debug("Creating record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    const result = await this.getDAO().insert<TModel>(
      this.entityName,
      processedData
    );
    return this.afterCreate(result);
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating many records", {
      entityName: this.entityName,
      count: data.length,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const processedData = await Promise.all(
      data.map((item) => this.beforeCreate(item))
    );
    const results = await this.getDAO().insertMany<TModel>(
      this.entityName,
      processedData
    );
    return Promise.all(results.map((result) => this.afterCreate(result)));
  }

  public async update(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<number> {
    logger.debug("Updating records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    const count = await this.getDAO().update(
      this.entityName,
      filter,
      processedData
    );
    await this.afterUpdate(count);
    return count;
  }

  public async updateOne(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<boolean> {
    logger.trace("Updating one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    return this.getDAO().updateOne(this.entityName, filter, processedData);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    logger.trace("Updating record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate({ id }, data);
    return this.getDAO().updateById(this.entityName, id, processedData);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    const count = await this.getDAO().delete(this.entityName, filter);
    await this.afterDelete(count);
    return count;
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    logger.trace("Deleting one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    return this.getDAO().deleteOne(this.entityName, filter);
  }

  public async deleteById(id: any): Promise<boolean> {
    logger.trace("Deleting record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().deleteById(this.entityName, id);
  }

  public async count(filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().count(this.entityName, filter);
  }

  // ==================== 🆕 ADVANCED CRUD OPERATIONS ====================

  /**
   * Upsert - Insert nếu không tồn tại, Update nếu đã tồn tại
   * @example
   * await userService.upsert({ email: 'user@example.com' }, { name: 'John', age: 30 });
   */
  public async upsert(
    data: Partial<TModel>,
    filter?: QueryFilter
  ): Promise<TModel> {
    logger.debug("Performing upsert", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    return this.getDAO().upsert<TModel>(this.entityName, processedData, filter);
  }

  /**
   * Kiểm tra sự tồn tại của record
   * @example
   * const exists = await userService.exists({ email: 'user@example.com' });
   */
  public async exists(filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().exists(this.entityName, filter);
  }

  /**
   * Lấy các giá trị unique của một field
   * @example
   * const categories = await productService.distinct('category');
   */
  public async distinct<T = any>(
    field: string,
    filter?: QueryFilter
  ): Promise<T[]> {
    logger.trace("Getting distinct values", {
      entityName: this.entityName,
      field,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().distinct<T>(this.entityName, field, filter);
  }

  /**
   * Find với pagination
   * @example
   * const result = await userService.paginate({ status: 'active' }, { page: 1, limit: 20 });
   */
  public async paginate(
    filter: QueryFilter = {},
    options: { page?: number; limit?: number; sort?: any } = {}
  ): Promise<{
    data: TModel[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    logger.trace("Paginating records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.getDAO().find<TModel>(this.entityName, filter, {
        limit,
        skip,
        sort: options.sort,
      }),
      this.getDAO().count(this.entityName, filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find first record hoặc tạo mới nếu không tìm thấy
   * @example
   * const user = await userService.findOrCreate(
   *   { email: 'user@example.com' },
   *   { name: 'John', email: 'user@example.com' }
   * );
   */
  public async findOrCreate(
    filter: QueryFilter,
    defaultData: Partial<TModel>
  ): Promise<{ record: TModel; created: boolean }> {
    logger.debug("Finding or creating record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const existing = await this.getDAO().findOne<TModel>(
      this.entityName,
      filter
    );
    if (existing) {
      return { record: existing, created: false };
    }

    const processedData = await this.beforeCreate({
      ...filter,
      ...defaultData,
    });
    const created = await this.getDAO().insert<TModel>(
      this.entityName,
      processedData
    );
    return { record: await this.afterCreate(created), created: true };
  }

  /**
   * Increment giá trị numeric field
   * @example
   * await productService.increment({ id: 1 }, 'views', 1);
   */
  public async increment(
    filter: QueryFilter,
    field: keyof TModel,
    value: number = 1
  ): Promise<number> {
    logger.debug("Incrementing field", {
      entityName: this.entityName,
      field,
      value,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    // For SQL databases, use direct SQL
    if (
      ["postgresql", "mysql", "mariadb", "sqlite", "sqlserver"].includes(
        this.getDAO().databaseType
      )
    ) {
      const adapter = this.getDAO().getAdapter();
      const whereClause = Object.entries(filter)
        .map(([key, val]) => `${key} = ${adapter.sanitize(val)}`)
        .join(" AND ");

      const query = `UPDATE ${this.entityName} SET ${String(field)} = ${String(
        field
      )} + ${value} WHERE ${whereClause}`;
      const result = await this.getDAO().executeRaw(query);
      return result.rowsAffected || 0;
    }

    // For NoSQL, fetch and update
    const records = await this.find(filter);
    let updated = 0;
    for (const record of records) {
      const currentValue = (record as any)[field] || 0;
      await this.update(
        { id: (record as any).id } as QueryFilter,
        {
          [field]: currentValue + value,
        } as any
      );
      updated++;
    }
    return updated;
  }

  /**
   * Decrement giá trị numeric field
   * @example
   * await productService.decrement({ id: 1 }, 'stock', 5);
   */
  public async decrement(
    filter: QueryFilter,
    field: keyof TModel,
    value: number = 1
  ): Promise<number> {
    return this.increment(filter, field, -value);
  }

  /**
   * Soft delete - Set deleted flag thay vì xóa thực sự
   * @example
   * await userService.softDelete({ id: 1 });
   */
  public async softDelete(filter: QueryFilter): Promise<number> {
    logger.debug("Soft deleting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.update(filter, {
      deleted: true,
      deletedAt: new Date(),
    } as any);
  }

  /**
   * Restore soft deleted records
   * @example
   * await userService.restore({ id: 1 });
   */
  public async restore(filter: QueryFilter): Promise<number> {
    logger.debug("Restoring soft deleted records", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.update(filter, {
      deleted: false,
      deletedAt: null,
    } as any);
  }

  /**
   * Bulk write operations (MongoDB-style)
   * @example
   * await userService.bulkWrite([
   *   { insertOne: { document: { name: 'John' } } },
   *   { updateOne: { filter: { id: 1 }, update: { age: 30 } } },
   *   { deleteOne: { filter: { id: 2 } } }
   * ]);
   */
  public async bulkWrite(operations: BulkOperation[]): Promise<IResult> {
    logger.debug("Performing bulk write", {
      entityName: this.entityName,
      count: operations.length,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().bulkWrite(this.entityName, operations);
  }

  /**
   * Aggregate operations (MongoDB-style pipeline)
   * @example
   * const stats = await userService.aggregate([
   *   { $match: { status: 'active' } },
   *   { $group: { _id: '$country', total: { $sum: 1 } } }
   * ]);
   */
  public async aggregate<T = any>(pipeline: any[]): Promise<T[]> {
    logger.debug("Performing aggregation", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().aggregate<T>(this.entityName, pipeline);
  }

  /**
   * Raw query execution
   * @example
   * const result = await userService.raw('SELECT * FROM users WHERE age > ?', [18]);
   */
  public async raw<T = any>(query: string | any, params?: any[]): Promise<T> {
    logger.trace("Executing raw query", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().raw<T>(query, params);
  }

  // ==================== TRANSACTION SUPPORT ====================

  public async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning transaction", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().beginTransaction();
  }

  public async withTransaction<T>(
    callback: (service: this) => Promise<T>
  ): Promise<T> {
    logger.debug("Starting transaction callback", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    return this.getDAO().withTransaction(async () => callback(this));
  }

  public async createBatch(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating batch with transaction", {
      entityName: this.entityName,
      count: data.length,
    });
    return this.withTransaction(async () => this.createMany(data));
  }

  public async updateBatch(
    updates: Array<{ filter: QueryFilter; data: Partial<TModel> }>
  ): Promise<number> {
    logger.debug("Updating batch with transaction", {
      entityName: this.entityName,
    });
    return this.withTransaction(async () => {
      let totalCount = 0;
      for (const { filter, data } of updates) {
        const count = await this.update(filter, data);
        totalCount += count;
      }
      return totalCount;
    });
  }

  public async deleteBatch(filters: QueryFilter[]): Promise<number> {
    logger.debug("Deleting batch with transaction", {
      entityName: this.entityName,
    });
    return this.withTransaction(async () => {
      let totalCount = 0;
      for (const filter of filters) {
        const count = await this.delete(filter);
        totalCount += count;
      }
      return totalCount;
    });
  }

  // ==================== 🆕 SCHEMA MANAGEMENT ====================

  /**
   * Tạo table/collection cho entity
   */
  public async createTable(schema?: SchemaDefinition): Promise<void> {
    logger.info("Creating table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().createTable(this.entityName, schema);
  }

  /**
   * Drop table/collection
   */
  public async dropTable(): Promise<void> {
    logger.info("Dropping table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().dropTable(this.entityName);
  }

  /**
   * Truncate table/collection
   */
  public async truncateTable(): Promise<void> {
    logger.info("Truncating table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().truncateTable(this.entityName);
  }

  /**
   * Alter table structure
   */
  public async alterTable(changes: SchemaDefinition): Promise<void> {
    logger.info("Altering table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().alterTable(this.entityName, changes);
  }

  /**
   * Kiểm tra table tồn tại
   */
  public async tableExists(): Promise<boolean> {
    await this.ensureInitialized();
    return this.getDAO().tableExists(this.entityName);
  }

  /**
   * Lấy thông tin table structure
   */
  public async getTableInfo(): Promise<any> {
    await this.ensureInitialized();
    return this.getDAO().getTableInfo(this.entityName);
  }

  // ==================== 🆕 INDEX MANAGEMENT ====================

  /**
   * Tạo index cho table
   * @example
   * await userService.createIndex({
   *   name: 'idx_email',
   *   fields: ['email'],
   *   unique: true
   * });
   */
  public async createIndex(indexDef: IndexDefinition): Promise<void> {
    logger.info("Creating index", {
      entityName: this.entityName,
      indexName: indexDef.name,
    });
    await this.ensureInitialized();
    await this.getDAO().createIndex(this.entityName, indexDef);
  }

  /**
   * Drop index
   */
  public async dropIndex(indexName: string): Promise<void> {
    logger.info("Dropping index", { entityName: this.entityName, indexName });
    await this.ensureInitialized();
    await this.getDAO().dropIndex(this.entityName, indexName);
  }

  // ==================== HOOKS ====================

  protected async beforeCreate(
    data: Partial<TModel>
  ): Promise<Partial<TModel>> {
    return data;
  }

  protected async afterCreate(result: TModel): Promise<TModel> {
    return result;
  }

  protected async beforeUpdate(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<Partial<TModel>> {
    return data;
  }

  protected async afterUpdate(count: number): Promise<void> {}

  protected async beforeDelete(filter: QueryFilter): Promise<void> {}

  protected async afterDelete(count: number): Promise<void> {}

  // ==================== STATUS & LIFECYCLE ====================

  public getStatus(): ServiceStatus {
    const daoStatus = this.dao?.getStatus(this.entityName) || {};
    return {
      schemaName: this.schemaKey,
      entityName: this.entityName,
      isOpened: this.isOpened,
      isInitialized: !!this.dao,
      hasDao: !!this.dao,
      lastAccess: new Date(this.lastAccess).toISOString(),
      connectionStatus: this.dao?.getAdapter().isConnected()
        ? "connected"
        : "disconnected",
      ...daoStatus,
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    logger.info("Closing service", { entityName: this.entityName });
    this.isOpened = false;
  }

  public destroy(): void {
    logger.info("Destroying service", { entityName: this.entityName });
    this.dao = null;
    this.isOpened = false;
  }

  public getEntityName(): string {
    return this.entityName;
  }

  public getSchemaKey(): string {
    return this.schemaKey;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.dao?.getAdapter().isConnected() || false;
    } catch (error) {
      return false;
    }
  }

  public async refresh(): Promise<void> {
    logger.info("Refreshing service connection", {
      entityName: this.entityName,
    });
    if (this.dao) {
      await this.dao.close();
    }
    this.isOpened = false;
    await this.initialize();
  }

  // ==================== 🆕 UTILITY METHODS ====================

  /**
   * Sanitize giá trị
   */
  public sanitize(value: any): any {
    return this.getDAO().sanitize(value);
  }

  /**
   * Execute query thông qua DAO
   */
  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }
}

// ========================
// src/core/base-service.ts (GUARANTEED ADAPTER SHARING)
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseManager } from "./database-manager";
import { IResult, QueryFilter, QueryOptions, Transaction } from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.BASE_SERVICE);

/**
 * Base Service - ✅ GUARANTEED to use shared adapter from DatabaseManager
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
      entityName: this.entityName
    });
  }

  // ==================== INITIALIZATION (FIXED) ====================

  /**
   * ✅ FIXED: Khởi tạo service - Đảm bảo dùng adapter đã register
   */
  public async initialize(retries: number = 3): Promise<void> {
    this.lastAccess = Date.now();

    logger.info("Initializing service with adapter sharing", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      retries,
      hasRegisteredAdapter: !!DatabaseManager.getAdapterInstance(this.schemaKey)
    });

    if (this.dao && this.dao.getAdapter().isConnected()) {
      logger.debug("Service already initialized with connected adapter, skipping", {
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });
      return;
    }

    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      logger.debug("Initialization retry attempt", {
        attempt: i + 1,
        totalRetries: retries,
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });

      try {
        // ✅ KEY FIX: Sử dụng DatabaseManager.getDAO() thay vì getOrCreateDAO()
        // Điều này đảm bảo sử dụng adapter đã được register
        this.dao = await DatabaseManager.getDAO(this.schemaKey);
        this.isOpened = true;

        logger.info("Service initialized successfully with shared adapter", {
          schemaKey: this.schemaKey,
          entityName: this.entityName,
          adapterConnected: this.dao.getAdapter().isConnected()
        });

        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn("Initialization attempt failed", {
          attempt: i + 1,
          totalRetries: retries,
          schemaKey: this.schemaKey,
          entityName: this.entityName,
          error: lastError.message
        });

        if (i < retries - 1) {
          await this.sleep(1000 * (i + 1)); // Exponential backoff
        }
      }
    }

    logger.error("Failed to initialize service after retries", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      retries,
      lastError: lastError?.message
    });

    throw new Error(
      `Failed to initialize service ${this.schemaKey}:${this.entityName} after ${retries} retries: ${lastError}`
    );
  }

  /**
   * ✅ IMPROVED: Đảm bảo service đã được khởi tạo với auto-reconnect
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.dao || !this.isOpened) {
      logger.debug("Service not initialized, initializing now", {
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });
      await this.initialize();
      return;
    }

    // ✅ Kiểm tra connection còn sống không
    if (!this.dao.getAdapter().isConnected()) {
      logger.warn("Connection lost for service, reinitializing to get shared adapter", {
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });
      // Re-initialize để lấy lại DAO với adapter đã register
      await this.initialize();
    }
  }

  /**
   * Lấy DAO (protected) với auto-reconnect
   */
  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      logger.error("Service not initialized, cannot get DAO", {
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });
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

  /**
   * Lấy UniversalDAO để tương tác trực tiếp với database
   * @returns UniversalDAO instance
   */
  public async getUniversalDAO(): Promise<UniversalDAO<any>> {
    logger.trace("Getting UniversalDAO", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    await this.ensureInitialized();
    return this.getDAO();
  }

  /**
   * Thực thi truy vấn raw thông qua DAO
   */
  public async executeRaw(query: string | any, params?: any[]): Promise<IResult> {
    logger.trace("Executing raw query", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      queryType: typeof query === 'string' ? 'sql' : 'object'
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  /**
   * Lấy adapter từ DAO
   */
  public async getAdapter(): Promise<any> {
    logger.trace("Getting adapter", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    await this.ensureInitialized();
    return this.getDAO().getAdapter();
  }

  /**
   * Lấy schema từ DAO
   */
  public getSchema(): any {
    logger.trace("Getting schema", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    return this.getDAO().getSchema();
  }

  // ==================== CRUD OPERATIONS ====================

  public async find(query: QueryFilter = {}, options?: QueryOptions): Promise<TModel[]> {
    logger.trace("Finding records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      queryKeys: Object.keys(query)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const results = await this.getDAO().find<TModel>(this.entityName, query, options);
    logger.trace("Found records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      count: results.length
    });

    return results;
  }

  public async findOne(
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<TModel | null> {
    logger.trace("Finding one record", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      queryKeys: Object.keys(query)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const result = await this.getDAO().findOne<TModel>(this.entityName, query, options);
    logger.trace("Found one record", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      found: !!result
    });

    return result;
  }

  public async findById(id: any): Promise<TModel | null> {
    logger.trace("Finding record by ID", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      id
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    logger.debug("Creating record", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      dataKeys: Object.keys(data)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    const result = await this.getDAO().insert<TModel>(this.entityName, processedData);
    const finalResult = await this.afterCreate(result);

    logger.info("Created record successfully", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    return finalResult;
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating many records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      count: data.length
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    
    // Áp dụng beforeCreate cho từng item
    const processedData = await Promise.all(
      data.map((item) => this.beforeCreate(item))
    );
    
    const results = await this.getDAO().insertMany<TModel>(this.entityName, processedData);
    
    // Áp dụng afterCreate cho từng result
    const finalResults = await Promise.all(results.map((result) => this.afterCreate(result)));

    logger.info("Created many records successfully", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      count: finalResults.length
    });

    return finalResults;
  }

  public async update(filter: QueryFilter, data: Partial<TModel>): Promise<number> {
    logger.debug("Updating records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    const count = await this.getDAO().update(this.entityName, filter, processedData);
    await this.afterUpdate(count);

    logger.info("Updated records successfully", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      affectedCount: count
    });

    return count;
  }

  public async updateOne(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<boolean> {
    logger.trace("Updating one record", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    return this.getDAO().updateOne(this.entityName, filter, processedData);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    logger.trace("Updating record by ID", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      id,
      dataKeys: Object.keys(data)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate({ id }, data);
    return this.getDAO().updateById(this.entityName, id, processedData);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    const count = await this.getDAO().delete(this.entityName, filter);
    await this.afterDelete(count);

    logger.info("Deleted records successfully", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      affectedCount: count
    });

    return count;
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    logger.trace("Deleting one record", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    return this.getDAO().deleteOne(this.entityName, filter);
  }

  public async deleteById(id: any): Promise<boolean> {
    logger.trace("Deleting record by ID", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      id
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().deleteById(this.entityName, id);
  }

  public async count(filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      hasFilter: !!filter
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const count = await this.getDAO().count(this.entityName, filter);

    logger.trace("Counted records", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      count
    });

    return count;
  }

  public async exists(filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter)
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const count = await this.count(filter);
    const exists = count > 0;

    logger.trace("Existence check result", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      exists
    });

    return exists;
  }

  // ==================== ADVANCED OPERATIONS ====================

  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    logger.trace("Executing advanced query", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      queryType: typeof query === 'string' ? 'sql' : 'object'
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  // ==================== TRANSACTION SUPPORT ====================

  /**
   * Bắt đầu transaction (low-level)
   */
  public async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning transaction", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().getAdapter().beginTransaction();
  }

  /**
   * Thực thi operations trong transaction với auto-commit/rollback
   */
  public async withTransaction<T>(
    callback: (service: this) => Promise<T>
  ): Promise<T> {
    logger.debug("Starting transaction callback", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    await this.ensureInitialized();
    const tx = await this.beginTransaction();
    
    try {
      const result = await callback(this);
      await tx.commit();

      logger.info("Transaction committed successfully", {
        schemaKey: this.schemaKey,
        entityName: this.entityName
      });

      return result;
    } catch (error) {
      await tx.rollback();

      logger.error("Transaction rolled back due to error", {
        schemaKey: this.schemaKey,
        entityName: this.entityName,
        error: (error as Error).message
      });

      throw error;
    }
  }

  /**
   * Batch create với transaction
   */
  public async createBatch(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating batch with transaction", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      count: data.length
    });

    return this.withTransaction(async () => {
      return this.createMany(data);
    });
  }

  /**
   * Batch update với transaction
   */
  public async updateBatch(
    updates: Array<{ filter: QueryFilter; data: Partial<TModel> }>
  ): Promise<number> {
    logger.debug("Updating batch with transaction", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      updateCount: updates.length
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

  /**
   * Batch delete với transaction
   */
  public async deleteBatch(filters: QueryFilter[]): Promise<number> {
    logger.debug("Deleting batch with transaction", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterCount: filters.length
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

  // ==================== HOOKS ====================

  protected async beforeCreate(data: Partial<TModel>): Promise<Partial<TModel>> {
    logger.trace("Executing beforeCreate hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      dataKeys: Object.keys(data)
    });

    return data;
  }

  protected async afterCreate(result: TModel): Promise<TModel> {
    logger.trace("Executing afterCreate hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    return result;
  }

  protected async beforeUpdate(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<Partial<TModel>> {
    logger.trace("Executing beforeUpdate hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data)
    });

    return data;
  }

  protected async afterUpdate(count: number): Promise<void> {
    logger.trace("Executing afterUpdate hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      affectedCount: count
    });
  }

  protected async beforeDelete(filter: QueryFilter): Promise<void> {
    logger.trace("Executing beforeDelete hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      filterKeys: Object.keys(filter)
    });
  }

  protected async afterDelete(count: number): Promise<void> {
    logger.trace("Executing afterDelete hook", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      affectedCount: count
    });
  }

  // ==================== STATUS & LIFECYCLE ====================

  public getStatus(): ServiceStatus {
    logger.trace("Getting service status", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    const daoStatus = this.dao?.getStatus(this.entityName) || {};
    return {
      schemaName: this.schemaKey,
      entityName: this.entityName,
      isOpened: this.isOpened,
      isInitialized: !!this.dao,
      hasDao: !!this.dao,
      lastAccess: new Date(this.lastAccess).toISOString(),
      connectionStatus: this.dao?.getAdapter().isConnected() ? 'connected' : 'disconnected',
      ...daoStatus,
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    logger.info("Closing service", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    this.isOpened = false;
  }

  public destroy(): void {
    logger.info("Destroying service", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    this.dao = null;
    this.isOpened = false;
  }

  public getEntityName(): string {
    return this.entityName;
  }

  public getSchemaKey(): string {
    return this.schemaKey;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Kiểm tra health của service
   */
  public async healthCheck(): Promise<boolean> {
    logger.debug("Performing health check", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    try {
      await this.ensureInitialized();
      const isHealthy = this.dao?.getAdapter().isConnected() || false;

      logger.debug("Health check result", {
        schemaKey: this.schemaKey,
        entityName: this.entityName,
        isHealthy
      });

      return isHealthy;
    } catch (error) {
      logger.warn("Health check failed", {
        schemaKey: this.schemaKey,
        entityName: this.entityName,
        error: (error as Error).message
      });

      return false;
    }
  }

  /**
   * Refresh connection (force reconnect)
   */
  public async refresh(): Promise<void> {
    logger.info("Refreshing service connection", {
      schemaKey: this.schemaKey,
      entityName: this.entityName
    });

    if (this.dao) {
      await this.dao.close();
    }
    this.isOpened = false;
    await this.initialize();
  }
}
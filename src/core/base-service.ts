// ========================
// src/core/base-service.ts (IMPROVED)
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseManager } from "./database-manager";
import { IResult, QueryFilter, QueryOptions, Transaction } from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";

/**
 * Base Service - IMPROVED với transaction handling tốt hơn
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
  }

  // ==================== INITIALIZATION ====================

  /**
   * Khởi tạo service với retry logic
   */
  public async initialize(retries: number = 3): Promise<void> {
    this.lastAccess = Date.now();
    
    if (this.dao && this.dao.getAdapter().isConnected()) {
      return;
    }

    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        this.dao = await DatabaseManager.getDAO(this.schemaKey);
        this.isOpened = true;
        return;
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await this.sleep(1000 * (i + 1)); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed to initialize service ${this.schemaKey}:${this.entityName} after ${retries} retries: ${lastError}`
    );
  }

  /**
   * Đảm bảo service đã được khởi tạo với auto-reconnect
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.dao || !this.isOpened) {
      await this.initialize();
      return;
    }

    // ✅ Kiểm tra connection còn sống không
    if (!this.dao.getAdapter().isConnected()) {
      console.warn(`Connection lost for ${this.schemaKey}, reconnecting...`);
      await this.initialize();
    }
  }

  /**
   * Lấy DAO (protected) với auto-reconnect
   */
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

  /**
   * Lấy UniversalDAO để tương tác trực tiếp với database
   * @returns UniversalDAO instance
   */
  public async getUniversalDAO(): Promise<UniversalDAO<any>> {
    await this.ensureInitialized();
    return this.getDAO();
  }

  /**
   * Thực thi truy vấn raw thông qua DAO
   */
  public async executeRaw(query: string | any, params?: any[]): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  /**
   * Lấy adapter từ DAO
   */
  public async getAdapter(): Promise<any> {
    await this.ensureInitialized();
    return this.getDAO().getAdapter();
  }

  /**
   * Lấy schema từ DAO
   */
  public getSchema(): any {
    return this.getDAO().getSchema();
  }

  // ==================== CRUD OPERATIONS ====================

  public async find(query: QueryFilter = {}, options?: QueryOptions): Promise<TModel[]> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().find<TModel>(this.entityName, query, options);
  }

  public async findOne(
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<TModel | null> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findOne<TModel>(this.entityName, query, options);
  }

  public async findById(id: any): Promise<TModel | null> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    const result = await this.getDAO().insert<TModel>(this.entityName, processedData);
    return this.afterCreate(result);
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    
    // ✅ Áp dụng beforeCreate cho từng item
    const processedData = await Promise.all(
      data.map((item) => this.beforeCreate(item))
    );
    
    const results = await this.getDAO().insertMany<TModel>(this.entityName, processedData);
    
    // ✅ Áp dụng afterCreate cho từng result
    return Promise.all(results.map((result) => this.afterCreate(result)));
  }

  public async update(filter: QueryFilter, data: Partial<TModel>): Promise<number> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    const count = await this.getDAO().update(this.entityName, filter, processedData);
    await this.afterUpdate(count);
    return count;
  }

  public async updateOne(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<boolean> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    return this.getDAO().updateOne(this.entityName, filter, processedData);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate({ id }, data);
    return this.getDAO().updateById(this.entityName, id, processedData);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    const count = await this.getDAO().delete(this.entityName, filter);
    await this.afterDelete(count);
    return count;
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    return this.getDAO().deleteOne(this.entityName, filter);
  }

  public async deleteById(id: any): Promise<boolean> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().deleteById(this.entityName, id);
  }

  public async count(filter?: QueryFilter): Promise<number> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().count(this.entityName, filter);
  }

  public async exists(filter: QueryFilter): Promise<boolean> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const count = await this.count(filter);
    return count > 0;
  }

  // ==================== ADVANCED OPERATIONS ====================

  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  // ==================== TRANSACTION SUPPORT ====================

  /**
   * 🆕 Bắt đầu transaction (low-level)
   */
  public async beginTransaction(): Promise<Transaction> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().getAdapter().beginTransaction();
  }

  /**
   * 🆕 Thực thi operations trong transaction với auto-commit/rollback
   * @example
   * await service.withTransaction(async () => {
   *   await service.create(data1);
   *   await service.create(data2);
   *   // Auto commit nếu không có lỗi
   * });
   */
  public async withTransaction<T>(
    callback: (service: this) => Promise<T>
  ): Promise<T> {
    await this.ensureInitialized();
    const tx = await this.beginTransaction();
    
    try {
      const result = await callback(this);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  /**
   * 🆕 Batch create với transaction
   */
  public async createBatch(data: Partial<TModel>[]): Promise<TModel[]> {
    return this.withTransaction(async () => {
      return this.createMany(data);
    });
  }

  /**
   * 🆕 Batch update với transaction
   */
  public async updateBatch(
    updates: Array<{ filter: QueryFilter; data: Partial<TModel> }>
  ): Promise<number> {
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
   * 🆕 Batch delete với transaction
   */
  public async deleteBatch(filters: QueryFilter[]): Promise<number> {
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

  protected async afterUpdate(count: number): Promise<void> {
    // Hook for after update
  }

  protected async beforeDelete(filter: QueryFilter): Promise<void> {
    // Hook for before delete
  }

  protected async afterDelete(count: number): Promise<void> {
    // Hook for after delete
  }

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
      connectionStatus: this.dao?.getAdapter().isConnected() ? 'connected' : 'disconnected',
      ...daoStatus,
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    this.isOpened = false;
  }

  public destroy(): void {
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
   * 🆕 Kiểm tra health của service
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.dao?.getAdapter().isConnected() || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 🆕 Refresh connection (force reconnect)
   */
  public async refresh(): Promise<void> {
    if (this.dao) {
      await this.dao.close();
    }
    this.isOpened = false;
    await this.initialize();
  }
}
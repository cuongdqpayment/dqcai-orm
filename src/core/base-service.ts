// ========================
// src/core/base-service.ts
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseManager } from "./database-manager";
import { IResult, QueryFilter, QueryOptions, Transaction } from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";

/**
 * Base Service - REFACTORED với khả năng truy cập DAO dễ dàng hơn
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
   * Khởi tạo service
   */
  public async initialize(): Promise<void> {
    this.lastAccess = Date.now();
    
    if (this.dao && this.dao.getAdapter().isConnected()) {
      return;
    }

    try {
      this.dao = await DatabaseManager.getDAO(this.schemaKey);
      this.isOpened = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize service ${this.schemaKey}:${this.entityName}: ${error}`
      );
    }
  }

  /**
   * Đảm bảo service đã được khởi tạo
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.dao || !this.isOpened) {
      await this.initialize();
    }
  }

  /**
   * Lấy DAO (protected)
   */
  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      throw new Error(
        `Service not initialized for ${this.schemaKey}:${this.entityName}`
      );
    }
    return this.dao;
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
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  /**
   * Lấy adapter từ DAO
   */
  public getAdapter(): any {
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
    this.lastAccess = Date.now();
    return this.getDAO().find<TModel>(this.entityName, query, options);
  }

  public async findOne(
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<TModel | null> {
    this.lastAccess = Date.now();
    return this.getDAO().findOne<TModel>(this.entityName, query, options);
  }

  public async findById(id: any): Promise<TModel | null> {
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    const result = await this.getDAO().insert<TModel>(this.entityName, processedData);
    return this.afterCreate(result);
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    this.lastAccess = Date.now();
    return this.getDAO().insertMany<TModel>(this.entityName, data);
  }

  public async update(filter: QueryFilter, data: Partial<TModel>): Promise<number> {
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
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    return this.getDAO().updateOne(this.entityName, filter, processedData);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    this.lastAccess = Date.now();
    return this.getDAO().updateById(this.entityName, id, data);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    const count = await this.getDAO().delete(this.entityName, filter);
    await this.afterDelete(count);
    return count;
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    return this.getDAO().deleteOne(this.entityName, filter);
  }

  public async deleteById(id: any): Promise<boolean> {
    this.lastAccess = Date.now();
    return this.getDAO().deleteById(this.entityName, id);
  }

  public async count(filter?: QueryFilter): Promise<number> {
    this.lastAccess = Date.now();
    return this.getDAO().count(this.entityName, filter);
  }

  public async exists(filter: QueryFilter): Promise<boolean> {
    this.lastAccess = Date.now();
    const count = await this.count(filter);
    return count > 0;
  }

  // ==================== ADVANCED OPERATIONS ====================

  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  public async beginTransaction(): Promise<Transaction> {
    this.lastAccess = Date.now();
    return this.getDAO().getAdapter().beginTransaction();
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
}
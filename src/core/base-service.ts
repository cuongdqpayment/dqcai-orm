
// ========================
// src/core/base-service.ts
// ========================

import { UniversalDAO } from './universal-dao';
import { DatabaseManager } from './database-manager';
import { IResult, QueryFilter, QueryOptions, Transaction } from '../types/orm.types';
import { ServiceStatus } from '../types/service.types';


/**
 * Base Service - Abstract class for entity-specific services
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

  /**
   * Initialize service by getting DAO from DatabaseManager
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
      throw new Error(`Failed to initialize service ${this.schemaKey}:${this.entityName}: ${error}`);
    }
  }

  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      throw new Error(`Service not initialized or DAO closed for ${this.schemaKey}:${this.entityName}`);
    }
    return this.dao;
  }

  // --- CRUD Operations ---

  public async find(query: QueryFilter = {}, options?: QueryOptions): Promise<TModel[]> {
    this.lastAccess = Date.now();
    return this.getDAO().find<TModel>(this.entityName, query, options);
  }

  public async findOne(query: QueryFilter, options?: QueryOptions): Promise<TModel | null> {
    this.lastAccess = Date.now();
    return this.getDAO().findOne<TModel>(this.entityName, query, options);
  }

  public async findById(id: any): Promise<TModel | null> {
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    this.lastAccess = Date.now();
    return this.getDAO().insert<TModel>(this.entityName, data);
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    this.lastAccess = Date.now();
    return this.getDAO().insertMany<TModel>(this.entityName, data);
  }

  public async update(filter: QueryFilter, data: Partial<TModel>): Promise<number> {
    this.lastAccess = Date.now();
    return this.getDAO().update(this.entityName, filter, data);
  }

  public async updateOne(filter: QueryFilter, data: Partial<TModel>): Promise<boolean> {
    this.lastAccess = Date.now();
    return this.getDAO().updateOne(this.entityName, filter, data);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    this.lastAccess = Date.now();
    return this.getDAO().updateById(this.entityName, id, data);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    this.lastAccess = Date.now();
    return this.getDAO().delete(this.entityName, filter);
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    this.lastAccess = Date.now();
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

  // --- Advanced Operations ---

  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  public async beginTransaction(): Promise<Transaction> {
    this.lastAccess = Date.now();
    return this.getDAO().getAdapter().beginTransaction();
  }

  // --- Hooks (Override in subclasses) ---

  protected async beforeCreate(data: Partial<TModel>): Promise<Partial<TModel>> {
    return data;
  }

  protected async afterCreate(result: TModel): Promise<TModel> {
    return result;
  }

  protected async beforeUpdate(filter: QueryFilter, data: Partial<TModel>): Promise<Partial<TModel>> {
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

  // --- Status & Lifecycle ---

  public getStatus(): ServiceStatus {
    const daoStatus = this.dao?.getStatus(this.entityName) || {};
    return {
      schemaName: this.schemaKey,
      entityName: this.entityName,
      isOpened: this.isOpened,
      isInitialized: !!this.dao,
      hasDao: !!this.dao,
      lastAccess: new Date(this.lastAccess).toISOString(),
      ...daoStatus
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    this.isOpened = false;
    // Don't close DAO here - it's managed by DatabaseManager
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


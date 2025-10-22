// ========================
// src/core/universal-dao.ts
// ========================

import { IConnection, IResult, QueryFilter, QueryOptions } from "../types/orm.types";
import { IDAO } from "../interfaces/dao.interface";
import { IAdapter } from "../interfaces/adapter.interface";
import { DatabaseSchema, DatabaseType, DbConfig } from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";

/**
 * Universal Data Access Object
 */
export class UniversalDAO<TConnection extends IConnection = IConnection> implements IDAO {
  protected adapter: IAdapter<TConnection>;
  protected connection: TConnection | null = null;
  public readonly schema: DatabaseSchema;
  public readonly databaseType: DatabaseType;
  public readonly dbConfig: DbConfig;

  constructor(adapter: IAdapter<TConnection>, schema: DatabaseSchema, dbConfig: DbConfig) {
    this.adapter = adapter;
    this.schema = schema;
    this.databaseType = schema.database_type;
    this.dbConfig = dbConfig;
  }

  async ensureConnected(): Promise<TConnection> {
    if (!this.connection || !this.connection.isConnected) {
      this.connection = await this.adapter.connect(this.dbConfig);
    }
    return this.connection;
  }

  async execute(query: string | any, params?: any[]): Promise<IResult> {
    const connection = await this.ensureConnected();
    return await this.adapter.execute(connection, query, params);
  }

  async find<T = any>(entityName: string, query: QueryFilter, options?: QueryOptions): Promise<T[]> {
    await this.ensureConnected();
    return this.adapter.find(entityName, query, options) as Promise<T[]>;
  }

  async findOne<T = any>(entityName: string, query: QueryFilter, options?: QueryOptions): Promise<T | null> {
    await this.ensureConnected();
    return this.adapter.findOne(entityName, query, options) as Promise<T | null>;
  }

  async findById<T = any>(entityName: string, id: any): Promise<T | null> {
    await this.ensureConnected();
    return this.adapter.findById(entityName, id) as Promise<T | null>;
  }

  async insert<T = any>(entityName: string, data: Partial<T>): Promise<T> {
    await this.ensureConnected();
    return this.adapter.insertOne(entityName, data) as Promise<T>;
  }

  async insertMany<T = any>(entityName: string, data: Partial<T>[]): Promise<T[]> {
    await this.ensureConnected();
    return this.adapter.insertMany(entityName, data) as Promise<T[]>;
  }

  async update(entityName: string, filter: QueryFilter, data: any): Promise<number> {
    await this.ensureConnected();
    return this.adapter.update(entityName, filter, data);
  }

  async updateOne(entityName: string, filter: QueryFilter, data: any): Promise<boolean> {
    await this.ensureConnected();
    return this.adapter.updateOne(entityName, filter, data);
  }

  async updateById(entityName: string, id: any, data: any): Promise<boolean> {
    await this.ensureConnected();
    return this.adapter.updateById(entityName, id, data);
  }

  async delete(entityName: string, filter: QueryFilter): Promise<number> {
    await this.ensureConnected();
    return this.adapter.delete(entityName, filter);
  }

  async deleteOne(entityName: string, filter: QueryFilter): Promise<boolean> {
    await this.ensureConnected();
    return this.adapter.deleteOne(entityName, filter);
  }

  async deleteById(entityName: string, id: any): Promise<boolean> {
    await this.ensureConnected();
    return this.adapter.deleteById(entityName, id);
  }

  async count(entityName: string, filter?: QueryFilter): Promise<number> {
    await this.ensureConnected();
    return this.adapter.count(entityName, filter);
  }

  async close(): Promise<void> {
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
      connectionStatus: this.adapter.isConnected() ? 'connected' : 'disconnected'
    };
  }

  getAdapter(): IAdapter<TConnection> {
    return this.adapter;
  }

  getSchema(): DatabaseSchema {
    return this.schema;
  }
}
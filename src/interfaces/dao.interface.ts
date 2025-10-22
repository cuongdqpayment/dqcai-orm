// ========================
// src/interfaces/dao.interface.ts
// ========================

import {
  IConnection,
  IResult,
  QueryFilter,
  QueryOptions,
} from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";

/**
 * Data Access Object Interface
 */
export interface IDAO<T = any> {
  // Core Operations
  execute(query: string | any, params?: any[]): Promise<IResult>;

  // CRUD
  find(
    entityName: string,
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<T[]>;
  findOne(
    entityName: string,
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<T | null>;
  findById(entityName: string, id: any): Promise<T | null>;

  insert(entityName: string, data: Partial<T>): Promise<T>;
  insertMany(entityName: string, data: Partial<T>[]): Promise<T[]>;

  update(
    entityName: string,
    filter: QueryFilter,
    data: Partial<T>
  ): Promise<number>;
  updateOne(
    entityName: string,
    filter: QueryFilter,
    data: Partial<T>
  ): Promise<boolean>;
  updateById(entityName: string, id: any, data: Partial<T>): Promise<boolean>;

  delete(entityName: string, filter: QueryFilter): Promise<number>;
  deleteOne(entityName: string, filter: QueryFilter): Promise<boolean>;
  deleteById(entityName: string, id: any): Promise<boolean>;

  count(entityName: string, filter?: QueryFilter): Promise<number>;

  // Connection
  ensureConnected(): Promise<IConnection>;
  close(): Promise<void>;

  // Status
  getStatus(entityName: string): Partial<ServiceStatus>;
}

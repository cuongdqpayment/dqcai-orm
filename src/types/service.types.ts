// ========================
// src/types/service.types.ts
// ========================

import { DbConfig, DatabaseSchema } from "./orm.types";
import { IAdapter } from "../interfaces/adapter.interface";

/**
 * Service status
 */
export interface ServiceStatus {
  schemaName: string;
  entityName: string;
  isOpened: boolean;
  isInitialized: boolean;
  hasDao: boolean;
  lastAccess: string | null;
  connectionStatus?: string;
  recordCount?: number;
  reconnectAttempts:number;
}

/**
 * Role configuration
 */
export interface RoleConfig {
  roleName: string;
  requiredDatabases: string[];
  optionalDatabases?: string[];
  priority?: number;
  permissions?: string[];
}

/**
 * Role registry
 */
export type RoleRegistry = { [roleName: string]: RoleConfig };

/**
 * Service configuration
 */
export interface ServiceConfig {
  schemaName: string;
  entityName: string;
  serviceClass: new (schemaName: string, entityName: string) => any;
  autoInit?: boolean;
  cacheTimeout?: number;
}

/**
 * Database factory options
 */
export interface DbFactoryOptions {
  config: DatabaseSchema;
  configAsset?: any;
  adapter?: IAdapter<any>;
  dbConfig?: DbConfig;
  autoConnect?: boolean;
  validateSchema?: boolean;
}

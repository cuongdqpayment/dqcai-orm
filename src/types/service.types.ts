// ========================
// src/types/service.types.ts
// ========================

import { DbConfig, DatabaseSchema } from "./orm.types";
import { IAdapter } from "../interfaces/adapter.interface";
import { BaseService } from "../core/base-service";

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
  serviceClass?: new (schemaName: string, entityName: string) => BaseService;
  autoInit?: boolean;
  cacheTimeout?: number;
}

// Interface cho trạng thái service
export interface ServiceInfo {
  key: string;
  schemaName: string;
  tableName: string;
  status: ServiceStatus;
  isRegistered: boolean;
  createdAt: string;
  lastAccessed?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  schemaName: string;
  recordCount?: number;
  error?: string;
  timestamp: string;
}

// Interface cho báo cáo sức khỏe
export interface HealthReport {
  totalServices: number;
  healthyServices: number;
  unhealthyServices: number;
  services: Array<HealthCheckResult & { serviceKey: string }>;
  timestamp: string;
  overallHealth: boolean;
}

// Event types cho ServiceManager
export interface ServiceManagerEvent {
  type:
    | "SERVICE_CREATED"
    | "SERVICE_DESTROYED"
    | "SERVICE_ERROR"
    | "HEALTH_CHECK_COMPLETED";
  serviceKey: string;
  schemaName: string;
  entityName: string;
  timestamp: string;
  data?: any;
  error?: Error;
}

export type ServiceManagerEventHandler = (event: ServiceManagerEvent) => void;

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

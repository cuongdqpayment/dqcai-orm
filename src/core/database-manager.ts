// ========================
// src/core/database-manager.ts
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseFactory } from "./database-factory";
import {
  RoleRegistry,
  RoleConfig,
  DbFactoryOptions,
} from "../types/service.types";
import { DatabaseSchema } from "../types/orm.types";
import { IAdapter } from "../interfaces/adapter.interface";

/**
 * Database Manager (Singleton) - REFACTORED
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private static roleRegistry: RoleRegistry = {};
  private static daoCache: Map<string, UniversalDAO<any>> = new Map();

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // ==================== SCHEMA MANAGEMENT ====================
  // Delegate to DatabaseFactory

  public static registerSchema(key: string, schema: DatabaseSchema): void {
    DatabaseFactory.registerSchema(key, schema);
  }

  public static registerSchemas(schemas: Record<string, DatabaseSchema>): void {
    DatabaseFactory.registerSchemas(schemas);
  }

  public static getSchema(key: string): DatabaseSchema | undefined {
    return DatabaseFactory.getSchema(key);
  }

  public static getAllSchemas(): Map<string, DatabaseSchema> {
    return DatabaseFactory.getAllSchemas();
  }

  public static hasSchema(key: string): boolean {
    return DatabaseFactory.hasSchema(key);
  }

  // ==================== ADAPTER MANAGEMENT ====================

  /**
   * Đăng ký adapter instance cho schema
   */
  public static registerAdapterInstance(
    schemaKey: string,
    adapter: IAdapter<any>
  ): void {
    DatabaseFactory.registerAdapterInstance(schemaKey, adapter);
  }

  /**
   * Lấy adapter instance
   */
  public static getAdapterInstance(schemaKey: string): IAdapter<any> | undefined {
    return DatabaseFactory.getAdapterInstance(schemaKey);
  }

  // ==================== DAO MANAGEMENT ====================

  /**
   * Lấy hoặc tạo DAO cho schema
   */
  public static async getDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    // 1. Kiểm tra cache
    const cachedDAO = this.daoCache.get(schemaKey);
    if (cachedDAO && cachedDAO.getAdapter().isConnected()) {
      return cachedDAO;
    }

    // 2. Tạo DAO mới từ DatabaseFactory
    const newDAO = await DatabaseFactory.createDAO(schemaKey, options);
    
    // 3. Lưu vào cache
    this.daoCache.set(schemaKey, newDAO);

    return newDAO;
  }

  /**
   * Lấy DAO từ cache (không tạo mới)
   */
  public static getCachedDAO(schemaKey: string): UniversalDAO<any> | undefined {
    return this.daoCache.get(schemaKey);
  }

  /**
   * Đóng và xóa DAO khỏi cache
   */
  public static async closeDAO(schemaKey: string): Promise<void> {
    const dao = this.daoCache.get(schemaKey);
    if (dao) {
      await dao.close();
      this.daoCache.delete(schemaKey);
    }
    
    // Xóa adapter instance
    await DatabaseFactory.unregisterAdapterInstance(schemaKey);
  }

  /**
   * Đóng tất cả DAOs
   */
  public static async closeAllDAOs(): Promise<void> {
    const closePromises = Array.from(this.daoCache.keys()).map((key) =>
      this.closeDAO(key)
    );
    await Promise.all(closePromises);
  }

  /**
   * Lấy tất cả DAOs đang cached
   */
  public static getAllDAOs(): Map<string, UniversalDAO<any>> {
    return new Map(this.daoCache);
  }

  // Compatibility aliases
  public static getConnection = this.getCachedDAO;
  public static closeConnection = this.closeDAO;
  public static closeAllConnections = this.closeAllDAOs;
  public static getAllConnections = this.getAllDAOs;

  // ==================== ROLE MANAGEMENT ====================

  public static registerRole(roleConfig: RoleConfig): void {
    this.roleRegistry[roleConfig.roleName] = roleConfig;
  }

  public static getRole(roleName: string): RoleConfig | undefined {
    return this.roleRegistry[roleName];
  }

  public static getAllRoles(): RoleRegistry {
    return { ...this.roleRegistry };
  }

  public static getRoleDatabases(roleName: string): {
    required: string[];
    optional: string[];
  } {
    const role = this.roleRegistry[roleName];
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }

    return {
      required: role.requiredDatabases,
      optional: role.optionalDatabases || [],
    };
  }

  /**
   * Khởi tạo connections cho role
   */
  public static async initializeRoleConnections(
    roleName: string,
    initOptional: boolean = false
  ): Promise<UniversalDAO<any>[]> {
    const { required, optional } = this.getRoleDatabases(roleName);
    const databaseKeys = initOptional ? [...required, ...optional] : required;

    const daos: UniversalDAO<any>[] = [];

    for (const dbKey of databaseKeys) {
      try {
        const dao = await this.getDAO(dbKey);
        daos.push(dao);
      } catch (error) {
        console.error(`Failed to initialize connection for ${dbKey}:`, error);
        if (required.includes(dbKey)) {
          throw error;
        }
      }
    }

    return daos;
  }

  // Compatibility alias
  public static initializeUserRoleConnections = this.initializeRoleConnections;

  /**
   * Lấy danh sách databases đã kết nối cho role
   */
  public static getActiveDatabases(roleName: string): string[] {
    const { required, optional } = this.getRoleDatabases(roleName);
    const allDatabases = [...required, ...optional];

    return allDatabases.filter((dbKey) => {
      const dao = this.daoCache.get(dbKey);
      return dao && dao.getAdapter().isConnected();
    });
  }

  // Compatibility alias
  public static getCurrentUserDatabases = this.getActiveDatabases;

  // ==================== STATUS & HEALTH ====================

  public static getStatus(): {
    schemas: number;
    daos: number;
    roles: number;
    activeConnections: string[];
    adapterInstances: number;
  } {
    const factoryStats = DatabaseFactory.getStats();
    
    return {
      schemas: factoryStats.schemas,
      daos: this.daoCache.size,
      roles: Object.keys(this.roleRegistry).length,
      activeConnections: Array.from(this.daoCache.keys()).filter((key) => {
        const dao = this.daoCache.get(key);
        return dao && dao.getAdapter().isConnected();
      }),
      adapterInstances: factoryStats.adapterInstances,
    };
  }

  public static async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [key, dao] of this.daoCache.entries()) {
      try {
        await dao.ensureConnected();
        health[key] = dao.getAdapter().isConnected();
      } catch (error) {
        health[key] = false;
      }
    }

    return health;
  }

  /**
   * Reset toàn bộ manager
   */
  public static reset(): void {
    this.roleRegistry = {};
    this.daoCache.clear();
    DatabaseFactory.reset();
  }
}

// ========================
// src/core/database-manager.ts (FIXED ADAPTER SHARING)
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

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.DATABASE_MANAGER);

/**
 * Database Manager (Singleton) - FIXED để đảm bảo adapter sharing
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private static roleRegistry: RoleRegistry = {};
  private static daoCache: Map<string, UniversalDAO<any>> = new Map();

  private constructor() {
    logger.trace("Creating DatabaseManager singleton instance");
  }

  public static getInstance(): DatabaseManager {
    logger.trace("Getting DatabaseManager instance");

    if (!DatabaseManager.instance) {
      logger.debug("No existing instance, creating new DatabaseManager");
      DatabaseManager.instance = new DatabaseManager();
    }

    return DatabaseManager.instance;
  }

  // ==================== SCHEMA MANAGEMENT ====================

  public static registerSchema(key: string, schema: DatabaseSchema): void {
    logger.trace("Registering schema via DatabaseManager", { key });

    DatabaseFactory.registerSchema(key, schema);

    logger.debug("Schema registered successfully via DatabaseManager", { key });
  }

  public static registerSchemas(schemas: Record<string, DatabaseSchema>): void {
    logger.trace("Registering multiple schemas via DatabaseManager", { schemaCount: Object.keys(schemas).length });

    DatabaseFactory.registerSchemas(schemas);

    logger.debug("Multiple schemas registered successfully via DatabaseManager", { schemaCount: Object.keys(schemas).length });
  }

  public static getSchema(key: string): DatabaseSchema | undefined {
    logger.trace("Getting schema via DatabaseManager", { key });

    return DatabaseFactory.getSchema(key);
  }

  public static getAllSchemas(): Map<string, DatabaseSchema> {
    logger.trace("Getting all schemas via DatabaseManager");

    return DatabaseFactory.getAllSchemas();
  }

  public static hasSchema(key: string): boolean {
    logger.trace("Checking schema existence via DatabaseManager", { key });

    return DatabaseFactory.hasSchema(key);
  }

  // ==================== ADAPTER MANAGEMENT ====================

  /**
   * Đăng ký adapter instance cho schema
   * ✅ KEY FIX: Khi user đăng ký adapter, nó sẽ được dùng cho tất cả operations
   */
  public static registerAdapterInstance(
    schemaKey: string,
    adapter: IAdapter<any>
  ): void {
    logger.debug("Registering adapter instance via DatabaseManager", { 
      schemaKey,
      isConnected: adapter.isConnected() 
    });

    // Đăng ký vào DatabaseFactory
    DatabaseFactory.registerAdapterInstance(schemaKey, adapter);

    // ✅ CRITICAL: Nếu đã có DAO trong cache, update adapter của nó
    const existingDAO = this.daoCache.get(schemaKey);
    if (existingDAO) {
      logger.debug("Updating existing DAO with new adapter", { schemaKey });
      // DAO sẽ sử dụng adapter mới
      (existingDAO as any).adapter = adapter;
    }

    logger.info("Adapter instance registered and synchronized", { schemaKey });
  }

  /**
   * Lấy adapter instance
   */
  public static getAdapterInstance(schemaKey: string): IAdapter<any> | undefined {
    logger.trace("Getting adapter instance via DatabaseManager", { schemaKey });

    return DatabaseFactory.getAdapterInstance(schemaKey);
  }

  // ==================== DAO MANAGEMENT (FIXED) ====================

  /**
   * ✅ FIXED: Lấy hoặc tạo DAO - Đảm bảo dùng adapter đã register
   */
  public static async getDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    logger.debug("Getting DAO with adapter sharing", { 
      schemaKey, 
      hasCachedDAO: this.daoCache.has(schemaKey),
      hasRegisteredAdapter: !!DatabaseFactory.getAdapterInstance(schemaKey)
    });

    // 1. Kiểm tra cache - nếu có và adapter còn connected
    const cachedDAO = this.daoCache.get(schemaKey);
    if (cachedDAO) {
      const adapter = cachedDAO.getAdapter();
      if (adapter.isConnected()) {
        logger.debug("Returning cached DAO with active connection", { schemaKey });
        return cachedDAO;
      } else {
        logger.debug("Cached DAO has disconnected adapter, will recreate", { schemaKey });
      }
    }

    // 2. ✅ KEY FIX: Kiểm tra xem đã có adapter instance được register chưa
    const existingAdapter = DatabaseFactory.getAdapterInstance(schemaKey);
    
    if (existingAdapter) {
      logger.info("Found registered adapter, using it for DAO creation", { 
        schemaKey,
        isConnected: existingAdapter.isConnected() 
      });
      
      // Đảm bảo adapter đã connected
      if (!existingAdapter.isConnected()) {
        logger.debug("Registered adapter not connected, will auto-connect", { schemaKey });
      }
      
      // ✅ CRITICAL FIX: autoConnect = false vì adapter đã connected rồi
      options = {
        ...options,
        adapter: existingAdapter,
        autoConnect: false // KHÔNG gọi connect lại
      };
    } else {
      logger.debug("No registered adapter found, will create new one", { schemaKey });
    }

    // 3. Tạo DAO mới từ DatabaseFactory (sẽ dùng adapter đã inject hoặc tạo mới)
    const newDAO = await DatabaseFactory.createDAO(schemaKey, options);
    
    // 4. Lưu vào cache
    this.daoCache.set(schemaKey, newDAO);

    logger.info("DAO created/updated and cached successfully", { 
      schemaKey,
      usedExistingAdapter: !!existingAdapter 
    });

    return newDAO;
  }

  /**
   * ✅ NEW: Phương thức tiện ích để đảm bảo có DAO với adapter đã register
   */
  public static async getOrCreateDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    logger.trace("Getting or creating DAO", { schemaKey });
    
    return this.getDAO(schemaKey, options);
  }

  /**
   * Lấy DAO từ cache (không tạo mới)
   */
  public static getCachedDAO(schemaKey: string): UniversalDAO<any> | undefined {
    logger.trace("Getting cached DAO", { schemaKey });

    return this.daoCache.get(schemaKey);
  }

  /**
   * Đóng và xóa DAO khỏi cache
   */
  public static async closeDAO(schemaKey: string): Promise<void> {
    logger.trace("Closing DAO", { schemaKey });

    const dao = this.daoCache.get(schemaKey);
    if (dao) {
      logger.debug("DAO found in cache, closing connection", { schemaKey });
      await dao.close();
      this.daoCache.delete(schemaKey);

      logger.info("DAO closed and removed from cache", { schemaKey });
    } else {
      logger.debug("No DAO found in cache to close", { schemaKey });
    }
    
    // Xóa adapter instance
    await DatabaseFactory.unregisterAdapterInstance(schemaKey);

    logger.debug("Adapter instance unregistered", { schemaKey });
  }

  /**
   * Đóng tất cả DAOs
   */
  public static async closeAllDAOs(): Promise<void> {
    logger.info("Closing all DAOs", { daoCount: this.daoCache.size });

    const closePromises = Array.from(this.daoCache.keys()).map((key) =>
      this.closeDAO(key)
    );
    await Promise.all(closePromises);

    logger.info("All DAOs closed successfully");
  }

  /**
   * Lấy tất cả DAOs đang cached
   */
  public static getAllDAOs(): Map<string, UniversalDAO<any>> {
    logger.trace("Getting all cached DAOs", { total: this.daoCache.size });

    return new Map(this.daoCache);
  }

  // Compatibility aliases
  public static getConnection = this.getCachedDAO;
  public static closeConnection = this.closeDAO;
  public static closeAllConnections = this.closeAllDAOs;
  public static getAllConnections = this.getAllDAOs;

  // ==================== ROLE MANAGEMENT ====================

  public static registerRole(roleConfig: RoleConfig): void {
    logger.trace("Registering role", { roleName: roleConfig.roleName });

    this.roleRegistry[roleConfig.roleName] = roleConfig;

    logger.debug("Role registered successfully", { roleName: roleConfig.roleName });
  }

  public static getRole(roleName: string): RoleConfig | undefined {
    logger.trace("Getting role", { roleName });

    return this.roleRegistry[roleName];
  }

  public static getAllRoles(): RoleRegistry {
    logger.trace("Getting all roles", { totalRoles: Object.keys(this.roleRegistry).length });

    return { ...this.roleRegistry };
  }

  public static getRoleDatabases(roleName: string): {
    required: string[];
    optional: string[];
  } {
    logger.trace("Getting role databases", { roleName });

    const role = this.roleRegistry[roleName];
    if (!role) {
      logger.error("Role not found", { roleName });
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
    logger.info("Initializing role connections", { roleName, initOptional });

    const { required, optional } = this.getRoleDatabases(roleName);
    const databaseKeys = initOptional ? [...required, ...optional] : required;

    logger.debug("Databases to initialize for role", { roleName, databaseKeys });

    const daos: UniversalDAO<any>[] = [];

    for (const dbKey of databaseKeys) {
      try {
        logger.trace("Initializing DAO for database key", { dbKey });
        const dao = await this.getDAO(dbKey);
        daos.push(dao);

        logger.debug("DAO initialized successfully for database", { dbKey });
      } catch (error) {
        logger.error(`Failed to initialize connection for ${dbKey}:`, { dbKey, error: (error as Error).message });
        if (required.includes(dbKey)) {
          throw error;
        }

        logger.warn("Skipping optional database initialization due to error", { dbKey });
      }
    }

    logger.info("Role connections initialized successfully", { roleName, daoCount: daos.length });

    return daos;
  }

  // Compatibility alias
  public static initializeUserRoleConnections = this.initializeRoleConnections;

  /**
   * Lấy danh sách databases đã kết nối cho role
   */
  public static getActiveDatabases(roleName: string): string[] {
    logger.trace("Getting active databases for role", { roleName });

    const { required, optional } = this.getRoleDatabases(roleName);
    const allDatabases = [...required, ...optional];

    const activeDatabases = allDatabases.filter((dbKey) => {
      const dao = this.daoCache.get(dbKey);
      return dao && dao.getAdapter().isConnected();
    });

    logger.debug("Active databases retrieved", { roleName, activeCount: activeDatabases.length });

    return activeDatabases;
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
    logger.trace("Getting DatabaseManager status");

    const factoryStats = DatabaseFactory.getStats();
    
    const status = {
      schemas: factoryStats.schemas,
      daos: this.daoCache.size,
      roles: Object.keys(this.roleRegistry).length,
      activeConnections: Array.from(this.daoCache.keys()).filter((key) => {
        const dao = this.daoCache.get(key);
        return dao && dao.getAdapter().isConnected();
      }),
      adapterInstances: factoryStats.adapterInstances,
    };

    logger.debug("Status retrieved", { status });

    return status;
  }

  public static async healthCheck(): Promise<Record<string, boolean>> {
    logger.info("Starting health check for all DAOs", { daoCount: this.daoCache.size });

    const health: Record<string, boolean> = {};

    for (const [key, dao] of this.daoCache.entries()) {
      try {
        logger.trace("Checking health for DAO", { key });
        await dao.ensureConnected();
        health[key] = dao.getAdapter().isConnected();

        logger.debug("Health check passed for DAO", { key, isHealthy: health[key] });
      } catch (error) {
        health[key] = false;

        logger.error("Health check failed for DAO", { key, error: (error as Error).message });
      }
    }

    logger.info("Health check completed", { healthyCount: Object.values(health).filter(Boolean).length, total: this.daoCache.size });

    return health;
  }

  /**
   * Reset toàn bộ manager
   */
  public static reset(): void {
    logger.warn("Resetting DatabaseManager", { 
      daoCount: this.daoCache.size,
      roleCount: Object.keys(this.roleRegistry).length
    });

    this.roleRegistry = {};
    this.daoCache.clear();
    DatabaseFactory.reset();

    logger.debug("DatabaseManager reset completed");
  }
}
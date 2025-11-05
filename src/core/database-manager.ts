// ========================
// src/core/database-manager.ts (ENHANCED WITH CLOSE METHODS)
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseFactory } from "./database-factory";
import {
  RoleRegistry,
  RoleConfig,
  DbFactoryOptions,
} from "@/types/service.types";
import { DatabaseSchema } from "@/types/orm.types";
import { IAdapter } from "@/interfaces/adapter.interface";

import { createModuleLogger, ORMModules } from "@/logger";
const logger = createModuleLogger(ORMModules.DATABASE_MANAGER);

/**
 * Database Manager (Singleton) - Enhanced with proper connection lifecycle
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private static roleRegistry: RoleRegistry = {};
  private static daoCache: Map<string, UniversalDAO<any>> = new Map();
  private static isClosingConnections: boolean = false;

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
    logger.trace("Registering multiple schemas via DatabaseManager", {
      schemaCount: Object.keys(schemas).length,
    });
    DatabaseFactory.registerSchemas(schemas);
    logger.debug(
      "Multiple schemas registered successfully via DatabaseManager",
      { schemaCount: Object.keys(schemas).length }
    );
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

  public static registerAdapterInstance(
    schemaKey: string,
    adapter: IAdapter<any>
  ): void {
    logger.debug("Registering adapter instance via DatabaseManager", {
      schemaKey,
      isConnected: adapter.isConnected(),
    });

    DatabaseFactory.registerAdapterInstance(schemaKey, adapter);

    const existingDAO = this.daoCache.get(schemaKey);
    if (existingDAO) {
      logger.debug("Updating existing DAO with new adapter", { schemaKey });
      (existingDAO as any).adapter = adapter;
    }

    logger.info("Adapter instance registered and synchronized", { schemaKey });
  }

  public static getAdapterInstance(
    schemaKey: string
  ): IAdapter<any> | undefined {
    logger.trace("Getting adapter instance via DatabaseManager", { schemaKey });
    return DatabaseFactory.getAdapterInstance(schemaKey);
  }

  // ==================== DAO MANAGEMENT ====================

  public static async getDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    logger.debug("Getting DAO with adapter sharing", {
      schemaKey,
      hasCachedDAO: this.daoCache.has(schemaKey),
      hasRegisteredAdapter: !!DatabaseFactory.getAdapterInstance(schemaKey),
    });

    const cachedDAO = this.daoCache.get(schemaKey);
    if (cachedDAO) {
      const adapter = cachedDAO.getAdapter();
      if (adapter.isConnected()) {
        logger.debug("Returning cached DAO with active connection", {
          schemaKey,
        });
        return cachedDAO;
      } else {
        logger.debug("Cached DAO has disconnected adapter, will recreate", {
          schemaKey,
        });
      }
    }

    const existingAdapter = DatabaseFactory.getAdapterInstance(schemaKey);

    if (existingAdapter) {
      logger.info("Found registered adapter, using it for DAO creation", {
        schemaKey,
        isConnected: existingAdapter.isConnected(),
      });

      if (!existingAdapter.isConnected()) {
        logger.debug("Registered adapter not connected, will auto-connect", {
          schemaKey,
        });
      }

      options = {
        ...options,
        adapter: existingAdapter,
        autoConnect: false,
      };
    } else {
      logger.debug("No registered adapter found, will create new one", {
        schemaKey,
      });
    }

    const newDAO = await DatabaseFactory.createDAO(schemaKey, options);
    this.daoCache.set(schemaKey, newDAO);

    logger.info("DAO created/updated and cached successfully", {
      schemaKey,
      usedExistingAdapter: !!existingAdapter,
    });

    return newDAO;
  }

  public static async getOrCreateDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    logger.trace("Getting or creating DAO", { schemaKey });
    return this.getDAO(schemaKey, options);
  }

  public static getCachedDAO(schemaKey: string): UniversalDAO<any> | undefined {
    logger.trace("Getting cached DAO", { schemaKey });
    return this.daoCache.get(schemaKey);
  }

  // ==================== LAZY INITIALIZATION & BULK OPERATIONS ====================

  /**
   * Initialize all available databases
   * Khởi tạo tất cả các schema đã được đăng ký
   */
  public static async initializeAll(): Promise<void> {
    logger.info("Initializing all available databases");

    const availableSchemas = Array.from(DatabaseFactory.getAllSchemas().keys());

    if (availableSchemas.length === 0) {
      logger.warn("No schemas available to initialize");
      return;
    }

    logger.debug("Available schemas for initialization", {
      schemaCount: availableSchemas.length,
      schemas: availableSchemas,
    });

    const failedInitializations: { key: string; error: Error }[] = [];

    const initPromises = availableSchemas.map(async (key) => {
      try {
        logger.debug("Initializing schema", { key });
        const dao = await this.getDAO(key);
        await dao.ensureConnected();

        logger.info("Schema initialized successfully", {
          key,
          isConnected: dao.getAdapter().isConnected(),
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to initialize schema", {
          key,
          error: err.message,
        });
        failedInitializations.push({ key, error: err });
      }
    });

    await Promise.all(initPromises);

    if (failedInitializations.length > 0) {
      const errorSummary = failedInitializations
        .map((f) => `  - ${f.key}: ${f.error.message}`)
        .join("\n");

      logger.error("Failed to initialize one or more databases", {
        failedDatabases: failedInitializations.map((f) => f.key),
        errorSummary,
      });

      throw new Error(
        `Failed to initialize one or more databases:\n${errorSummary}`
      );
    }

    logger.info("All databases initialized successfully", {
      totalSchemas: availableSchemas.length,
      totalConnections: this.daoCache.size,
    });
  }

  /**
   * Get database with lazy loading
   * Tự động khởi tạo connection nếu chưa tồn tại
   */
  public static async getLazyLoading(key: string): Promise<UniversalDAO<any>> {
    logger.debug("Getting database with lazy loading", { key });

    // Check if schema exists
    if (!DatabaseFactory.hasSchema(key)) {
      logger.error("Schema not found for lazy loading", { key });
      throw new Error(`Invalid database key: ${key}. Schema not found.`);
    }

    // Try to get cached DAO first
    const cachedDAO = this.daoCache.get(key);
    if (cachedDAO) {
      const adapter = cachedDAO.getAdapter();
      if (adapter.isConnected()) {
        logger.debug("Returning cached connected DAO", { key });
        return cachedDAO;
      } else {
        logger.debug("Cached DAO exists but not connected, will reconnect", {
          key,
        });
      }
    }

    // Create or reconnect DAO
    logger.debug("Creating new connection for lazy loading", { key });

    try {
      const dao = await this.getDAO(key);
      await dao.ensureConnected();

      logger.info("Database connection created via lazy loading", {
        key,
        isConnected: dao.getAdapter().isConnected(),
      });

      return dao;
    } catch (error) {
      logger.error("Failed to lazy load database", {
        key,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ==================== ENHANCED CONNECTION CLOSING ====================

  /**
   * Close specific connection (Enhanced version)
   * Similar to closeDAO but with better error handling and state management
   */
  public static async closeConnection(dbKey: string): Promise<void> {
    logger.debug("Closing specific connection", { dbKey });

    const dao = this.daoCache.get(dbKey);
    if (dao) {
      try {
        await dao.close();
        this.daoCache.delete(dbKey);

        // Also unregister adapter instance
        await DatabaseFactory.unregisterAdapterInstance(dbKey);

        logger.info("Database connection closed successfully", { dbKey });
      } catch (error) {
        logger.error("Error closing database connection", {
          dbKey,
          error: (error as Error).message,
        });
        throw error;
      }
    } else {
      logger.warn("Attempted to close non-existent connection", { dbKey });
    }
  }

  /**
   * Close DAO (Backward compatibility alias)
   */
  public static async closeDAO(schemaKey: string): Promise<void> {
    logger.trace("Closing DAO (via closeConnection)", { schemaKey });
    await this.closeConnection(schemaKey);
  }

  /**
   * Close all connections gracefully
   */
  public static async closeAllConnections(): Promise<void> {
    if (this.isClosingConnections) {
      logger.warn("Already closing connections, skipping duplicate call");
      return;
    }

    this.isClosingConnections = true;
    logger.info("Closing all connections", { daoCount: this.daoCache.size });

    try {
      const closePromises = Array.from(this.daoCache.keys()).map((key) =>
        this.closeConnection(key).catch((error) => {
          logger.error("Error closing connection during batch close", {
            key,
            error: (error as Error).message,
          });
          // Continue closing other connections even if one fails
        })
      );

      await Promise.all(closePromises);
      logger.info("All connections closed successfully");
    } finally {
      this.isClosingConnections = false;
    }
  }

  /**
   * Close all DAOs (Backward compatibility alias)
   */
  public static async closeAllDAOs(): Promise<void> {
    logger.trace("Closing all DAOs (via closeAllConnections)");
    await this.closeAllConnections();
  }

  /**
   * Close all connections and reset complete state
   * This is a full cleanup method that resets everything
   */
  public static async closeAll(): Promise<void> {
    logger.info("Closing all connections and resetting complete state");

    try {
      // Close all connections first
      await this.closeAllConnections();

      // Reset all state
      this.roleRegistry = {};
      this.daoCache.clear();
      this.isClosingConnections = false;

      // Reset DatabaseFactory
      DatabaseFactory.reset();

      logger.info("All connections closed and state reset successfully");
    } catch (error) {
      logger.error("Error during closeAll", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Reset manager (Backward compatibility - now uses closeAll)
   */
  public static async reset(): Promise<void> {
    logger.warn("Resetting DatabaseManager (via closeAll)", {
      daoCount: this.daoCache.size,
      roleCount: Object.keys(this.roleRegistry).length,
    });

    await this.closeAll();
  }

  public static getAllDAOs(): Map<string, UniversalDAO<any>> {
    logger.trace("Getting all cached DAOs", { total: this.daoCache.size });
    return new Map(this.daoCache);
  }

  // Compatibility aliases
  public static getConnection = this.getCachedDAO;
  public static getAllConnections = this.getAllDAOs;

  // ==================== ROLE MANAGEMENT ====================

  public static registerRole(roleConfig: RoleConfig): void {
    logger.trace("Registering role", { roleName: roleConfig.roleName });
    this.roleRegistry[roleConfig.roleName] = roleConfig;
    logger.debug("Role registered successfully", {
      roleName: roleConfig.roleName,
    });
  }

  public static getRole(roleName: string): RoleConfig | undefined {
    logger.trace("Getting role", { roleName });
    return this.roleRegistry[roleName];
  }

  public static getAllRoles(): RoleRegistry {
    logger.trace("Getting all roles", {
      totalRoles: Object.keys(this.roleRegistry).length,
    });
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

  public static async initializeRoleConnections(
    roleName: string,
    initOptional: boolean = false
  ): Promise<UniversalDAO<any>[]> {
    logger.info("Initializing role connections", { roleName, initOptional });

    const { required, optional } = this.getRoleDatabases(roleName);
    const databaseKeys = initOptional ? [...required, ...optional] : required;

    logger.debug("Databases to initialize for role", {
      roleName,
      databaseKeys,
    });

    const daos: UniversalDAO<any>[] = [];

    for (const dbKey of databaseKeys) {
      try {
        logger.trace("Initializing DAO for database key", { dbKey });
        const dao = await this.getDAO(dbKey);
        daos.push(dao);
        logger.debug("DAO initialized successfully for database", { dbKey });
      } catch (error) {
        logger.error(`Failed to initialize connection for ${dbKey}:`, {
          dbKey,
          error: (error as Error).message,
        });
        if (required.includes(dbKey)) {
          throw error;
        }
        logger.warn("Skipping optional database initialization due to error", {
          dbKey,
        });
      }
    }

    logger.info("Role connections initialized successfully", {
      roleName,
      daoCount: daos.length,
    });
    return daos;
  }

  public static initializeUserRoleConnections = this.initializeRoleConnections;

  public static getActiveDatabases(roleName: string): string[] {
    logger.trace("Getting active databases for role", { roleName });

    const { required, optional } = this.getRoleDatabases(roleName);
    const allDatabases = [...required, ...optional];

    const activeDatabases = allDatabases.filter((dbKey) => {
      const dao = this.daoCache.get(dbKey);
      return dao && dao.getAdapter().isConnected();
    });

    logger.debug("Active databases retrieved", {
      roleName,
      activeCount: activeDatabases.length,
    });
    return activeDatabases;
  }

  public static getCurrentUserDatabases = this.getActiveDatabases;

  // ==================== STATUS & HEALTH ====================

  public static getStatus(): {
    schemas: number;
    daos: number;
    roles: number;
    activeConnections: string[];
    adapterInstances: number;
    isClosingConnections: boolean;
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
      isClosingConnections: this.isClosingConnections,
    };

    logger.debug("Status retrieved", { status });
    return status;
  }

  public static async healthCheck(): Promise<Record<string, boolean>> {
    logger.info("Starting health check for all DAOs", {
      daoCount: this.daoCache.size,
    });

    const health: Record<string, boolean> = {};

    for (const [key, dao] of this.daoCache.entries()) {
      try {
        logger.trace("Checking health for DAO", { key });
        await dao.ensureConnected();
        health[key] = dao.getAdapter().isConnected();
        logger.debug("Health check passed for DAO", {
          key,
          isHealthy: health[key],
        });
      } catch (error) {
        health[key] = false;
        logger.error("Health check failed for DAO", {
          key,
          error: (error as Error).message,
        });
      }
    }

    logger.info("Health check completed", {
      healthyCount: Object.values(health).filter(Boolean).length,
      total: this.daoCache.size,
    });

    return health;
  }
}

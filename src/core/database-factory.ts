// ========================
// src/core/database-factory.ts (OPTIMIZED VERSION)
// ========================

import { DatabaseType, DbConfig, DatabaseSchema } from "@/types/orm.types";
import { UniversalDAO } from "./universal-dao";
import { AdapterHelper } from "@/helpers/adapter-helper";
import { IAdapter } from "@/interfaces/adapter.interface";
import { DbFactoryOptions } from "@/types/service.types";
import { IConnection } from "@/types/orm.types";

import { createModuleLogger, ORMModules } from "@/logger";

const logger = createModuleLogger(ORMModules.DATABASE_FACTORY);

/**
 * Schema Registry - Lưu trữ schema structure
 */
const SchemaRegistry = new Map<string, DatabaseSchema>();

/**
 * Adapter Registry - Lưu trữ adapter class theo database type
 */
const AdapterRegistry = new Map<
  DatabaseType,
  { new (config?: any): IAdapter<any> }
>();

/**
 * Adapter Instance Registry - Lưu trữ adapter instances đã được tạo
 */
const AdapterInstanceRegistry = new Map<string, IAdapter<any>>();

/**
 * Theo dõi các schema đang trong quá trình khởi tạo tables
 */
const InitializingSchemas = new Set<string>();

/**
 * Database Factory (OPTIMIZED)
 */
export class DatabaseFactory {
  // ==================== SCHEMA MANAGEMENT ====================

  public static registerSchema(
    schemaKey: string,
    schema: DatabaseSchema
  ): void {
    logger.trace("Registering schema", { schemaKey });
    SchemaRegistry.set(schemaKey, schema);
    logger.debug("Schema registered successfully", { schemaKey });
  }

  public static registerSchemas(schemas: Record<string, DatabaseSchema>): void {
    logger.trace("Registering multiple schemas", {
      schemaCount: Object.keys(schemas).length,
    });
    Object.entries(schemas).forEach(([key, schema]) => {
      this.registerSchema(key, schema);
    });
    logger.debug("Multiple schemas registered successfully", {
      schemaCount: Object.keys(schemas).length,
    });
  }

  public static getSchema(schemaKey: string): DatabaseSchema | undefined {
    logger.trace("Getting schema", { schemaKey });
    return SchemaRegistry.get(schemaKey);
  }

  public static hasSchema(schemaKey: string): boolean {
    logger.trace("Checking schema existence", { schemaKey });
    return SchemaRegistry.has(schemaKey);
  }

  public static getAllSchemas(): Map<string, DatabaseSchema> {
    logger.trace("Getting all schemas", { totalSchemas: SchemaRegistry.size });
    return new Map(SchemaRegistry);
  }

  public static unregisterSchema(schemaKey: string): boolean {
    logger.trace("Unregistering schema", { schemaKey });
    const result = SchemaRegistry.delete(schemaKey);
    logger.debug("Schema unregistered", { schemaKey, success: result });
    return result;
  }

  // ==================== ADAPTER CLASS MANAGEMENT ====================

  public static registerAdapter<TConnection extends IConnection>(
    type: DatabaseType,
    AdapterClass: { new (config?: any): IAdapter<TConnection> }
  ): void {
    logger.trace("Registering adapter class", { type });
    AdapterRegistry.set(
      type,
      AdapterClass as { new (config?: any): IAdapter<any> }
    );
    logger.debug("Adapter class registered successfully", { type });
  }

  public static getAdapterClass(
    type: DatabaseType
  ): { new (config?: any): IAdapter<any> } | undefined {
    logger.trace("Getting adapter class", { type });
    return AdapterRegistry.get(type);
  }

  public static hasAdapterClass(type: DatabaseType): boolean {
    logger.trace("Checking adapter class existence", { type });
    return AdapterRegistry.has(type);
  }

  // ==================== ADAPTER INSTANCE MANAGEMENT ====================

  public static registerAdapterInstance(
    schemaKey: string,
    adapter: IAdapter<any>
  ): void {
    logger.info("Registering adapter instance", {
      schemaKey,
      isConnected: adapter.isConnected(),
      isSupported: adapter.isSupported(),
    });
    AdapterInstanceRegistry.set(schemaKey, adapter);
    logger.debug("Adapter instance registered successfully", { schemaKey });
  }

  public static getAdapterInstance(
    schemaKey: string
  ): IAdapter<any> | undefined {
    logger.trace("Getting adapter instance", { schemaKey });
    const adapter = AdapterInstanceRegistry.get(schemaKey);
    if (adapter) {
      logger.debug("Found adapter instance", {
        schemaKey,
        isConnected: adapter.isConnected(),
      });
    }
    return adapter;
  }

  public static hasAdapterInstance(schemaKey: string): boolean {
    logger.trace("Checking adapter instance existence", { schemaKey });
    return AdapterInstanceRegistry.has(schemaKey);
  }

  public static async unregisterAdapterInstance(
    schemaKey: string
  ): Promise<boolean> {
    logger.trace("Unregistering adapter instance", { schemaKey });
    const adapter = AdapterInstanceRegistry.get(schemaKey);

    if (!adapter) {
      logger.debug("No adapter instance found to unregister", { schemaKey });
      return false;
    }

    try {
      if (adapter.isConnected()) {
        logger.debug("Disconnecting adapter before unregister", { schemaKey });
        await adapter.disconnect();
      }
    } catch (error) {
      logger.warn("Error disconnecting adapter", {
        schemaKey,
        error: (error as Error).message,
      });
    }

    const result = AdapterInstanceRegistry.delete(schemaKey);
    logger.debug("Adapter instance unregistered", {
      schemaKey,
      success: result,
    });
    return result;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * 🆕 HELPER: Tạo adapter instance từ AdapterClass và config
   */
  private static createAdapterFromClass(
    AdapterClass: { new (config?: any): IAdapter<any> },
    config?: DbConfig
  ): IAdapter<any> {
    logger.debug("Creating adapter from class", {
      databaseType: config?.databaseType,
    });
    return new AdapterClass(config);
  }

  /**
   * 🆕 HELPER: Đảm bảo adapter class được đăng ký (với lazy loading)
   */
  private static async ensureAdapterClassRegistered(
    databaseType: DatabaseType
  ): Promise<{ new (config?: any): IAdapter<any> }> {
    logger.debug("Ensuring adapter class is registered", { databaseType });

    // Kiểm tra trong AdapterRegistry trước
    let AdapterClass = AdapterRegistry.get(databaseType);

    if (AdapterClass) {
      logger.debug("Adapter class found in local registry", { databaseType });
      return AdapterClass;
    }

    // Lazy load từ AdapterHelper
    logger.debug("Lazy loading adapter class from helper", { databaseType });
    await AdapterHelper.lazyRegister(databaseType);

    // Thử lấy từ Helper
    AdapterClass = AdapterHelper.getAdapterClass(databaseType);

    if (!AdapterClass) {
      logger.error("Adapter class not found after lazy loading", {
        databaseType,
      });
      throw new Error(
        `Failed to load adapter class for database type '${databaseType}'. ` +
          `Please ensure the adapter is properly configured.`
      );
    }

    // Đăng ký vào local registry để tái sử dụng
    this.registerAdapter(databaseType, AdapterClass);
    logger.debug("Adapter class registered to local registry", {
      databaseType,
    });

    return AdapterClass;
  }

 
  /**
   * Tạo một adapter new Adapter(dbConfig);
   * @param schemaKey 
   * @param dbConfig 
   * @returns 
   */
  private static async createAdapterInstance(
    schemaKey: string,
    dbConfig?: DbConfig
  ): Promise<IAdapter<any>> {
    logger.debug("Creating/getting adapter instance", {
      schemaKey,
      hasRegisteredAdapter: AdapterInstanceRegistry.has(schemaKey),
      hasDatabaseType: !!dbConfig?.databaseType,
    });

    // 1. Kiểm tra adapter đã được đăng ký chưa
    const registeredAdapter = AdapterInstanceRegistry.get(schemaKey);
    if (registeredAdapter) {
      logger.info("Reusing registered adapter instance", {
        schemaKey,
        databaseType: registeredAdapter.databaseType,
        isConnected: registeredAdapter.isConnected(),
      });
      return registeredAdapter;
    }

    // 2. Cần tạo adapter mới - yêu cầu databaseType
    if (!dbConfig?.databaseType) {
      logger.error("Cannot create adapter without database type", {
        schemaKey,
      });
      throw new Error(
        `No adapter registered for schema '${schemaKey}' and no database type provided. ` +
          `Please provide dbConfig with databaseType or register adapter instance first.`
      );
    }

    // 3. Đảm bảo adapter class được đăng ký (với lazy loading)
    const AdapterClass = await this.ensureAdapterClassRegistered(
      dbConfig.databaseType
    );

    // 4. Tạo và đăng ký adapter instance mới
    logger.debug("Creating new adapter instance", {
      schemaKey,
      databaseType: dbConfig.databaseType,
    });

    const adapter = this.createAdapterFromClass(AdapterClass, dbConfig);
    this.registerAdapterInstance(schemaKey, adapter);

    logger.info("New adapter instance created and registered", {
      schemaKey,
      databaseType: adapter.databaseType,
    });

    return adapter;
  }

  // ==================== DAO CREATION ====================

  /**
   * Tạo UniversalDAO từ schema key với adapter sharing
   */
  public static async createDAO(
    schemaKey: string,
    options?: Partial<
      DbFactoryOptions & {
        autoInitializeTables?: boolean;
      }
    >
  ): Promise<UniversalDAO<any>> {
    logger.info("Creating DAO with adapter sharing", {
      schemaKey,
      hasOptions: !!options,
      hasRegisteredAdapter: AdapterInstanceRegistry.has(schemaKey),
    });

    // 1. Lấy schema

    const schema = SchemaRegistry.get(schemaKey);
    if (!schema) {
      logger.error("Schema not found", { schemaKey });
      throw new Error(
        `Schema with key '${schemaKey}' is not registered. ` +
          `Please call DatabaseFactory.registerSchema() first.`
      );
    }

    logger.debug("Resulte DAO for schema", { schemaKey });

    // 2. Lấy hoặc tạo adapter
    const adapter = await this.createAdapterInstance(
      schemaKey,
      options?.dbConfig
    );

    logger.debug("Adapter in database_type of database_name:", {
      databaseType: adapter.databaseType,
      databaseName: schema.database_name,
    });

    // 3. Kiểm tra hỗ trợ
    if (options?.validateSchema !== false && !adapter.isSupported()) {
      logger.error("Adapter not supported in current environment", {
        schemaKey,
        databaseType: adapter.databaseType,
      });
      throw new Error(
        `Database type '${adapter.databaseType}' is not supported in the current environment.`
      );
    }

    // 4. Tạo DAO
    const dao = new UniversalDAO(adapter, schema);
    logger.debug(
      "UniversalDAO created and waiting for connected to database: ",
      {
        databaseType: adapter.databaseType,
        databaseName: schema.database_name,
      }
    );

    // 5. Kết nối
    await dao.connect();
    logger.debug("UniversalDAO instance created and connected for schemaKey", { schemaKey });

    // 6. Validate schema (optional)
    if (options?.validateSchema) {
      logger.debug("Validating schema", { schemaKey });
      await this.validateSchema(dao, schema);
    }

    // 7. Initialize tables (chỉ khi được yêu cầu)
    if (options?.autoInitializeTables === true) {
      logger.debug("Auto-initializing tables", { schemaKey });
      await this.initializeTablesInternal(dao, schemaKey);
    }

    logger.info("DAO created successfully", { schemaKey });
    return dao;
  }

  /**
   * Tạo hoặc mở DAO (compatibility method)
   */
  public static async createOrOpen(
    options: DbFactoryOptions,
    checkAdapterSupport: boolean = true
  ): Promise<UniversalDAO<any>> {
    logger.trace("Creating or opening DAO", {
      databaseName: options.configSchema.database_name,
    });

    const { configSchema: schema } = options;
    const schemaKey = schema.database_name;

    // Đăng ký schema nếu chưa có
    if (!SchemaRegistry.has(schemaKey)) {
      logger.debug("Schema not registered, registering now", { schemaKey });
      SchemaRegistry.set(schemaKey, schema);
    }

    return await this.createDAO(schemaKey, {
      ...options,
      validateSchema: checkAdapterSupport,
    });
  }

  /**
   * Tạo adapter instance (standalone)
   */
  public static async createAdapter<
    TConnection extends IConnection = IConnection
  >(type: DatabaseType, config?: DbConfig): Promise<IAdapter<TConnection>> {
    logger.trace("Creating standalone adapter", { type });

    const AdapterClass = await this.ensureAdapterClassRegistered(type);
    const adapter = this.createAdapterFromClass(
      AdapterClass,
      config
    ) as IAdapter<TConnection>;

    logger.debug("Standalone adapter created successfully", { type });
    return adapter;
  }

  // ==================== TABLE INITIALIZATION ====================

  /**
   * Internal method - Khởi tạo tables KHÔNG tạo DAO mới
   */
  private static async initializeTablesInternal(
    dao: UniversalDAO<any>,
    schemaKey: string,
    entityNames?: string[],
    options?: {
      forceRecreate?: boolean;
      validateSchema?: boolean;
    }
  ): Promise<void> {
    logger.info("Initializing tables (internal)", {
      schemaKey,
      entityCount: entityNames?.length || "all",
      forceRecreate: options?.forceRecreate || false,
    });

    const schema = dao.getSchema();
    const targetEntities = entityNames || Object.keys(schema.schemas);

    await dao.ensureConnected();

    // Giải quyết dependency order
    const orderedEntities = this.resolveDependencyOrderForEntities(
      schema,
      targetEntities
    );

    logger.debug("Dependency order resolved", {
      schemaKey,
      order: orderedEntities,
    });

    // Tạo từng bảng theo thứ tự
    for (const entityName of orderedEntities) {
      const tableExists = await dao.tableExists(entityName);

      if (options?.forceRecreate) {
        logger.debug("Force recreating table", { entityName });
        if (tableExists) {
          await dao.dropTable(entityName);
        }
        await dao.createTable(entityName);
        logger.info("Table recreated", { entityName });
      } else if (!tableExists) {
        logger.debug("Creating new table", { entityName });
        await dao.createTable(entityName);
        logger.info("Table created", { entityName });
      } else {
        logger.debug("Table already exists, skipping", { entityName });
      }
    }

    logger.info("All tables initialized successfully", {
      schemaKey,
      tableCount: orderedEntities.length,
    });
  }

  /**
   * Public method - Khởi tạo nhiều bảng
   */
  public static async initializeTables(
    schemaKey: string,
    entityNames?: string[],
    options?: {
      forceRecreate?: boolean;
      validateSchema?: boolean;
      autoConnect?: boolean;
      dbConfig?: DbConfig;
      adapter?: IAdapter<any>;
    }
  ): Promise<UniversalDAO<any>> {
    // Ngăn chặn đệ quy
    if (InitializingSchemas.has(schemaKey)) {
      logger.warn("Already initializing tables, skipping", { schemaKey });
      return await this.createDAO(schemaKey, {
        ...options,
        autoInitializeTables: false,
      });
    }

    InitializingSchemas.add(schemaKey);

    try {
      logger.info("Initializing multiple tables", {
        schemaKey,
        entityCount: entityNames?.length || "all",
      });

      // Tạo DAO KHÔNG auto-initialize
      const dao = await this.createDAO(schemaKey, {
        dbConfig: options?.dbConfig,
        adapter: options?.adapter,
        autoConnect: options?.autoConnect !== false,
        validateSchema: false,
        autoInitializeTables: false,
      });

      // Sử dụng internal method để initialize
      await this.initializeTablesInternal(dao, schemaKey, entityNames, options);

      return dao;
    } finally {
      InitializingSchemas.delete(schemaKey);
    }
  }

  /**
   * Khởi tạo một bảng đơn lẻ
   */
  public static async initializeTable(
    schemaKey: string,
    entityName: string,
    options?: {
      forceRecreate?: boolean;
      validateSchema?: boolean;
      autoConnect?: boolean;
      dbConfig?: DbConfig;
      adapter?: IAdapter<any>;
    }
  ): Promise<UniversalDAO<any>> {
    logger.info("Initializing single table", { schemaKey, entityName });
    return await this.initializeTables(schemaKey, [entityName], options);
  }

  /**
   * Helper: Giải quyết thứ tự dependency
   */
  private static resolveDependencyOrderForEntities(
    schema: DatabaseSchema,
    entityNames: string[]
  ): string[] {
    const schemas = schema.schemas;
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (entityName: string) => {
      if (visited.has(entityName)) return;
      if (visiting.has(entityName)) {
        logger.warn("Circular dependency detected", { entityName });
        return;
      }

      visiting.add(entityName);

      const entitySchema = schemas[entityName];
      if (entitySchema?.foreign_keys) {
        for (const fk of entitySchema.foreign_keys) {
          const refTable = fk.references.table;
          if (
            entityNames.includes(refTable) &&
            schemas[refTable] &&
            !visited.has(refTable)
          ) {
            visit(refTable);
          }
        }
      }

      visiting.delete(entityName);
      visited.add(entityName);
      order.push(entityName);
    };

    for (const entityName of entityNames) {
      if (schemas[entityName]) {
        visit(entityName);
      }
    }

    logger.debug("Resolved dependency order", { order });
    return order;
  }

  // ==================== VALIDATION & UTILITIES ====================

  private static async validateSchema(
    dao: UniversalDAO,
    schema: DatabaseSchema
  ): Promise<void> {
    logger.trace("Starting schema validation", {
      schemaName: schema.database_name,
      entityCount: Object.keys(schema.schemas).length,
    });

    for (const [entityName, entitySchema] of Object.entries(schema.schemas)) {
      const adapter = dao.getAdapter();
      const exists = await adapter.tableExists(entityName);

      if (!exists) {
        logger.warn(`Table '${entityName}' does not exist, creating...`);

        const schemaDefinition: any = {};
        for (const col of entitySchema.cols) {
          if (col.name) {
            schemaDefinition[col.name] = col;
          }
        }

        await adapter.createTable(entityName, schemaDefinition);
        logger.info("Table created", { entityName });
      }
    }

    logger.trace("Schema validation completed");
  }

  /**
   * Reset tất cả registries (dùng cho testing)
   */
  public static reset(): void {
    logger.trace("Resetting all registries");
    SchemaRegistry.clear();
    AdapterRegistry.clear();
    AdapterInstanceRegistry.clear();
    InitializingSchemas.clear();
    logger.debug("Registries reset successfully");
  }

  /**
   * Lấy thống kê
   */
  public static getStats(): {
    schemas: number;
    adapterClasses: number;
    adapterInstances: number;
  } {
    return {
      schemas: SchemaRegistry.size,
      adapterClasses: AdapterRegistry.size,
      adapterInstances: AdapterInstanceRegistry.size,
    };
  }
}

// ========================
// src/core/database-factory.ts (ENHANCED ADAPTER MANAGEMENT)
// ========================

import { DatabaseType, DbConfig, DatabaseSchema } from "@/types/orm.types";
import { UniversalDAO } from "./universal-dao";
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
 * ✅ NEW: Theo dõi các schema đang trong quá trình khởi tạo tables
 */
const InitializingSchemas = new Set<string>();

/**
 * Database Factory (ENHANCED FOR ADAPTER SHARING)
 */
export class DatabaseFactory {
  // ==================== SCHEMA MANAGEMENT ====================

  /**
   * Đăng ký schema structure
   */
  public static registerSchema(
    schemaKey: string,
    schema: DatabaseSchema
  ): void {
    logger.trace("Registering schema", { schemaKey });

    SchemaRegistry.set(schemaKey, schema);

    logger.debug("Schema registered successfully", { schemaKey });
  }

  /**
   * Đăng ký nhiều schemas
   */
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

  /**
   * Lấy schema đã đăng ký
   */
  public static getSchema(schemaKey: string): DatabaseSchema | undefined {
    logger.trace("Getting schema", { schemaKey });

    return SchemaRegistry.get(schemaKey);
  }

  /**
   * Kiểm tra schema đã được đăng ký chưa
   */
  public static hasSchema(schemaKey: string): boolean {
    logger.trace("Checking schema existence", { schemaKey });

    return SchemaRegistry.has(schemaKey);
  }

  /**
   * Lấy tất cả schemas đã đăng ký
   */
  public static getAllSchemas(): Map<string, DatabaseSchema> {
    logger.trace("Getting all schemas", { totalSchemas: SchemaRegistry.size });

    return new Map(SchemaRegistry);
  }

  /**
   * Xóa schema đã đăng ký
   */
  public static unregisterSchema(schemaKey: string): boolean {
    logger.trace("Unregistering schema", { schemaKey });

    const result = SchemaRegistry.delete(schemaKey);

    logger.debug("Schema unregistered", { schemaKey, success: result });

    return result;
  }

  // ==================== ADAPTER CLASS MANAGEMENT ====================

  /**
   * Đăng ký adapter class cho database type
   */
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

  /**
   * Lấy adapter class đã đăng ký
   */
  public static getAdapterClass(
    type: DatabaseType
  ): { new (config?: any): IAdapter<any> } | undefined {
    logger.trace("Getting adapter class", { type });

    return AdapterRegistry.get(type);
  }

  /**
   * Kiểm tra adapter class đã được đăng ký chưa
   */
  public static hasAdapterClass(type: DatabaseType): boolean {
    logger.trace("Checking adapter class existence", { type });

    return AdapterRegistry.has(type);
  }

  // ==================== ADAPTER INSTANCE MANAGEMENT (ENHANCED) ====================

  /**
   * ✅ ENHANCED: Đăng ký adapter instance đã được tạo sẵn
   * @param schemaKey - Key của schema
   * @param adapter - Instance của adapter
   */
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

  /**
   * Lấy adapter instance đã đăng ký
   */
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
    } else {
      logger.trace("No adapter instance found", { schemaKey });
    }

    return adapter;
  }

  /**
   * ✅ NEW: Kiểm tra có adapter instance không
   */
  public static hasAdapterInstance(schemaKey: string): boolean {
    logger.trace("Checking adapter instance existence", { schemaKey });

    return AdapterInstanceRegistry.has(schemaKey);
  }

  /**
   * Xóa adapter instance
   */
  public static async unregisterAdapterInstance(
    schemaKey: string
  ): Promise<boolean> {
    logger.trace("Unregistering adapter instance", { schemaKey });

    const adapter = AdapterInstanceRegistry.get(schemaKey);
    if (adapter) {
      logger.debug("Disconnecting adapter before unregister", { schemaKey });

      try {
        if (adapter.isConnected()) {
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

    logger.debug("No adapter instance found to unregister", { schemaKey });

    return false;
  }

  // ==================== DAO CREATION (ENHANCED) ====================

  /**
   * ✅ ENHANCED: Tạo adapter instance từ schema key hoặc config
   * Ưu tiên sử dụng adapter đã được register
   */
  private static async createAdapterInstance(
    schema: DatabaseSchema,
    schemaKey: string,
    dbConfig?: DbConfig,
    injectedAdapter?: IAdapter<any>
  ): Promise<IAdapter<any>> {
    logger.debug("Creating/getting adapter instance", {
      schemaKey,
      databaseType: schema.database_type,
      databaseName: schema.database_name,
      hasInjectedAdapter: !!injectedAdapter,
      hasRegisteredAdapter: AdapterInstanceRegistry.has(schemaKey),
    });

    // 1. ✅ PRIORITY 1: Nếu có adapter được inject sẵn
    if (injectedAdapter) {
      logger.info("Using injected adapter instance", {
        schemaKey,
        databaseType: schema.database_type,
      });
      return injectedAdapter;
    }

    // 2. ✅ PRIORITY 2: Kiểm tra adapter đã được register chưa
    const registeredAdapter = AdapterInstanceRegistry.get(schemaKey);
    if (registeredAdapter) {
      logger.info("Using registered adapter instance", {
        schemaKey,
        databaseType: schema.database_type,
        isConnected: registeredAdapter.isConnected(),
      });
      return registeredAdapter;
    }

    // 3. ✅ PRIORITY 3: Tạo adapter mới
    logger.debug("No existing adapter, creating new one", {
      schemaKey,
      databaseType: schema.database_type,
    });

    // Lấy adapter class từ registry
    const AdapterClass = AdapterRegistry.get(schema.database_type || "sqlite");
    if (!AdapterClass) {
      logger.error("Adapter class not found for database type", {
        databaseType: schema.database_type,
        schemaName: schema.database_name,
      });
      throw new Error(
        `Adapter for database type '${schema.database_type}' is not registered. ` +
          `Please call DatabaseFactory.registerAdapter() first.`
      );
    }

    // Tạo dbConfig nếu chưa có
    const finalDbConfig: DbConfig = dbConfig || {
      databaseType: schema.database_type || "sqlite",
      database: schema.database_name,
      dbName: schema.database_name,
      host: "localhost",
      port: this.getDefaultPort(schema.database_type || "sqlite"),
      username: "root",
      password: "",
    };

    logger.debug("Created final dbConfig", {
      schemaKey,
      databaseType: finalDbConfig.databaseType,
      databaseName: finalDbConfig.dbName,
    });

    // Tạo adapter instance
    const adapter = new AdapterClass(finalDbConfig);

    // ✅ KEY: Tự động register adapter mới tạo
    logger.info("Auto-registering newly created adapter", { schemaKey });
    AdapterInstanceRegistry.set(schemaKey, adapter);

    logger.debug("Adapter instance created and registered successfully", {
      schemaKey,
      databaseType: schema.database_type,
      databaseName: schema.database_name,
    });

    return adapter;
  }

  // ==================== DAO CREATION (FIXED) ====================

  /**
   * ✅ FIXED: Tạo UniversalDAO từ schema key với adapter sharing
   * KHÔNG tự động gọi initializeTables() nữa
   */
  public static async createDAO(
    schemaKey: string,
    options?: Partial<
      DbFactoryOptions & {
        autoInitializeTables?: boolean; // ✅ THÊM FLAG MỚI chỉ thị khi nào cần khởi tạo mới table thì đặt nó = true
      }
    >
  ): Promise<UniversalDAO<any>> {
    logger.info("Creating DAO with adapter sharing", {
      schemaKey,
      optionsKeys: options ? Object.keys(options) : [],
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

    logger.debug("Retrieved schema", {
      schemaKey,
      databaseType: schema.database_type,
    });

    // 2. Lấy hoặc tạo adapter
    const adapter = await this.createAdapterInstance(
      schema,
      schemaKey,
      options?.dbConfig,
      options?.adapter
    );

    logger.debug("Adapter obtained for DAO", {
      schemaKey,
      isConnected: adapter.isConnected(),
      isFromRegistry: AdapterInstanceRegistry.get(schemaKey) === adapter,
    });

    // 3. Kiểm tra hỗ trợ
    const checkAdapterSupport = options?.validateSchema !== false;
    if (checkAdapterSupport && !adapter.isSupported()) {
      logger.error("Adapter not supported in current environment", {
        schemaKey,
        databaseType: schema.database_type,
      });
      throw new Error(
        `Database type '${schema.database_type}' is not supported in the current environment or missing dependencies.`
      );
    }

    // 4. Tạo DAO
    const dao = new UniversalDAO(
      adapter,
      schema,
      options?.dbConfig || adapter.getConnection()?.rawConnection
    );

    logger.debug("UniversalDAO instance created", { schemaKey });

    // 5. Auto-connect
    const autoConnect = options?.autoConnect !== false;
    const needsConnection = autoConnect && !adapter.isConnected();

    if (needsConnection) {
      logger.debug("Adapter not connected, auto-connecting DAO", {
        schemaKey,
        adapterConnected: adapter.isConnected(),
      });
      await dao.ensureConnected();
      logger.info("DAO connected successfully", { schemaKey });
    } else if (adapter.isConnected()) {
      logger.info("Adapter already connected, skipping auto-connect", {
        schemaKey,
        adapterConnected: true,
      });
    } else {
      logger.debug("Auto-connect disabled, skipping connection", { schemaKey });
    }

    // 6. Validate schema
    if (options?.validateSchema) {
      logger.debug("Validating schema", { schemaKey });
      await this.validateSchema(dao, schema);
      logger.info("Schema validation completed", { schemaKey });
    }

    // ✅ FIXED: CHỈ initialize tables khi được yêu cầu EXPLICIT
    if (options?.autoInitializeTables === true) {
      logger.debug("Auto-initializing tables as requested", { schemaKey });
      // Gọi initializeTablesInternal để tránh đệ quy
      await this.initializeTablesInternal(dao, schemaKey);
    }

    logger.info("DAO created successfully with shared adapter", {
      schemaKey,
      adapterShared: AdapterInstanceRegistry.get(schemaKey) === adapter,
    });

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
      databaseName: options.config.database_name,
      checkAdapterSupport,
    });

    const { config: schema } = options;

    // Đăng ký schema nếu chưa có
    const schemaKey = schema.database_name;
    if (!SchemaRegistry.has(schemaKey)) {
      logger.debug("Schema not registered, registering now", { schemaKey });
      SchemaRegistry.set(schemaKey, schema);
    }

    const dao = await this.createDAO(schemaKey, {
      ...options,
      validateSchema: checkAdapterSupport,
    });

    logger.debug("DAO created/opened successfully via compatibility method", {
      schemaKey,
    });

    return dao;
  }

  /**
   * Tạo adapter instance (standalone)
   */
  public static createAdapter<TConnection extends IConnection = IConnection>(
    type: DatabaseType,
    config?: DbConfig
  ): IAdapter<TConnection> {
    logger.trace("Creating standalone adapter", { type });

    const AdapterClass = AdapterRegistry.get(type);
    if (!AdapterClass) {
      logger.error("Adapter class not found for standalone creation", { type });
      throw new Error(`Adapter for database type '${type}' is not registered.`);
    }

    const adapter = new AdapterClass(config) as IAdapter<TConnection>;

    logger.debug("Standalone adapter created successfully", { type });

    return adapter;
  }

  // ==================== TABLE INITIALIZATION (FIXED) ====================

  /**
   * ✅ FIXED: Internal method - Khởi tạo tables KHÔNG tạo DAO mới
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

    logger.debug("Target entities determined", {
      schemaKey,
      entities: targetEntities,
    });

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

    logger.info("All tables initialized successfully (internal)", {
      schemaKey,
      tableCount: orderedEntities.length,
    });
  }

  /**
   * ✅ FIXED: Public method - Khởi tạo nhiều bảng (SỬ DỤNG DAO ĐÃ CÓ)
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
    // ✅ NGĂN CHẶN ĐỆ QUY
    if (InitializingSchemas.has(schemaKey)) {
      logger.warn("Already initializing tables for this schema, skipping", {
        schemaKey,
      });
      // Trả về DAO hiện tại thay vì tạo mới
      const dao = await this.createDAO(schemaKey, {
        ...options,
        autoInitializeTables: false, // ✅ TẮT auto-init
      });
      return dao;
    }

    InitializingSchemas.add(schemaKey);

    try {
      logger.info("Initializing multiple tables", {
        schemaKey,
        entityCount: entityNames?.length || "all",
        forceRecreate: options?.forceRecreate || false,
      });

      // 1. Tạo DAO KHÔNG auto-initialize
      const dao = await this.createDAO(schemaKey, {
        dbConfig: options?.dbConfig,
        adapter: options?.adapter,
        autoConnect: options?.autoConnect !== false,
        validateSchema: false,
        autoInitializeTables: false, // ✅ QUAN TRỌNG: TẮT auto-init
      });

      // 2. Sử dụng internal method để initialize
      await this.initializeTablesInternal(dao, schemaKey, entityNames, options);

      return dao;
    } finally {
      InitializingSchemas.delete(schemaKey);
    }
  }

  /**
   * ✅ FIXED: Khởi tạo một bảng đơn lẻ
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
    logger.info("Initializing single table", {
      schemaKey,
      entityName,
      forceRecreate: options?.forceRecreate || false,
    });

    // Sử dụng initializeTables với single entity
    return await this.initializeTables(schemaKey, [entityName], options);
  }

  /**
   * ✅ Helper: Giải quyết thứ tự dependency cho danh sách entities
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
          // Chỉ visit nếu refTable nằm trong danh sách cần tạo
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

    // Visit các entities trong danh sách
    for (const entityName of entityNames) {
      if (schemas[entityName]) {
        visit(entityName);
      }
    }

    logger.debug("Resolved dependency order for specific entities", { order });
    return order;
  }

  // ==================== HELPER METHODS ====================

  private static getDefaultPort(dbType: DatabaseType): number {
    logger.trace("Getting default port", { dbType });

    const portMap: Record<DatabaseType, number> = {
      postgresql: 5432,
      mysql: 3306,
      mariadb: 3306,
      sqlite: 0,
      sqlserver: 1433,
      mongodb: 27017,
      oracle: 0,
    };
    const port = portMap[dbType] || 0;

    logger.trace("Default port retrieved", { dbType, port });

    return port;
  }

  private static async validateSchema(
    dao: UniversalDAO,
    schema: DatabaseSchema
  ): Promise<void> {
    logger.trace("Starting schema validation", {
      schemaName: schema.database_name,
      entityCount: Object.keys(schema.schemas).length,
    });

    for (const [entityName, entitySchema] of Object.entries(schema.schemas)) {
      logger.trace("Validating entity", { entityName });

      const adapter = dao.getAdapter();
      const exists = await adapter.tableExists(entityName);

      if (!exists) {
        logger.warn(
          `Table/Collection '${entityName}' does not exist. Creating...`,
          { entityName, schemaName: schema.database_name }
        );
        const schemaDefinition: any = {};
        for (const col of entitySchema.cols) {
          const fieldName = col.name || "";
          if (fieldName) {
            schemaDefinition[fieldName] = col;
          }
        }
        await adapter.createTable(entityName, schemaDefinition);

        logger.info("Table/Collection created", {
          entityName,
          schemaName: schema.database_name,
        });
      } else {
        logger.debug("Entity already exists, skipping creation", {
          entityName,
        });
      }
    }

    logger.trace("Schema validation completed", {
      schemaName: schema.database_name,
    });
  }

  /**
   * Reset tất cả registries (dùng cho testing)
   */
  public static reset(): void {
    logger.warn("Resetting all registries", {
      stats: {
        schemas: SchemaRegistry.size,
        adapterClasses: AdapterRegistry.size,
        adapterInstances: AdapterInstanceRegistry.size,
        initializing: InitializingSchemas.size,
      },
    });

    SchemaRegistry.clear();
    AdapterRegistry.clear();
    AdapterInstanceRegistry.clear();
    InitializingSchemas.clear(); // ✅ THÊM

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
    logger.trace("Getting factory stats");

    const stats = {
      schemas: SchemaRegistry.size,
      adapterClasses: AdapterRegistry.size,
      adapterInstances: AdapterInstanceRegistry.size,
    };

    logger.trace("Factory stats retrieved", { stats });

    return stats;
  }
}

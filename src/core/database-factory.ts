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
 * ✅ KEY: Đây là nơi lưu trữ tập trung tất cả adapter instances
 */
const AdapterInstanceRegistry = new Map<string, IAdapter<any>>();

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

  /**
   * ✅ ENHANCED: Tạo UniversalDAO từ schema key với adapter sharing
   */
  public static async createDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
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

    // 2. ✅ KEY: Lấy hoặc tạo adapter (ưu tiên adapter đã register)
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

    // 5. ✅ FIXED: Auto-connect chỉ khi adapter chưa connected
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

    // 6. Validate schema nếu được yêu cầu
    if (options?.validateSchema) {
      logger.debug("Validating schema", { schemaKey });
      await this.validateSchema(dao, schema);
      logger.info("Schema validation completed", { schemaKey });
    }

    logger.info("DAO created successfully with shared adapter", {
      schemaKey,
      adapterShared: AdapterInstanceRegistry.get(schemaKey) === adapter,
    });

    // tạo bảng nếu khởi động ban đầu hoặc lazyload
    await this.initializeTables(schemaKey);

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

  // ==================== TABLE INITIALIZATION & SYNC ====================

  /**
   * ✅ Khởi tạo hoặc đồng bộ bảng dữ liệu từ schema
   * @param schemaKey - Key của schema đã đăng ký
   * @param entityName - Tên bảng/collection cần khởi tạo
   * @param options - Tùy chọn khởi tạo
   * @returns UniversalDAO đã sẵn sàng để CRUD
   */
  public static async initializeTable(
    schemaKey: string,
    entityName: string,
    options?: {
      forceRecreate?: boolean; // Ép tạo lại bảng (xóa và tạo mới)
      validateSchema?: boolean; // Kiểm tra schema sau khi tạo
      autoConnect?: boolean; // Tự động kết nối (default: true)
      dbConfig?: DbConfig; // Config database
      adapter?: IAdapter<any>; // Adapter đã tạo sẵn
    }
  ): Promise<UniversalDAO<any>> {
    logger.info("Initializing table", {
      schemaKey,
      entityName,
      forceRecreate: options?.forceRecreate || false,
    });

    // 1. Lấy schema
    const schema = SchemaRegistry.get(schemaKey);
    if (!schema) {
      logger.error("Schema not found for table initialization", { schemaKey });
      throw new Error(
        `Schema with key '${schemaKey}' is not registered. ` +
          `Please call DatabaseFactory.registerSchema() first.`
      );
    }

    // 2. Kiểm tra entity có trong schema không
    const entitySchema = schema.schemas[entityName];
    if (!entitySchema) {
      logger.error("Entity not found in schema", { schemaKey, entityName });
      throw new Error(
        `Entity '${entityName}' not found in schema '${schemaKey}'`
      );
    }

    logger.debug("Retrieved entity schema", {
      schemaKey,
      entityName,
      columnCount: entitySchema.cols.length,
      indexCount: entitySchema.indexes?.length || 0,
      foreignKeyCount: entitySchema.foreign_keys?.length || 0,
    });

    // 3. Tạo hoặc lấy DAO với adapter sharing
    const dao = await this.createDAO(schemaKey, {
      dbConfig: options?.dbConfig,
      adapter: options?.adapter,
      autoConnect: options?.autoConnect !== false,
      validateSchema: false, // Không validate toàn bộ, chỉ xử lý entity cụ thể
    });

    logger.debug("DAO instance obtained", {
      schemaKey,
      entityName,
      adapterConnected: dao.getAdapter().isConnected(),
    });

    // 4. Đảm bảo kết nối
    await dao.ensureConnected();

    // 5. Kiểm tra bảng đã tồn tại chưa
    const tableExists = await dao.tableExists(entityName);

    logger.debug("Table existence check", {
      schemaKey,
      entityName,
      exists: tableExists,
    });

    // 6. Xử lý logic tạo/tái tạo bảng
    if (options?.forceRecreate) {
      // ✅ CASE 1: Ép tạo lại bảng (migration/upgrade/downgrade)
      logger.info("Force recreate requested - dropping and recreating table", {
        schemaKey,
        entityName,
      });

      if (tableExists) {
        logger.debug("Dropping existing table", { entityName });
        await dao.dropTable(entityName);
        logger.info("Table dropped successfully", { entityName });
      }

      logger.debug("Creating new table with full schema", { entityName });
      await dao.createTable(entityName);
      logger.info("Table recreated successfully", { entityName });
    } else if (!tableExists) {
      // ✅ CASE 2: Bảng chưa tồn tại - tạo mới
      logger.info("Table does not exist - creating new table", {
        schemaKey,
        entityName,
      });

      await dao.createTable(entityName);
      logger.info("Table created successfully", { entityName });
    } else {
      // ✅ CASE 3: Bảng đã tồn tại - không làm gì
      logger.info("Table already exists - skipping creation", {
        schemaKey,
        entityName,
      });
    }

    // 7. Validate schema nếu được yêu cầu
    if (options?.validateSchema) {
      logger.debug("Validating table structure", { entityName });

      const tableInfo = await dao.getTableInfo(entityName);
      logger.info("Table structure validated", {
        entityName,
        tableInfo,
      });
    }

    logger.info("Table initialization completed successfully", {
      schemaKey,
      entityName,
      wasCreated: !tableExists || options?.forceRecreate,
    });

    return dao;
  }

  /**
   * ✅ Khởi tạo nhiều bảng cùng lúc (theo thứ tự dependency)
   * @param schemaKey - Key của schema đã đăng ký
   * @param entityNames - Danh sách tên bảng cần khởi tạo (optional, mặc định là tất cả)
   * @param options - Tùy chọn khởi tạo
   * @returns UniversalDAO đã sẵn sàng để CRUD
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
    logger.info("Initializing multiple tables", {
      schemaKey,
      entityCount: entityNames?.length || "all",
      forceRecreate: options?.forceRecreate || false,
    });

    // 1. Lấy schema
    const schema = SchemaRegistry.get(schemaKey);
    if (!schema) {
      logger.error("Schema not found for tables initialization", { schemaKey });
      throw new Error(
        `Schema with key '${schemaKey}' is not registered. ` +
          `Please call DatabaseFactory.registerSchema() first.`
      );
    }

    // 2. Xác định danh sách entities cần tạo
    const targetEntities = entityNames || Object.keys(schema.schemas);

    logger.debug("Target entities determined", {
      schemaKey,
      entities: targetEntities,
    });

    // 3. Tạo DAO một lần duy nhất
    const dao = await this.createDAO(schemaKey, {
      dbConfig: options?.dbConfig,
      adapter: options?.adapter,
      autoConnect: options?.autoConnect !== false,
      validateSchema: false,
    });

    await dao.ensureConnected();

    logger.debug("DAO instance ready for batch operations", { schemaKey });

    // 4. Giải quyết thứ tự dependency (tương tự syncAllTables)
    const orderedEntities = this.resolveDependencyOrderForEntities(
      schema,
      targetEntities
    );

    logger.debug("Dependency order resolved", {
      schemaKey,
      order: orderedEntities,
    });

    // 5. Tạo từng bảng theo thứ tự
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

    return dao;
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
      },
    });

    SchemaRegistry.clear();
    AdapterRegistry.clear();
    AdapterInstanceRegistry.clear();

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

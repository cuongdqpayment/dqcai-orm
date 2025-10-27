// ========================
// src/core/database-factory.ts 
// ========================

import { DatabaseType, DbConfig, DatabaseSchema } from "../types/orm.types";
import { UniversalDAO } from "./universal-dao";
import { IAdapter } from "../interfaces/adapter.interface";
import { DbFactoryOptions } from "../types/service.types";
import { IConnection } from "../types/orm.types";

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
 * Database Factory (REFACTORED)
 */
export class DatabaseFactory {
  // ==================== SCHEMA MANAGEMENT ====================
  
  /**
   * Đăng ký schema structure
   */
  public static registerSchema(schemaKey: string, schema: DatabaseSchema): void {
    SchemaRegistry.set(schemaKey, schema);
  }

  /**
   * Đăng ký nhiều schemas
   */
  public static registerSchemas(schemas: Record<string, DatabaseSchema>): void {
    Object.entries(schemas).forEach(([key, schema]) => {
      this.registerSchema(key, schema);
    });
  }

  /**
   * Lấy schema đã đăng ký
   */
  public static getSchema(schemaKey: string): DatabaseSchema | undefined {
    return SchemaRegistry.get(schemaKey);
  }

  /**
   * Kiểm tra schema đã được đăng ký chưa
   */
  public static hasSchema(schemaKey: string): boolean {
    return SchemaRegistry.has(schemaKey);
  }

  /**
   * Lấy tất cả schemas đã đăng ký
   */
  public static getAllSchemas(): Map<string, DatabaseSchema> {
    return new Map(SchemaRegistry);
  }

  /**
   * Xóa schema đã đăng ký
   */
  public static unregisterSchema(schemaKey: string): boolean {
    return SchemaRegistry.delete(schemaKey);
  }

  // ==================== ADAPTER CLASS MANAGEMENT ====================

  /**
   * Đăng ký adapter class cho database type
   */
  public static registerAdapter<TConnection extends IConnection>(
    type: DatabaseType,
    AdapterClass: { new (config?: any): IAdapter<TConnection> }
  ): void {
    AdapterRegistry.set(
      type,
      AdapterClass as { new (config?: any): IAdapter<any> }
    );
  }

  /**
   * Lấy adapter class đã đăng ký
   */
  public static getAdapterClass(
    type: DatabaseType
  ): { new (config?: any): IAdapter<any> } | undefined {
    return AdapterRegistry.get(type);
  }

  /**
   * Kiểm tra adapter class đã được đăng ký chưa
   */
  public static hasAdapterClass(type: DatabaseType): boolean {
    return AdapterRegistry.has(type);
  }

  // ==================== ADAPTER INSTANCE MANAGEMENT ====================

  /**
   * Đăng ký adapter instance đã được tạo sẵn
   * @param schemaKey - Key của schema
   * @param adapter - Instance của adapter
   */
  public static registerAdapterInstance(
    schemaKey: string,
    adapter: IAdapter<any>
  ): void {
    AdapterInstanceRegistry.set(schemaKey, adapter);
  }

  /**
   * Lấy adapter instance đã đăng ký
   */
  public static getAdapterInstance(schemaKey: string): IAdapter<any> | undefined {
    return AdapterInstanceRegistry.get(schemaKey);
  }

  /**
   * Xóa adapter instance
   */
  public static async unregisterAdapterInstance(schemaKey: string): Promise<boolean> {
    const adapter = AdapterInstanceRegistry.get(schemaKey);
    if (adapter) {
      await adapter.disconnect();
      return AdapterInstanceRegistry.delete(schemaKey);
    }
    return false;
  }

  // ==================== DAO CREATION ====================

  /**
   * Tạo adapter instance từ schema key hoặc config
   */
  private static async createAdapterInstance(
    schema: DatabaseSchema,
    dbConfig?: DbConfig,
    injectedAdapter?: IAdapter<any>
  ): Promise<IAdapter<any>> {
    // 1. Nếu có adapter được inject sẵn
    if (injectedAdapter) {
      return injectedAdapter;
    }

    // 2. Lấy adapter class từ registry
    const AdapterClass = AdapterRegistry.get(schema.database_type);
    if (!AdapterClass) {
      throw new Error(
        `Adapter for database type '${schema.database_type}' is not registered. ` +
        `Please call DatabaseFactory.registerAdapter() first.`
      );
    }

    // 3. Tạo dbConfig nếu chưa có
    const finalDbConfig: DbConfig = dbConfig || {
      databaseType: schema.database_type,
      database: schema.database_name,
      dbName: schema.database_name,
      host: "localhost",
      port: this.getDefaultPort(schema.database_type),
      username: "root",
      password: "",
    };

    // 4. Tạo adapter instance
    return new AdapterClass(finalDbConfig);
  }

  /**
   * Tạo UniversalDAO từ schema key
   */
  public static async createDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    // 1. Lấy schema
    const schema = SchemaRegistry.get(schemaKey);
    if (!schema) {
      throw new Error(
        `Schema with key '${schemaKey}' is not registered. ` +
        `Please call DatabaseFactory.registerSchema() first.`
      );
    }

    // 2. Kiểm tra adapter instance đã tồn tại
    let adapter = AdapterInstanceRegistry.get(schemaKey);
    
    // 3. Nếu chưa có, tạo mới
    if (!adapter) {
      adapter = await this.createAdapterInstance(
        schema,
        options?.dbConfig,
        options?.adapter
      );
      
      // Lưu lại adapter instance
      AdapterInstanceRegistry.set(schemaKey, adapter);
    }

    // 4. Kiểm tra hỗ trợ
    const checkAdapterSupport = options?.validateSchema !== false;
    if (checkAdapterSupport && !adapter.isSupported()) {
      throw new Error(
        `Database type '${schema.database_type}' is not supported in the current environment or missing dependencies.`
      );
    }

    // 5. Tạo DAO
    const dao = new UniversalDAO(adapter, schema, options?.dbConfig || adapter.getConnection()?.rawConnection);

    // 6. Auto-connect nếu được yêu cầu
    const autoConnect = options?.autoConnect !== false;
    if (autoConnect) {
      await dao.ensureConnected();
    }

    // 7. Validate schema nếu được yêu cầu
    if (options?.validateSchema) {
      await this.validateSchema(dao, schema);
    }

    return dao;
  }

  /**
   * Tạo hoặc mở DAO (compatibility method)
   */
  public static async createOrOpen(
    options: DbFactoryOptions,
    checkAdapterSupport: boolean = true
  ): Promise<UniversalDAO<any>> {
    const { config: schema } = options;
    
    // Đăng ký schema nếu chưa có
    const schemaKey = schema.database_name;
    if (!SchemaRegistry.has(schemaKey)) {
      SchemaRegistry.set(schemaKey, schema);
    }

    return this.createDAO(schemaKey, {
      ...options,
      validateSchema: checkAdapterSupport,
    });
  }

  /**
   * Tạo adapter instance (standalone)
   */
  public static createAdapter<TConnection extends IConnection = IConnection>(
    type: DatabaseType,
    config?: DbConfig
  ): IAdapter<TConnection> {
    const AdapterClass = AdapterRegistry.get(type);
    if (!AdapterClass) {
      throw new Error(`Adapter for database type '${type}' is not registered.`);
    }
    return new AdapterClass(config) as IAdapter<TConnection>;
  }

  // ==================== HELPER METHODS ====================

  private static getDefaultPort(dbType: DatabaseType): number {
    const portMap: Record<DatabaseType, number> = {
      postgresql: 5432,
      mysql: 3306,
      mariadb: 3306,
      sqlite: 0,
      sqlserver: 1433,
      mongodb: 27017,
      oracle: 0,
    };
    return portMap[dbType] || 0;
  }

  private static async validateSchema(
    dao: UniversalDAO,
    schema: DatabaseSchema
  ): Promise<void> {
    for (const [entityName, entitySchema] of Object.entries(schema.schemas)) {
      const adapter = dao.getAdapter();
      const exists = await adapter.tableExists(entityName);

      if (!exists) {
        console.warn(
          `Table/Collection '${entityName}' does not exist. Creating...`
        );
        const schemaDefinition: any = {};
        for (const col of entitySchema.cols) {
          const fieldName = col.name || "";
          if (fieldName) {
            schemaDefinition[fieldName] = col;
          }
        }
        await adapter.createTable(entityName, schemaDefinition);
      }
    }
  }

  /**
   * Reset tất cả registries (dùng cho testing)
   */
  public static reset(): void {
    SchemaRegistry.clear();
    AdapterRegistry.clear();
    AdapterInstanceRegistry.clear();
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

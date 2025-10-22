// ========================
// src/core/database-factory.ts
// ========================

import { DatabaseType } from "../types/orm.types";
import { UniversalDAO } from "./universal-dao";
import { IAdapter } from "../interfaces/adapter.interface";
import { DbConfig, DatabaseSchema } from "../types/orm.types";
import { DbFactoryOptions } from "../types/service.types";
import { IConnection } from "../types/orm.types";

/**
 * Adapter Registry
 */
const AdapterRegistry = new Map<
  DatabaseType,
  { new (config?: any): IAdapter<any> }
>();

/**
 * Database Factory
 */
export class DatabaseFactory {
  /**
   * Register an adapter class for a database type
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
   * Get registered adapter class
   */
  public static getAdapterClass(
    type: DatabaseType
  ): { new (config?: any): IAdapter<any> } | undefined {
    return AdapterRegistry.get(type);
  }

  /**
   * Create or open a UniversalDAO instance
   */
  public static async createOrOpen(
    options: DbFactoryOptions,
    checkAdapterSupport: boolean = true
  ): Promise<UniversalDAO<any>> {
    const {
      config: schema,
      adapter: injectedAdapter,
      dbConfig: injectedDbConfig,
      autoConnect = true,
    } = options;
    const dbType = schema.database_type;

    // 1. Determine DbConfig
    const dbConfig: DbConfig = injectedDbConfig || {
      databaseType: dbType,
      database: schema.database_name,
      dbName: schema.database_name,
      // Additional config from defaults
      host: "localhost",
      port: this.getDefaultPort(dbType),
      username: "root",
      password: "",
    };

    // 2. Determine Adapter
    let adapter: IAdapter<any>;

    if (injectedAdapter) {
      adapter = injectedAdapter;
    } else {
      const AdapterClass = AdapterRegistry.get(dbType);
      if (!AdapterClass) {
        throw new Error(
          `Adapter for database type '${dbType}' is not registered. ` +
            `Please call DatabaseFactory.registerAdapter() first.`
        );
      }
      adapter = new AdapterClass(dbConfig);
    }

    if (checkAdapterSupport && !adapter.isSupported()) {
      throw new Error(
        `Database type '${dbType}' is not supported in the current environment or missing dependencies.`
      );
    }

    // 3. Create DAO
    const dao = new UniversalDAO(adapter, schema, dbConfig);

    // 4. Auto-connect if requested
    if (autoConnect) {
      await dao.ensureConnected();
    }

    // 5. Validate schema if requested
    if (options.validateSchema) {
      await this.validateSchema(dao, schema);
    }

    return dao;
  }

  /**
   * Create adapter instance
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
    // Validate that all tables/collections exist
    for (const [entityName, entitySchema] of Object.entries(schema.schemas)) {
      const adapter = dao.getAdapter();
      const exists = await adapter.tableExists(entityName);

      if (!exists) {
        console.warn(
          `Table/Collection '${entityName}' does not exist. Creating...`
        );
        // Convert EntitySchemaDefinition to SchemaDefinition
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
}

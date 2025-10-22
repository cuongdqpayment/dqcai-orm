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

/**
 * Database Manager (Singleton)
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private static schemaConfigurations: Record<string, DatabaseSchema> = {};
  private static roleRegistry: RoleRegistry = {};
  private static connections: Record<string, UniversalDAO<any>> = {};

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // --- Schema Management ---

  public static registerSchema(key: string, schema: DatabaseSchema): void {
    this.schemaConfigurations[key] = schema;
  }

  public static getSchema(key: string): DatabaseSchema | undefined {
    return this.schemaConfigurations[key];
  }

  public static getAllSchemas(): Record<string, DatabaseSchema> {
    return { ...this.schemaConfigurations };
  }

  public static hasSchema(key: string): boolean {
    return key in this.schemaConfigurations;
  }

  // --- Connection/DAO Management ---

  public static async getDAO(
    schemaKey: string,
    options?: Partial<DbFactoryOptions>
  ): Promise<UniversalDAO<any>> {
    const existingDAO = this.connections[schemaKey];
    if (existingDAO && existingDAO.getAdapter().isConnected()) {
      return existingDAO;
    }

    const schema = this.getSchema(schemaKey);
    if (!schema) {
      throw new Error(`Database schema not found for key: ${schemaKey}`);
    }

    const factoryOptions: DbFactoryOptions = {
      config: schema,
      ...options,
    };

    const newDAO = await DatabaseFactory.createOrOpen(factoryOptions);
    this.connections[schemaKey] = newDAO;

    return newDAO;
  }

  public static getConnection(
    schemaKey: string
  ): UniversalDAO<any> | undefined {
    return this.connections[schemaKey];
  }

  public static async closeConnection(schemaKey: string): Promise<void> {
    const dao = this.connections[schemaKey];
    if (dao) {
      await dao.close();
      delete this.connections[schemaKey];
    }
  }

  public static async closeAllConnections(): Promise<void> {
    const closePromises = Object.keys(this.connections).map((key) =>
      this.closeConnection(key)
    );
    await Promise.all(closePromises);
  }

  public static getAllConnections(): Record<string, UniversalDAO<any>> {
    return { ...this.connections };
  }

  // --- Role Management ---

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

  public static async initializeUserRoleConnections(
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
          throw error; // Required databases must connect
        }
      }
    }

    return daos;
  }

  public static getCurrentUserDatabases(roleName: string): string[] {
    const { required, optional } = this.getRoleDatabases(roleName);
    const allDatabases = [...required, ...optional];

    return allDatabases.filter((dbKey) => {
      const dao = this.connections[dbKey];
      return dao && dao.getAdapter().isConnected();
    });
  }

  // --- Status & Health ---

  public static getStatus(): {
    schemas: number;
    connections: number;
    roles: number;
    activeConnections: string[];
  } {
    return {
      schemas: Object.keys(this.schemaConfigurations).length,
      connections: Object.keys(this.connections).length,
      roles: Object.keys(this.roleRegistry).length,
      activeConnections: Object.keys(this.connections).filter((key) => {
        const dao = this.connections[key];
        return dao && dao.getAdapter().isConnected();
      }),
    };
  }

  public static async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [key, dao] of Object.entries(this.connections)) {
      try {
        await dao.ensureConnected();
        health[key] = dao.getAdapter().isConnected();
      } catch (error) {
        health[key] = false;
      }
    }

    return health;
  }

  public static reset(): void {
    this.schemaConfigurations = {};
    this.roleRegistry = {};
    this.connections = {};
  }
}

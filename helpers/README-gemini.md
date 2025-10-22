```ts
// src/types.ts

/**
 * Các loại cơ sở dữ liệu được hỗ trợ (Từ README-1.0.0.md)
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'sqlserver' | 'mongodb';

/**
 * Định nghĩa cấu hình kết nối database chung
 */
export interface DbConfig {
  databaseType: DatabaseType;
  connectionString?: string;
  dbName?: string;
  options?: Record<string, any>;
  dbDirectory?: string; // Ví dụ: Dùng cho SQLite file path
}

// --- Trừu tượng hóa Core Database ---

/**
 * Interface kết nối chung (thay thế SQLiteConnection, MongoConnection)
 */
export interface IConnection {
  rawConnection: any; // Đối tượng kết nối gốc (ví dụ: sqlite3.Database | MongoClient)
  isConnected: boolean;
  close(): Promise<void>;
}

/**
 * Interface kết quả chung (thay thế SQLiteResult, MongoResult)
 */
export interface IResult {
  rows: any[];
  rowsAffected: number;
  lastInsertId?: any;
  insertedIds?: any[];
}

/**
 * Interface Adapter chung (IAdapter)
 * Đây là nơi xử lý logic database-specific, được khai báo dùng type rõ ràng.
 */
export interface IAdapter<TConnection extends IConnection> {
  databaseType: DatabaseType;
  connect(config: DbConfig): Promise<TConnection>;
  isSupported(): boolean;
  disconnectAll(): Promise<void>;
  /**
   * Phương thức thực thi tổng quát:
   * - Đối với SQL: query là string, params là any[]
   * - Đối với NoSQL: query là object command, params là undefined
   */
  execute(connection: TConnection, query: string | any, params?: any[]): Promise<IResult>;
}

/**
 * Interface DAO chung (Data Access Object)
 */
export interface IDAO {
    execute(query: string | any, params?: any[]): Promise<IResult>;
    find<T = any>(entityName: string, query: any, options?: any): Promise<T[]>;
    // ... Các phương thức CRUD khác
}

// --- Trừu tượng hóa Schema và Manager ---

/**
 * Định nghĩa trường/cột (tổng quát từ ColumnDefinition)
 */
export interface FieldDefinition {
  name: string;
  type: string;
  primary_key?: boolean;
  auto_increment?: boolean;
  unique?: boolean;
  // ... các thuộc tính khác (nullable, length, v.v.)
}

/**
 * Định nghĩa Schema cho một Table/Collection (tổng quát từ TableDefinition/MongoCollection)
 */
export interface EntitySchemaDefinition {
  name: string; // Tên Table hoặc Collection
  cols: FieldDefinition[]; 
  // ... indexes, foreign_keys
}

/**
 * Định nghĩa Schema Database (tổng quát từ DatabaseSchema/MongoDatabaseSchema)
 */
export interface DatabaseSchema {
  version: string;
  database_type: DatabaseType; // Bắt buộc phải khai báo loại DB
  database_name: string;
  schemas: Record<string, EntitySchemaDefinition>; // Key là tên Table/Collection
  // ... type_mapping, description
}

/**
 * Tùy chọn cho DatabaseFactory
 */
export interface DbFactoryOptions {
  config: DatabaseSchema;
  configAsset?: any;
  adapter?: IAdapter<any>; // Cho phép inject adapter cụ thể
  dbConfig?: DbConfig; // Cấu hình kết nối cụ thể
}

/**
 * Cấu hình Role (tổng quát từ RoleConfig/MongoRoleConfig)
 */
export interface RoleConfig {
  roleName: string;
  requiredDatabases: string[];
  optionalDatabases?: string[];
  priority?: number;
}
export type RoleRegistry = { [roleName: string]: RoleConfig; };


/**
 * Trạng thái Service (tổng quát từ ServiceStatus, đổi collectionName thành entityName)
 */
export interface ServiceStatus {
  schemaName: string;
  entityName: string;
  isOpened: boolean;
  isInitialized: boolean;
  hasDao: boolean;
  lastAccess: string | null;
}

```

```ts
// src/core/UniversalDAO.ts

import { IDAO, IAdapter, IConnection, IResult, DatabaseSchema, DatabaseType, DbConfig, ServiceStatus } from '../types';

/**
 * Universal Data Access Object (DAO)
 * Cung cấp giao diện truy cập dữ liệu không phụ thuộc vào DB bằng cách ủy quyền
 * việc thực thi cho IAdapter đã được inject.
 */
export class UniversalDAO<TConnection extends IConnection> implements IDAO {
  protected adapter: IAdapter<TConnection>;
  protected connection: TConnection | null = null;
  public readonly schema: DatabaseSchema;
  public readonly databaseType: DatabaseType;
  public readonly dbConfig: DbConfig;

  constructor(adapter: IAdapter<TConnection>, schema: DatabaseSchema, dbConfig: DbConfig) {
    this.adapter = adapter;
    this.schema = schema;
    this.databaseType = schema.database_type;
    this.dbConfig = dbConfig;
  }

  // Phương thức kết nối (đảm bảo kết nối mở)
  public async ensureConnected(): Promise<TConnection> {
    if (!this.connection || !this.connection.isConnected) {
      this.connection = await this.adapter.connect(this.dbConfig);
    }
    return this.connection;
  }

  // --- Core IDAO Implementation ---

  /**
   * Phương thức thực thi tổng quát, ủy quyền cho Adapter.
   */
  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    const connection = await this.ensureConnected();
    try {
      // Adapter sẽ chịu trách nhiệm chuyển đổi và thực thi query
      return await this.adapter.execute(connection, query, params);
    } catch (error) {
      // Xử lý lỗi chung
      throw error;
    }
  }

  /**
   * Thao tác tìm kiếm tổng quát.
   * Dữ liệu query và options được chuyển đến Adapter để dịch ra lệnh DB.
   */
  public async find<T = any>(entityName: string, query: any, options?: any): Promise<T[]> {
    // Trong thực tế, bạn sẽ cần một QueryBuilder/Translator chung ở đây.
    // Tạm thời, ta gói gọn lệnh FIND cho Adapter.
    const findCommand = { entityName, type: 'SELECT', filter: query, options };
    const result = await this.execute(findCommand);
    return result.rows as T[];
  }
  
  public async insert(entityName: string, data: Record<string, any>): Promise<IResult> {
    const insertCommand = { entityName, type: 'INSERT', data };
    return this.execute(insertCommand);
  }

  // ... các phương thức update, delete, transaction
  
  public async close(): Promise<void> {
    if (this.connection && this.connection.isConnected) {
      await this.connection.close();
      this.connection = null;
    }
  }

  public getStatus(entityName: string): Partial<ServiceStatus> {
    return {
      schemaName: this.schema.database_name,
      entityName: entityName,
      isOpened: !!this.connection && this.connection.isConnected,
      hasDao: true,
      isInitialized: true, // Logic kiểm tra schema phức tạp, tạm coi là true
    };
  }
}
```

```ts
// src/core/DatabaseFactory.ts

import { UniversalDAO } from './UniversalDAO';
import { IAdapter, IConnection, DatabaseSchema, DbFactoryOptions, DatabaseType } from '../types';

// Registry để lưu trữ các Adapter Class đã đăng ký
const AdapterRegistry = new Map<DatabaseType, { new (config: any): IAdapter<any> }>();

export class DatabaseFactory {
  
  /**
   * Đăng ký một Adapter Class cho một DatabaseType cụ thể.
   * Đây là cách bạn khai báo môi trường và CSDL.
   */
  public static registerAdapter<TConnection extends IConnection>(
      type: DatabaseType, 
      AdapterClass: { new (config: any): IAdapter<TConnection> }
  ): void {
      AdapterRegistry.set(type, AdapterClass as { new (config: any): IAdapter<any> });
  }

  /**
   * Tạo hoặc mở một UniversalDAO instance.
   */
  public static async createOrOpen(options: DbFactoryOptions, checkAdapterSupport: boolean = true): Promise<UniversalDAO<any>> {
    const { config: schema, adapter: injectedAdapter, dbConfig: injectedDbConfig } = options;
    const dbType = schema.database_type;
    
    // 1. Xác định DbConfig
    // Logic này sẽ lấy config từ injectedDbConfig hoặc từ môi trường/default
    const dbConfig = injectedDbConfig || { 
        databaseType: dbType, 
        dbName: schema.database_name,
        connectionString: '...', // Giả định lấy từ process.env hoặc config
    };

    // 2. Xác định Adapter
    let adapter: IAdapter<any>;

    if (injectedAdapter) {
        adapter = injectedAdapter; // Dùng adapter được inject
    } else {
        const AdapterClass = AdapterRegistry.get(dbType);
        if (!AdapterClass) {
            throw new Error(`Adapter for database type '${dbType}' is not registered. Please call DatabaseFactory.registerAdapter() first.`);
        }
        // Khởi tạo Adapter
        adapter = new AdapterClass(dbConfig); 
    }

    if (checkAdapterSupport && !adapter.isSupported()) {
      throw new Error(`Database type '${dbType}' is not supported in the current environment or missing dependencies.`);
    }

    // 3. Tạo DAO
    const dao = new UniversalDAO(adapter, schema, dbConfig);
    
    return dao;
  }
}
```

```ts
// src/core/DatabaseManager.ts

import { UniversalDAO } from './UniversalDAO';
import { DatabaseFactory } from './DatabaseFactory';
import { DatabaseSchema, RoleConfig, RoleRegistry, DbFactoryOptions } from '../types';

/**
 * DatabaseManager là Singleton quản lý các UniversalDAO connections, schemas và roles.
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

  private static getSchema(key: string): DatabaseSchema | undefined {
      return this.schemaConfigurations[key]; // Hoặc logic gọi external schema manager
  }
  
  // --- Connection/DAO Management ---

  /**
   * Lấy UniversalDAO đã có hoặc tạo mới thông qua DatabaseFactory.
   */
  public static async getDAO(schemaKey: string): Promise<UniversalDAO<any>> {
    const existingDAO = this.connections[schemaKey];
    if (existingDAO) {
      return existingDAO;
    }

    const schema = this.getSchema(schemaKey);
    if (!schema) {
      throw new Error(`Database schema not found for key: ${schemaKey}`);
    }
    
    // Tạo DAO qua Factory
    const factoryOptions: DbFactoryOptions = { config: schema };
    const newDAO = await DatabaseFactory.createOrOpen(factoryOptions);
    this.connections[schemaKey] = newDAO;
    
    // Auto-connect và initialization
    await newDAO.ensureConnected(); 
    
    return newDAO;
  }
  
  // --- Role Management (Theo logic trong snippet) ---
  
  public static registerRole(roleConfig: RoleConfig): void {
      this.roleRegistry[roleConfig.roleName] = roleConfig;
  }
  
  // ... getRoleDatabases, getCurrentUserDatabases, initializeUserRoleConnections ...
  // Các phương thức này vẫn giữ logic tương tự như trong snippet, chỉ thay đổi 
  // đối tượng kết nối là UniversalDAO thay vì MongoUniversalDAO/SQLiteDAO.
}
```

```ts
// src/core/BaseService.ts

import { UniversalDAO } from './UniversalDAO';
import { DatabaseManager } from './DatabaseManager';
import { IResult, ServiceStatus, FieldDefinition } from '../types';

/**
 * Abstract BaseService cung cấp các phương thức CRUD và truy cập dữ liệu chung.
 * TModel: Kiểu dữ liệu TypeScript cho Entity (ví dụ: User, Product).
 */
export abstract class BaseService<TModel = any> {
  protected dao: UniversalDAO<any> | null = null;
  protected schemaKey: string;
  protected entityName: string; // Tên Table hoặc Collection
  protected isOpened: boolean = false;
  public lastAccess: number = Date.now();
  
  constructor(schemaKey: string, entityName: string) {
    this.schemaKey = schemaKey;
    this.entityName = entityName;
  }
  
  /**
   * Khởi tạo Service bằng cách lấy UniversalDAO từ DatabaseManager.
   */
  public async initialize(): Promise<void> {
    this.lastAccess = Date.now();
    if (this.dao) return;
    
    try {
      // Lấy DAO tổng quát
      this.dao = await DatabaseManager.getDAO(this.schemaKey);
      this.isOpened = true;
    } catch (error) {
      throw error;
    }
  }

  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      throw new Error(`Service not initialized or DAO closed for ${this.schemaKey}:${this.entityName}.`);
    }
    return this.dao;
  }
  
  // --- CRUD Operations ---
  
  public async find(query: any = {}, options: any = {}): Promise<TModel[]> {
    this.lastAccess = Date.now();
    // DAO xử lý dịch query (SQL/NoSQL)
    return this.getDAO().find<TModel>(this.entityName, query, options); 
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    this.lastAccess = Date.now();
    const result = await this.getDAO().insert(this.entityName, data);
    
    // Giả định logic trả về model đã tạo
    const createdId = result.lastInsertId || result.insertedIds?.[0];
    if (createdId) {
        // Cần phương thức findById hoặc logic tương đương
    }
    return data as TModel;
  }
  
  // ... update, delete, v.v.
  
  // --- Status và Cleanup ---
  
  public getStatus(): ServiceStatus {
    const daoStatus = this.dao?.getStatus(this.entityName) || {};
    return {
      schemaName: this.schemaKey,
      entityName: this.entityName,
      isOpened: this.isOpened,
      isInitialized: true, // Tạm thời
      hasDao: !!this.dao,
      lastAccess: new Date(this.lastAccess).toISOString(),
      ...daoStatus
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    this.isOpened = false;
    // BaseService không đóng DAO, DAO do DatabaseManager quản lý
  }

  public destroy(): void {
      this.dao = null;
  }
}
```

```ts
// src/core/ServiceManager.ts

import { BaseService } from './BaseService';
import { ServiceStatus } from '../types';

export interface ServiceConfig {
    schemaName: string;
    entityName: string;
    // ServiceClass phải kế thừa BaseService
    serviceClass: new (schemaName: string, entityName: string) => BaseService<any>; 
}

/**
 * ServiceManager là Singleton quản lý các BaseService instances đã được đăng ký.
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, BaseService<any>> = new Map();
  private serviceConfigs: Map<string, ServiceConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  
  private constructor() {
      // Khởi động logic dọn dẹp định kỳ (theo snippet)
      // this.startPeriodicCleanup(); 
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  private static getServiceKey(schemaName: string, entityName: string): string {
    return `${schemaName}:${entityName}`;
  }
  
  public registerService(config: ServiceConfig): void {
      const key = ServiceManager.getServiceKey(config.schemaName, config.entityName);
      this.serviceConfigs.set(key, config);
  }

  /**
   * Lấy hoặc tạo và khởi tạo Service instance.
   */
  public async getService<T extends BaseService<any>>(schemaName: string, entityName: string): Promise<T> {
    const key = ServiceManager.getServiceKey(schemaName, entityName);
    
    // 1. Trả về service từ cache
    let service = this.services.get(key);
    if (service) {
      service.lastAccess = Date.now();
      return service as T;
    }
    
    // 2. Kiểm tra cấu hình
    const config = this.serviceConfigs.get(key);
    if (!config) {
      throw new Error(`Service is not registered for ${key}.`);
    }

    // 3. Tạo và Khởi tạo Service mới
    const ServiceClass = config.serviceClass;
    service = new ServiceClass(schemaName, entityName);
    
    await service.initialize(); // Khởi tạo để lấy DAO
    
    this.services.set(key, service);
    
    return service as T;
  }
  
  // ... destroy, cleanupUnusedServices, getAllServiceInfo (vẫn giữ logic tương tự)
}
```

```ts
// src/adapters/base-adapter.ts
import { DatabaseAdapter, DatabaseType, QueryFilter, QueryOptions, SchemaDefinition, Transaction } from '../types';
import { createModuleLogger, ORMModules } from '../logger/logger-config';

const logger = createModuleLogger(ORMModules.BASE_ADAPTER);

export abstract class BaseAdapter implements DatabaseAdapter {
  abstract type: DatabaseType;
  protected connected = false;

  abstract connect(config: any): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  abstract createTable(tableName: string, schema: SchemaDefinition): Promise<void>;
  abstract dropTable(tableName: string): Promise<void>;
  abstract tableExists(tableName: string): Promise<boolean>;

  abstract insertOne(tableName: string, data: any): Promise<any>;
  abstract insertMany(tableName: string, data: any[]): Promise<any[]>;

  abstract find(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any[]>;
  abstract findOne(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any | null>;
  abstract findById(tableName: string, id: any): Promise<any | null>;

  abstract update(tableName: string, filter: QueryFilter, data: any): Promise<number>;
  abstract updateOne(tableName: string, filter: QueryFilter, data: any): Promise<boolean>;
  abstract updateById(tableName: string, id: any, data: any): Promise<boolean>;

  abstract delete(tableName: string, filter: QueryFilter): Promise<number>;
  abstract deleteOne(tableName: string, filter: QueryFilter): Promise<boolean>;
  abstract deleteById(tableName: string, id: any): Promise<boolean>;

  abstract count(tableName: string, filter?: QueryFilter): Promise<number>;
  abstract raw(query: string | any, params?: any[]): Promise<any>;
  abstract beginTransaction(): Promise<Transaction>;

  protected sanitizeFieldName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  protected buildWhereClause(filter: QueryFilter): { whereClause: string; params: any[] } {
    // Common implementation for SQL adapters; Mongo overrides
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith('$')) continue;  // Handle logical ops separately
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Operator object
        for (const [op, opValue] of Object.entries(value)) {
          let condition = `"${key}"`;  // SQL-quoted
          switch (op) {
            case '$eq': condition += ` = $${paramIndex++}`; break;
            case '$ne': condition += ` != $${paramIndex++}`; break;
            case '$gt': condition += ` > $${paramIndex++}`; break;
            // ... Add more
            default: continue;
          }
          conditions.push(condition);
          params.push(opValue);
        }
      } else {
        conditions.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      }
    }

    return { whereClause: conditions.join(' AND '), params };
  }

  protected async executeRaw(query: string | any, params?: any[]): Promise<any> {
    logger.debug('Executing raw query', { query, params: params?.length });
    // Adapter-specific exec
    throw new Error('Must implement executeRaw in adapter');
  }
}
```

```ts
// src/logger/logger-config.ts
import {
  BaseModule,
  LoggerConfigBuilder,
  CommonModules,
  CommonLoggerConfig,
  createModuleLogger,
} from "@dqcai/logger";

const ORMModules = {
  ...CommonModules,
  DATABASE_MANAGER: "DatabaseManager",
  DATABASE_FACTORY: "DatabaseFactory",
  UNIVERSAL_DAO: "UniversalDAO",
  BASE_SERVICE: "BaseService",
  SERVICE_MANAGER: "ServiceManager",
  QUERY_BUILDER: "QueryBuilder",
  BASE_ADAPTER: "BaseAdapter",
  POSTGRESQL_ADAPTER: "PostgreSQLAdapter",
  MYSQL_ADAPTER: "MySQLAdapter",
  // ... Add for other adapters
};

const config = new LoggerConfigBuilder()
  .setEnabled(true)
  .setDefaultLevel("warn")
  .build();

CommonLoggerConfig.updateConfiguration(config);

export { BaseModule, createModuleLogger, ORMModules, CommonLoggerConfig };
```

```ts
// src/query/query-builder.ts
import { QueryFilter, QueryOptions, JoinClause as JoinType } from '../types';
import { createModuleLogger, ORMModules } from '../logger/logger-config';
import { DatabaseAdapter } from '../adapters/base-adapter';  // Import for visitor

const logger = createModuleLogger(ORMModules.QUERY_BUILDER);

export interface QueryCondition {
  field: string;
  operator: string;
  value: any;
}

export class QueryBuilder {
  private tableName = '';
  private selectFields: string[] = ['*'];
  private whereConditions: QueryCondition[] = [];
  private joinClauses: JoinType[] = [];
  private orderByFields: string[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private params: any[] = [];
  private adapter?: DatabaseAdapter;  // For adapter-specific generation

  constructor(adapter?: DatabaseAdapter) {
    this.adapter = adapter;
  }

  static table(name: string, adapter?: DatabaseAdapter): QueryBuilder {
    const builder = new QueryBuilder(adapter);
    builder.tableName = name;
    return builder;
  }

  select(fields: string | string[]): this {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  where(field: string, operator: string, value: any): this {
    this.whereConditions.push({ field, operator, value });
    this.params.push(value);
    return this;
  }

  whereIn(field: string, values: any[]): this {
    this.whereConditions.push({ field, operator: 'IN', value: values });
    this.params.push(values);
    return this;
  }

  join(table: string, condition: string, type: 'INNER' | 'LEFT' = 'INNER'): this {
    this.joinClauses.push({ type, table, on: condition });
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push(`${field} ${direction}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  // Generate query based on adapter
  toQuery(filter?: QueryFilter, options?: QueryOptions): { sql: string; params: any[] } | { pipeline: any[] } {
    if (this.adapter?.type === 'mongodb') {
      // Generate Mongo pipeline
      logger.debug('Generating MongoDB pipeline');
      const pipeline: any[] = [{ $match: filter }];
      if (options?.sort) pipeline.push({ $sort: options.sort });
      if (this.limitValue) pipeline.push({ $limit: this.limitValue });
      return { pipeline };
    } else {
      // Generate SQL
      logger.debug('Generating SQL query');
      let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;
      // Build WHERE from conditions + filter
      const whereParts = [...this.whereConditions.map(c => `"${c.field}" ${c.operator} $${this.params.length}`)];
      // ... Add joins, order, limit
      if (this.orderByFields.length) sql += ` ORDER BY ${this.orderByFields.join(', ')}`;
      if (this.limitValue) sql += ` LIMIT ${this.limitValue}`;
      if (this.offsetValue) sql += ` OFFSET ${this.offsetValue}`;
      return { sql, params: this.params };
    }
  }

  async execute(): Promise<any[]> {
    const query = this.toQuery();
    if ('pipeline' in query) {
      return await (this.adapter as any).raw(query.pipeline);  // Mongo exec
    } else {
      return await (this.adapter as any).raw(query.sql, query.params);
    }
  }
}
```

```ts
// src/index.ts
export { DatabaseType, SchemaDefinition, QueryFilter, QueryOptions } from './types';
export { ORMModules, createModuleLogger } from './logger/logger-config';
export { BaseAdapter } from './adapters/base-adapter';
export { PostgreSQLAdapter, PostgreSQLConfig } from './adapters/postgresql-adapter';
// Export other adapters...

export { QueryBuilder } from './query/query-builder';
export { UniversalDAO } from './core/universal-dao';
export { DatabaseFactory, DbFactoryOptions } from './core/database-factory';
export { DatabaseManager } from './core/database-manager';
export { BaseService } from './core/base-service';
export { serviceManager, ServiceManager } from './core/service-manager';
```

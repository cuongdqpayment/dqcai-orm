// ========================
// src/helpers/adapter-helper.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnectionFactory } from "../factories/connection-factory.interface";
import { DatabaseType, DbConfig } from "../types/orm.types";

/**
 * Factory Registry - Lưu trữ factories theo database type
 */
const FactoryRegistry = new Map<DatabaseType, IConnectionFactory>();

/**
 * Adapter Class Registry - Lưu trữ adapter classes theo database type
 */
const AdapterClassRegistry = new Map<
  DatabaseType,
  new () => BaseAdapter
>();

/**
 * Adapter Helper - REFACTORED
 * Tự động quản lý factories và adapters
 */
export class AdapterHelper {
  /**
   * Đăng ký factory cho database type
   */
  static registerFactory(
    type: DatabaseType,
    factory: IConnectionFactory
  ): void {
    FactoryRegistry.set(type, factory);
  }

  /**
   * Đăng ký adapter class cho database type
   */
  static registerAdapterClass(
    type: DatabaseType,
    AdapterClass: new () => BaseAdapter
  ): void {
    AdapterClassRegistry.set(type, AdapterClass);
  }

  /**
   * Đăng ký cả factory và adapter class cùng lúc
   */
  static register(
    type: DatabaseType,
    factory: IConnectionFactory,
    AdapterClass: new () => BaseAdapter
  ): void {
    this.registerFactory(type, factory);
    this.registerAdapterClass(type, AdapterClass);
  }

  /**
   * Lấy factory đã đăng ký
   */
  static getFactory(type: DatabaseType): IConnectionFactory | undefined {
    return FactoryRegistry.get(type);
  }

  /**
   * Lấy adapter class đã đăng ký
   */
  static getAdapterClass(type: DatabaseType): (new () => BaseAdapter) | undefined {
    return AdapterClassRegistry.get(type);
  }

  /**
   * Kiểm tra database type có được hỗ trợ không
   */
  static isSupported(type: DatabaseType): boolean {
    const factory = FactoryRegistry.get(type);
    return factory ? factory.isSupported() : false;
  }

  /**
   * Tạo adapter với auto factory lookup
   * CHỈ CẦN 2 THAM SỐ: type và config
   */
  static async createAdapter(
    type: DatabaseType,
    config: DbConfig
  ): Promise<BaseAdapter> {
    // 1. Lấy factory từ registry
    const factory = FactoryRegistry.get(type);
    if (!factory) {
      throw new Error(
        `Factory for database type '${type}' is not registered. ` +
        `Please call AdapterHelper.register() or AdapterHelper.registerFactory() first.`
      );
    }

    // 2. Kiểm tra driver có được cài đặt không
    if (!factory.isSupported()) {
      throw new Error(
        `Database driver for '${type}' is not installed. ` +
        `Please install the required package.`
      );
    }

    // 3. Lấy adapter class từ registry
    const AdapterClass = AdapterClassRegistry.get(type);
    if (!AdapterClass) {
      throw new Error(
        `Adapter class for database type '${type}' is not registered. ` +
        `Please call AdapterHelper.register() or AdapterHelper.registerAdapterClass() first.`
      );
    }

    // 4. Tạo adapter instance
    const adapter = new AdapterClass();

    // 5. Connect sử dụng factory
    await factory.connect(adapter, config);

    return adapter;
  }

  /**
   * Tạo adapter không connect (chỉ tạo instance)
   */
  static createAdapterInstance(type: DatabaseType): BaseAdapter {
    const AdapterClass = AdapterClassRegistry.get(type);
    if (!AdapterClass) {
      throw new Error(
        `Adapter class for database type '${type}' is not registered.`
      );
    }
    return new AdapterClass();
  }

  /**
   * Lấy danh sách các database types đã đăng ký
   */
  static getRegisteredTypes(): DatabaseType[] {
    return Array.from(AdapterClassRegistry.keys());
  }

  /**
   * Lấy thông tin về các database types được hỗ trợ
   */
  static getSupportedTypes(): Array<{
    type: DatabaseType;
    hasFactory: boolean;
    hasAdapter: boolean;
    isSupported: boolean;
  }> {
    const allTypes: Set<DatabaseType> = new Set([
      ...FactoryRegistry.keys(),
      ...AdapterClassRegistry.keys(),
    ]);

    return Array.from(allTypes).map((type) => ({
      type,
      hasFactory: FactoryRegistry.has(type),
      hasAdapter: AdapterClassRegistry.has(type),
      isSupported: this.isSupported(type),
    }));
  }

  /**
   * Reset tất cả registries (dùng cho testing)
   */
  static reset(): void {
    FactoryRegistry.clear();
    AdapterClassRegistry.clear();
  }

  /**
   * Khởi tạo auto-registration cho tất cả adapters có sẵn
   * Gọi hàm này một lần khi khởi động ứng dụng
   */
  static async autoRegisterAll(): Promise<void> {
    const registrations = [
      { type: 'postgresql' as DatabaseType, lazy: true },
      { type: 'mysql' as DatabaseType, lazy: true },
      { type: 'mariadb' as DatabaseType, lazy: true },
      { type: 'mongodb' as DatabaseType, lazy: true },
      { type: 'sqlite' as DatabaseType, lazy: true },
      { type: 'oracle' as DatabaseType, lazy: true },
      { type: 'sqlserver' as DatabaseType, lazy: true },
    ];

    for (const { type } of registrations) {
      try {
        await this.lazyRegister(type);
      } catch (error) {
        // Bỏ qua nếu driver không được cài đặt
        console.debug(`Skip registering ${type}: driver not installed`);
      }
    }
  }

  /**
   * Lazy register - chỉ load khi cần
   */
  private static async lazyRegister(type: DatabaseType): Promise<void> {
    // Kiểm tra đã đăng ký chưa
    if (FactoryRegistry.has(type) && AdapterClassRegistry.has(type)) {
      return;
    }

    try {
      switch (type) {
        case 'postgresql': {
          const { PostgreSQLConnectionFactory } = await import('../factories/postgresql-connection.factory');
          const { PostgreSQLAdapter } = await import('../adapters/postgresql-adapter');
          this.register(type, new PostgreSQLConnectionFactory(), PostgreSQLAdapter as any);
          break;
        }
        case 'mysql': {
          const { MySQLConnectionFactory } = await import('../factories/mysql-connection.factory');
          const { MySQLAdapter } = await import('../adapters/mysql-adapter');
          this.register(type, new MySQLConnectionFactory(), MySQLAdapter as any);
          break;
        }
        case 'mariadb': {
          const { MariaDBConnectionFactory } = await import('../factories/maria-connection.factory');
          const { MariaDBAdapter } = await import('../adapters/mariadb-adapter');
          this.register(type, new MariaDBConnectionFactory(), MariaDBAdapter as any);
          break;
        }
        case 'mongodb': {
          const { MongoDBConnectionFactory } = await import('../factories/mongodb-connection.factory');
          const { MongoDBAdapter } = await import('../adapters/mongodb-adapter');
          this.register(type, new MongoDBConnectionFactory(), MongoDBAdapter as any);
          break;
        }
        case 'sqlite': {
          const { SQLiteConnectionFactory } = await import('../factories/sqlite-connection.factory');
          const { SQLiteAdapter } = await import('../adapters/sqlite-adapter');
          this.register(type, new SQLiteConnectionFactory(), SQLiteAdapter as any);
          break;
        }
        case 'oracle': {
          const { OracleConnectionFactory } = await import('../factories/oracle-connection.factory');
          const { OracleAdapter } = await import('../adapters/oracle-adapter');
          this.register(type, new OracleConnectionFactory(), OracleAdapter as any);
          break;
        }
        case 'sqlserver': {
          const { SQLServerConnectionFactory } = await import('../factories/sqlserver-connection.factory');
          const { SQLServerAdapter } = await import('../adapters/sqlserver-adapter');
          this.register(type, new SQLServerConnectionFactory(), SQLServerAdapter as any);
          break;
        }
        default:
          throw new Error(`Unknown database type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to register ${type}: ${error}`);
    }
  }
}


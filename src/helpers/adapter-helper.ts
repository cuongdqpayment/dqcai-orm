// ========================
// src/helpers/adapter-helper.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DatabaseType, DbConfig } from "../types/orm.types";

/**
 * Adapter Class Registry - Lưu trữ adapter classes theo database type
 */
const AdapterClassRegistry = new Map<
  DatabaseType,
  new (dbConfig: DbConfig) => BaseAdapter
>();

/**
 * Adapter Helper - REFACTORED
 * Tự động quản lý factories và adapters
 */
export class AdapterHelper {
  /**
   * Đăng ký adapter class cho database type
   */
  static registerAdapterClass(
    type: DatabaseType,
    AdapterClass: new (dbConfig: DbConfig) => BaseAdapter
  ): void {
    AdapterClassRegistry.set(type, AdapterClass);
  }

  /**
   * Đăng ký cả factory và adapter class cùng lúc
   */
  static register(
    type: DatabaseType,
    AdapterClass: new (dbConfig: DbConfig) => BaseAdapter
  ): void {
    this.registerAdapterClass(type, AdapterClass);
  }

  /**
   * Lấy adapter class đã đăng ký
   */
  static getAdapterClass(
    type: DatabaseType
  ): (new (dbConfig: DbConfig) => BaseAdapter) | undefined {
    return AdapterClassRegistry.get(type);
  }

  /**
   * Tạo adapter với auto factory lookup
   * CHỈ CẦN 2 THAM SỐ: type và config
   */
  static async createAdapter(
    type: DatabaseType,
    config: DbConfig
  ): Promise<BaseAdapter> {
    // 3. Lấy adapter class từ registry
    const AdapterClass = AdapterClassRegistry.get(type);
    if (!AdapterClass) {
      throw new Error(
        `Adapter class for database type '${type}' is not registered. ` +
          `Please call AdapterHelper.register() or AdapterHelper.registerAdapterClass() first.`
      );
    }

    // 4. Tạo adapter instance
    const adapter = new AdapterClass(config);
    // không connect

    return adapter;
  }

  /**
   * Tạo adapter không connect (chỉ tạo instance)
   */
  static createAdapterInstance(
    type: DatabaseType,
    config: DbConfig
  ): BaseAdapter {
    const AdapterClass = AdapterClassRegistry.get(type);
    if (!AdapterClass) {
      throw new Error(
        `Adapter class for database type '${type}' is not registered.`
      );
    }
    return new AdapterClass(config);
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
    hasAdapter: boolean;
  }> {
    const allTypes: Set<DatabaseType> = new Set([
      ...AdapterClassRegistry.keys(),
    ]);

    return Array.from(allTypes).map((type) => ({
      type,
      hasAdapter: AdapterClassRegistry.has(type),
    }));
  }

  /**
   * Reset tất cả registries (dùng cho testing)
   */
  static reset(): void {
    AdapterClassRegistry.clear();
  }

  /**
   * Khởi tạo auto-registration cho tất cả adapters có sẵn
   * Gọi hàm này một lần khi khởi động ứng dụng
   */
  static async autoRegisterAll(): Promise<void> {
    const registrations = [
      { type: "postgresql" as DatabaseType, lazy: true },
      { type: "mysql" as DatabaseType, lazy: true },
      { type: "mariadb" as DatabaseType, lazy: true },
      { type: "mongodb" as DatabaseType, lazy: true },
      { type: "sqlite" as DatabaseType, lazy: true },
      { type: "oracle" as DatabaseType, lazy: true },
      { type: "sqlserver" as DatabaseType, lazy: true },
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
  static async lazyRegister(type: DatabaseType): Promise<void> {
    // Kiểm tra đã đăng ký chưa
    if (AdapterClassRegistry.has(type)) {
      return;
    }

    try {
      switch (type) {
        case "postgresql": {
          const { PostgreSQLAdapter } = await import(
            "@/adapters/postgresql-adapter"
          );
          this.register(type, PostgreSQLAdapter);
          break;
        }
        case "mysql": {
          const { MySQLAdapter } = await import("@/adapters/mysql-adapter");
          this.register(type, MySQLAdapter);
          break;
        }
        case "mariadb": {
          const { MariaDBAdapter } = await import("@/adapters/mariadb-adapter");
          this.register(type, MariaDBAdapter);
          break;
        }
        case "mongodb": {
          const { MongoDBAdapter } = await import("@/adapters/mongodb-adapter");
          this.register(type, MongoDBAdapter);
          break;
        }
        case "sqlite": {
          const { SQLiteAdapter } = await import("@/adapters/sqlite-adapter");
          this.register(type, SQLiteAdapter);
          break;
        }
        case "oracle": {
          const { OracleAdapter } = await import("@/adapters/oracle-adapter");
          this.register(type, OracleAdapter);
          break;
        }
        case "sqlserver": {
          const { SQLServerAdapter } = await import(
            "@/adapters/sqlserver-adapter"
          );
          this.register(type, SQLServerAdapter);
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

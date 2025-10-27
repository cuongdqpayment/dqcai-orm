// ========================
// USAGE EXAMPLES
// ========================

// 1. Đăng ký schemas và adapters
import {
  DatabaseFactory,
  DatabaseManager,
  PostgreSQLAdapter,
  MySQLAdapter,
  SQLiteAdapter,
  BaseService,
  DatabaseSchema,
  QueryFilter,
  QueryOptions,
  UniversalDAO,
  DbConfig
} from "../src";

// Đăng ký adapter classes
DatabaseFactory.registerAdapter("postgresql", PostgreSQLAdapter);
DatabaseFactory.registerAdapter("mysql", MySQLAdapter);
DatabaseFactory.registerAdapter("sqlite", SQLiteAdapter);

// Đăng ký schemas
const userSchema: DatabaseSchema = {
  version: "1.0.0",
  database_type: "postgresql",
  database_name: "user_db",
  schemas: {
    users: {
      name: "users",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "name", type: "string", length: 100, required: true },
        { name: "email", type: "string", length: 255, unique: true },
      ],
    },
  },
};

DatabaseFactory.registerSchema("user_db", userSchema);

// 2. Tạo và đăng ký adapter instance tùy chỉnh
const customAdapter = new PostgreSQLAdapter();

DatabaseFactory.registerAdapterInstance("user_db", customAdapter);

// 3. Sử dụng trong Service
class UserService extends BaseService<User> {
  constructor() {
    super("user_db", "users");
  }

  // Truy cập trực tiếp DAO
  async getUsersWithCustomQuery() {
    const dao = await this.getUniversalDAO();

    // Sử dụng các phương thức của DAO
    const users = await dao.find("users", { active: true });

    // Hoặc thực thi raw query
    const result = await dao.execute(
      "SELECT * FROM users WHERE created_at > $1",
      [new Date("2024-01-01")]
    );

    return result.rows;
  }

  // Truy cập adapter để thực hiện các thao tác đặc biệt
  async createCustomIndex() {
    const adapter = this.getAdapter();
    await adapter.createIndex("users", {
      name: "idx_email_name",
      fields: ["email", "name"],
      unique: false,
    });
  }

  // Lấy thông tin schema
  getTableStructure() {
    const schema = this.getSchema();
    return schema.schemas.users;
  }
}

// 4. Sử dụng DatabaseManager
async function setupApplication() {
  // Đăng ký role
  DatabaseManager.registerRole({
    roleName: "admin",
    requiredDatabases: ["user_db", "product_db"],
    optionalDatabases: ["analytics_db"],
  });

  // Khởi tạo connections cho role
  const daos = await DatabaseManager.initializeRoleConnections("admin");

  // Lấy DAO cụ thể
  const userDAO = await DatabaseManager.getDAO("user_db");

  // Kiểm tra trạng thái
  const status = DatabaseManager.getStatus();
  console.log("Database Status:", status);

  // Health check
  const health = await DatabaseManager.healthCheck();
  console.log("Health:", health);
}

// 5. Sử dụng Service với DAO access
async function demonstrateServiceUsage() {
  const userService = new UserService();
  await userService.initialize();

  // CRUD operations thông thường
  const user = await userService.create({
    name: "John Doe",
    email: "john@example.com",
  });

  // Truy cập DAO để thực hiện các thao tác phức tạp
  const dao = await userService.getUniversalDAO();

  // Sử dụng các phương thức của DAO
  const allUsers = await dao.find("users", {});

  // Transaction với DAO
  const adapter = dao.getAdapter();
  const transaction = await adapter.beginTransaction();

  try {
    await dao.insert("users", { name: "User 1", email: "user1@example.com" });
    await dao.insert("users", { name: "User 2", email: "user2@example.com" });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// 6. Advanced: Đăng ký nhiều databases với configs khác nhau
async function setupMultipleDatabases() {
  // PostgreSQL database
  const pgSchema: DatabaseSchema = {
    version: "1.0.0",
    database_type: "postgresql",
    database_name: "users_db",
    schemas: {
      users: {
        name: "users",
        cols: [
          {
            name: "id",
            type: "integer",
            primaryKey: true,
            autoIncrement: true,
          },
          { name: "username", type: "string", length: 50, unique: true },
          { name: "email", type: "string", length: 255 },
        ],
      },
    },
  };

  // MySQL database
  const mysqlSchema: DatabaseSchema = {
    version: "1.0.0",
    database_type: "mysql",
    database_name: "products_db",
    schemas: {
      products: {
        name: "products",
        cols: [
          {
            name: "id",
            type: "integer",
            primaryKey: true,
            autoIncrement: true,
          },
          { name: "name", type: "string", length: 200 },
          { name: "price", type: "decimal", precision: 10, scale: 2 },
        ],
      },
    },
  };

  // SQLite database
  const sqliteSchema: DatabaseSchema = {
    version: "1.0.0",
    database_type: "sqlite",
    database_name: "cache_db",
    schemas: {
      cache: {
        name: "cache",
        cols: [
          { name: "key", type: "string", primaryKey: true },
          { name: "value", type: "text" },
          { name: "expires_at", type: "timestamp" },
        ],
      },
    },
  };

  // Đăng ký tất cả schemas
  DatabaseFactory.registerSchemas({
    users_db: pgSchema,
    products_db: mysqlSchema,
    cache_db: sqliteSchema,
  });

  // Tạo và đăng ký adapters với config cụ thể
  const pgAdapter = DatabaseFactory.createAdapter("postgresql", {
    host: "localhost",
    port: 5432,
    database: "users_db",
    user: "postgres",
    password: "password",
  } as DbConfig);

  const mysqlAdapter = DatabaseFactory.createAdapter("mysql", {
    host: "localhost",
    port: 3306,
    database: "products_db",
    user: "root",
    password: "password",
  } as DbConfig);

  const sqliteAdapter = DatabaseFactory.createAdapter("sqlite", {
      filename: "./cache.db",
  } as unknown as DbConfig);

  // Đăng ký adapter instances
  DatabaseFactory.registerAdapterInstance("users_db", pgAdapter);
  DatabaseFactory.registerAdapterInstance("products_db", mysqlAdapter);
  DatabaseFactory.registerAdapterInstance("cache_db", sqliteAdapter);

  // Lấy DAOs
  const usersDAO = await DatabaseManager.getDAO("users_db");
  const productsDAO = await DatabaseManager.getDAO("products_db");
  const cacheDAO = await DatabaseManager.getDAO("cache_db");

  return { usersDAO, productsDAO, cacheDAO };
}

// 7. Service với custom DAO operations
class ProductService extends BaseService<Product> {
  constructor() {
    super("products_db", "products");
  }

  // Tìm sản phẩm theo khoảng giá
  async findByPriceRange(minPrice: number, maxPrice: number) {
    const dao = await this.getUniversalDAO();
    const query = `
      SELECT * FROM products 
      WHERE price BETWEEN ? AND ? 
      ORDER BY price ASC
    `;
    const result = await dao.execute(query, [minPrice, maxPrice]);
    return result.rows;
  }

  // Cập nhật giá hàng loạt
  async bulkUpdatePrices(percentage: number) {
    const dao = await this.getUniversalDAO();
    const adapter = dao.getAdapter();

    const transaction = await adapter.beginTransaction();
    try {
      const query = `UPDATE products SET price = price * ?`;
      await dao.execute(query, [1 + percentage / 100]);
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Lấy thống kê
  async getStatistics() {
    const dao = await this.getUniversalDAO();
    const query = `
      SELECT 
        COUNT(*) as total,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM products
    `;
    const result = await dao.execute(query);
    return result.rows[0];
  }

  // Tạo index động
  async optimizeQueries() {
    const adapter = this.getAdapter();

    // Tạo index cho price
    await adapter.createIndex("products", {
      name: "idx_products_price",
      fields: ["price"],
      unique: false,
    });

    // Tạo index cho name
    await adapter.createIndex("products", {
      name: "idx_products_name",
      fields: ["name"],
      unique: false,
    });
  }
}

// 8. Multi-database service
class ReportService extends BaseService<any> {
  private productsDAO: UniversalDAO<any> | null = null;
  private usersDAO: UniversalDAO<any> | null = null;

  constructor() {
    super("cache_db", "cache"); // Base database
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Khởi tạo thêm các DAOs khác
    this.productsDAO = await DatabaseManager.getDAO("products_db");
    this.usersDAO = await DatabaseManager.getDAO("users_db");
  }

  async generateSalesReport() {
    if (!this.productsDAO || !this.usersDAO) {
      throw new Error("DAOs not initialized");
    }

    // Lấy dữ liệu từ nhiều databases
    const products = await this.productsDAO.find("products", {});
    const users = await this.usersDAO.find("users", {});

    // Tạo báo cáo
    const report = {
      totalProducts: products.length,
      totalUsers: users.length,
      timestamp: new Date(),
    };

    // Lưu vào cache
    const cacheDAO = await this.getUniversalDAO();
    await cacheDAO.insert("cache", {
      key: "sales_report",
      value: JSON.stringify(report),
      expires_at: new Date(Date.now() + 3600000), // 1 hour
    });

    return report;
  }
}

// 9. Lazy loading và connection pooling
class LazyService<TModel = any> extends BaseService<TModel> {
  private connectionPromise: Promise<UniversalDAO<any>> | null = null;

  constructor(schemaKey: string, entityName: string) {
    super(schemaKey, entityName);
  }

  // Override để thêm lazy loading
  protected async ensureInitialized(): Promise<void> {
    if (this.dao && this.dao.getAdapter().isConnected()) {
      return;
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.initializeConnection();
    }

    await this.connectionPromise;
  }

  private async initializeConnection(): Promise<UniversalDAO<any>> {
    try {
      this.dao = await DatabaseManager.getDAO(this.schemaKey);
      this.isOpened = true;
      return this.dao;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  // Auto reconnect
  protected async reconnectIfNeeded(): Promise<void> {
    if (!this.dao || !this.dao.getAdapter().isConnected()) {
      console.log(`Reconnecting to ${this.schemaKey}...`);
      await this.ensureInitialized();
    }
  }

  // Override các methods để auto reconnect
  public async find(
    query: QueryFilter = {},
    options?: QueryOptions
  ): Promise<TModel[]> {
    await this.reconnectIfNeeded();
    return super.find(query, options);
  }
}

// 10. Testing helpers
async function setupTestEnvironment() {
  // Sử dụng in-memory SQLite cho testing
  const testSchema: DatabaseSchema = {
    version: "1.0.0",
    database_type: "sqlite",
    database_name: "test_db",
    schemas: {
      test_table: {
        name: "test_table",
        cols: [
          {
            name: "id",
            type: "integer",
            primaryKey: true,
            autoIncrement: true,
          },
          { name: "data", type: "text" },
        ],
      },
    },
  };

  DatabaseFactory.registerSchema("test_db", testSchema);

  const testAdapter = DatabaseFactory.createAdapter("sqlite", {
      memory: true,
  } as unknown as DbConfig);

  DatabaseFactory.registerAdapterInstance("test_db", testAdapter);

  return await DatabaseManager.getDAO("test_db");
}

async function cleanupTestEnvironment() {
  await DatabaseManager.closeAllDAOs();
  DatabaseFactory.reset();
}

// 11. Factory pattern cho services
class ServiceFactory {
  private static serviceCache = new Map<string, BaseService<any>>();

  static async createService<T extends BaseService<any>>(
    ServiceClass: new (schemaKey: string, entityName: string) => T,
    schemaKey: string,
    entityName: string
  ): Promise<T> {
    const key = `${schemaKey}:${entityName}`;

    let service = this.serviceCache.get(key);
    if (!service) {
      service = new ServiceClass(schemaKey, entityName);
      await service.initialize();
      this.serviceCache.set(key, service);
    }

    return service as T;
  }

  static clearCache() {
    this.serviceCache.clear();
  }
}

// Sử dụng ServiceFactory
async function useServiceFactory() {
  const userService = await ServiceFactory.createService(
    UserService,
    "users_db",
    "users"
  );

  const productService = await ServiceFactory.createService(
    ProductService,
    "products_db",
    "products"
  );

  // Services đã được cached và initialized
  await userService.create({ name: "Test User", email: "test@example.com" });
  await productService.create({ name: "Test Product", price: 99.99 });
}

// 12. Migration helper
class MigrationService {
  static async createTable(schemaKey: string, tableName: string) {
    const dao = await DatabaseManager.getDAO(schemaKey);
    const schema = dao.getSchema();
    const tableSchema = schema.schemas[tableName];

    if (!tableSchema) {
      throw new Error(`Table ${tableName} not found in schema`);
    }

    const adapter = dao.getAdapter();
    const schemaDefinition: any = {};

    for (const col of tableSchema.cols) {
      if (col.name) {
        schemaDefinition[col.name] = col;
      }
    }

    await adapter.createTable(tableName, schemaDefinition);
  }

  static async dropTable(schemaKey: string, tableName: string) {
    const dao = await DatabaseManager.getDAO(schemaKey);
    const adapter = dao.getAdapter();
    await adapter.dropTable(tableName);
  }

  static async migrateSchema(schemaKey: string) {
    const dao = await DatabaseManager.getDAO(schemaKey);
    const schema = dao.getSchema();
    const adapter = dao.getAdapter();

    for (const [tableName, tableSchema] of Object.entries(schema.schemas)) {
      const exists = await adapter.tableExists(tableName);

      if (!exists) {
        console.log(`Creating table: ${tableName}`);
        await this.createTable(schemaKey, tableName);
      } else {
        console.log(`Table exists: ${tableName}`);
      }
    }
  }
}

// 13. Complete example application
interface User {
  id?: number;
  name: string;
  email: string;
  created_at?: Date;
}

interface Product {
  id?: number;
  name: string;
  price: number;
  user_id: number;
}

async function completeExample() {
  // Setup
  DatabaseFactory.registerAdapter("sqlite", SQLiteAdapter);

  // Register schemas
  const appSchema: DatabaseSchema = {
    version: "1.0.0",
    database_type: "sqlite",
    database_name: "app_db",
    schemas: {
      users: {
        name: "users",
        cols: [
          {
            name: "id",
            type: "integer",
            primaryKey: true,
            autoIncrement: true,
          },
          { name: "name", type: "string", length: 100 },
          { name: "email", type: "string", length: 255, unique: true },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      },
      products: {
        name: "products",
        cols: [
          {
            name: "id",
            type: "integer",
            primaryKey: true,
            autoIncrement: true,
          },
          { name: "name", type: "string", length: 200 },
          { name: "price", type: "decimal", precision: 10, scale: 2 },
          {
            name: "user_id",
            type: "integer",
            references: { table: "users", field: "id" },
          },
        ],
      },
    },
  };

  DatabaseFactory.registerSchema("app_db", appSchema);

  // Initialize
  const userService = new UserService();
  const productService = new ProductService();

  await userService.initialize();
  await productService.initialize();

  // Use services
  const user = await userService.create({
    name: "John Doe",
    email: "john@example.com",
  });

  const product = await productService.create({
    name: "Laptop",
    price: 999.99,
    user_id: user.id!,
  });

  // Use DAO directly for complex queries
  const dao = await userService.getUniversalDAO();
  const results = await dao.execute(`
    SELECT u.name, p.name as product_name, p.price
    FROM users u
    INNER JOIN products p ON u.id = p.user_id
  `);

  console.log("Results:", results.rows);

  // Cleanup
  await DatabaseManager.closeAllDAOs();
}

// Export everything
export {
  DatabaseFactory,
  DatabaseManager,
  BaseService,
  ServiceFactory,
  MigrationService,
  LazyService,
};

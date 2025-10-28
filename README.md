# @dqcai/orm - Universal ORM Library

A powerful, flexible, and database-agnostic ORM library for TypeScript/JavaScript that supports multiple databases with a unified API.

[![npm version](https://img.shields.io/npm/v/@dqcai/orm.svg)](https://www.npmjs.com/package/@dqcai/orm)
[![License](https://img.shields.io/npm/l/@dqcai/orm.svg)](https://github.com/dqcai/orm/blob/main/LICENSE)

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Supported Databases](#️-supported-databases)
- [Quick Start](#-quick-start)
- [Complete Examples](#-complete-examples)
- [API Reference](#-api-reference)
- [Advanced Usage](#-advanced-usage)
- [Best Practices](#-best-practices)

---

## ✨ Features

- 🔄 **Universal API** - Same code works across different databases
- 🎯 **Type-Safe** - Full TypeScript support with generics
- 🔌 **Database Agnostic** - Support for PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, MongoDB
- 🏗️ **Schema Management** - Define schemas once, use everywhere
- 🔐 **Connection Pooling** - Automatic connection management and pooling
- 🔄 **Auto-Reconnection** - Built-in reconnection logic for dropped connections
- 📦 **Service Layer** - Business logic abstraction with BaseService
- 🎣 **Lifecycle Hooks** - beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete
- 🔍 **Advanced Queries** - Rich query operators ($gt, $lt, $in, $like, $between, etc.)
- 🔗 **Relations** - Foreign keys and joins support
- 💾 **Transactions** - ACID compliant transaction support
- ⚡ **Performance** - Optimized for speed with connection caching

---

## 📦 Installation

### Core Library

```bash
npm install @dqcai/orm
```

### Database Drivers

Install the driver for your database:

```bash
# SQLite
npm install better-sqlite3

# PostgreSQL
npm install pg

# MySQL / MariaDB
npm install mysql2

# SQL Server
npm install mssql

# MongoDB
npm install mongodb

# Oracle
npm install oracledb
```

---

## 🗄️ Supported Databases

| Database | Driver | Status | Connection Pooling |
|----------|--------|--------|-------------------|
| SQLite | better-sqlite3 | ✅ Fully Supported | N/A (file-based) |
| PostgreSQL | pg | ✅ Fully Supported | ✅ Yes |
| MySQL | mysql2 | ✅ Fully Supported | ✅ Yes |
| MariaDB | mysql2/mariadb | ✅ Fully Supported | ✅ Yes |
| SQL Server | mssql | ✅ Fully Supported | ✅ Yes |
| MongoDB | mongodb | ✅ Fully Supported | ✅ Yes |
| Oracle | oracledb | ✅ Fully Supported | ✅ Yes |

---

## 🚀 Quick Start

### 1. Define Your Schema

```typescript
import { DatabaseSchema } from "@dqcai/orm";

const myAppSchema: DatabaseSchema = {
  version: "1.0.0",
  database_type: "sqlite", // or 'postgresql', 'mysql', 'mongodb', etc.
  database_name: "myapp",
  schemas: {
    users: {
      name: "users",
      cols: [
        { 
          name: "id", 
          type: "integer", 
          primaryKey: true, 
          autoIncrement: true 
        },
        { 
          name: "name", 
          type: "string", 
          length: 100, 
          required: true 
        },
        { 
          name: "email", 
          type: "string", 
          length: 255, 
          unique: true, 
          required: true 
        },
        { 
          name: "age", 
          type: "integer", 
          nullable: true 
        },
        { 
          name: "is_active", 
          type: "boolean", 
          default: true 
        },
        { 
          name: "created_at", 
          type: "timestamp", 
          default: "CURRENT_TIMESTAMP" 
        }
      ]
    }
  }
};
```

### 2. Configure Database Connection

#### SQLite Configuration

```typescript
import { SQLiteConfig } from "@dqcai/orm";

const sqliteConfig: SQLiteConfig = {
  databaseType: "sqlite",
  database: "myapp",
  filename: "./myapp.db",
  // For in-memory database:
  // memory: true
};
```

#### PostgreSQL Configuration

```typescript
import { PostgreSQLConfig } from "@dqcai/orm";

const postgresConfig: PostgreSQLConfig = {
  databaseType: "postgresql",
  host: "localhost",
  port: 5432,
  database: "myapp",
  user: "postgres",
  password: "password",
  ssl: false,
  max: 10 // connection pool size
};
```

#### MySQL Configuration

```typescript
import { MySQLConfig } from "@dqcai/orm";

const mysqlConfig: MySQLConfig = {
  databaseType: "mysql",
  host: "localhost",
  port: 3306,
  database: "myapp",
  user: "root",
  password: "password",
  charset: "utf8mb4",
  connectionLimit: 10
};
```

#### MongoDB Configuration

```typescript
import { MongoDBConfig } from "@dqcai/orm";

const mongoConfig: MongoDBConfig = {
  databaseType: "mongodb",
  url: "mongodb://localhost:27017",
  database: "myapp",
  options: {
    maxPoolSize: 10,
    minPoolSize: 2
  }
};
```

### 3. Define Your Entity Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  created_at: Date;
}
```

### 4. Create Service Classes

```typescript
import { BaseService } from "@dqcai/orm";

class UserService extends BaseService<User> {
  constructor() {
    super("myapp", "users");
  }

  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  async getActiveUsers(): Promise<User[]> {
    return this.find({ is_active: true });
  }

  // Lifecycle hooks
  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    // Validation
    if (!data.email?.includes("@")) {
      throw new Error("Invalid email format");
    }
    return data;
  }

  protected async afterCreate(result: User): Promise<User> {
    console.log(`User created: ${result.name}`);
    return result;
  }
}
```

### 5. Initialize and Use

```typescript
import {
  DatabaseFactory,
  DatabaseManager,
  ServiceManager,
  SQLiteAdapter,
  SQLiteConnectionFactory,
  AdapterHelper
} from "@dqcai/orm";

async function initialize() {
  // 1. Register adapter
  const factory = new SQLiteConnectionFactory();
  AdapterHelper.register("sqlite", factory, SQLiteAdapter as any);
  DatabaseFactory.registerAdapter("sqlite", SQLiteAdapter as any);

  // 2. Register schema
  DatabaseManager.registerSchema("myapp", myAppSchema);

  // 3. Create and connect adapter
  const adapter = new SQLiteAdapter();
  await factory.connect(adapter, sqliteConfig);
  DatabaseManager.registerAdapterInstance("myapp", adapter);

  // 4. Create tables
  for (const [tableName, entitySchema] of Object.entries(myAppSchema.schemas)) {
    const exists = await adapter.tableExists(tableName);
    if (!exists) {
      const schemaDefinition: any = {};
      for (const col of entitySchema.cols) {
        if (col.name) {
          schemaDefinition[col.name] = col;
        }
      }
      await adapter.createTable(tableName, schemaDefinition);
    }
  }

  // 5. Register services
  ServiceManager.getInstance().registerService({
    schemaName: "myapp",
    entityName: "users",
    serviceClass: UserService,
    autoInit: true
  });
}

async function main() {
  await initialize();

  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");

  // CREATE
  const user = await userService.create({
    name: "John Doe",
    email: "john@example.com",
    age: 30
  });
  console.log("Created:", user);

  // READ
  const users = await userService.find({ is_active: true });
  console.log("Active users:", users.length);

  // UPDATE
  await userService.updateById(user.id, { age: 31 });
  console.log("Updated user");

  // DELETE
  await userService.deleteById(user.id);
  console.log("Deleted user");
}

main().catch(console.error);
```

---

## 📚 Complete Examples

See the full SQLite Blog Application example in the artifact above for:
- Complete database schema with multiple tables
- Service layer implementation
- CRUD operations
- Advanced queries
- Relationships and joins
- Tags (many-to-many)
- Comments (nested data)
- Transactions
- Batch operations
- Aggregations
- Raw SQL queries

---

## 📖 API Reference

### BaseService Methods

#### Create Operations

```typescript
// Create single record
async create(data: Partial<T>): Promise<T>

// Create multiple records
async createMany(data: Partial<T>[]): Promise<T[]>

// Create in batch with transaction
async createBatch(data: Partial<T>[]): Promise<T[]>
```

#### Read Operations

```typescript
// Find all records matching filter
async find(filter?: QueryFilter, options?: QueryOptions): Promise<T[]>

// Find single record
async findOne(filter: QueryFilter, options?: QueryOptions): Promise<T | null>

// Find by ID
async findById(id: any): Promise<T | null>

// Count records
async count(filter?: QueryFilter): Promise<number>

// Check if records exist
async exists(filter: QueryFilter): Promise<boolean>
```

#### Update Operations

```typescript
// Update multiple records
async update(filter: QueryFilter, data: Partial<T>): Promise<number>

// Update single record
async updateOne(filter: QueryFilter, data: Partial<T>): Promise<boolean>

// Update by ID
async updateById(id: any, data: Partial<T>): Promise<boolean>

// Batch update with transaction
async updateBatch(updates: Array<{filter, data}>): Promise<number>
```

#### Delete Operations

```typescript
// Delete multiple records
async delete(filter: QueryFilter): Promise<number>

// Delete single record
async deleteOne(filter: QueryFilter): Promise<boolean>

// Delete by ID
async deleteById(id: any): Promise<boolean>

// Batch delete
const deletedCount = await userService.deleteBatch([
  { status: "inactive" },
  { created_at: { $lt: oldDate } }
]);
```

### 4. Multiple Database Connections

```typescript
// Register multiple schemas
DatabaseManager.registerSchema("app_db", appSchema);
DatabaseManager.registerSchema("analytics_db", analyticsSchema);
DatabaseManager.registerSchema("logs_db", logsSchema);

// Create services for different databases
class UserService extends BaseService<User> {
  constructor() {
    super("app_db", "users"); // Main application database
  }
}

class AnalyticsService extends BaseService<Event> {
  constructor() {
    super("analytics_db", "events"); // Analytics database
  }
}

class LogService extends BaseService<Log> {
  constructor() {
    super("logs_db", "logs"); // Logs database
  }
}

// Use services independently
const userService = await ServiceManager.getInstance()
  .getService<UserService>("app_db", "users");

const analyticsService = await ServiceManager.getInstance()
  .getService<AnalyticsService>("analytics_db", "events");
```

### 5. Role-Based Database Access

```typescript
// Define roles with database access
DatabaseManager.registerRole({
  roleName: "admin",
  requiredDatabases: ["app_db", "analytics_db", "logs_db"],
  optionalDatabases: []
});

DatabaseManager.registerRole({
  roleName: "user",
  requiredDatabases: ["app_db"],
  optionalDatabases: ["analytics_db"]
});

// Initialize connections for role
const daos = await DatabaseManager.initializeRoleConnections("admin");
console.log(`Initialized ${daos.length} database connections for admin role`);

// Get active databases for role
const activeDbs = DatabaseManager.getActiveDatabases("admin");
console.log("Active databases:", activeDbs);
```

### 6. Connection Management

```typescript
// Get DAO for direct access
const dao = await DatabaseManager.getDAO("myapp");

// Close specific connection
await DatabaseManager.closeDAO("myapp");

// Close all connections
await DatabaseManager.closeAllDAOs();

// Health check all connections
const health = await DatabaseManager.healthCheck();
console.log("Database health:", health);
// { myapp: true, analytics: true, logs: false }

// Get manager status
const status = DatabaseManager.getStatus();
console.log(status);
// {
//   schemas: 3,
//   daos: 3,
//   roles: 2,
//   activeConnections: ["myapp", "analytics"],
//   adapterInstances: 3
// }
```

### 7. Schema Validation

```typescript
// Validate schema exists
if (DatabaseManager.hasSchema("myapp")) {
  console.log("Schema registered");
}

// Get schema definition
const schema = DatabaseManager.getSchema("myapp");

// Get all schemas
const allSchemas = DatabaseManager.getAllSchemas();
for (const [key, schema] of allSchemas) {
  console.log(`Schema: ${key} - ${schema.database_name}`);
}

// Validate and create missing tables
const dao = await DatabaseManager.getDAO("myapp");
await dao.syncAllTables();
```

### 8. Service Manager

```typescript
const serviceManager = ServiceManager.getInstance();

// Register service configuration
serviceManager.registerService({
  schemaName: "myapp",
  entityName: "users",
  serviceClass: UserService,
  autoInit: true,
  cacheTimeout: 30 * 60 * 1000 // 30 minutes
});

// Get service (creates if not exists)
const userService = await serviceManager.getService<UserService>("myapp", "users");

// Check if service exists
const exists = serviceManager.hasService("myapp", "users");

// Get service info
const info = serviceManager.getServiceInfo("myapp", "users");
console.log(info);

// Get all service info
const allInfo = serviceManager.getAllServiceInfo();

// Get statistics
const stats = serviceManager.getStats();
console.log(stats);
// {
//   totalServices: 5,
//   activeServices: 5,
//   configurations: 5
// }

// Cleanup unused services
const cleanedCount = await serviceManager.cleanupUnusedServices();
console.log(`Cleaned up ${cleanedCount} unused services`);

// Shutdown all services
await serviceManager.shutdown();
```

### 9. Custom Validation

```typescript
class UserService extends BaseService<User> {
  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    // Email validation
    if (!this.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }

    // Username validation
    if (!data.username?.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      throw new Error("Username must be 3-30 alphanumeric characters");
    }

    // Age validation
    if (data.age !== undefined && (data.age < 0 || data.age > 150)) {
      throw new Error("Age must be between 0 and 150");
    }

    // Check for duplicate email
    const existingUser = await this.findOne({ email: data.email });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Set default values
    data.is_active = data.is_active ?? true;
    data.created_at = new Date().toISOString() as any;

    return data;
  }

  private isValidEmail(email?: string): boolean {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### 10. Pagination Helper

```typescript
class UserService extends BaseService<User> {
  async getPaginated(
    page: number = 1, 
    pageSize: number = 10,
    filter?: QueryFilter
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * pageSize;
    
    const [data, total] = await Promise.all([
      this.find(filter || {}, {
        limit: pageSize,
        offset: offset,
        sort: { created_at: -1 }
      }),
      this.count(filter || {})
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

// Usage
const result = await userService.getPaginated(1, 20, { is_active: true });
console.log(`Page ${result.page} of ${result.totalPages}`);
console.log(`Showing ${result.data.length} of ${result.total} users`);
```

### 11. Soft Delete Pattern

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  deleted_at?: Date;
}

class UserService extends BaseService<User> {
  // Override find to exclude deleted
  async find(filter?: QueryFilter, options?: QueryOptions): Promise<User[]> {
    const newFilter = {
      ...filter,
      deleted_at: { $exists: false }
    };
    return super.find(newFilter, options);
  }

  // Soft delete
  async softDelete(id: number): Promise<boolean> {
    return this.updateById(id, {
      deleted_at: new Date().toISOString() as any
    });
  }

  // Find including deleted
  async findWithDeleted(filter?: QueryFilter): Promise<User[]> {
    return super.find(filter || {});
  }

  // Restore deleted
  async restore(id: number): Promise<boolean> {
    return this.updateById(id, {
      deleted_at: null as any
    });
  }

  // Permanent delete
  async hardDelete(id: number): Promise<boolean> {
    return super.deleteById(id);
  }
}
```

### 12. Audit Trail

```typescript
interface AuditLog {
  id: number;
  entity_name: string;
  entity_id: number;
  action: "create" | "update" | "delete";
  old_data?: string;
  new_data?: string;
  user_id?: number;
  timestamp: Date;
}

class AuditService extends BaseService<AuditLog> {
  constructor() {
    super("myapp", "audit_logs");
  }

  async logAction(
    entityName: string,
    entityId: number,
    action: "create" | "update" | "delete",
    oldData?: any,
    newData?: any,
    userId?: number
  ): Promise<void> {
    await this.create({
      entity_name: entityName,
      entity_id: entityId,
      action,
      old_data: oldData ? JSON.stringify(oldData) : undefined,
      new_data: newData ? JSON.stringify(newData) : undefined,
      user_id: userId,
      timestamp: new Date().toISOString() as any
    });
  }
}

class UserService extends BaseService<User> {
  private auditService?: AuditService;

  async setAuditService(service: AuditService) {
    this.auditService = service;
  }

  protected async afterCreate(result: User): Promise<User> {
    if (this.auditService) {
      await this.auditService.logAction(
        "users",
        result.id,
        "create",
        undefined,
        result
      );
    }
    return result;
  }

  protected async afterUpdate(count: number): Promise<void> {
    // Log update action
    if (this.auditService && count > 0) {
      // Implementation depends on your needs
    }
  }
}
```

---

## 🎯 Best Practices

### 1. Always Use Services

✅ **DO:**
```typescript
class UserService extends BaseService<User> {
  async findActiveAdults(): Promise<User[]> {
    return this.find({
      is_active: true,
      age: { $gte: 18 }
    });
  }
}
```

❌ **DON'T:**
```typescript
// Don't use DAO directly in application code
const dao = await DatabaseManager.getDAO("myapp");
const users = await dao.find("users", { is_active: true });
```

### 2. Validate in Hooks

✅ **DO:**
```typescript
protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
  if (!data.email?.includes("@")) {
    throw new Error("Invalid email");
  }
  return data;
}
```

❌ **DON'T:**
```typescript
async createUser(data: Partial<User>): Promise<User> {
  if (!data.email?.includes("@")) {
    throw new Error("Invalid email");
  }
  return this.create(data); // Validation should be in hook
}
```

### 3. Use Transactions for Related Operations

✅ **DO:**
```typescript
await userService.withTransaction(async () => {
  const user = await userService.create(userData);
  await profileService.create({ user_id: user.id, ...profileData });
  await settingsService.create({ user_id: user.id, ...settingsData });
});
```

❌ **DON'T:**
```typescript
const user = await userService.create(userData);
await profileService.create({ user_id: user.id, ...profileData });
// If this fails, user is created but profile is not
```

### 4. Handle Errors Properly

✅ **DO:**
```typescript
try {
  await userService.create(userData);
} catch (error) {
  if (error.message.includes("unique constraint")) {
    throw new Error("Email already exists");
  }
  throw error;
}
```

### 5. Use Type Safety

✅ **DO:**
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService extends BaseService<User> {
  // Type-safe methods
}

const userService = await ServiceManager.getInstance()
  .getService<UserService>("myapp", "users");
```

### 6. Implement Pagination for Large Datasets

✅ **DO:**
```typescript
async getUsers(page: number, pageSize: number): Promise<PaginatedResult<User>> {
  return this.getPaginated(page, pageSize);
}
```

### 7. Close Connections Gracefully

✅ **DO:**
```typescript
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await ServiceManager.getInstance().shutdown();
  await DatabaseManager.closeAllDAOs();
  process.exit(0);
});
```

### 8. Use Indexes for Frequently Queried Fields

```typescript
const schema: DatabaseSchema = {
  // ...
  schemas: {
    users: {
      name: "users",
      cols: [
        { name: "email", type: "string", unique: true, index: true },
        // ...
      ]
    }
  }
};
```

### 9. Keep Services Focused

✅ **DO:**
```typescript
class UserService extends BaseService<User> {
  // User-specific methods only
}

class AuthService {
  constructor(private userService: UserService) {}
  
  async login(email: string, password: string) {
    // Authentication logic using userService
  }
}
```

### 10. Use Environment Variables for Configuration

```typescript
import * as dotenv from "dotenv";
dotenv.config();

const dbConfig: SQLiteConfig = {
  databaseType: "sqlite",
  database: process.env.DB_NAME || "myapp",
  filename: process.env.DB_FILE || "./myapp.db"
};
```

---

## 🧪 Testing

### Unit Testing Services

```typescript
import { describe, it, beforeAll, afterAll } from "@jest/globals";

describe("UserService", () => {
  let userService: UserService;

  beforeAll(async () => {
    // Initialize with test database
    await initializeTestDatabase();
    userService = await ServiceManager.getInstance()
      .getService<UserService>("test_db", "users");
  });

  afterAll(async () => {
    await ServiceManager.getInstance().shutdown();
    await DatabaseManager.closeAllDAOs();
  });

  it("should create a user", async () => {
    const user = await userService.create({
      name: "Test User",
      email: "test@example.com"
    });
    
    expect(user).toBeDefined();
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe("test@example.com");
  });

  it("should find user by email", async () => {
    const user = await userService.findByEmail("test@example.com");
    expect(user).toBeDefined();
    expect(user?.name).toBe("Test User");
  });

  it("should throw error for invalid email", async () => {
    await expect(
      userService.create({
        name: "Invalid",
        email: "invalid-email"
      })
    ).rejects.toThrow("Invalid email");
  });
});
```

---

## 🔧 Troubleshooting

### Connection Issues

**Problem:** "Driver not installed" error

**Solution:**
```bash
# Make sure you've installed the correct driver
npm install better-sqlite3  # for SQLite
npm install pg              # for PostgreSQL
npm install mysql2          # for MySQL
```

**Problem:** Connection timeout

**Solution:**
```typescript
const config: PostgreSQLConfig = {
  // ...
  connectionTimeoutMillis: 30000, // Increase timeout
  max: 20 // Increase pool size
};
```

### Query Issues

**Problem:** Query returns empty results

**Solution:**
```typescript
// Check if table exists
const dao = await DatabaseManager.getDAO("myapp");
const exists = await dao.tableExists("users");
console.log("Table exists:", exists);

// Check record count
const count = await userService.count();
console.log("Total records:", count);
```

**Problem:** Type mismatch errors

**Solution:**
```typescript
// For SQLite, convert boolean to number
protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
  if (typeof data.is_active === "boolean") {
    data.is_active = data.is_active ? 1 : 0 as any;
  }
  return data;
}
```

### Performance Issues

**Problem:** Slow queries

**Solution:**
```typescript
// Add indexes
{ name: "email", type: "string", unique: true, index: true }

// Use pagination
const result = await service.find(filter, { limit: 100, offset: 0 });

// Use select to fetch only needed fields
const users = await service.find({}, { select: ["id", "name", "email"] });
```

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📞 Support

- GitHub Issues: [https://github.com/cuongdqpayment/dqcai_orm/issues](https://github.com/cuongdqpayment/dqcai_orm/issues)
- Documentation: [https://cuongdq.no-ip.info/dqcai-orm-docs-1.1.0](https://cuongdq.no-ip.info/dqcai-orm-docs-1.1.0)
- Email: support@dqcai.com

---

## 🎓 Additional Resources

- [Full API Documentation](https://cuongdq.no-ip.info/dqcai-orm-docs-api)
- [Migration Guide](https://cuongdq.no-ip.info/dqcai-orm-docs-migrations-guide)
- [Video Tutorials](https://youtube.com/@dqcai)
- [Example Projects](https://github.com/dqcai/orm-examples)

---

Made with ❤️ by DQCAI Team
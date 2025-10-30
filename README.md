# @dqcai/orm - Universal ORM Library

A powerful, flexible, and database-agnostic ORM library for TypeScript/JavaScript that supports multiple databases with a unified API.

[![npm version](https://img.shields.io/npm/v/@dqcai/orm.svg)](https://www.npmjs.com/package/@dqcai/orm)
[![License](https://img.shields.io/npm/l/@dqcai/orm.svg)](https://github.com/dqcai/orm/blob/main/LICENSE)

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Supported Databases](#️-supported-databases)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
  - [Basic CRUD Operations](#basic-crud-operations)
  - [Advanced CRUD Operations](#advanced-crud-operations)
  - [Schema Management](#schema-management)
  - [Index Management](#index-management)
  - [Transaction Support](#transaction-support)
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
- 🚀 **Advanced CRUD** - Upsert, pagination, soft delete, bulk operations, aggregations
- 📊 **Aggregations** - MongoDB-style aggregation pipeline support
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
          name: "status", 
          type: "string", 
          length: 20, 
          default: "active" 
        },
        { 
          name: "is_active", 
          type: "boolean", 
          default: true 
        },
        { 
          name: "deleted", 
          type: "boolean", 
          default: false 
        },
        { 
          name: "deleted_at", 
          type: "timestamp", 
          nullable: true 
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

### 2. Create Service Classes

```typescript
import { BaseService } from "@dqcai/orm";

interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  status: string;
  is_active: boolean;
  deleted: boolean;
  deleted_at?: Date;
  created_at: Date;
}

class UserService extends BaseService<User> {
  constructor() {
    super("myapp", "users");
  }

  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  async getActiveUsers(): Promise<User[]> {
    return this.find({ is_active: true, deleted: false });
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

### 3. Initialize and Use

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

  // 4. Sync tables
  const dao = await DatabaseManager.getDAO("myapp");
  await dao.syncAllTables();

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

  // Basic CRUD
  const user = await userService.create({
    name: "John Doe",
    email: "john@example.com",
    age: 30
  });

  // Advanced operations
  const result = await userService.paginate(
    { is_active: true },
    { page: 1, limit: 20, sort: { created_at: -1 } }
  );

  console.log(`Found ${result.total} users`);
}

main().catch(console.error);
```

---

## 📖 API Reference

### Basic CRUD Operations

#### Create Operations

```typescript
// Create single record
const user = await userService.create({
  name: "John Doe",
  email: "john@example.com",
  age: 30
});

// Create multiple records
const users = await userService.createMany([
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" }
]);

// Create in batch with transaction
const batchUsers = await userService.createBatch([
  { name: "User 1", email: "user1@example.com" },
  { name: "User 2", email: "user2@example.com" }
]);
```

#### Read Operations

```typescript
// Find all records
const users = await userService.find();

// Find with filter
const activeUsers = await userService.find({ 
  is_active: true,
  age: { $gte: 18 }
});

// Find with options
const sortedUsers = await userService.find(
  { status: "active" },
  { 
    sort: { created_at: -1 },
    limit: 10,
    offset: 0,
    select: ["id", "name", "email"]
  }
);

// Find single record
const user = await userService.findOne({ email: "john@example.com" });

// Find by ID
const user = await userService.findById(1);

// Count records
const count = await userService.count({ is_active: true });

// Check existence
const exists = await userService.exists({ email: "john@example.com" });
```

#### Update Operations

```typescript
// Update multiple records
const updatedCount = await userService.update(
  { status: "pending" },
  { status: "active" }
);

// Update single record
const updated = await userService.updateOne(
  { email: "john@example.com" },
  { age: 31 }
);

// Update by ID
const updated = await userService.updateById(1, { age: 32 });

// Batch update with transaction
const updatedCount = await userService.updateBatch([
  { filter: { status: "pending" }, data: { status: "active" } },
  { filter: { age: { $lt: 18 } }, data: { status: "minor" } }
]);
```

#### Delete Operations

```typescript
// Delete multiple records
const deletedCount = await userService.delete({ status: "inactive" });

// Delete single record
const deleted = await userService.deleteOne({ email: "john@example.com" });

// Delete by ID
const deleted = await userService.deleteById(1);

// Batch delete with transaction
const deletedCount = await userService.deleteBatch([
  { status: "inactive" },
  { created_at: { $lt: oldDate } }
]);
```

---

### Advanced CRUD Operations

#### 1. Upsert (Insert or Update)

Insert a new record if it doesn't exist, or update if it does:

```typescript
// Upsert by email
const user = await userService.upsert(
  { email: "john@example.com" },
  { 
    name: "John Doe", 
    email: "john@example.com",
    age: 30 
  }
);

// If user exists: updates the record
// If user doesn't exist: creates new record
```

#### 2. Pagination

Fetch paginated results with metadata:

```typescript
const result = await userService.paginate(
  { status: "active" },
  { 
    page: 1, 
    limit: 20,
    sort: { created_at: -1 }
  }
);

console.log(`Page ${result.page} of ${result.totalPages}`);
console.log(`Total records: ${result.total}`);
console.log(`Records on this page: ${result.data.length}`);

// Result structure:
// {
//   data: User[],
//   total: number,
//   page: number,
//   limit: number,
//   totalPages: number
// }
```

#### 3. Find or Create

Find an existing record or create it if not found:

```typescript
const { record, created } = await userService.findOrCreate(
  { email: "jane@example.com" },
  { 
    name: "Jane Doe", 
    email: "jane@example.com",
    age: 25 
  }
);

if (created) {
  console.log("New user created");
} else {
  console.log("Existing user found");
}
```

#### 4. Distinct Values

Get unique values for a specific field:

```typescript
// Get all unique statuses
const statuses = await userService.distinct<string>("status");
// Result: ["active", "inactive", "pending"]

// Get unique statuses with filter
const activeCountries = await userService.distinct<string>(
  "country",
  { status: "active" }
);
```

#### 5. Increment / Decrement

Atomically increment or decrement numeric fields:

```typescript
// Increment views count by 1
await productService.increment({ id: 1 }, "views");

// Increment by custom value
await productService.increment({ id: 1 }, "views", 5);

// Decrement stock
await productService.decrement({ id: 1 }, "stock", 10);

// Works with multiple records
const updatedCount = await productService.increment(
  { category: "electronics" },
  "popularity",
  1
);
```

#### 6. Soft Delete & Restore

Mark records as deleted without actually removing them:

```typescript
// Soft delete (sets deleted=true, deleted_at=now)
const deletedCount = await userService.softDelete({ id: 1 });

// Restore soft-deleted records
const restoredCount = await userService.restore({ id: 1 });

// Note: Regular find() operations should filter out soft-deleted records
// Override in your service:
class UserService extends BaseService<User> {
  async find(filter?: QueryFilter, options?: QueryOptions): Promise<User[]> {
    return super.find({ ...filter, deleted: false }, options);
  }
}
```

#### 7. Bulk Write Operations

Execute multiple operations in a single call (MongoDB-style):

```typescript
const result = await userService.bulkWrite([
  {
    insertOne: {
      document: { name: "Alice", email: "alice@example.com" }
    }
  },
  {
    updateOne: {
      filter: { id: 1 },
      update: { age: 30 }
    }
  },
  {
    updateMany: {
      filter: { status: "pending" },
      update: { status: "active" }
    }
  },
  {
    deleteOne: {
      filter: { id: 2 }
    }
  },
  {
    deleteMany: {
      filter: { status: "inactive" }
    }
  }
]);

console.log(`Inserted: ${result.insertedCount}`);
console.log(`Updated: ${result.modifiedCount}`);
console.log(`Deleted: ${result.deletedCount}`);
```

#### 8. Aggregations

Perform complex aggregations (MongoDB-style pipeline):

```typescript
// Group by status and count
const statusStats = await userService.aggregate([
  {
    $match: { is_active: true }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      avgAge: { $avg: "$age" }
    }
  },
  {
    $sort: { count: -1 }
  }
]);

// Advanced aggregation with multiple stages
const monthlyStats = await orderService.aggregate([
  {
    $match: {
      created_at: { $gte: new Date("2024-01-01") }
    }
  },
  {
    $group: {
      _id: { 
        year: { $year: "$created_at" },
        month: { $month: "$created_at" }
      },
      totalOrders: { $sum: 1 },
      totalRevenue: { $sum: "$amount" },
      avgOrderValue: { $avg: "$amount" }
    }
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 }
  }
]);
```

#### 9. Raw Queries

Execute raw SQL or database-specific queries:

```typescript
// Raw SQL query
const users = await userService.raw<User[]>(
  "SELECT * FROM users WHERE age > ? AND status = ?",
  [18, "active"]
);

// Raw query with complex joins
const result = await userService.raw(`
  SELECT u.*, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON u.id = o.user_id
  WHERE u.status = ?
  GROUP BY u.id
  HAVING order_count > ?
`, ["active", 5]);

// For MongoDB, use native query format
const users = await userService.raw({
  find: "users",
  filter: { 
    age: { $gt: 18 },
    status: "active"
  },
  projection: { name: 1, email: 1 }
});
```

---

### Schema Management

Create, modify, and manage database schemas:

```typescript
// Create table from schema
await userService.createTable();

// Create table with custom schema
await userService.createTable({
  id: { type: "integer", primaryKey: true, autoIncrement: true },
  name: { type: "string", length: 100, required: true },
  email: { type: "string", length: 255, unique: true }
});

// Check if table exists
const exists = await userService.tableExists();

// Get table structure information
const tableInfo = await userService.getTableInfo();
console.log(tableInfo);

// Alter table structure (add/modify columns)
await userService.alterTable({
  phone: { type: "string", length: 20, nullable: true },
  address: { type: "text", nullable: true }
});

// Truncate table (delete all data but keep structure)
await userService.truncateTable();

// Drop table completely
await userService.dropTable();
```

---

### Index Management

Create and manage database indexes for better query performance:

```typescript
// Create single-field index
await userService.createIndex({
  name: "idx_email",
  fields: ["email"],
  unique: true
});

// Create composite index
await userService.createIndex({
  name: "idx_status_created",
  fields: ["status", "created_at"],
  unique: false
});

// Create partial index (with condition)
await userService.createIndex({
  name: "idx_active_users",
  fields: ["status"],
  where: "is_active = true"
});

// Drop index
await userService.dropIndex("idx_email");
```

---

### Transaction Support

Execute multiple operations atomically with transactions:

```typescript
// Method 1: Using withTransaction (recommended)
await userService.withTransaction(async (service) => {
  const user = await service.create({
    name: "John Doe",
    email: "john@example.com"
  });
  
  await profileService.create({
    user_id: user.id,
    bio: "Software developer"
  });
  
  await settingsService.create({
    user_id: user.id,
    theme: "dark"
  });
  
  // If any operation fails, all changes are rolled back
  // If all succeed, changes are committed automatically
});

// Method 2: Manual transaction control
const tx = await userService.beginTransaction();

try {
  const user = await userService.create({
    name: "Jane Doe",
    email: "jane@example.com"
  });
  
  await profileService.create({
    user_id: user.id,
    bio: "Designer"
  });
  
  await tx.commit();
  console.log("Transaction committed");
} catch (error) {
  await tx.rollback();
  console.error("Transaction rolled back:", error);
  throw error;
}

// Batch operations with transactions
const users = await userService.createBatch([
  { name: "User 1", email: "user1@example.com" },
  { name: "User 2", email: "user2@example.com" }
]);

const updatedCount = await userService.updateBatch([
  { filter: { id: 1 }, data: { status: "active" } },
  { filter: { id: 2 }, data: { status: "inactive" } }
]);

const deletedCount = await userService.deleteBatch([
  { status: "spam" },
  { created_at: { $lt: oldDate } }
]);
```

---

## 🔥 Advanced Usage Examples

### 1. Complex Filtering

```typescript
// Combining multiple operators
const users = await userService.find({
  age: { $gte: 18, $lte: 65 },
  status: { $in: ["active", "pending"] },
  email: { $like: "%@gmail.com" },
  created_at: { $between: [startDate, endDate] },
  $or: [
    { role: "admin" },
    { role: "moderator" }
  ]
});

// Nested conditions
const posts = await postService.find({
  $and: [
    { status: "published" },
    {
      $or: [
        { author_id: currentUserId },
        { is_public: true }
      ]
    }
  ]
});
```

### 2. Custom Service Methods

```typescript
class UserService extends BaseService<User> {
  // Find users with pagination and search
  async searchUsers(
    searchTerm: string,
    page: number = 1,
    pageSize: number = 20
  ) {
    return this.paginate(
      {
        $or: [
          { name: { $like: `%${searchTerm}%` } },
          { email: { $like: `%${searchTerm}%` } }
        ],
        deleted: false
      },
      { page, limit: pageSize, sort: { created_at: -1 } }
    );
  }

  // Get user statistics
  async getUserStats() {
    const [total, active, inactive] = await Promise.all([
      this.count(),
      this.count({ is_active: true }),
      this.count({ is_active: false })
    ]);

    return { total, active, inactive };
  }

  // Get users by age range
  async getUsersByAgeRange(minAge: number, maxAge: number) {
    return this.find({
      age: { $gte: minAge, $lte: maxAge },
      deleted: false
    });
  }

  // Deactivate old inactive users
  async deactivateInactiveUsers(daysSinceLastLogin: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastLogin);

    return this.update(
      {
        last_login_at: { $lt: cutoffDate },
        is_active: true
      },
      { is_active: false }
    );
  }
}
```

### 3. Relationships and Joins

```typescript
class OrderService extends BaseService<Order> {
  // Get orders with user information
  async getOrdersWithUsers(filter?: QueryFilter) {
    const orders = await this.find(filter);
    
    // Manually join with users
    const userIds = [...new Set(orders.map(o => o.user_id))];
    const users = await userService.find({ 
      id: { $in: userIds } 
    });
    
    const userMap = new Map(users.map(u => [u.id, u]));
    
    return orders.map(order => ({
      ...order,
      user: userMap.get(order.user_id)
    }));
  }

  // Get order summary with aggregation
  async getOrderSummary(userId: number) {
    return this.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);
  }
}
```

### 4. Audit Trail Implementation

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

  async logChange(
    entityName: string,
    entityId: number,
    action: "create" | "update" | "delete",
    oldData?: any,
    newData?: any,
    userId?: number
  ) {
    await this.create({
      entity_name: entityName,
      entity_id: entityId,
      action,
      old_data: oldData ? JSON.stringify(oldData) : undefined,
      new_data: newData ? JSON.stringify(newData) : undefined,
      user_id: userId,
      timestamp: new Date()
    });
  }
}

class UserService extends BaseService<User> {
  private auditService: AuditService;

  setAuditService(service: AuditService) {
    this.auditService = service;
  }

  protected async afterCreate(result: User): Promise<User> {
    await this.auditService?.logChange(
      "users",
      result.id,
      "create",
      undefined,
      result
    );
    return result;
  }

  protected async beforeUpdate(
    filter: QueryFilter,
    data: Partial<User>
  ): Promise<Partial<User>> {
    // Log old data before update
    const oldRecords = await this.find(filter);
    for (const old of oldRecords) {
      await this.auditService?.logChange(
        "users",
        old.id,
        "update",
        old,
        { ...old, ...data }
      );
    }
    return data;
  }
}
```

### 5. Caching Layer

```typescript
class CachedUserService extends BaseService<User> {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheDuration
    });
  }

  async findById(id: number): Promise<User | null> {
    const cacheKey = this.getCacheKey("findById", { id });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const result = await super.findById(id);
    if (result) {
      this.setCache(cacheKey, result);
    }
    return result;
  }

  protected async afterCreate(result: User): Promise<User> {
    // Invalidate relevant caches
    this.cache.clear();
    return result;
  }

  protected async afterUpdate(count: number): Promise<void> {
    // Invalidate caches on update
    this.cache.clear();
  }
}
```

### 6. Rate Limiting

```typescript
class RateLimitedUserService extends BaseService<User> {
  private requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests = 100;
  private windowMs = 60 * 1000; // 1 minute

  private checkRateLimit(userId: string): void {
    const now = Date.now();
    const userLimit = this.requestCounts.get(userId);

    if (!userLimit || userLimit.resetAt < now) {
      this.requestCounts.set(userId, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return;
    }

    if (userLimit.count >= this.maxRequests) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    userLimit.count++;
  }

  async find(filter?: QueryFilter, options?: QueryOptions): Promise<User[]> {
    // Assume userId is in context
    const userId = "current-user-id"; // Get from context
    this.checkRateLimit(userId);
    return super.find(filter, options);
  }
}
```

### 7. Multiple Database Connections

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

### 8. Role-Based Database Access

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

### 9. Connection Management

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

### 10. Schema Validation

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

### 11. Service Manager

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

### 12. Custom Validation

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

### 13. Pagination Helper

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

### 14. Soft Delete Pattern

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

### 15. Audit Trail

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
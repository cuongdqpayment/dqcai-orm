# @dqcai/orm

A powerful, multi-database TypeScript ORM library supporting PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, and MongoDB with a unified API and lazy-loading service management.

## ✨ Features

- 🎯 **Multi-Database Support** - Single API for 7+ database types
- 🔒 **Type-Safe** - Full TypeScript support with generics
- 📦 **Minimal Dependencies** - Only install drivers you need
- 🎨 **Schema-Based** - JSON schema definitions for all databases
- 🔄 **Adapter Pattern** - Pluggable database adapters
- 🚀 **Lazy Loading** - Services initialized on-demand
- 💾 **Transaction Support** - ACID transactions for SQL databases
- 📊 **Query Builder** - Fluent query building interface
- 🔐 **Role-Based Access** - Multi-database role management
- ⚡ **High Performance** - Optimized for production use

---

## 📚 Mục lục

1. [Cài đặt](#1-cài-đặt)
2. [Định nghĩa Schema](#2-định-nghĩa-schema)
3. [Cấu hình Connection](#3-cấu-hình-connection)
4. [Khởi tạo Adapter](#4-khởi-tạo-adapter)
5. [Đăng ký với Manager](#5-đăng-ký-với-manager)
6. [Định nghĩa Service](#6-định-nghĩa-service)
7. [Khởi tạo Database](#7-khởi-tạo-database)
8. [Sử dụng Service](#8-sử-dụng-service)
9. [Advanced Features](#9-advanced-features)
10. [Best Practices](#10-best-practices)

---

## 1. Cài đặt

### Bước 1.1: Cài đặt core library

```bash
npm install @dqcai/orm
```

### Bước 1.2: Cài đặt database driver (chỉ cài driver bạn cần)

```bash
# PostgreSQL
npm install pg

# MySQL
npm install mysql2

# MariaDB
npm install mariadb
# hoặc
npm install mysql2

# MongoDB
npm install mongodb

# SQLite
npm install better-sqlite3

# Oracle
npm install oracledb

# SQL Server
npm install mssql
```

### Bước 1.3: Kiểm tra driver đã cài

```typescript
import { AdapterHelper } from "@dqcai/orm/helpers";

// Kiểm tra các driver đã cài đặt
const supported = AdapterHelper.getSupportedDatabases();
console.log("Available databases:", supported);
// Output: ["postgresql", "mongodb", "sqlite"]

// Kiểm tra từng driver cụ thể
if (AdapterHelper.isDriverInstalled("postgresql")) {
  console.log("PostgreSQL driver is installed");
} else {
  console.error("Please run: npm install pg");
}
```

---

## 2. Định nghĩa Schema

### 2.1. Cấu trúc Database Schema

```typescript
import type { DatabaseSchema } from "@dqcai/orm";

const myAppSchema: DatabaseSchema = {
  version: "1.0.0",
  database_type: "postgresql", // postgresql | mysql | mongodb | sqlite | oracle | sqlserver
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
    },
    
    posts: {
      name: "posts",
      cols: [
        {
          name: "id",
          type: "integer",
          primaryKey: true,
          autoIncrement: true
        },
        {
          name: "title",
          type: "string",
          length: 200,
          required: true
        },
        {
          name: "content",
          type: "text",
          nullable: true
        },
        {
          name: "user_id",
          type: "integer",
          required: true,
          references: {
            table: "users",
            field: "id",
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
          }
        },
        {
          name: "metadata",
          type: "json",
          nullable: true
        },
        {
          name: "published_at",
          type: "timestamp",
          nullable: true
        }
      ]
    }
  }
};
```

### 2.2. Field Types hỗ trợ

| Type | Description | PostgreSQL | MySQL | MongoDB | SQLite | Oracle | SQL Server |
|------|-------------|-----------|-------|---------|--------|--------|-----------|
| `string` | Chuỗi ký tự | VARCHAR | VARCHAR | string | TEXT | VARCHAR2 | NVARCHAR |
| `text` | Text dài | TEXT | TEXT | string | TEXT | CLOB | NVARCHAR(MAX) |
| `integer` | Số nguyên | INTEGER | INT | number | INTEGER | NUMBER | INT |
| `bigint` | Số nguyên lớn | BIGINT | BIGINT | number | INTEGER | NUMBER | BIGINT |
| `float` | Số thực | REAL | FLOAT | number | REAL | FLOAT | FLOAT |
| `double` | Số thực độ chính xác cao | DOUBLE PRECISION | DOUBLE | number | REAL | DOUBLE PRECISION | FLOAT |
| `decimal` | Số thập phân | DECIMAL | DECIMAL | number | REAL | NUMBER | DECIMAL |
| `boolean` | Boolean | BOOLEAN | TINYINT(1) | boolean | INTEGER | NUMBER(1) | BIT |
| `date` | Ngày | DATE | DATE | date | TEXT | DATE | DATE |
| `datetime` | Ngày giờ | TIMESTAMP | DATETIME | date | TEXT | TIMESTAMP | DATETIME2 |
| `timestamp` | Timestamp | TIMESTAMP | TIMESTAMP | date | TEXT | TIMESTAMP | DATETIME2 |
| `json` | JSON object | JSONB | JSON | object | TEXT | CLOB | NVARCHAR(MAX) |
| `array` | Mảng | ARRAY | JSON | array | TEXT | - | - |
| `uuid` | UUID | UUID | CHAR(36) | string | TEXT | RAW(16) | UNIQUEIDENTIFIER |

### 2.3. Field Constraints

```typescript
{
  name: "email",
  type: "string",
  
  // Constraints
  required: true,        // NOT NULL
  unique: true,          // UNIQUE constraint
  primaryKey: true,      // PRIMARY KEY
  autoIncrement: true,   // AUTO INCREMENT (chỉ cho integer)
  
  // String constraints
  length: 255,           // VARCHAR(255)
  
  // Number constraints
  precision: 10,         // Độ chính xác (cho decimal)
  scale: 2,              // Số chữ số thập phân
  
  // Default value
  default: "active",     // Giá trị mặc định
  
  // Nullable
  nullable: true,        // Cho phép NULL
  
  // Foreign key
  references: {
    table: "users",
    field: "id",
    onDelete: "CASCADE",  // CASCADE | SET NULL | RESTRICT | NO ACTION
    onUpdate: "CASCADE"
  }
}
```

---

## 3. Cấu hình Connection

### 3.1. PostgreSQL Connection Config

```typescript
const postgresConfig = {
  host: "localhost",
  port: 5432,
  database: "myapp",
  username: "postgres",
  password: "password",
  
  // Optional
  ssl: false,
  poolSize: 10,
  connectionTimeoutMillis: 30000
};
```

### 3.2. MySQL / MariaDB Connection Config

```typescript
const mysqlConfig = {
  host: "localhost",
  port: 3306,
  database: "myapp",
  user: "root",
  password: "password",
  
  // Optional
  charset: "utf8mb4",
  timezone: "+00:00",
  connectionLimit: 10
};
```

### 3.3. MongoDB Connection Config

```typescript
const mongoConfig = {
  // Cách 1: URL đầy đủ
  connectionString: "mongodb://user:pass@localhost:27017/myapp?authSource=admin",
  
  // Cách 2: Tách riêng
  url: "mongodb://localhost:27017",
  database: "myapp",
  
  // Optional
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000
  }
};
```

### 3.4. SQLite Connection Config

```typescript
// File-based
const sqliteConfig = {
  filename: "./database.db",
  database: "myapp"
};

// In-memory
const sqliteMemoryConfig = {
  memory: true,
  database: "myapp"
};
```

### 3.5. Oracle Connection Config

```typescript
const oracleConfig = {
  // Cách 1: Connection string
  user: "system",
  password: "oracle",
  connectString: "localhost:1521/XE",
  
  // Cách 2: Tách riêng
  host: "localhost",
  port: 1521,
  serviceName: "XE",
  
  // Optional
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1
};
```

### 3.6. SQL Server Connection Config

```typescript
const sqlServerConfig = {
  server: "localhost",
  port: 1433,
  database: "myapp",
  user: "sa",
  password: "YourPassword123",
  
  // Optional
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};
```

---

## 4. Khởi tạo Adapter

### 4.1. Cách 1: Sử dụng Factory trực tiếp (Recommended)

```typescript
import { PostgreSQLAdapter } from "@dqcai/orm";
import { PostgreSQLConnectionFactory } from "@dqcai/orm/factories";

async function createPostgreSQLAdapter() {
  // Tạo adapter
  const adapter = new PostgreSQLAdapter();
  
  // Tạo factory
  const factory = new PostgreSQLConnectionFactory();
  
  // Kiểm tra driver
  if (!factory.isSupported()) {
    throw new Error("PostgreSQL driver not installed. Run: npm install pg");
  }
  
  // Kết nối
  await factory.connect(adapter, {
    host: "localhost",
    port: 5432,
    database: "myapp",
    username: "postgres",
    password: "password"
  });
  
  return adapter;
}
```

### 4.2. Cách 2: Sử dụng AdapterHelper (Đơn giản hơn)

```typescript
import { AdapterHelper } from "@dqcai/orm/helpers";

async function createAdapter() {
  // Tự động tạo adapter và kết nối
  const adapter = await AdapterHelper.createAdapterAuto("postgresql", {
    host: "localhost",
    port: 5432,
    database: "myapp",
    username: "postgres",
    password: "password"
  });
  
  return adapter;
}
```

### 4.3. Ví dụ cho các database khác

```typescript
import { 
  MySQLAdapter, 
  MongoDBAdapter, 
  SQLiteAdapter,
  OracleAdapter,
  SQLServerAdapter 
} from "@dqcai/orm";
import { 
  MySQLConnectionFactory,
  MongoDBConnectionFactory,
  SQLiteConnectionFactory,
  OracleConnectionFactory,
  SQLServerConnectionFactory
} from "@dqcai/orm/factories";

// MySQL
async function createMySQLAdapter() {
  const adapter = new MySQLAdapter();
  const factory = new MySQLConnectionFactory();
  
  await factory.connect(adapter, {
    host: "localhost",
    port: 3306,
    database: "myapp",
    user: "root",
    password: "password"
  });
  
  return adapter;
}

// MongoDB
async function createMongoDBAdapter() {
  const adapter = new MongoDBAdapter();
  const factory = new MongoDBConnectionFactory();
  
  await factory.connect(adapter, {
    url: "mongodb://localhost:27017",
    database: "myapp"
  });
  
  return adapter;
}

// SQLite
async function createSQLiteAdapter() {
  const adapter = new SQLiteAdapter();
  const factory = new SQLiteConnectionFactory();
  
  await factory.connect(adapter, {
    filename: "./database.db",
    database: "myapp"
  });
  
  return adapter;
}

// Oracle
async function createOracleAdapter() {
  const adapter = new OracleAdapter();
  const factory = new OracleConnectionFactory();
  
  await factory.connect(adapter, {
    user: "system",
    password: "oracle",
    connectString: "localhost:1521/XE"
  });
  
  return adapter;
}

// SQL Server
async function createSQLServerAdapter() {
  const adapter = new SQLServerAdapter();
  const factory = new SQLServerConnectionFactory();
  
  await factory.connect(adapter, {
    server: "localhost",
    port: 1433,
    database: "myapp",
    user: "sa",
    password: "YourPassword123"
  });
  
  return adapter;
}
```

---

## 5. Đăng ký với Manager

### 5.1. Đăng ký Adapter vào DatabaseFactory

```typescript
import { DatabaseFactory, PostgreSQLAdapter, MySQLAdapter, MongoDBAdapter } from "@dqcai/orm";

// Đăng ký các adapter types
DatabaseFactory.registerAdapter("postgresql", PostgreSQLAdapter);
DatabaseFactory.registerAdapter("mysql", MySQLAdapter);
DatabaseFactory.registerAdapter("mongodb", MongoDBAdapter);
```

### 5.2. Đăng ký Schema vào DatabaseManager

```typescript
import { DatabaseManager } from "@dqcai/orm";

// Đăng ký schema (từ bước 2)
DatabaseManager.registerSchema("myapp", myAppSchema);

// Đăng ký nhiều schemas
DatabaseManager.registerSchema("users_db", usersSchema);
DatabaseManager.registerSchema("products_db", productsSchema);
DatabaseManager.registerSchema("logs_db", logsSchema);
```

### 5.3. Đăng ký Role-Based Access (Optional)

```typescript
// Đăng ký role admin
DatabaseManager.registerRole({
  roleName: "admin",
  requiredDatabases: ["myapp", "users_db"],
  optionalDatabases: ["logs_db"],
  permissions: ["read", "write", "delete"]
});

// Đăng ký role user
DatabaseManager.registerRole({
  roleName: "user",
  requiredDatabases: ["myapp"],
  optionalDatabases: [],
  permissions: ["read", "write"]
});

// Khởi tạo connections cho role
await DatabaseManager.initializeUserRoleConnections("admin", true);
```

---

## 6. Định nghĩa Service

### 6.1. Base Service Structure

```typescript
import { BaseService } from "@dqcai/orm";

// Interface cho entity
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  created_at: Date;
}

// Định nghĩa UserService
class UserService extends BaseService<User> {
  constructor() {
    super("myapp", "users"); // (schemaName, entityName)
  }
  
  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
  
  async getActiveUsers(): Promise<User[]> {
    return this.find({ is_active: true });
  }
  
  async getUsersByAgeRange(minAge: number, maxAge: number): Promise<User[]> {
    return this.find({
      age: { $gte: minAge, $lte: maxAge }
    });
  }
  
  async deactivateUser(userId: number): Promise<boolean> {
    return this.updateById(userId, { is_active: false });
  }
  
  // Lifecycle hooks
  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    // Validate email
    if (data.email && !this.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }
    
    // Add timestamp
    return {
      ...data,
      created_at: new Date()
    };
  }
  
  protected async afterCreate(result: User): Promise<User> {
    console.log(`User created: ${result.id}`);
    // Có thể gửi email welcome, log, etc.
    return result;
  }
  
  protected async beforeUpdate(id: any, data: Partial<User>): Promise<Partial<User>> {
    // Validate trước khi update
    if (data.email && !this.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }
    return data;
  }
  
  protected async afterUpdate(id: any, success: boolean): Promise<boolean> {
    if (success) {
      console.log(`User ${id} updated`);
    }
    return success;
  }
  
  // Helper methods
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### 6.2. Service với quan hệ (Posts Service)

```typescript
interface Post {
  id: number;
  title: string;
  content?: string;
  user_id: number;
  metadata?: any;
  published_at?: Date;
}

class PostService extends BaseService<Post> {
  constructor() {
    super("myapp", "posts");
  }
  
  // Lấy bài viết kèm thông tin user
  async getPostsWithUser(limit: number = 10): Promise<any[]> {
    const dao = await this.getDAO();
    
    // SQL databases: sử dụng raw query với JOIN
    if (this.isSQLDatabase()) {
      const result = await dao.getAdapter().raw(`
        SELECT 
          posts.*,
          users.name as author_name,
          users.email as author_email
        FROM posts
        LEFT JOIN users ON posts.user_id = users.id
        ORDER BY posts.published_at DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    }
    
    // MongoDB: sử dụng aggregate
    const posts = await dao.find("posts", {}, {
      sort: { published_at: -1 },
      limit
    });
    
    // Populate user data manually
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const users = await dao.find("users", { id: { $in: userIds } });
    
    return posts.map(post => ({
      ...post,
      author: users.find(u => u.id === post.user_id)
    }));
  }
  
  async getPostsByUser(userId: number): Promise<Post[]> {
    return this.find({ user_id: userId });
  }
  
  async publishPost(postId: number): Promise<boolean> {
    return this.updateById(postId, {
      published_at: new Date()
    });
  }
  
  async getPublishedPosts(): Promise<Post[]> {
    return this.find({
      published_at: { $exists: true }
    }, {
      sort: { published_at: -1 }
    });
  }
  
  private isSQLDatabase(): boolean {
    const dbType = this.getSchemaName().split("_")[0];
    return ["postgresql", "mysql", "sqlite", "oracle", "sqlserver"].includes(dbType);
  }
}
```

### 6.3. Đăng ký Service vào ServiceManager

```typescript
import { ServiceManager } from "@dqcai/orm";

// Đăng ký UserService
ServiceManager.getInstance().registerService({
  schemaName: "myapp",
  entityName: "users",
  serviceClass: UserService,
  autoInit: true,               // Tự động khởi tạo khi get
  cacheTimeout: 30 * 60 * 1000  // Cache 30 phút
});

// Đăng ký PostService
ServiceManager.getInstance().registerService({
  schemaName: "myapp",
  entityName: "posts",
  serviceClass: PostService,
  autoInit: true,
  cacheTimeout: 30 * 60 * 1000
});
```

---

## 7. Khởi tạo Database

### 7.1. Setup Database Script

```typescript
// src/database/setup.ts
import { DatabaseManager, DatabaseFactory } from "@dqcai/orm";
import { PostgreSQLAdapter } from "@dqcai/orm";
import { myAppSchema } from "./schemas";

export async function setupDatabase() {
  try {
    // 1. Đăng ký adapter
    DatabaseFactory.registerAdapter("postgresql", PostgreSQLAdapter);
    
    // 2. Đăng ký schema
    DatabaseManager.registerSchema("myapp", myAppSchema);
    
    // 3. Lấy DAO để tạo tables
    const dao = await DatabaseManager.getDAO("myapp");
    
    // 4. Tạo tables từ schema
    for (const [tableName, tableSchema] of Object.entries(myAppSchema.schemas)) {
      const exists = await dao.getAdapter().tableExists(tableName);
      
      if (!exists) {
        console.log(`Creating table: ${tableName}`);
        
        // Convert schema cols to column definitions
        const columns: any = {};
        for (const col of tableSchema.cols) {
          columns[col.name] = {
            type: col.type,
            primaryKey: col.primaryKey,
            autoIncrement: col.autoIncrement,
            required: col.required,
            unique: col.unique,
            length: col.length,
            default: col.default,
            nullable: col.nullable,
            references: col.references
          };
        }
        
        await dao.getAdapter().createTable(tableName, columns);
        console.log(`✓ Table ${tableName} created`);
      } else {
        console.log(`Table ${tableName} already exists`);
      }
    }
    
    console.log("Database setup completed");
    return dao;
    
  } catch (error) {
    console.error("Database setup failed:", error);
    throw error;
  }
}
```

### 7.2. Migration System

```typescript
// src/database/migrations/001_create_users_table.ts
import type { BaseAdapter } from "@dqcai/orm";

export async function up(adapter: BaseAdapter) {
  await adapter.createTable("users", {
    id: { type: "integer", primaryKey: true, autoIncrement: true },
    name: { type: "string", length: 100, required: true },
    email: { type: "string", length: 255, unique: true, required: true },
    age: { type: "integer", nullable: true },
    is_active: { type: "boolean", default: true },
    created_at: { type: "timestamp", default: "CURRENT_TIMESTAMP" }
  });
}

export async function down(adapter: BaseAdapter) {
  await adapter.dropTable("users");
}
```

```typescript
// src/database/migrations/runner.ts
import { DatabaseManager } from "@dqcai/orm";
import * as migration001 from "./001_create_users_table";
import * as migration002 from "./002_create_posts_table";

const migrations = [
  { name: "001_create_users_table", ...migration001 },
  { name: "002_create_posts_table", ...migration002 }
];

export async function runMigrations(schemaName: string) {
  const dao = await DatabaseManager.getDAO(schemaName);
  const adapter = dao.getAdapter();
  
  // Tạo bảng migrations nếu chưa có
  const migrationsTableExists = await adapter.tableExists("migrations");
  if (!migrationsTableExists) {
    await adapter.createTable("migrations", {
      id: { type: "integer", primaryKey: true, autoIncrement: true },
      name: { type: "string", length: 255, unique: true },
      executed_at: { type: "timestamp", default: "CURRENT_TIMESTAMP" }
    });
  }
  
  // Lấy danh sách migrations đã chạy
  const executed = await adapter.find("migrations", {});
  const executedNames = new Set(executed.map((m: any) => m.name));
  
  // Chạy migrations chưa thực hiện
  for (const migration of migrations) {
    if (!executedNames.has(migration.name)) {
      console.log(`Running migration: ${migration.name}`);
      
      try {
        await migration.up(adapter);
        await adapter.insertOne("migrations", { name: migration.name });
        console.log(`✓ ${migration.name} completed`);
      } catch (error) {
        console.error(`✗ ${migration.name} failed:`, error);
        throw error;
      }
    }
  }
  
  console.log("All migrations completed");
}
```

### 7.3. Seed Data

```typescript
// src/database/seeders/users.seeder.ts
import { DatabaseManager } from "@dqcai/orm";

export async function seedUsers() {
  const dao = await DatabaseManager.getDAO("myapp");
  
  const users = [
    { name: "John Doe", email: "john@example.com", age: 30, is_active: true },
    { name: "Jane Smith", email: "jane@example.com", age: 25, is_active: true },
    { name: "Bob Wilson", email: "bob@example.com", age: 35, is_active: false }
  ];
  
  for (const user of users) {
    const exists = await dao.exists("users", { email: user.email });
    if (!exists) {
      await dao.insert("users", user);
      console.log(`✓ Created user: ${user.email}`);
    }
  }
}
```

---

## 8. Sử dụng Service

### 8.1. Lazy Loading Services

```typescript
import { ServiceManager } from "@dqcai/orm";

async function exampleUsage() {
  // Lấy service (tự động khởi tạo nếu chưa có)
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const postService = await ServiceManager.getInstance()
    .getService<PostService>("myapp", "posts");
  
  // Sử dụng services
  const user = await userService.create({
    name: "Alice Johnson",
    email: "alice@example.com",
    age: 28
  });
  
  const post = await postService.create({
    title: "My First Post",
    content: "Hello World!",
    user_id: user.id
  });
  
  console.log("User created:", user);
  console.log("Post created:", post);
}
```

### 8.2. CRUD Operations với Service

```typescript
async function crudExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // CREATE
  const newUser = await userService.create({
    name: "Charlie Brown",
    email: "charlie@example.com",
    age: 32
  });
  
  // READ - Find all
  const allUsers = await userService.findAll();
  console.log("All users:", allUsers);
  
  // READ - Find với filter
  const activeUsers = await userService.find({ is_active: true });
  console.log("Active users:", activeUsers);
  
  // READ - Find one
  const user = await userService.findByEmail("charlie@example.com");
  console.log("Found user:", user);
  
  // READ - Find by ID
  const userById = await userService.findById(newUser.id);
  
  // READ - Custom method
  const youngUsers = await userService.getUsersByAgeRange(20, 30);
  
  // UPDATE
  await userService.update({ email: "charlie@example.com" }, {
    age: 33,
    is_active: true
  });
  
  // UPDATE - By ID
  await userService.updateById(newUser.id, { age: 34 });
  
  // DELETE
  await userService.delete({ is_active: false });
  
  // DELETE - By ID
  await userService.deleteById(newUser.id);
  
  // COUNT
  const totalUsers = await userService.count();
  const activeCount = await userService.count({ is_active: true });
  
  // EXISTS
  const exists = await userService.exists({ email: "charlie@example.com" });
}
```

### 8.3. Query Options

```typescript
async function queryOptionsExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // Select specific fields
  const users = await userService.find(
    { is_active: true },
    {
      select: ["id", "name", "email"], // Chỉ lấy các field này
      sort: { created_at: -1 },        // Sắp xếp giảm dần
      limit: 10,                        // Giới hạn 10 bản ghi
      offset: 0                         // Bỏ qua 0 bản ghi
    }
  );
  
  // Pagination
  const page1 = await userService.find(
    {},
    { limit: 20, offset: 0 }
  );
  
  const page2 = await userService.find(
    {},
    { limit: 20, offset: 20 }
  );
}
```

### 8.4. Query Operators

```typescript
async function queryOperatorsExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // Comparison operators
  const usersOver25 = await userService.find({ age: { $gt: 25 } });
  const usersUnder40 = await userService.find({ age: { $lt: 40 } });
  const users25to35 = await userService.find({
    age: { $gte: 25, $lte: 35 }
  });
  
  // In array
  const specificUsers = await userService.find({
    id: { $in: [1, 2, 3, 4, 5] }
  });
  
  // Not in array
  const otherUsers = await userService.find({
    id: { $nin: [1, 2, 3] }
  });
  
  // Like (SQL) / Regex (MongoDB)
  const johnUsers = await userService.find({
    name: { $like: "%John%" }
  });
  
  // Exists (NOT NULL)
  const usersWithAge = await userService.find({
    age: { $exists: true }
  });
  
  // Null check
  const usersWithoutAge = await userService.find({
    age: { $exists: false }
  });
  
  // Between
  const ageBetween = await userService.find({
    age: { $between: [20, 30] }
  });
  
  // Logical operators
  const complexQuery = await userService.find({
    $and: [
      { is_active: true },
      { age: { $gte: 25 } }
    ]
  });
  
  const orQuery = await userService.find({
    $or: [
      { age: { $lt: 20 } },
      { age: { $gt: 60 } }
    ]
  });
}
```

### 8.5. Transactions

```typescript
async function transactionExample() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  const postService = await ServiceManager.getInstance()
    .getService<PostService>("myapp", "posts");
  
  // Lấy adapter để bắt đầu transaction
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  const transaction = await adapter.beginTransaction();
  
  try {
    // Tạo user
    const user = await userService.create({
      name: "Transaction User",
      email: "transaction@example.com",
      age: 30
    });
    
    // Tạo post cho user
    const post = await postService.create({
      title: "Transaction Post",
      content: "This is created in a transaction",
      user_id: user.id
    });
    
    // Commit nếu thành công
    await transaction.commit();
    console.log("Transaction committed successfully");
    
    return { user, post };
  } catch (error) {
    // Rollback nếu có lỗi
    await transaction.rollback();
    console.error("Transaction rolled back:", error);
    throw error;
  }
}
```

### 8.6. Bulk Operations

```typescript
async function bulkOperationsExample() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // Create nhiều users cùng lúc
  const users = await userService.createMany([
    { name: "User 1", email: "user1@example.com", age: 25 },
    { name: "User 2", email: "user2@example.com", age: 30 },
    { name: "User 3", email: "user3@example.com", age: 35 }
  ]);
  
  console.log(`Created ${users.length} users`);
  
  // Update nhiều users
  const updatedCount = await userService.update(
    { age: { $lt: 30 } },
    { is_active: false }
  );
  
  console.log(`Updated ${updatedCount} users`);
  
  // Delete nhiều users
  const deletedCount = await userService.delete({
    is_active: false
  });
  
  console.log(`Deleted ${deletedCount} users`);
}
```

### 8.7. Raw Queries

```typescript
async function rawQueryExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  // PostgreSQL
  const pgResult = await adapter.raw(
    "SELECT * FROM users WHERE age > $1 AND is_active = $2",
    [25, true]
  );
  console.log("PostgreSQL result:", pgResult.rows);
  
  // MySQL
  const mysqlResult = await adapter.raw(
    "SELECT * FROM users WHERE age > ? AND is_active = ?",
    [25, true]
  );
  console.log("MySQL result:", mysqlResult);
  
  // MongoDB (sử dụng command)
  const mongoResult = await adapter.raw({
    find: "users",
    filter: { age: { $gt: 25 }, is_active: true }
  });
  console.log("MongoDB result:", mongoResult);
}
```

### 8.8. Service Statistics

```typescript
async function serviceStatsExample() {
  const serviceManager = ServiceManager.getInstance();
  
  // Lấy thống kê tổng quan
  const stats = serviceManager.getStats();
  console.log("Service Manager Stats:", stats);
  // {
  //   totalServices: 10,
  //   activeServices: 5,
  //   configurations: 15
  // }
  
  // Kiểm tra service đã được đăng ký
  const isRegistered = serviceManager.hasService("myapp", "users");
  console.log("User service registered:", isRegistered);
  
  // Cleanup unused services
  const cleanedCount = await serviceManager.cleanupUnusedServices();
  console.log(`Cleaned ${cleanedCount} unused services`);
  
  // Destroy specific service
  await serviceManager.destroyService("myapp", "users");
  console.log("User service destroyed");
}
```

---

## 9. Advanced Features

### 9.1. Query Builder

```typescript
import { QueryBuilder } from "@dqcai/orm";

async function queryBuilderExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  // Complex query
  const users = await QueryBuilder
    .table<User>("users", adapter)
    .select("id", "name", "email")
    .where("is_active", "=", true)
    .where("age", ">", 18)
    .whereIn("name", ["John", "Jane", "Bob"])
    .orderBy("created_at", "DESC")
    .limit(10)
    .execute();
  
  // Pagination
  const page = await QueryBuilder
    .table<User>("users", adapter)
    .where("is_active", "=", true)
    .paginate(1, 20)
    .execute();
  
  // Joins (SQL only)
  const usersWithPosts = await QueryBuilder
    .table("users", adapter)
    .select("users.name", "posts.title")
    .leftJoin("posts", "users.id = posts.user_id")
    .where("users.is_active", "=", true)
    .execute();
  
  // Group by
  const ageGroups = await QueryBuilder
    .table("users", adapter)
    .select("age")
    .groupBy("age")
    .having({ count: { $gt: 1 } })
    .execute();
  
  // Distinct
  const distinctAges = await QueryBuilder
    .table("users", adapter)
    .select("age")
    .distinct()
    .execute();
}
```

### 9.2. Aggregate (MongoDB)

```typescript
async function mongodbAggregateExample() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  // Chỉ MongoDB hỗ trợ aggregate
  if (adapter instanceof MongoDBAdapter) {
    const results = await adapter.aggregate("users", [
      { $match: { is_active: true } },
      { $group: { 
          _id: "$age", 
          count: { $sum: 1 },
          avgAge: { $avg: "$age" },
          names: { $push: "$name" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    console.log("Aggregate results:", results);
  }
}
```

### 9.3. Upsert

```typescript
async function upsertExample() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // Tìm hoặc tạo mới
  const user = await userService.upsert(
    { email: "upsert@example.com" },  // Điều kiện tìm
    {
      name: "Upsert User",
      email: "upsert@example.com",
      age: 28,
      is_active: true
    }
  );
  
  // Nếu tìm thấy => update, không tìm thấy => insert
  console.log("Upserted user:", user);
}
```

### 9.4. Distinct & Pluck

```typescript
async function distinctPluckExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  
  // Lấy danh sách email duy nhất
  const emails = await dao.distinct("users", "email");
  console.log("Unique emails:", emails);
  // ["john@example.com", "jane@example.com", ...]
  
  // Với điều kiện
  const activeEmails = await dao.distinct(
    "users",
    "email",
    { is_active: true }
  );
  
  // Pluck - lấy mảng giá trị của một field
  const allUsers = await dao.find("users", {});
  const names = allUsers.map(u => u.name);
  console.log("User names:", names);
}
```

### 9.5. Table Management

```typescript
async function tableManagementExamples() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  // Kiểm tra bảng tồn tại
  const exists = await adapter.tableExists("users");
  console.log("Table exists:", exists);
  
  // Lấy thông tin bảng
  const info = await adapter.getTableInfo("users");
  console.log("Table info:", info);
  // { name: "users", cols: [...] }
  
  // Truncate bảng (xóa dữ liệu, giữ cấu trúc)
  await adapter.truncateTable("users");
  console.log("Table truncated");
  
  // Xóa bảng
  // await adapter.dropTable("users");
  // console.log("Table dropped");
}
```

### 9.6. Multi-Database Operations

```typescript
async function multiDatabaseExample() {
  // PostgreSQL cho dữ liệu chính
  const pgUserService = await ServiceManager.getInstance()
    .getService<UserService>("postgres_app", "users");
  
  // MongoDB cho logs
  const mongoLogService = await ServiceManager.getInstance()
    .getService("mongo_logs", "logs");
  
  // SQLite cho cache
  const sqliteCacheService = await ServiceManager.getInstance()
    .getService("sqlite_cache", "cache");
  
  try {
    // Tạo user trong PostgreSQL
    const user = await pgUserService.create({
      name: "Multi DB User",
      email: "multidb@example.com",
      age: 30
    });
    
    // Log vào MongoDB
    await mongoLogService.create({
      action: "user_created",
      user_id: user.id,
      timestamp: new Date(),
      metadata: { source: "api" }
    });
    
    // Cache vào SQLite
    await sqliteCacheService.create({
      key: `user_${user.id}`,
      value: JSON.stringify(user),
      expires_at: new Date(Date.now() + 3600000) // 1 hour
    });
    
    console.log("Multi-database operation completed");
  } catch (error) {
    console.error("Multi-database operation failed:", error);
  }
}
```

### 9.7. Health Check & Monitoring

```typescript
async function healthCheckExample() {
  // Kiểm tra health của tất cả databases
  const health = await DatabaseManager.healthCheck();
  console.log("Database Health:", health);
  // {
  //   myapp: true,
  //   logs_db: true,
  //   cache_db: false
  // }
  
  // Kiểm tra từng database
  for (const [dbName, isHealthy] of Object.entries(health)) {
    if (!isHealthy) {
      console.error(`Database ${dbName} is not healthy`);
      // Có thể gửi alert, retry connection, etc.
    }
  }
  
  // Lấy thông tin connections
  const databases = DatabaseManager.getCurrentUserDatabases("admin");
  console.log("Connected databases:", databases);
}
```

---

## 10. Best Practices

### 10.1. Project Structure

```
src/
├── config/
│   ├── database.config.ts       # Database configurations
│   └── environments.ts          # Environment variables
├── database/
│   ├── schemas/
│   │   ├── users.schema.ts
│   │   ├── posts.schema.ts
│   │   └── index.ts
│   ├── migrations/
│   │   ├── 001_create_users.ts
│   │   ├── 002_create_posts.ts
│   │   └── runner.ts
│   ├── seeders/
│   │   ├── users.seeder.ts
│   │   └── posts.seeder.ts
│   └── setup.ts                 # Database initialization
├── services/
│   ├── user.service.ts
│   ├── post.service.ts
│   └── index.ts
├── models/
│   ├── user.model.ts            # TypeScript interfaces
│   └── post.model.ts
├── repositories/                 # Optional: Repository pattern
│   ├── user.repository.ts
│   └── post.repository.ts
├── controllers/
│   ├── user.controller.ts
│   └── post.controller.ts
└── app.ts                        # Application entry point
```

### 10.2. Configuration Management

```typescript
// src/config/database.config.ts
import type { DatabaseConfig } from "@dqcai/orm";

interface DatabaseConfigs {
  [key: string]: DatabaseConfig;
}

export const databaseConfigs: DatabaseConfigs = {
  postgresql: {
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432"),
    database: process.env.PG_DATABASE || "myapp",
    username: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "password",
    ssl: process.env.PG_SSL === "true",
    poolSize: parseInt(process.env.PG_POOL_SIZE || "10")
  },
  
  mongodb: {
    url: process.env.MONGO_URL || "mongodb://localhost:27017",
    database: process.env.MONGO_DATABASE || "myapp",
    options: {
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE || "10")
    }
  },
  
  sqlite: {
    filename: process.env.SQLITE_FILE || "./database.db",
    database: process.env.SQLITE_DATABASE || "myapp"
  }
};

export function getDatabaseConfig(type: string): DatabaseConfig {
  const config = databaseConfigs[type];
  if (!config) {
    throw new Error(`Database configuration for ${type} not found`);
  }
  return config;
}
```

### 10.3. Centralized Database Manager

```typescript
// src/database/manager.ts
import { DatabaseManager, DatabaseFactory, ServiceManager } from "@dqcai/orm";
import { PostgreSQLAdapter, MySQLAdapter, MongoDBAdapter } from "@dqcai/orm";
import { getDatabaseConfig } from "../config/database.config";
import { UserService, PostService } from "../services";
import * as schemas from "./schemas";

export class AppDatabaseManager {
  private static instance: AppDatabaseManager;
  private initialized = false;
  
  private constructor() {}
  
  static getInstance(): AppDatabaseManager {
    if (!AppDatabaseManager.instance) {
      AppDatabaseManager.instance = new AppDatabaseManager();
    }
    return AppDatabaseManager.instance;
  }
  
  async initialize() {
    if (this.initialized) {
      console.log("Database already initialized");
      return;
    }
    
    try {
      // 1. Register adapters
      DatabaseFactory.registerAdapter("postgresql", PostgreSQLAdapter);
      DatabaseFactory.registerAdapter("mysql", MySQLAdapter);
      DatabaseFactory.registerAdapter("mongodb", MongoDBAdapter);
      
      // 2. Register schemas
      DatabaseManager.registerSchema("myapp", schemas.myAppSchema);
      
      // 3. Register services
      this.registerServices();
      
      // 4. Setup databases
      await this.setupDatabases();
      
      this.initialized = true;
      console.log("✓ Database initialized successfully");
    } catch (error) {
      console.error("Database initialization failed:", error);
      throw error;
    }
  }
  
  private registerServices() {
    const serviceManager = ServiceManager.getInstance();
    
    serviceManager.registerService({
      schemaName: "myapp",
      entityName: "users",
      serviceClass: UserService,
      autoInit: true,
      cacheTimeout: 30 * 60 * 1000
    });
    
    serviceManager.registerService({
      schemaName: "myapp",
      entityName: "posts",
      serviceClass: PostService,
      autoInit: true,
      cacheTimeout: 30 * 60 * 1000
    });
  }
  
  private async setupDatabases() {
    const dao = await DatabaseManager.getDAO("myapp");
    const adapter = dao.getAdapter();
    
    // Create tables if not exists
    for (const [tableName, tableSchema] of Object.entries(schemas.myAppSchema.schemas)) {
      const exists = await adapter.tableExists(tableName);
      
      if (!exists) {
        console.log(`Creating table: ${tableName}`);
        const columns = this.schemaToColumns(tableSchema.cols);
        await adapter.createTable(tableName, columns);
        console.log(`✓ Table ${tableName} created`);
      }
    }
  }
  
  private schemaToColumns(cols: any[]): any {
    const columns: any = {};
    for (const col of cols) {
      columns[col.name] = {
        type: col.type,
        primaryKey: col.primaryKey,
        autoIncrement: col.autoIncrement,
        required: col.required,
        unique: col.unique,
        length: col.length,
        default: col.default,
        nullable: col.nullable,
        references: col.references
      };
    }
    return columns;
  }
  
  async healthCheck() {
    return await DatabaseManager.healthCheck();
  }
  
  async closeAllConnections() {
    await DatabaseManager.closeAllConnections();
    this.initialized = false;
    console.log("✓ All database connections closed");
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
}
```

### 10.4. Error Handling

```typescript
// src/utils/error-handler.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public detail?: any
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export function handleDatabaseError(error: any): DatabaseError {
  // PostgreSQL errors
  if (error.code === "23505") {
    return new DatabaseError("Duplicate entry", "DUPLICATE_ENTRY", error);
  }
  if (error.code === "23503") {
    return new DatabaseError("Foreign key constraint", "FK_CONSTRAINT", error);
  }
  
  // MySQL errors
  if (error.code === "ER_DUP_ENTRY") {
    return new DatabaseError("Duplicate entry", "DUPLICATE_ENTRY", error);
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return new DatabaseError("Foreign key constraint", "FK_CONSTRAINT", error);
  }
  
  // MongoDB errors
  if (error.code === 11000) {
    return new DatabaseError("Duplicate key", "DUPLICATE_KEY", error);
  }
  
  return new DatabaseError(error.message || "Unknown database error", "UNKNOWN", error);
}

// Usage in service
async function safeCreate(data: any) {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    return await userService.create(data);
  } catch (error) {
    const dbError = handleDatabaseError(error);
    
    if (dbError.code === "DUPLICATE_ENTRY") {
      throw new Error("Email already exists");
    }
    
    throw dbError;
  }
}
```

### 10.5. Testing

```typescript
// tests/services/user.service.test.ts
import { AppDatabaseManager } from "../../src/database/manager";
import { ServiceManager } from "@dqcai/orm";
import type { UserService } from "../../src/services";

describe("UserService", () => {
  let userService: UserService;
  
  beforeAll(async () => {
    // Initialize database
    await AppDatabaseManager.getInstance().initialize();
    
    // Get service
    userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
  });
  
  afterAll(async () => {
    // Cleanup
    await AppDatabaseManager.getInstance().closeAllConnections();
  });
  
  beforeEach(async () => {
    // Clear data before each test
    const dao = await userService.getDAO();
    await dao.getAdapter().truncateTable("users");
  });
  
  it("should create a user", async () => {
    const user = await userService.create({
      name: "Test User",
      email: "test@example.com",
      age: 25
    });
    
    expect(user).toHaveProperty("id");
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
  });
  
  it("should find user by email", async () => {
    await userService.create({
      name: "Test User",
      email: "test@example.com",
      age: 25
    });
    
    const user = await userService.findByEmail("test@example.com");
    
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Test User");
  });
  
  it("should update user", async () => {
    const created = await userService.create({
      name: "Test User",
      email: "test@example.com",
      age: 25
    });
    
    const updated = await userService.updateById(created.id, { age: 26 });
    
    expect(updated).toBe(true);
    
    const user = await userService.findById(created.id);
    expect(user?.age).toBe(26);
  });
});
```

### 10.6. Graceful Shutdown

```typescript
// src/app.ts
import { AppDatabaseManager } from "./database/manager";

async function startApp() {
  // Initialize database
  await AppDatabaseManager.getInstance().initialize();
  
  // Start your application (Express, Fastify, etc.)
  // ...
  
  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      
      try {
        // Close database connections
        await AppDatabaseManager.getInstance().closeAllConnections();
        
        console.log("✓ Shutdown complete");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  });
}

startApp().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
```

---

## Complete Example: Express.js Application

```typescript
// src/app.ts
import express from "express";
import { AppDatabaseManager } from "./database/manager";
import { ServiceManager } from "@dqcai/orm";
import type { UserService, PostService } from "./services";

const app = express();
app.use(express.json());

// Initialize database
let dbManager: AppDatabaseManager;

async function initializeApp() {
  dbManager = AppDatabaseManager.getInstance();
  await dbManager.initialize();
}

// Health check endpoint
app.get("/health", async (req, res) => {
  const health = await dbManager.healthCheck();
  const allHealthy = Object.values(health).every(v => v === true);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "unhealthy",
    databases: health
  });
});

// User routes
app.get("/users", async (req, res) => {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    const users = await userService.find({});
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    const user = await userService.findById(parseInt(req.params.id));
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    const user = await userService.create(req.body);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    const success = await userService.updateById(
      parseInt(req.params.id),
      req.body
    );
    
    if (!success) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ message: "User updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const userService = await ServiceManager.getInstance()
      .getService<UserService>("myapp", "users");
    
    const success = await userService.deleteById(parseInt(req.params.id));
    
    if (!success) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Post routes
app.get("/posts", async (req, res) => {
  try {
    const postService = await ServiceManager.getInstance()
      .getService<PostService>("myapp", "posts");
    
    const posts = await postService.find({});
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/users/:userId/posts", async (req, res) => {
  try {
    const postService = await ServiceManager.getInstance()
      .getService<PostService>("myapp", "posts");
    
    const posts = await postService.getPostsByUser(parseInt(req.params.userId));
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

initializeApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await dbManager.closeAllConnections();
  process.exit(0);
});
```

---

## Troubleshooting

### Driver không được cài đặt

```typescript
import { AdapterHelper } from "@dqcai/orm/helpers";

if (!AdapterHelper.isDriverInstalled("postgresql")) {
  console.error("PostgreSQL driver not installed");
  console.log("Please run: npm install pg");
  process.exit(1);
}
```

### Connection timeout

```typescript
// Tăng connection timeout
const config = {
  host: "localhost",
  port: 5432,
  database: "myapp",
  username: "postgres",
  password: "password",
  connectionTimeoutMillis: 60000 // 60 seconds
};
```

### Memory leaks

```typescript
// Đảm bảo đóng connections
process.on("exit", async () => {
  await DatabaseManager.closeAllConnections();
});

// Cleanup unused services định kỳ
setInterval(async () => {
  const cleaned = await ServiceManager.getInstance().cleanupUnusedServices();
  console.log(`Cleaned ${cleaned} unused services`);
}, 3600000); // Every hour
```

---

## API Reference

### BaseService Methods

```typescript
class BaseService<T> {
  // Initialization
  async initialize(): Promise<void>
  async getDAO(): Promise<DAO>
  
  // CRUD
  async create(data: Partial<T>): Promise<T>
  async createMany(data: Partial<T>[]): Promise<T[]>
  async find(filter: QueryFilter<T>, options?: QueryOptions): Promise<T[]>
  async findOne(filter: QueryFilter<T>, options?: QueryOptions): Promise<T | null>
  async findById(id: any): Promise<T | null>
  async update(filter: QueryFilter<T>, data: Partial<T>): Promise<number>
  async updateOne(filter: QueryFilter<T>, data: Partial<T>): Promise<boolean>
  async updateById(id: any, data: Partial<T>): Promise<boolean>
  async upsert(filter: QueryFilter<T>, data: Partial<T>): Promise<T>
  async delete(filter: QueryFilter<T>): Promise<number>
  async deleteOne(filter: QueryFilter<T>): Promise<boolean>
  async deleteById(id: any): Promise<boolean>
  
  // Query
  async count(filter?: QueryFilter<T>): Promise<number>
  async exists(filter: QueryFilter<T>): Promise<boolean>
  async distinct(field: keyof T, filter?: QueryFilter<T>): Promise<any[]>
  
  // Lifecycle hooks (override in subclass)
  protected async beforeCreate(data: Partial<T>): Promise<Partial<T>>
  protected async afterCreate(result: T): Promise<T>
  protected async beforeUpdate(id: any, data: Partial<T>): Promise<Partial<T>>
  protected async afterUpdate(id: any, success: boolean): Promise<boolean>
  protected async beforeDelete(id: any): Promise<void>
  protected async afterDelete(id: any, success: boolean): Promise<boolean>
  
  // Utility
  getSchemaName(): string
  getEntityName(): string
  async destroy(): Promise<void>
}
```

### DatabaseManager Methods

```typescript
class DatabaseManager {
  // Schema management
  static registerSchema(name: string, schema: DatabaseSchema): void
  static getSchema(name: string): DatabaseSchema | undefined
  static hasSchema(name: string): boolean
  
  // DAO management
  static async getDAO(schemaName: string): Promise<DAO>
  static async closeConnection(schemaName: string): Promise<void>
  static async closeAllConnections(): Promise<void>
  
  // Role management
  static registerRole(config: RoleConfig): void
  static async initializeUserRoleConnections(roleName: string, forceReconnect?: boolean): Promise<void>
  static getCurrentUserDatabases(roleName: string): string[]
  
  // Health check
  static async healthCheck(): Promise<Record<string, boolean>>
}
```

### ServiceManager Methods

```typescript
class ServiceManager {
  static getInstance(): ServiceManager
  
  // Service registration
  registerService(config: ServiceConfig): void
  hasService(schemaName: string, entityName: string): boolean
  
  // Service retrieval
  async getService<T extends BaseService<any>>(
    schemaName: string,
    entityName: string
  ): Promise<T>
  
  // Service management
  async destroyService(schemaName: string, entityName: string): Promise<void>
  async cleanupUnusedServices(maxIdleTime?: number): Promise<number>
  
  // Statistics
  getStats(): ServiceStats
}
```

### AdapterHelper Methods

```typescript
class AdapterHelper {
  // Driver detection
  static isDriverInstalled(dbType: string): boolean
  static getSupportedDatabases(): string[]
  
  // Adapter creation
  static async createAdapterAuto(
    dbType: string,
    config: any
  ): Promise<BaseAdapter>
  
  // Factory methods
  static createPostgreSQLAdapter(): PostgreSQLAdapter
  static createMySQLAdapter(): MySQLAdapter
  static createMongoDBAdapter(): MongoDBAdapter
  static createSQLiteAdapter(): SQLiteAdapter
  static createOracleAdapter(): OracleAdapter
  static createSQLServerAdapter(): SQLServerAdapter
}
```

### BaseAdapter Methods

```typescript
interface BaseAdapter {
  // Connection
  connect(config: any): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  
  // Table operations
  createTable(name: string, schema: SchemaDefinition): Promise<void>
  dropTable(name: string): Promise<void>
  truncateTable(name: string): Promise<void>
  tableExists(name: string): Promise<boolean>
  getTableInfo(name: string): Promise<TableInfo>
  
  // CRUD operations
  insertOne(table: string, data: any): Promise<any>
  insertMany(table: string, data: any[]): Promise<any[]>
  find(table: string, filter: QueryFilter, options?: QueryOptions): Promise<any[]>
  findOne(table: string, filter: QueryFilter, options?: QueryOptions): Promise<any | null>
  findById(table: string, id: any): Promise<any | null>
  update(table: string, filter: QueryFilter, data: any): Promise<number>
  updateOne(table: string, filter: QueryFilter, data: any): Promise<boolean>
  updateById(table: string, id: any, data: any): Promise<boolean>
  delete(table: string, filter: QueryFilter): Promise<number>
  deleteOne(table: string, filter: QueryFilter): Promise<boolean>
  deleteById(table: string, id: any): Promise<boolean>
  upsert(table: string, filter: QueryFilter, data: any): Promise<any>
  
  // Query operations
  count(table: string, filter?: QueryFilter): Promise<number>
  exists(table: string, filter: QueryFilter): Promise<boolean>
  distinct(table: string, field: string, filter?: QueryFilter): Promise<any[]>
  
  // Advanced operations
  beginTransaction(): Promise<Transaction>
  raw(query: string | any, params?: any[]): Promise<any>
  aggregate(table: string, pipeline: any[]): Promise<any[]> // MongoDB only
}
```

---

## Performance Optimization

### 10.7. Indexing

```typescript
// Create indexes for better query performance
async function createIndexes() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  const dao = await userService.getDAO();
  const adapter = dao.getAdapter();
  
  // PostgreSQL
  await adapter.raw(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
  `);
  
  // MongoDB
  if (adapter instanceof MongoDBAdapter) {
    const db = adapter.getConnection();
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ is_active: 1 });
    await db.collection("users").createIndex({ created_at: -1 });
  }
  
  console.log("✓ Indexes created");
}
```

### 10.8. Connection Pooling

```typescript
// Configure optimal pool size
const config = {
  host: "localhost",
  port: 5432,
  database: "myapp",
  username: "postgres",
  password: "password",
  
  // Connection pool settings
  poolSize: 20,                    // Maximum connections
  connectionTimeoutMillis: 30000,  // Connection timeout
  idleTimeoutMillis: 30000,        // Idle connection timeout
  
  // For MongoDB
  options: {
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 30000
  }
};
```

### 10.9. Query Optimization

```typescript
async function optimizedQueries() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // ❌ Bad: Load all data then filter in memory
  const allUsers = await userService.find({});
  const activeUsers = allUsers.filter(u => u.is_active);
  
  // ✅ Good: Filter at database level
  const activeUsersOptimized = await userService.find({ is_active: true });
  
  // ❌ Bad: Multiple queries
  const user1 = await userService.findById(1);
  const user2 = await userService.findById(2);
  const user3 = await userService.findById(3);
  
  // ✅ Good: Single query with $in
  const users = await userService.find({ id: { $in: [1, 2, 3] } });
  
  // ❌ Bad: Load all fields
  const allData = await userService.find({});
  
  // ✅ Good: Select only needed fields
  const limitedData = await userService.find({}, {
    select: ["id", "name", "email"]
  });
  
  // ✅ Use pagination for large datasets
  const page1 = await userService.find({}, { limit: 50, offset: 0 });
  const page2 = await userService.find({}, { limit: 50, offset: 50 });
}
```

### 10.10. Caching Strategy

```typescript
// Simple in-memory cache
class CachedUserService extends UserService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  async findById(id: any): Promise<User | null> {
    const cacheKey = `user_${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`Cache hit: ${cacheKey}`);
      return cached.data;
    }
    
    const user = await super.findById(id);
    
    if (user) {
      this.cache.set(cacheKey, { data: user, timestamp: Date.now() });
    }
    
    return user;
  }
  
  async updateById(id: any, data: Partial<User>): Promise<boolean> {
    const result = await super.updateById(id, data);
    
    if (result) {
      // Invalidate cache
      this.cache.delete(`user_${id}`);
    }
    
    return result;
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}
```

### 10.11. Batch Processing

```typescript
async function batchProcessing() {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  // Process large datasets in batches
  const batchSize = 100;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const batch = await userService.find({}, {
      limit: batchSize,
      offset: offset
    });
    
    if (batch.length === 0) {
      hasMore = false;
      break;
    }
    
    // Process batch
    for (const user of batch) {
      // Do something with user
      console.log(`Processing user: ${user.id}`);
    }
    
    offset += batchSize;
  }
}
```

---

## Security Best Practices

### 10.12. Input Validation

```typescript
class SecureUserService extends UserService {
  private emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    // Validate email
    if (!data.email || !this.emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }
    
    // Validate name
    if (!data.name || data.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    
    // Validate age
    if (data.age !== undefined && (data.age < 0 || data.age > 150)) {
      throw new Error("Invalid age");
    }
    
    // Sanitize input
    return {
      ...data,
      name: data.name.trim(),
      email: data.email.toLowerCase().trim()
    };
  }
}
```

### 10.13. SQL Injection Prevention

```typescript
// ❌ Bad: String concatenation (vulnerable to SQL injection)
async function vulnerableQuery(email: string) {
  const dao = await DatabaseManager.getDAO("myapp");
  const result = await dao.getAdapter().raw(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  return result.rows;
}

// ✅ Good: Parameterized queries
async function safeQuery(email: string) {
  const dao = await DatabaseManager.getDAO("myapp");
  
  // PostgreSQL
  const result = await dao.getAdapter().raw(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  
  // MySQL
  const result2 = await dao.getAdapter().raw(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  
  return result.rows;
}

// ✅ Best: Use ORM methods
async function safestQuery(email: string) {
  const userService = await ServiceManager.getInstance()
    .getService<UserService>("myapp", "users");
  
  return await userService.findOne({ email });
}
```

### 10.14. Access Control

```typescript
class RoleBasedUserService extends UserService {
  constructor(private currentUserId: number, private currentUserRole: string) {
    super();
  }
  
  async findById(id: any): Promise<User | null> {
    const user = await super.findById(id);
    
    // Users can only see their own data unless they're admin
    if (this.currentUserRole !== "admin" && user?.id !== this.currentUserId) {
      throw new Error("Access denied");
    }
    
    return user;
  }
  
  async updateById(id: any, data: Partial<User>): Promise<boolean> {
    // Users can only update their own data
    if (this.currentUserRole !== "admin" && id !== this.currentUserId) {
      throw new Error("Access denied");
    }
    
    // Users cannot change their own role
    if (this.currentUserRole !== "admin" && "role" in data) {
      delete data.role;
    }
    
    return await super.updateById(id, data);
  }
  
  async delete(filter: QueryFilter<User>): Promise<number> {
    // Only admins can delete users
    if (this.currentUserRole !== "admin") {
      throw new Error("Access denied");
    }
    
    return await super.delete(filter);
  }
}
```

### 10.15. Environment Variables

```typescript
// .env
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_SSL=true
DB_POOL_SIZE=10

// Never commit .env to version control
// Add to .gitignore:
// .env
// .env.local
// .env.*.local

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true"
};
```

---

## Migration from Other ORMs

### From TypeORM

```typescript
// TypeORM
@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  name: string;
  
  @Column({ unique: true })
  email: string;
}

const user = await userRepository.save({ name: "John", email: "john@example.com" });

// @dqcai/orm
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService extends BaseService<User> {
  constructor() {
    super("myapp", "users");
  }
}

const userService = await ServiceManager.getInstance().getService("myapp", "users");
const user = await userService.create({ name: "John", email: "john@example.com" });
```

### From Sequelize

```typescript
// Sequelize
const User = sequelize.define("User", {
  name: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true }
});

const user = await User.create({ name: "John", email: "john@example.com" });

// @dqcai/orm
const userSchema = {
  name: "users",
  cols: [
    { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
    { name: "name", type: "string", length: 255 },
    { name: "email", type: "string", length: 255, unique: true }
  ]
};

const userService = await ServiceManager.getInstance().getService("myapp", "users");
const user = await userService.create({ name: "John", email: "john@example.com" });
```

### From Mongoose

```typescript
// Mongoose
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true }
});

const User = mongoose.model("User", userSchema);
const user = await User.create({ name: "John", email: "john@example.com" });

// @dqcai/orm
const userSchema = {
  name: "users",
  cols: [
    { name: "_id", type: "string", primaryKey: true },
    { name: "name", type: "string" },
    { name: "email", type: "string", unique: true }
  ]
};

const userService = await ServiceManager.getInstance().getService("myapp", "users");
const user = await userService.create({ name: "John", email: "john@example.com" });
```

---

## FAQ

### Q: Tôi có thể sử dụng nhiều database cùng lúc không?

**A:** Có, bạn có thể đăng ký nhiều schema cho các database khác nhau:

```typescript
DatabaseManager.registerSchema("postgres_app", postgresSchema);
DatabaseManager.registerSchema("mongo_logs", mongoSchema);
DatabaseManager.registerSchema("sqlite_cache", sqliteSchema);

const pgService = await ServiceManager.getInstance().getService("postgres_app", "users");
const mongoService = await ServiceManager.getInstance().getService("mongo_logs", "logs");
```

### Q: Làm thế nào để migration database?

**A:** Sử dụng migration system như đã hướng dẫn ở phần 7.2:

```typescript
import { runMigrations } from "./database/migrations/runner";
await runMigrations("myapp");
```

### Q: Service có tự động cleanup không?

**A:** Có, bạn có thể cleanup unused services:

```typescript
// Manual cleanup
await ServiceManager.getInstance().cleanupUnusedServices();

// Auto cleanup every hour
setInterval(async () => {
  await ServiceManager.getInstance().cleanupUnusedServices();
}, 3600000);
```

### Q: Làm thế nào để debug queries?

**A:** Sử dụng raw queries hoặc enable logging:

```typescript
const dao = await DatabaseManager.getDAO("myapp");
const result = await dao.getAdapter().raw("SELECT * FROM users LIMIT 1");
console.log("Query result:", result);
```

### Q: Có hỗ trợ TypeScript không?

**A:** Có, thư viện được viết hoàn toàn bằng TypeScript với full type support:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService extends BaseService<User> {
  // Full type inference
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
}
```

---

## Resources

- 📖 **Documentation**: [https://cuongdq.no-ip.info/dqc-orm-document](https://cuongdq.no-ip.info/dqc-orm-document)
- 🐙 **GitHub**: [https://github.com/cuongdqpayment/dqcai-orm](https://github.com/cuongdqpayment/dqcai-orm)
- 📧 **Email**: cuongdq3500888@gmail.com
- 💬 **Issues**: [https://github.com/cuongdqpayment/dqcai-orm/issues](https://github.com/cuongdqpayment/dqcai-orm/issues)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/cuongdqpayment/dqcai-orm.git
cd dqcai-orm

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

---

## License

MIT © DQC AI Team

---

## Changelog

### Version 1.0.0
- ✨ Initial release
- 🎯 Multi-database support (PostgreSQL, MySQL, MongoDB, SQLite, Oracle, SQL Server)
- 🔄 Adapter pattern with factory
- 📦 Lazy-loading services
- 🔐 Role-based access control
- 💾 Transaction support
- 📊 Query builder
- 🚀 High performance

---

**Happy coding! 🎉**
# @dqcai/orm

A powerful, multi-database TypeScript ORM library supporting PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, and MongoDB.

## Features

✨ **Multi-Database Support** - Single API for multiple databases  
🔒 **Type-Safe** - Full TypeScript support with generics  
🎯 **Schema-Based** - Auto-generate tables from schema definitions  
🔄 **Adapter Pattern** - Easy to extend with custom adapters  
🔗 **Query Builder** - Fluent query building interface  
💾 **Transaction Support** - ACID transactions for SQL databases  
🚀 **High Performance** - Optimized for production use  
📦 **Zero Dependencies** - Only peer dependencies for specific databases

## Installation

```bash
npm install @dqcai/orm

# Install database driver (choose one or more)
npm install pg              # PostgreSQL
npm install mysql2          # MySQL/MariaDB
npm install better-sqlite3  # SQLite
npm install mssql           # SQL Server
npm install mongodb         # MongoDB
```

## Quick Start

### Basic Usage

```typescript
import { ORM, PostgreSQLAdapter } from '@dqcai/orm';

// Create adapter and ORM
const adapter = new PostgreSQLAdapter();
const orm = new ORM(adapter);

// Connect
await orm.connect({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'password'
});

// Define schema
const userSchema = {
  id: { type: 'integer', primaryKey: true, autoIncrement: true },
  name: { type: 'string', required: true, length: 100 },
  email: { type: 'string', unique: true, length: 255 },
  age: { type: 'integer' },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
};

// Create model
const User = orm.model('users', userSchema);

// Create table
await User.createTable();

// CRUD Operations
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

const users = await User.find({ isActive: true });
await User.updateById(1, { age: 31 });
await User.deleteById(1);
```

### Using Query Builder

```typescript
// Complex queries
const users = await User.query()
  .select('id', 'name', 'email')
  .where('isActive', '=', true)
  .where('age', '>', 18)
  .whereIn('name', ['John', 'Jane', 'Bob'])
  .orderBy('createdAt', 'DESC')
  .limit(10)
  .execute();

// Pagination
const page = await User.query()
  .where('isActive', '=', true)
  .paginate(1, 20)
  .execute();

// Joins (SQL only)
const usersWithPosts = await QueryBuilder
  .table('users', adapter)
  .select('users.name', 'posts.title')
  .leftJoin('posts', 'users.id = posts.userId')
  .execute();
```

### Using Database Manager

```typescript
import { DatabaseManager, DatabaseFactory, PostgreSQLAdapter } from '@dqcai/orm';

// Register adapter
DatabaseFactory.registerAdapter('postgresql', PostgreSQLAdapter);

// Define database schema
const dbSchema = {
  version: '1.0.0',
  database_type: 'postgresql',
  database_name: 'myapp',
  schemas: {
    users: {
      name: 'users',
      cols: [
        { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', unique: true }
      ]
    }
  }
};

// Register schema
DatabaseManager.registerSchema('myapp', dbSchema);

// Get DAO
const dao = await DatabaseManager.getDAO('myapp');

// Use DAO
const users = await dao.find('users', { isActive: true });
const user = await dao.insert('users', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});
```

### Using Base Service

```typescript
import { BaseService } from '@dqcai/orm';

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

class UserService extends BaseService<User> {
  constructor() {
    super('myapp', 'users');
  }

  // Custom methods
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  async getActiveUsers(): Promise<User[]> {
    return this.find({ isActive: true });
  }

  // Lifecycle hooks
  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    return {
      ...data,
      createdAt: new Date()
    };
  }
}

// Use service
const userService = new UserService();
await userService.initialize();

const user = await userService.create({
  name: 'Alice',
  email: 'alice@example.com'
});

const foundUser = await userService.findByEmail('alice@example.com');
```

## Supported Databases

### PostgreSQL

```typescript
import { PostgreSQLAdapter } from '@dqcai/orm';

const adapter = new PostgreSQLAdapter();
await adapter.connect({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'password',
  ssl: false
});
```

### MySQL / MariaDB

```typescript
import { MySQLAdapter, MariaDBAdapter } from '@dqcai/orm';

const adapter = new MySQLAdapter();
await adapter.connect({
  host: 'localhost',
  port: 3306,
  database: 'mydb',
  user: 'user',
  password: 'password'
});
```

### SQLite

```typescript
import { SQLiteAdapter } from '@dqcai/orm';

const adapter = new SQLiteAdapter();
await adapter.connect({
  filename: './database.db',
  // or use in-memory
  memory: true
});
```

### SQL Server

```typescript
import { SQLServerAdapter } from '@dqcai/orm';

const adapter = new SQLServerAdapter();
await adapter.connect({
  server: 'localhost',
  port: 1433,
  database: 'mydb',
  user: 'sa',
  password: 'password',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
});
```

### MongoDB

```typescript
import { MongoDBAdapter } from '@dqcai/orm';

const adapter = new MongoDBAdapter();
await adapter.connect({
  url: 'mongodb://localhost:27017',
  database: 'mydb'
});
```

## Schema Definition

```typescript
const schema = {
  // Primary key with auto increment
  id: {
    type: 'integer',
    primaryKey: true,
    autoIncrement: true
  },
  
  // String with constraints
  name: {
    type: 'string',
    required: true,
    length: 100,
    unique: true
  },
  
  // Number types
  age: { type: 'integer' },
  salary: { type: 'decimal', precision: 10, scale: 2 },
  rating: { type: 'float' },
  
  // Boolean
  isActive: {
    type: 'boolean',
    default: true
  },
  
  // Date/Time
  createdAt: {
    type: 'timestamp',
    default: 'CURRENT_TIMESTAMP'
  },
  birthDate: { type: 'date' },
  
  // JSON
  metadata: { type: 'json' },
  tags: { type: 'array' },
  
  // Text
  description: { type: 'text' },
  
  // UUID
  uuid: { type: 'uuid' },
  
  // Foreign Key
  userId: {
    type: 'integer',
    references: {
      table: 'users',
      field: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  }
};
```

## Field Types

| Type | PostgreSQL | MySQL | SQLite | SQL Server | MongoDB |
|------|-----------|-------|--------|-----------|---------|
| string | VARCHAR | VARCHAR | TEXT | NVARCHAR | string |
| text | TEXT | TEXT | TEXT | NVARCHAR(MAX) | string |
| integer | INTEGER | INT | INTEGER | INT | number |
| bigint | BIGINT | BIGINT | INTEGER | BIGINT | number |
| float | REAL | FLOAT | REAL | FLOAT | number |
| double | DOUBLE PRECISION | DOUBLE | REAL | FLOAT | number |
| decimal | DECIMAL | DECIMAL | REAL | DECIMAL | number |
| boolean | BOOLEAN | TINYINT(1) | INTEGER | BIT | boolean |
| date | DATE | DATE | TEXT | DATE | date |
| datetime | TIMESTAMP | DATETIME | TEXT | DATETIME2 | date |
| timestamp | TIMESTAMP | TIMESTAMP | TEXT | DATETIME2 | date |
| json | JSONB | JSON | TEXT | NVARCHAR(MAX) | object |
| uuid | UUID | CHAR(36) | TEXT | UNIQUEIDENTIFIER | string |

## Query Operators

```typescript
// Comparison
{ field: { $eq: value } }      // Equal
{ field: { $ne: value } }      // Not equal
{ field: { $gt: value } }      // Greater than
{ field: { $gte: value } }     // Greater than or equal
{ field: { $lt: value } }      // Less than
{ field: { $lte: value } }     // Less than or equal

// Array
{ field: { $in: [1, 2, 3] } }  // In array
{ field: { $nin: [1, 2, 3] } } // Not in array

// String
{ field: { $like: '%pattern%' } }   // SQL LIKE
{ field: { $ilike: '%pattern%' } }  // Case-insensitive LIKE
{ field: { $regex: /pattern/i } }   // Regex (MongoDB)

// Range
{ field: { $between: [10, 20] } }

// Null check
{ field: { $exists: true } }   // NOT NULL
{ field: { $exists: false } }  // IS NULL

// Logical
{ $and: [{ field1: value1 }, { field2: value2 }] }
{ $or: [{ field1: value1 }, { field2: value2 }] }
{ $not: { field: value } }
```

## Advanced Features

### Transactions

```typescript
const transaction = await orm.beginTransaction();

try {
  await User.create({ name: 'User 1' });
  await User.create({ name: 'User 2' });
  
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### Pagination

```typescript
const result = await User.paginate(
  { isActive: true },  // filter
  1,                   // page
  20,                  // perPage
  { sort: { createdAt: -1 } }  // options
);

console.log(result);
// {
//   data: [...],
//   total: 100,
//   page: 1,
//   perPage: 20,
//   totalPages: 5
// }
```

### Bulk Operations

```typescript
await User.bulkWrite([
  { insertOne: { document: { name: 'User 1' } } },
  { updateOne: { filter: { id: 1 }, update: { name: 'Updated' } } },
  { deleteOne: { filter: { id: 2 } } }
]);
```

### Soft Delete

```typescript
// Soft delete (sets deletedAt timestamp)
await User.softDelete({ id: 1 });

// Restore soft deleted
await User.restore({ id: 1 });

// Query excluding soft deleted
const activeUsers = await User.find({
  deletedAt: { $exists: false }
});
```

### Increment/Decrement

```typescript
// Increment stock by 5
await Product.increment({ id: 1 }, 'stock', 5);

// Decrement stock by 2
await Product.decrement({ id: 1 }, 'stock', 2);
```

### Find or Create

```typescript
const user = await User.findOrCreate(
  { email: 'john@example.com' },  // search criteria
  { name: 'John Doe', email: 'john@example.com' }  // data to create if not found
);
```

### Pluck & Distinct

```typescript
// Get array of specific field values
const emails = await User.pluck('email', { isActive: true });
// ['john@example.com', 'jane@example.com', ...]

// Get distinct values
const categories = await Product.distinct('category');
// ['Electronics', 'Clothing', 'Books']
```

## Multi-Database Management

```typescript
import { DatabaseManager, DatabaseFactory } from '@dqcai/orm';

// Register multiple adapters
DatabaseFactory.registerAdapter('postgresql', PostgreSQLAdapter);
DatabaseFactory.registerAdapter('mongodb', MongoDBAdapter);
DatabaseFactory.registerAdapter('mysql', MySQLAdapter);

// Define schemas for different databases
DatabaseManager.registerSchema('postgres_db', postgresSchema);
DatabaseManager.registerSchema('mongo_db', mongoSchema);
DatabaseManager.registerSchema('mysql_db', mysqlSchema);

// Get DAOs
const postgresDAO = await DatabaseManager.getDAO('postgres_db');
const mongoDAO = await DatabaseManager.getDAO('mongo_db');
const mysqlDAO = await DatabaseManager.getDAO('mysql_db');

// Health check
const health = await DatabaseManager.healthCheck();
console.log(health);
// { postgres_db: true, mongo_db: true, mysql_db: false }

// Close all connections
await DatabaseManager.closeAllConnections();
```

## Role-Based Access

```typescript
// Register role
DatabaseManager.registerRole({
  roleName: 'admin',
  requiredDatabases: ['users_db', 'orders_db'],
  optionalDatabases: ['logs_db'],
  permissions: ['read', 'write', 'delete']
});

// Initialize role connections
await DatabaseManager.initializeUserRoleConnections('admin', true);

// Get current user databases
const databases = DatabaseManager.getCurrentUserDatabases('admin');
```

## Service Manager

```typescript
import { ServiceManager, BaseService } from '@dqcai/orm';

class UserService extends BaseService<User> {
  constructor() {
    super('myapp', 'users');
  }
}

// Register service
ServiceManager.getInstance().registerService({
  schemaName: 'myapp',
  entityName: 'users',
  serviceClass: UserService,
  autoInit: true,
  cacheTimeout: 30 * 60 * 1000  // 30 minutes
});

// Get service (auto-initialized)
const userService = await ServiceManager.getInstance()
  .getService('myapp', 'users');

// Service stats
const stats = ServiceManager.getInstance().getStats();
console.log(stats);
// { totalServices: 5, activeServices: 3, configurations: 10 }

// Cleanup unused services
const cleaned = await ServiceManager.getInstance()
  .cleanupUnusedServices();
console.log(`Cleaned ${cleaned} services`);
```

## API Reference

### ORM Class

```typescript
class ORM {
  constructor(adapter: IAdapter)
  
  async connect(config: any): Promise<void>
  async disconnect(): Promise<void>
  isConnected(): boolean
  
  model<T>(name: string, schema: SchemaDefinition): Model<T>
  getModel<T>(name: string): Model<T> | undefined
  hasModel(name: string): boolean
  
  async beginTransaction(): Promise<Transaction>
  async raw(query: string | any, params?: any[]): Promise<any>
  
  async sync(options?: { force?: boolean; alter?: boolean }): Promise<void>
  async drop(): Promise<void>
  async truncate(): Promise<void>
}
```

### Model Class

```typescript
class Model<T> {
  async createTable(): Promise<void>
  async dropTable(): Promise<void>
  async truncate(): Promise<void>
  async exists(): Promise<boolean>
  
  query(): QueryBuilder<T>
  
  async create(data: Partial<T>): Promise<T>
  async createMany(data: Partial<T>[]): Promise<T[]>
  
  async find(filter?: QueryFilter<T>, options?: QueryOptions): Promise<T[]>
  async findOne(filter: QueryFilter<T>, options?: QueryOptions): Promise<T | null>
  async findById(id: any): Promise<T | null>
  
  async update(filter: QueryFilter<T>, data: Partial<T>): Promise<number>
  async updateOne(filter: QueryFilter<T>, data: Partial<T>): Promise<boolean>
  async updateById(id: any, data: Partial<T>): Promise<boolean>
  async upsert(filter: QueryFilter<T>, data: Partial<T>): Promise<T>
  
  async delete(filter: QueryFilter<T>): Promise<number>
  async deleteOne(filter: QueryFilter<T>): Promise<boolean>
  async deleteById(id: any): Promise<boolean>
  
  async count(filter?: QueryFilter<T>): Promise<number>
  async distinct(field: keyof T, filter?: QueryFilter<T>): Promise<any[]>
  
  async paginate(filter: QueryFilter<T>, page: number, perPage: number, options?: QueryOptions)
  async findOrCreate(filter: QueryFilter<T>, data: Partial<T>): Promise<T>
  async increment(filter: QueryFilter<T>, field: keyof T, amount?: number): Promise<number>
  async decrement(filter: QueryFilter<T>, field: keyof T, amount?: number): Promise<number>
}
```

### QueryBuilder Class

```typescript
class QueryBuilder<T> {
  static table<T>(name: string, adapter?: IAdapter): QueryBuilder<T>
  
  select(...fields: (keyof T)[]): this
  distinct(): this
  
  where(field: keyof T, operator: string, value: any): this
  where(filter: QueryFilter<T>): this
  whereIn(field: keyof T, values: any[]): this
  whereNotIn(field: keyof T, values: any[]): this
  whereLike(field: keyof T, pattern: string): this
  whereBetween(field: keyof T, min: any, max: any): this
  whereNull(field: keyof T): this
  whereNotNull(field: keyof T): this
  orWhere(filters: QueryFilter<T>[]): this
  andWhere(filters: QueryFilter<T>[]): this
  
  join(table: string, condition: string, type?: JoinType): this
  leftJoin(table: string, condition: string): this
  rightJoin(table: string, condition: string): this
  innerJoin(table: string, condition: string): this
  
  orderBy(field: keyof T, direction?: SortDirection): this
  groupBy(...fields: (keyof T)[]): this
  having(filter: QueryFilter): this
  
  limit(count: number): this
  offset(count: number): this
  paginate(page: number, perPage: number): this
  
  toSQL(): { sql: string; params: any[] }
  toPipeline(): any[]  // MongoDB
  
  async execute(): Promise<T[]>
  async first(): Promise<T | null>
  async count(): Promise<number>
  async exists(): Promise<boolean>
}
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines.

## Support

- GitHub Issues: https://github.com/cuongdqpayment/dqcai-orm/issues
- Documentation: https://cuongdq.no-ip.info/dqc-orm-document
- Email: cuongdq3500888@gmail.com
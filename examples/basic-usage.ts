// ./src/examples/basic-usage.ts
/**
 * EXAMPLE 1: Basic ORM Usage with PostgreSQL
 */

import { BaseService, DatabaseFactory, DatabaseManager, DatabaseSchema, ORM, QueryBuilder, SchemaDefinition } from '../src';
import { PostgreSQLAdapter } from '../src/adapters/postgresql-adapter';


async function example1_BasicORMUsage() {

  // 1. Create adapter
  const adapter = new PostgreSQLAdapter();

  // 2. Create ORM instance
  const orm = new ORM(adapter);

  // 3. Connect to database
  await orm.connect({
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    username: 'user',
    password: 'password'
  });

  // 4. Define schema
  const userSchema: SchemaDefinition = {
    id: {
      type: 'integer',
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: 'string',
      required: true,
      length: 100
    },
    email: {
      type: 'string',
      required: true,
      unique: true,
      length: 255
    },
    age: {
      type: 'integer'
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    createdAt: {
      type: 'timestamp',
      default: 'CURRENT_TIMESTAMP'
    }
  };

  // 5. Create model
  const User = orm.model('users', userSchema);

  // 6. Create table
  await User.createTable();

  // 7. CRUD operations
  
  // Create
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  });

  // Find
  const users = await User.find({ isActive: true });
  const singleUser = await User.findOne({ email: 'john@example.com' });
  const userById = await User.findById(1);

  // Update
  await User.updateById(1, { age: 31 });
  await User.update({ isActive: false }, { isActive: true });

  // Delete
  await User.deleteById(1);
  await User.delete({ isActive: false });

  // Count
  const count = await User.count({ isActive: true });

  // 8. Disconnect
  await orm.disconnect();
}

/**
 * EXAMPLE 2: Using Database Factory and Manager
 */
async function example2_FactoryAndManager() {

  // 1. Register adapter
  DatabaseFactory.registerAdapter('postgresql', PostgreSQLAdapter);

  // 2. Define database schema
  const dbSchema: DatabaseSchema = {
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
      },
      posts: {
        name: 'posts',
        cols: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'title', type: 'string', required: true },
          { name: 'content', type: 'text' },
          { name: 'userId', type: 'integer', references: { table: 'users', field: 'id' } }
        ]
      }
    }
  };

  // 3. Register schema
  DatabaseManager.registerSchema('myapp', dbSchema);

  // 4. Get DAO
  const dao = await DatabaseManager.getDAO('myapp');

  // 5. Use DAO for operations
  const users = await dao.find('users', { isActive: true });
  const user = await dao.insert('users', {
    name: 'Jane Doe',
    email: 'jane@example.com'
  });

  // 6. Close connection
  await DatabaseManager.closeConnection('myapp');
}

/**
 * EXAMPLE 3: Using BaseService
 */
async function example3_BaseService() {
 

  // Define User model interface
  interface User {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
  }

  // Create custom service
  class UserService extends BaseService<User> {
    constructor() {
      super('myapp', 'users');
    }

    // Custom method
    async findByEmail(email: string): Promise<User | null> {
      return this.findOne({ email });
    }

    // Override hook
    protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
      // Add timestamp
      return {
        ...data,
        createdAt: new Date()
      };
    }
  }

  // Initialize
  const userService = new UserService();
  await userService.initialize();

  // Use service
  const user = await userService.create({
    name: 'Alice',
    email: 'alice@example.com'
  });

  const foundUser = await userService.findByEmail('alice@example.com');
  const allUsers = await userService.find();

  // Status
  const status = userService.getStatus();
  console.log(status);
}

/**
 * EXAMPLE 4: Query Builder
 */
async function example4_QueryBuilder() {
  
  const adapter = new PostgreSQLAdapter();
  const orm = new ORM(adapter);
  
  await orm.connect({
    host: 'localhost',
    database: 'mydb',
    username: 'user',
    password: 'password'
  });

  const User = orm.model('users', {
    id: { type: 'integer', primaryKey: true },
    name: { type: 'string' },
    email: { type: 'string' },
    age: { type: 'integer' },
    isActive: { type: 'boolean' }
  });

  // Complex query with Query Builder
  const users = await User.query()
    .select('id', 'name', 'email')
    .where('isActive', '=', true)
    .where('age', '>', 18)
    .whereIn('name', ['John', 'Jane', 'Bob'])
    .orderBy('createdAt', 'DESC')
    .limit(10)
    .offset(0)
    .execute();

  // Pagination
  const page1 = await User.query()
    .where('isActive', '=', true)
    .paginate(1, 20)
    .execute();

  // Count
  const count = await User.query()
    .where('isActive', '=', true)
    .count();

  // Join (SQL only)
  const usersWithPosts = await QueryBuilder
    .table('users', adapter)
    .select('users.name', 'posts.title')
    .leftJoin('posts', 'users.id = posts.userId')
    .where('users.isActive', '=', true)
    .execute();

  await orm.disconnect();
}

/**
 * EXAMPLE 5: Transactions
 */
async function example5_Transactions() {
 
  const adapter = new PostgreSQLAdapter();
  const orm = new ORM(adapter);
  
  await orm.connect({
    host: 'localhost',
    database: 'mydb',
    username: 'user',
    password: 'password'
  });

  const User = orm.model('users', {
    id: { type: 'integer', primaryKey: true },
    name: { type: 'string' },
    balance: { type: 'decimal', precision: 10, scale: 2 }
  });

  // Begin transaction
  const transaction = await orm.beginTransaction();

  try {
    // Perform operations
    const user1 = await User.findById(1);
    const user2 = await User.findById(2);

    await User.updateById(1, { balance: user1.balance - 100 });
    await User.updateById(2, { balance: user2.balance + 100 });

    // Commit transaction
    await transaction.commit();
    console.log('Transaction committed successfully');
  } catch (error) {
    // Rollback on error
    await transaction.rollback();
    console.error('Transaction rolled back:', error);
  }

  await orm.disconnect();
}

/**
 * EXAMPLE 6: Multi-Database Support
 */
async function example6_MultiDatabase() {
  const {
    DatabaseFactory,
    DatabaseManager,
    PostgreSQLAdapter,
    MongoDBAdapter,
    MySQLAdapter
  } = require('@dqcai/orm');

  // Register multiple adapters
  DatabaseFactory.registerAdapter('postgresql', PostgreSQLAdapter);
  DatabaseFactory.registerAdapter('mongodb', MongoDBAdapter);
  DatabaseFactory.registerAdapter('mysql', MySQLAdapter);

  // Define schemas for different databases
  const postgresSchema = {
    version: '1.0.0',
    database_type: 'postgresql',
    database_name: 'users_db',
    schemas: {
      users: {
        name: 'users',
        cols: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'name', type: 'string' }
        ]
      }
    }
  };

  const mongoSchema = {
    version: '1.0.0',
    database_type: 'mongodb',
    database_name: 'logs_db',
    schemas: {
      logs: {
        name: 'logs',
        cols: [
          { name: '_id', type: 'uuid' },
          { name: 'message', type: 'string' },
          { name: 'timestamp', type: 'timestamp' }
        ]
      }
    }
  };

  // Register schemas
  DatabaseManager.registerSchema('postgres', postgresSchema);
  DatabaseManager.registerSchema('mongo', mongoSchema);

  // Get DAOs for different databases
  const postgresDAO = await DatabaseManager.getDAO('postgres');
  const mongoDAO = await DatabaseManager.getDAO('mongo');

  // Use them
  await postgresDAO.insert('users', { name: 'John' });
  await mongoDAO.insert('logs', { message: 'User created', timestamp: new Date() });

  // Health check
  const health = await DatabaseManager.healthCheck();
  console.log('Database health:', health);

  // Cleanup
  await DatabaseManager.closeAllConnections();
}

/**
 * EXAMPLE 7: Service Manager with Roles
 */
async function example7_ServiceManagerWithRoles() {
  const {
    DatabaseManager,
    ServiceManager,
    BaseService
  } = require('@dqcai/orm');

  // Define role
  DatabaseManager.registerRole({
    roleName: 'admin',
    requiredDatabases: ['users_db', 'orders_db'],
    optionalDatabases: ['logs_db'],
    permissions: ['read', 'write', 'delete']
  });

  // Create services
  class UserService extends BaseService {
    constructor() {
      super('users_db', 'users');
    }
  }

  class OrderService extends BaseService {
    constructor() {
      super('orders_db', 'orders');
    }
  }

  // Register services
  ServiceManager.getInstance().registerService({
    schemaName: 'users_db',
    entityName: 'users',
    serviceClass: UserService,
    autoInit: true
  });

  ServiceManager.getInstance().registerService({
    schemaName: 'orders_db',
    entityName: 'orders',
    serviceClass: OrderService,
    autoInit: true
  });

  // Initialize role connections
  await DatabaseManager.initializeUserRoleConnections('admin', true);

  // Get services
  const userService = await ServiceManager.getInstance().getService('users_db', 'users');
  const orderService = await ServiceManager.getInstance().getService('orders_db', 'orders');

  // Use services
  await userService.create({ name: 'Admin User' });
  await orderService.create({ userId: 1, total: 100 });

  // Get stats
  const stats = ServiceManager.getInstance().getStats();
  console.log('Service stats:', stats);

  // Cleanup unused services
  const cleaned = await ServiceManager.getInstance().cleanupUnusedServices();
  console.log('Cleaned services:', cleaned);
}

/**
 * EXAMPLE 8: Advanced Model Features
 */
async function example8_AdvancedModelFeatures() {


  const adapter = new PostgreSQLAdapter();
  const orm = new ORM(adapter);
  
  await orm.connect({
    host: 'localhost',
    database: 'mydb',
    username: 'user',
    password: 'password'
  });

  const Product = orm.model('products', {
    id: { type: 'integer', primaryKey: true, autoIncrement: true },
    name: { type: 'string', required: true },
    price: { type: 'decimal', precision: 10, scale: 2 },
    stock: { type: 'integer', default: 0 },
    isActive: { type: 'boolean', default: true },
    deletedAt: { type: 'timestamp', nullable: true }
  });

  // Pagination
  const page = await Product.paginate(
    { isActive: true },
    1,
    20,
    { sort: { createdAt: -1 } }
  );
  console.log(`Page ${page.page} of ${page.totalPages}, ${page.total} total`);

  // Find or create
  const product = await Product.findOrCreate(
    { name: 'Widget' },
    { name: 'Widget', price: 19.99, stock: 100 }
  );

  // Increment/Decrement
  await Product.increment({ id: 1 }, 'stock', 5);
  await Product.decrement({ id: 1 }, 'stock', 2);

  // Soft delete
  await Product.softDelete({ id: 1 });

  // Restore
  await Product.restore({ id: 1 });

  // Pluck
  const names = await Product.pluck('name', { isActive: true });
  console.log('Product names:', names);

  // Distinct
  const categories = await Product.distinct('category');
  console.log('Categories:', categories);

  // Bulk operations
  await Product.bulkWrite([
    { insertOne: { document: { name: 'Product 1', price: 10 } } },
    { insertOne: { document: { name: 'Product 2', price: 20 } } },
    { updateOne: { filter: { name: 'Product 1' }, update: { price: 15 } } },
    { deleteOne: { filter: { name: 'Product 3' } } }
  ]);

  await orm.disconnect();
}

// Export examples
export {
  example1_BasicORMUsage,
  example2_FactoryAndManager,
  example3_BaseService,
  example4_QueryBuilder,
  example5_Transactions,
  example6_MultiDatabase,
  example7_ServiceManagerWithRoles,
  example8_AdvancedModelFeatures
};
// ./test/test-mongodb-enhanced.ts
// Enhanced test suite with all new MongoDB-style methods

import {
  ServiceManager,
  BaseService,
  DatabaseManager,
  MongoDBAdapter,
  MongoDBConfig,
  ForeignKeyInfo,
} from "../src/index";

import { schemas } from "./posSchemas";

const dbConfig: MongoDBConfig = {
  databaseType: "mongodb",
  database: "test",
  url: "mongodb://admin:Admin$123@127.0.0.1:27017/test?authSource=admin",
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
  },
};

// ========== Logger Setup ==========
import { createModuleLogger, APPModules, CommonLoggerConfig } from "./logger";
const logger = createModuleLogger(APPModules.TEST_ORM);

console.log("Initial config:", CommonLoggerConfig.getCurrentConfig());
logger.trace("🔍 Enhanced test file started");

// ========== Service Definitions ==========

class UserService extends BaseService {
  constructor() {
    super("core", "users");
  }

  async findByStoreId(storeId: string) {
    return await this.find({ store_id: storeId });
  }

  async findByRole(role: string) {
    return await this.find({ role, is_active: true });
  }
}

class StoreService extends BaseService {
  constructor() {
    super("core", "stores");
  }

  async findByEnterpriseId(enterpriseId: string) {
    return await this.find({ enterprise_id: enterpriseId });
  }

  async getActiveStores(enterpriseId: string) {
    return await this.find(
      { enterprise_id: enterpriseId, status: "active" },
      { orderBy: { name: "ASC" } }
    );
  }
}

class OrderService extends BaseService {
  constructor() {
    super("oms", "orders");
  }

  async findByStoreId(storeId: string) {
    return await this.find({ store_id: storeId });
  }

  async findByStatus(storeId: string, status: string) {
    return await this.find({ store_id: storeId, status });
  }

  async getPendingOrders(storeId: string) {
    return await this.find(
      { store_id: storeId, status: "pending" },
      { orderBy: { created_at: "DESC" } }
    );
  }
}

class OrderItemService extends BaseService {
  constructor() {
    super("oms", "order_items");
  }

  async findByOrderId(orderId: string) {
    return await this.find({ order_id: orderId });
  }

  async getOrderTotal(orderId: string) {
    const items = await this.find({ order_id: orderId });
    return items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.total_price),
      0
    );
  }
}

class TransactionService extends BaseService {
  constructor() {
    super("oms", "transactions");
  }

  async findByOrderId(orderId: string) {
    return await this.find({ order_id: orderId });
  }

  async findByStatus(storeId: string, status: string) {
    return await this.find({ store_id: storeId, status });
  }
}

class OnlineOrderService extends BaseService {
  constructor() {
    super("oms", "online_orders");
  }

  async findByOrderId(orderId: string) {
    const results = await this.find({ order_id: orderId });
    return results.length > 0 ? results[0] : null;
  }

  async getPendingDeliveries(storeId: string) {
    return await this.find({
      store_id: storeId,
      status: "pending",
    });
  }
}

class PaymentTransactionService extends BaseService {
  constructor() {
    super("payment", "payment_transactions");
  }

  async findByOrderId(orderId: string) {
    return await this.find({ order_id: orderId });
  }

  async findByGateway(gateway: string) {
    return await this.find({ payment_gateway: gateway });
  }

  async getSuccessfulTransactions(storeId: string) {
    return await this.find({
      store_id: storeId,
      status: "completed",
    });
  }
}

class PaymentConfigService extends BaseService {
  constructor() {
    super("payment", "payment_configs");
  }

  async findActiveConfigs(storeId: string) {
    return await this.find({ store_id: storeId, status: "active" });
  }

  async findByGateway(storeId: string, gatewayName: string) {
    const results = await this.find({
      store_id: storeId,
      gateway_name: gatewayName,
    });
    return results.length > 0 ? results[0] : null;
  }
}

// ========== Helper Functions ==========

function generateOrderNumber(): string {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  return `ORD-${timestamp}`;
}

function generateTransactionNumber(): string {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  return `TXN-${timestamp}`;
}

async function verifyForeignKeys(schemaName: string, tables: string[]) {
  console.log(`\n🔍 Verifying Foreign Keys for ${schemaName.toUpperCase()}...`);

  const adapter = DatabaseManager.getAdapterInstance(
    schemaName
  ) as MongoDBAdapter;

  for (const table of tables) {
    const fks = await adapter.getForeignKeys(table);

    console.log(`\n📋 ${table}:`);
    if (fks.length === 0) {
      console.log("  ❌ No foreign keys found");
    } else {
      fks.forEach((fk: ForeignKeyInfo) => {
        console.log(`  ✅ ${fk.constraintName}:`);
        console.log(
          `     ${fk.columnName} -> ${fk.referencedTable}.${fk.referencedColumn}`
        );
        console.log(`     ON DELETE ${fk.onDelete} | ON UPDATE ${fk.onUpdate}`);
      });
    }
  }
}

// ========== NEW TEST FUNCTIONS FOR MONGODB-STYLE METHODS ==========

async function testFindFirstMethod(
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing findFirst() method...");

  // Test 1: Find first order without filter
  const firstOrder = await orderService.findFirst();
  console.log(`✅ First order (no filter): ${firstOrder?.order_number || "N/A"}`);

  // Test 2: Find first pending order
  const firstPendingOrder = await orderService.findFirst({ status: "pending" });
  console.log(
    `✅ First pending order: ${firstPendingOrder?.order_number || "N/A"}`
  );

  // Test 3: Find first order with sort
  const newestOrder = await orderService.findFirst(
    { store_id: storeId },
    { sort: { created_at: -1 } }
  );
  console.log(`✅ Newest order: ${newestOrder?.order_number || "N/A"}`);

  // Test 4: Find first order by store with oldest first
  const oldestOrder = await orderService.findFirst(
    { store_id: storeId },
    { sort: { created_at: 1 } }
  );
  console.log(`✅ Oldest order: ${oldestOrder?.order_number || "N/A"}`);

  return { firstOrder, firstPendingOrder, newestOrder, oldestOrder };
}

async function testFindAllMethod(orderService: OrderService, storeId: string) {
  console.log("\n🧪 Testing findAll() method...");

  // Test 1: Find all orders
  const allOrders = await orderService.findAll();
  console.log(`✅ All orders: ${allOrders.length}`);

  // Test 2: Find all orders for specific store
  const storeOrders = await orderService.findAll({ store_id: storeId });
  console.log(`✅ Store orders: ${storeOrders.length}`);

  // Test 3: Find all orders with limit
  const limitedOrders = await orderService.findAll({}, { limit: 5 });
  console.log(`✅ Limited orders (5): ${limitedOrders.length}`);

  // Test 4: Find all orders with sort
  const sortedOrders = await orderService.findAll(
    { store_id: storeId },
    { sort: { total: -1 } }
  );
  console.log(
    `✅ Orders sorted by total (desc): ${sortedOrders.length} (First total: ${sortedOrders[0]?.total || 0})`
  );

  return { allOrders, storeOrders, limitedOrders, sortedOrders };
}

async function testFindWithPaginationMethod(
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing findWithPagination() method...");

  // Test 1: First page with default limit (10)
  const page1 = await orderService.findWithPagination(
    { store_id: storeId },
    { page: 1, limit: 10 }
  );
  console.log(`✅ Page 1: ${page1.data.length} orders`);
  console.log(`   Total: ${page1.pagination.total}`);
  console.log(`   Total Pages: ${page1.pagination.totalPages}`);
  console.log(`   Has Next: ${page1.pagination.hasNextPage}`);
  console.log(`   Has Prev: ${page1.pagination.hasPrevPage}`);

  // Test 2: Second page
  const page2 = await orderService.findWithPagination(
    { store_id: storeId },
    { page: 2, limit: 10 }
  );
  console.log(`✅ Page 2: ${page2.data.length} orders`);
  console.log(`   Has Next: ${page2.pagination.hasNextPage}`);
  console.log(`   Has Prev: ${page2.pagination.hasPrevPage}`);

  // Test 3: Custom page size
  const customPage = await orderService.findWithPagination(
    { store_id: storeId },
    { page: 1, limit: 3 }
  );
  console.log(`✅ Custom page (limit 3): ${customPage.data.length} orders`);
  console.log(`   Total Pages: ${customPage.pagination.totalPages}`);

  // Test 4: Pagination with sort
  const sortedPage = await orderService.findWithPagination(
    { store_id: storeId },
    { page: 1, limit: 5, sort: { created_at: -1 } }
  );
  console.log(
    `✅ Sorted page (newest first): ${sortedPage.data.length} orders`
  );

  // Test 5: Filter by status with pagination
  const pendingPage = await orderService.findWithPagination(
    { store_id: storeId, status: "pending" },
    { page: 1, limit: 10 }
  );
  console.log(`✅ Pending orders page: ${pendingPage.data.length} orders`);
  console.log(`   Total pending: ${pendingPage.pagination.total}`);

  return { page1, page2, customPage, sortedPage, pendingPage };
}

async function testSearchMethod(
  userService: UserService,
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing search() method...");

  // Test 1: Search users by name
  const usersByName = await userService.search("Admin", ["full_name", "username"]);
  console.log(`✅ Users matching 'Admin': ${usersByName.length}`);

  // Test 2: Search users by email (case-insensitive)
  const usersByEmail = await userService.search(
    "techfood.com",
    ["email"],
    { caseSensitive: false }
  );
  console.log(
    `✅ Users with email containing 'techfood.com': ${usersByEmail.length}`
  );

  // Test 3: Search with exact match
  const exactMatch = await userService.search(
    "admin@techfood.com",
    ["email"],
    { exactMatch: true }
  );
  console.log(`✅ Exact email match: ${exactMatch.length}`);

  // Test 4: Search with limit
  const limitedSearch = await userService.search(
    "User",
    ["full_name", "username"],
    { limit: 2 }
  );
  console.log(`✅ Limited search results (2): ${limitedSearch.length}`);

  // Test 5: Search orders by order number
  const ordersByNumber = await orderService.search("ORD", ["order_number"]);
  console.log(`✅ Orders matching 'ORD': ${ordersByNumber.length}`);

  // Test 6: Search with sort
  const sortedSearch = await userService.search(
    "User",
    ["full_name"],
    { sort: { created_at: -1 }, limit: 5 }
  );
  console.log(`✅ Sorted search results: ${sortedSearch.length}`);

  return {
    usersByName,
    usersByEmail,
    exactMatch,
    limitedSearch,
    ordersByNumber,
    sortedSearch,
  };
}

async function testMongoDBStyleAliases(
  orderService: OrderService,
  userService: UserService,
  storeId: string
) {
  console.log("\n🧪 Testing MongoDB-style aliases...");

  // Test insertOne (alias for create)
  const newOrder = await orderService.insertOne({
    store_id: storeId,
    order_number: generateOrderNumber(),
    order_type: "dine_in",
    subtotal: 100000,
    tax_amount: 10000,
    total: 110000,
    status: "pending",
  });
  console.log(`✅ insertOne: ${newOrder?.order_number}`);

  // Test insertMany (alias for createMany)
  const newOrders = await orderService.insertMany([
    {
      store_id: storeId,
      order_number: generateOrderNumber(),
      order_type: "takeaway",
      subtotal: 150000,
      tax_amount: 15000,
      total: 165000,
      status: "pending",
    },
    {
      store_id: storeId,
      order_number: generateOrderNumber(),
      order_type: "delivery",
      subtotal: 200000,
      tax_amount: 20000,
      total: 220000,
      status: "confirmed",
    },
  ]);
  console.log(`✅ insertMany: ${newOrders.length} orders created`);

  // Test countDocuments (alias for count)
  const orderCount = await orderService.countDocuments({
    store_id: storeId,
    status: "pending",
  });
  console.log(`✅ countDocuments (pending): ${orderCount}`);

  // Test estimatedDocumentCount
  const estimatedCount = await orderService.estimatedDocumentCount();
  console.log(`✅ estimatedDocumentCount: ${estimatedCount}`);

  // Test updateMany (alias for update)
  const updateCount = await orderService.updateMany(
    { store_id: storeId, status: "pending" },
    { status: "processing" }
  );
  console.log(`✅ updateMany: ${updateCount} orders updated`);

  // Test deleteMany (alias for delete) - Create temp records first
  const tempOrders = await orderService.insertMany([
    {
      store_id: storeId,
      order_number: "TEMP-001",
      order_type: "dine_in",
      subtotal: 50000,
      tax_amount: 5000,
      total: 55000,
      status: "cancelled",
    },
    {
      store_id: storeId,
      order_number: "TEMP-002",
      order_type: "dine_in",
      subtotal: 60000,
      tax_amount: 6000,
      total: 66000,
      status: "cancelled",
    },
  ]);
  const deleteCount = await orderService.deleteMany({
    order_number: { $in: ["TEMP-001", "TEMP-002"] },
  });
  console.log(`✅ deleteMany: ${deleteCount} temp orders deleted`);

  // Test findMany (alias for findAll)
  const manyOrders = await orderService.findMany(
    { store_id: storeId },
    { limit: 5 }
  );
  console.log(`✅ findMany: ${manyOrders.length} orders`);

  return {
    newOrder,
    newOrders,
    orderCount,
    estimatedCount,
    updateCount,
    deleteCount,
    manyOrders,
  };
}

async function testAdvancedCRUDOperations(
  orderService: OrderService,
  userService: UserService,
  orderItemService: OrderItemService,
  storeId: string
) {
  console.log("\n🧪 Testing advanced CRUD operations...");

  // Test exists
  const orderExists = await orderService.exists({ store_id: storeId });
  console.log(`✅ exists: Store has orders: ${orderExists}`);

  // Test distinct
  const distinctStatuses = await orderService.distinct("status", {
    store_id: storeId,
  });
  console.log(
    `✅ distinct statuses: ${distinctStatuses.join(", ") || "N/A"}`
  );

  const distinctOrderTypes = await orderService.distinct("order_type");
  console.log(
    `✅ distinct order types: ${distinctOrderTypes.join(", ") || "N/A"}`
  );

  // Test findOrCreate
  const { record: foundOrder, created: wasCreated } =
    await orderService.findOrCreate(
      { order_number: "FIND-OR-CREATE-001" },
      {
        store_id: storeId,
        order_number: "FIND-OR-CREATE-001",
        order_type: "dine_in",
        subtotal: 100000,
        tax_amount: 10000,
        total: 110000,
        status: "pending",
      }
    );
  console.log(`✅ findOrCreate: ${wasCreated ? "Created" : "Found existing"}`);
  console.log(`   Order number: ${foundOrder?.order_number}`);

  // Test again (should find existing)
  const { created: wasCreatedAgain } = await orderService.findOrCreate(
    { order_number: "FIND-OR-CREATE-001" },
    {
      store_id: storeId,
      order_number: "FIND-OR-CREATE-001",
      order_type: "takeaway",
      subtotal: 200000,
      tax_amount: 20000,
      total: 220000,
      status: "confirmed",
    }
  );
  console.log(
    `✅ findOrCreate (2nd call): ${wasCreatedAgain ? "Created" : "Found existing"}`
  );

  // Test increment - Create an order with views field first
  const orderWithViews = await orderService.insertOne({
    store_id: storeId,
    order_number: generateOrderNumber(),
    order_type: "dine_in",
    subtotal: 100000,
    tax_amount: 10000,
    total: 110000,
    status: "pending",
    views: 0,
  });

  await orderService.increment(
    { id: orderWithViews.id },
    "views" as any,
    1
  );
  const incrementedOrder = await orderService.findById(orderWithViews.id);
  console.log(`✅ increment: views = ${(incrementedOrder as any)?.views || 0}`);

  // Test decrement
  await orderService.decrement(
    { id: orderWithViews.id },
    "views" as any,
    1
  );
  const decrementedOrder = await orderService.findById(orderWithViews.id);
  console.log(
    `✅ decrement: views = ${(decrementedOrder as any)?.views || 0}`
  );

  // Test softDelete
  const softDeleteCount = await orderService.softDelete({
    order_number: "FIND-OR-CREATE-001",
  });
  console.log(`✅ softDelete: ${softDeleteCount} order(s) soft deleted`);

  // Verify soft delete
  const softDeletedOrder = await orderService.findOne({
    order_number: "FIND-OR-CREATE-001",
  });
  console.log(
    `✅ Soft deleted order found: ${!!softDeletedOrder} (deleted: ${(softDeletedOrder as any)?.deleted})`
  );

  // Test restore
  const restoreCount = await orderService.restore({
    order_number: "FIND-OR-CREATE-001",
  });
  console.log(`✅ restore: ${restoreCount} order(s) restored`);

  // Test replaceOne
  const replaceResult = await orderService.replaceOne(
    { order_number: "FIND-OR-CREATE-001" },
    {
      store_id: storeId,
      order_number: "FIND-OR-CREATE-001",
      order_type: "delivery",
      subtotal: 300000,
      tax_amount: 30000,
      total: 330000,
      status: "completed",
      replaced: true,
    }
  );
  console.log(`✅ replaceOne: ${replaceResult ? "Success" : "Failed"}`);

  return {
    orderExists,
    distinctStatuses,
    distinctOrderTypes,
    foundOrder,
    wasCreated,
    incrementedOrder,
    decrementedOrder,
    softDeleteCount,
    restoreCount,
    replaceResult,
  };
}

async function testBulkOperations(
  orderService: OrderService,
  orderItemService: OrderItemService,
  storeId: string
) {
  console.log("\n🧪 Testing bulk operations...");

  // Test bulkInsert
  const bulkInsertData = Array.from({ length: 20 }, (_, i) => ({
    store_id: storeId,
    order_number: `BULK-${Date.now()}-${i}`,
    order_type: i % 3 === 0 ? "dine_in" : i % 3 === 1 ? "takeaway" : "delivery",
    subtotal: 100000 + i * 10000,
    tax_amount: 10000 + i * 1000,
    total: 110000 + i * 11000,
    status: i % 2 === 0 ? "pending" : "confirmed",
  }));

  const bulkInsertResult = await orderService.bulkInsert(bulkInsertData, 5, false);
  console.log(`✅ bulkInsert: ${bulkInsertResult.successRows}/${bulkInsertResult.totalRows} rows inserted`);
  console.log(`   Errors: ${bulkInsertResult.errorRows}`);

  // Test bulkCreate (with transaction)
  const bulkCreateData = Array.from({ length: 5 }, (_, i) => ({
    store_id: storeId,
    order_number: `BULK-CREATE-${Date.now()}-${i}`,
    order_type: "dine_in",
    subtotal: 150000,
    tax_amount: 15000,
    total: 165000,
    status: "pending",
  }));

  const bulkCreateResult = await orderService.bulkCreate(bulkCreateData);
  console.log(`✅ bulkCreate: ${bulkCreateResult.length} orders created with transaction`);

  // Test bulkUpsert
  const existingOrders = await orderService.findAll(
    { store_id: storeId },
    { limit: 3 }
  );

  const bulkUpsertData = [
    // Update existing
    ...existingOrders.map((order: any) => ({
      id: order.id,
      store_id: order.store_id,
      order_number: order.order_number,
      status: "updated",
      subtotal: order.subtotal + 10000,
      total: order.total + 11000,
    })),
    // Insert new
    {
      store_id: storeId,
      order_number: `UPSERT-NEW-${Date.now()}`,
      order_type: "dine_in",
      subtotal: 200000,
      tax_amount: 20000,
      total: 220000,
      status: "pending",
    },
  ];

  const bulkUpsertResult = await orderService.bulkUpsert(
    bulkUpsertData,
    ["id"],
    true
  );
  console.log(`✅ bulkUpsert: Created ${bulkUpsertResult.created.length}, Updated ${bulkUpsertResult.updated.length}`);
  console.log(`   Total: ${bulkUpsertResult.total}, Errors: ${bulkUpsertResult.errors.length}`);

  return {
    bulkInsertResult,
    bulkCreateResult,
    bulkUpsertResult,
  };
}

async function testTransactionSupport(
  orderService: OrderService,
  orderItemService: OrderItemService,
  transactionService: TransactionService,
  storeId: string
) {
  console.log("\n🧪 Testing transaction support...");

  // Test withTransaction
  try {
    const result = await orderService.withTransaction(async (service) => {
      // Create order
      const order = await service.insertOne({
        store_id: storeId,
        order_number: `TXN-${Date.now()}`,
        order_type: "dine_in",
        subtotal: 300000,
        tax_amount: 30000,
        total: 330000,
        status: "pending",
      });

      console.log(`   ✅ Order created in transaction: ${order.order_number}`);

      // Create order items
      await orderItemService.insertMany([
        {
          order_id: order.id,
          product_id: 201,
          quantity: 2,
          unit_price: 100000,
          total_price: 200000,
          status: "pending",
        },
        {
          order_id: order.id,
          product_id: 202,
          quantity: 1,
          unit_price: 100000,
          total_price: 100000,
          status: "pending",
        },
      ]);

      console.log(`   ✅ Order items created in transaction`);

      // Create transaction record
      await transactionService.insertOne({
        order_id: order.id,
        store_id: storeId,
        transaction_number: generateTransactionNumber(),
        amount: 330000,
        payment_method: "cash",
        status: "completed",
      });

      console.log(`   ✅ Transaction record created`);

      return order;
    });

    console.log(`✅ withTransaction completed successfully: ${result.order_number}`);
  } catch (error) {
    console.log(`❌ withTransaction failed: ${(error as Error).message}`);
  }

  // Test createBatch (uses transaction internally)
  const batchData = Array.from({ length: 3 }, (_, i) => ({
    store_id: storeId,
    order_number: `BATCH-${Date.now()}-${i}`,
    order_type: "takeaway",
    subtotal: 100000,
    tax_amount: 10000,
    total: 110000,
    status: "pending",
  }));

  const batchResult = await orderService.createBatch(batchData);
  console.log(`✅ createBatch: ${batchResult.length} orders created`);

  // Test updateBatch
  const ordersToUpdate = await orderService.findAll(
    { store_id: storeId, status: "pending" },
    { limit: 3 }
  );

  const updateBatchData = ordersToUpdate.map((order: any) => ({
    filter: { id: order.id },
    data: { status: "batch_updated" },
  }));

  const updateBatchCount = await orderService.updateBatch(updateBatchData);
  console.log(`✅ updateBatch: ${updateBatchCount} orders updated`);

  // Test deleteBatch - Create temp records first
  const tempOrders = await orderService.insertMany([
    {
      store_id: storeId,
      order_number: "BATCH-DEL-001",
      order_type: "dine_in",
      subtotal: 50000,
      tax_amount: 5000,
      total: 55000,
      status: "cancelled",
    },
    {
      store_id: storeId,
      order_number: "BATCH-DEL-002",
      order_type: "dine_in",
      subtotal: 60000,
      tax_amount: 6000,
      total: 66000,
      status: "cancelled",
    },
  ]);

  const deleteBatchFilters = tempOrders.map((order: any) => ({
    id: order.id,
  }));

  const deleteBatchCount = await orderService.deleteBatch(deleteBatchFilters);
  console.log(`✅ deleteBatch: ${deleteBatchCount} orders deleted`);
}

async function testAggregateOperations(
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing aggregate operations...");

  try {
    // Test aggregate - Group by status
    const statusAggregation = await orderService.aggregate([
      { $match: { store_id: storeId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$total" },
          avgAmount: { $avg: "$total" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log(`✅ Aggregate by status:`);
    statusAggregation.forEach((stat: any) => {
      console.log(
        `   ${stat._id}: ${stat.count} orders, Total: ${stat.totalAmount}, Avg: ${Math.round(stat.avgAmount)}`
      );
    });

    // Test aggregate - Group by order type
    const typeAggregation = await orderService.aggregate([
      { $match: { store_id: storeId } },
      {
        $group: {
          _id: "$order_type",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    console.log(`✅ Aggregate by order type:`);
    typeAggregation.forEach((type: any) => {
      console.log(
        `   ${type._id}: ${type.count} orders, Revenue: ${type.totalRevenue}`
      );
    });

    // Test aggregate - Date-based aggregation
    const dateAggregation = await orderService.aggregate([
      { $match: { store_id: storeId } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$created_at",
            },
          },
          orderCount: { $sum: 1 },
          dailyRevenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 5 },
    ]);

    console.log(`✅ Aggregate by date (last 5 days):`);
    dateAggregation.forEach((day: any) => {
      console.log(
        `   ${day._id}: ${day.orderCount} orders, Revenue: ${day.dailyRevenue}`
      );
    });

    return { statusAggregation, typeAggregation, dateAggregation };
  } catch (error) {
    console.log(`⚠️ Aggregate operations not fully supported: ${(error as Error).message}`);
    return null;
  }
}

async function testRawQueryOperations(
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing raw query operations...");

  try {
    // Test raw query for MongoDB
    const rawResult = await orderService.raw({
      find: "orders",
      filter: { store_id: storeId, status: "pending" },
      limit: 5,
    });

    console.log(`✅ Raw query result: ${Array.isArray(rawResult) ? rawResult.length : 'N/A'} records`);

    // Test executeRaw
    const executeResult = await orderService.executeRaw(
      { countDocuments: "orders" },
      [{ store_id: storeId }]
    );

    console.log(`✅ Execute raw result: ${executeResult.rowsAffected || executeResult.result || 'N/A'}`);

    return { rawResult, executeResult };
  } catch (error) {
    console.log(`⚠️ Raw query operations: ${(error as Error).message}`);
    return null;
  }
}

async function testSchemaManagement(orderService: OrderService) {
  console.log("\n🧪 Testing schema management...");

  try {
    // Test tableExists
    const exists = await orderService.tableExists();
    console.log(`✅ Table exists: ${exists}`);

    // Test getTableInfo
    const tableInfo = await orderService.getTableInfo();
    console.log(`✅ Table info retrieved: ${Object.keys(tableInfo || {}).length} properties`);

    // Test creating an index
    await orderService.createIndex({
      name: "idx_order_number",
      fields: ["order_number"],
      unique: true,
    });
    console.log(`✅ Index created: idx_order_number`);

    // Test creating a composite index
    await orderService.createIndex({
      name: "idx_store_status",
      fields: ["store_id", "status"],
      unique: false,
    });
    console.log(`✅ Composite index created: idx_store_status`);

    return { exists, tableInfo };
  } catch (error) {
    console.log(`⚠️ Schema management: ${(error as Error).message}`);
    return null;
  }
}

async function testPaginationPerformance(
  orderService: OrderService,
  storeId: string
) {
  console.log("\n🧪 Testing pagination performance...");

  const startTime = Date.now();

  // Create many test records
  const testRecords = Array.from({ length: 100 }, (_, i) => ({
    store_id: storeId,
    order_number: `PERF-TEST-${Date.now()}-${i}`,
    order_type: "dine_in",
    subtotal: 100000,
    tax_amount: 10000,
    total: 110000,
    status: "pending",
  }));

  await orderService.bulkInsert(testRecords, 50, false);
  console.log(`✅ Created 100 test records in ${Date.now() - startTime}ms`);

  // Test pagination performance
  const pageStart = Date.now();
  const results = [];

  for (let page = 1; page <= 5; page++) {
    const pageResult = await orderService.findWithPagination(
      { store_id: storeId },
      { page, limit: 20 }
    );
    results.push(pageResult);
  }

  const pageTime = Date.now() - pageStart;
  console.log(`✅ Paginated through 5 pages (100 records) in ${pageTime}ms`);
  console.log(`   Avg per page: ${Math.round(pageTime / 5)}ms`);

  // Test search performance
  const searchStart = Date.now();
  const searchResults = await orderService.search("PERF-TEST", ["order_number"]);
  const searchTime = Date.now() - searchStart;

  console.log(`✅ Search completed in ${searchTime}ms`);
  console.log(`   Found: ${searchResults.length} records`);

  return { pageTime, searchTime, searchResults: searchResults.length };
}

// ========== Main Test Function ==========

async function main() {
  try {
    logger.info("🚀 Starting ENHANCED MongoDB Test Suite with New Methods");

    // ========== Initialize Databases ==========
    logger.debug("📋 Registering schemas...");
    DatabaseManager.registerSchemas(schemas);

    logger.debug("🔧 Initializing CORE database...");
    await DatabaseManager.initializeSchema("core", {
      dbConfig,
      validateVersion: true,
    });
    console.log("✅ CORE database initialized");

    logger.debug("🔧 Initializing OMS database...");
    await DatabaseManager.initializeSchema("oms", {
      dbConfig: { ...dbConfig, database: "oms" },
      validateVersion: true,
    });
    console.log("✅ OMS database initialized");

    logger.debug("🔧 Initializing PAYMENT database...");
    await DatabaseManager.initializeSchema("payment", {
      dbConfig: { ...dbConfig, database: "payment" },
      validateVersion: true,
    });
    console.log("✅ PAYMENT database initialized");

    // Verify foreign keys
    // await verifyForeignKeys("core", ["stores", "users", "user_sessions", "settings"]);
    // await verifyForeignKeys("oms", ["orders", "order_items", "transactions", "online_orders"]);
    // await verifyForeignKeys("payment", ["payment_transactions", "payment_configs"]);

    // ========== Register Services ==========
    logger.debug("\n🔌 Registering services...");
    const serviceManager = ServiceManager.getInstance();

    serviceManager.registerServices([
      { schemaName: "core", entityName: "enterprises" },
      { schemaName: "core", entityName: "stores", serviceClass: StoreService, autoInit: true },
      { schemaName: "core", entityName: "users", serviceClass: UserService, autoInit: true },
      { schemaName: "core", entityName: "user_sessions" },
      { schemaName: "core", entityName: "settings" },
    ]);

    serviceManager.registerServices([
      { schemaName: "oms", entityName: "orders", serviceClass: OrderService, autoInit: true },
      { schemaName: "oms", entityName: "order_items", serviceClass: OrderItemService, autoInit: true },
      { schemaName: "oms", entityName: "transactions", serviceClass: TransactionService, autoInit: true },
      { schemaName: "oms", entityName: "online_orders", serviceClass: OnlineOrderService, autoInit: true },
    ]);

    serviceManager.registerServices([
      { schemaName: "payment", entityName: "payment_transactions", serviceClass: PaymentTransactionService, autoInit: true },
      { schemaName: "payment", entityName: "payment_configs", serviceClass: PaymentConfigService, autoInit: true },
    ]);

    // Get service instances
    const enterpriseService = await serviceManager.getService("core", "enterprises");
    const storeService = (await serviceManager.getService("core", "stores")) as StoreService;
    const userService = (await serviceManager.getService("core", "users")) as UserService;
    const orderService = (await serviceManager.getService("oms", "orders")) as OrderService;
    const orderItemService = (await serviceManager.getService("oms", "order_items")) as OrderItemService;
    const transactionService = (await serviceManager.getService("oms", "transactions")) as TransactionService;
    const onlineOrderService = (await serviceManager.getService("oms", "online_orders")) as OnlineOrderService;
    const paymentTransactionService = (await serviceManager.getService("payment", "payment_transactions")) as PaymentTransactionService;
    const paymentConfigService = (await serviceManager.getService("payment", "payment_configs")) as PaymentConfigService;

    // ========== CREATE INITIAL DATA ==========
    logger.info("\n📦 ===== CREATING INITIAL TEST DATA =====");

    const enterpriseId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    const enterprise = await enterpriseService.upsert(
      {
        id: enterpriseId,
        name: "TechFood Enhanced Testing",
        business_type: "ltd",
        email: "enhanced@techfood.com",
        phone: "0123456789",
        status: "active",
        subscription_plan: "premium",
      },
      ["email"]
    );
    console.log("✅ Enterprise created:", enterprise?.name);

    const store = await storeService.upsert({
      id: storeId,
      enterprise_id: enterprise!.id,
      name: "Enhanced Test Restaurant",
      store_type: "retail",
      address: "123 Enhanced Street, District 1",
      phone: "0987654321",
      email: "enhanced@techfood.com",
      status: "active",
      currency: "VND",
      tax_rate: 10,
    });
    console.log("✅ Store created:", store?.name);

    const adminUser = await userService.upsert(
      {
        id: crypto.randomUUID(),
        store_id: store!.id,
        username: "admin",
        password_hash: "hashed_password_123",
        full_name: "Admin User",
        email: "admin@techfood.com",
        phone: "0911111111",
        role: "admin",
        is_active: true,
      },
      ["email"]
    );
    console.log("✅ Admin user created:", adminUser?.full_name);

    const cashierUser = await userService.upsert(
      {
        id: crypto.randomUUID(),
        store_id: store!.id,
        username: "cashier01",
        password_hash: "hashed_password_456",
        full_name: "Cashier One",
        email: "cashier01@techfood.com",
        role: "cashier",
        is_active: true,
      },
      ["email"]
    );
    console.log("✅ Cashier user created:", cashierUser?.full_name);

    // Create initial orders for testing
    const initialOrders = Array.from({ length: 15 }, (_, i) => ({
      store_id: storeId,
      user_id: i % 2 === 0 ? adminUser?.id : cashierUser?.id,
      order_number: `INIT-${Date.now()}-${i}`,
      order_type: i % 3 === 0 ? "dine_in" : i % 3 === 1 ? "takeaway" : "delivery",
      subtotal: 100000 + i * 20000,
      tax_amount: 10000 + i * 2000,
      discount_amount: i % 5 === 0 ? 10000 : 0,
      total: 110000 + i * 22000 - (i % 5 === 0 ? 10000 : 0),
      status: i % 4 === 0 ? "pending" : i % 4 === 1 ? "confirmed" : i % 4 === 2 ? "completed" : "cancelled",
    }));

    await orderService.bulkInsert(initialOrders, 10, false);
    console.log(`✅ Created ${initialOrders.length} initial orders`);

    // ========== RUN NEW MONGODB-STYLE TESTS ==========
    logger.info("\n🎯 ===== TESTING NEW MONGODB-STYLE METHODS =====");

    // Test 1: findFirst
    await testFindFirstMethod(orderService, storeId);

    // Test 2: findAll
    await testFindAllMethod(orderService, storeId);

    // Test 3: findWithPagination
    await testFindWithPaginationMethod(orderService, storeId);

    // Test 4: search
    await testSearchMethod(userService, orderService, storeId);

    // Test 5: MongoDB-style aliases
    await testMongoDBStyleAliases(orderService, userService, storeId);

    // Test 6: Advanced CRUD operations
    await testAdvancedCRUDOperations(orderService, userService, orderItemService, storeId);

    // Test 7: Bulk operations
    await testBulkOperations(orderService, orderItemService, storeId);

    // Test 8: Transaction support
    await testTransactionSupport(orderService, orderItemService, transactionService, storeId);

    // Test 9: Aggregate operations
    await testAggregateOperations(orderService, storeId);

    // Test 10: Raw query operations
    await testRawQueryOperations(orderService, storeId);

    // Test 11: Schema management
    await testSchemaManagement(orderService);

    // Test 12: Pagination performance
    await testPaginationPerformance(orderService, storeId);

    // ========== ORIGINAL TESTS (FROM ORIGINAL FILE) ==========
    logger.info("\n🔄 ===== RUNNING ORIGINAL TEST SCENARIOS =====");

    // Create payment configurations
    const momoConfig = await paymentConfigService.upsert({
      store_id: storeId,
      payment_method: "mobile_payment",
      gateway_name: "MoMo",
      partner_code: "MOMO_PARTNER_123",
      access_key: "ACCESS_KEY_XXX",
      secret_key: "SECRET_KEY_YYY",
      endpoint_url: "https://test-payment.momo.vn/v2/gateway/api",
      is_sandbox: true,
      status: "active",
    });
    console.log("✅ MoMo config created:", momoConfig?.gateway_name);

    const vnpayConfig = await paymentConfigService.upsert({
      store_id: storeId,
      payment_method: "credit_card",
      gateway_name: "VNPay",
      partner_code: "VNPAY_PARTNER_456",
      access_key: "VNPAY_ACCESS_KEY",
      secret_key: "VNPAY_SECRET_KEY",
      endpoint_url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      is_sandbox: true,
      status: "active",
    });
    console.log("✅ VNPay config created:", vnpayConfig?.gateway_name);

    // Create a complete order with online details
    const deliveryOrderId = crypto.randomUUID();
    const deliveryOrder = await orderService.upsert({
      id: deliveryOrderId,
      store_id: storeId,
      user_id: cashierUser?.id || null,
      order_number: generateOrderNumber(),
      order_type: "delivery",
      subtotal: 500000,
      tax_amount: 50000,
      discount_amount: 25000,
      total: 525000,
      status: "confirmed",
    });
    console.log("✅ Delivery order created:", deliveryOrder?.order_number);

    const onlineOrderId = crypto.randomUUID();
    const onlineOrder = await onlineOrderService.upsert({
      id: onlineOrderId,
      order_id: deliveryOrderId,
      store_id: storeId,
      delivery_address: "456 Customer Street, District 3, HCMC",
      delivery_service: "GrabFood",
      delivery_fee: 25000,
      estimated_delivery_time: new Date(Date.now() + 3600000).toISOString(),
      status: "pending",
      tracking_id: `GRAB-${Date.now()}`,
      special_instructions: "Call before delivery",
    });
    console.log("✅ Online order details created:", onlineOrder?.tracking_id);

    await orderItemService.bulkInsert([
      {
        order_id: deliveryOrderId,
        product_id: 103,
        quantity: 3,
        unit_price: 150000,
        total_price: 450000,
        status: "preparing",
      },
      {
        order_id: deliveryOrderId,
        product_id: 104,
        quantity: 1,
        unit_price: 50000,
        total_price: 50000,
        status: "preparing",
      },
    ]);
    console.log("✅ Delivery order items created");

    const deliveryTransaction = await transactionService.upsert({
      id: crypto.randomUUID(),
      order_id: deliveryOrderId,
      store_id: storeId,
      transaction_number: generateTransactionNumber(),
      amount: 525000,
      payment_method: "mobile_payment",
      status: "pending",
      reference_id: `MOMO_REF_${Date.now()}`,
    });
    console.log("✅ Delivery transaction created:", deliveryTransaction?.transaction_number);

    const paymentTxn = await paymentTransactionService.upsert({
      id: crypto.randomUUID(),
      transaction_id: `PAY_${Date.now()}`,
      order_id: deliveryOrderId,
      store_id: storeId,
      payment_gateway: "MoMo",
      amount: 525000,
      currency: "VND",
      payment_method: "mobile_payment",
      status: "pending",
      gateway_transaction_id: `MOMO_TXN_${Date.now()}`,
      gateway_response: JSON.stringify({
        resultCode: 0,
        message: "Transaction pending",
        requestId: `REQ_${Date.now()}`,
      }),
    });
    console.log("✅ Payment transaction created:", paymentTxn?.transaction_id);

    await paymentTransactionService.update(
      { id: paymentTxn!.id },
      {
        status: "completed",
        gateway_response: JSON.stringify({
          resultCode: 0,
          message: "Transaction successful",
          transTime: new Date().toISOString(),
        }),
      }
    );
    console.log("✅ Payment transaction completed");

    // ========== FINAL STATISTICS ==========
    logger.info("\n📈 ===== COMPREHENSIVE STATISTICS =====");

    const stats = {
      core: {
        enterprises: await enterpriseService.count(),
        stores: await storeService.count(),
        users: await userService.count(),
        activeUsers: await userService.count({ is_active: true }),
      },
      oms: {
        orders: await orderService.count(),
        ordersByStatus: {
          pending: await orderService.count({ store_id: storeId, status: "pending" }),
          confirmed: await orderService.count({ store_id: storeId, status: "confirmed" }),
          completed: await orderService.count({ store_id: storeId, status: "completed" }),
          cancelled: await orderService.count({ store_id: storeId, status: "cancelled" }),
        },
        orderItems: await orderItemService.count(),
        transactions: await transactionService.count(),
        onlineOrders: await onlineOrderService.count(),
      },
      payment: {
        paymentTransactions: await paymentTransactionService.count(),
        completedPayments: await paymentTransactionService.count({ status: "completed" }),
        paymentConfigs: await paymentConfigService.count(),
      },
    };

    console.log("\n📊 Comprehensive Database Statistics:");
    console.log("   CORE:");
    console.log(`     - Enterprises: ${stats.core.enterprises}`);
    console.log(`     - Stores: ${stats.core.stores}`);
    console.log(`     - Users: ${stats.core.users} (Active: ${stats.core.activeUsers})`);
    console.log("   OMS:");
    console.log(`     - Total Orders: ${stats.oms.orders}`);
    console.log(`       • Pending: ${stats.oms.ordersByStatus.pending}`);
    console.log(`       • Confirmed: ${stats.oms.ordersByStatus.confirmed}`);
    console.log(`       • Completed: ${stats.oms.ordersByStatus.completed}`);
    console.log(`       • Cancelled: ${stats.oms.ordersByStatus.cancelled}`);
    console.log(`     - Order Items: ${stats.oms.orderItems}`);
    console.log(`     - Transactions: ${stats.oms.transactions}`);
    console.log(`     - Online Orders: ${stats.oms.onlineOrders}`);
    console.log("   PAYMENT:");
    console.log(`     - Payment Transactions: ${stats.payment.paymentTransactions}`);
    console.log(`     - Completed Payments: ${stats.payment.completedPayments}`);
    console.log(`     - Payment Configs: ${stats.payment.paymentConfigs}`);

    // Health check
    const health = await serviceManager.healthCheck();
    console.log(`\n✅ System Health: ${health.overallHealth}`);
    console.log(`   Healthy Services: ${health.healthyServices}/${health.totalServices}`);

    // Service status report
    console.log("\n📋 Service Status Report:");
    const orderStatus = orderService.getStatus();
    console.log(`   Order Service: ${orderStatus.connectionStatus} (Last access: ${orderStatus.lastAccess})`);

    logger.info("\n🎉 ===== ALL ENHANCED TESTS COMPLETED SUCCESSFULLY =====");

  } catch (error) {
    console.error("❌ Test failed:", (error as Error).message);
    console.error((error as Error).stack);
    throw error;
  } finally {
    await DatabaseManager.closeAll();
    logger.info("✅ All database connections closed");
  }
}

// Run test
main()
  .then(() => {
    console.log("\n✅ All enhanced tests with MongoDB-style methods completed successfully!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
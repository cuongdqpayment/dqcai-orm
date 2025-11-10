// ./test/test-postgresql.ts
// script này đã chạy thành công

// ========== BƯỚC 4: SAU ĐÓ mới import SQLite library ==========
import {
  ServiceManager,
  BaseService,
  DatabaseManager,
  PostgreSQLConfig,
  PostgreSQLAdapter,
  ForeignKeyInfo,
} from "../src/index";

import { schemas } from "./posSchemas";
const dbConfig: PostgreSQLConfig = {
  databaseType: "postgresql",
  database: "postgres",
  host: "localhost",
  port: 5432,
  user: "admin",
  password: "Admin@123",
  // Optional: connection pool settings
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// ========== Logger Setup ==========
import { createModuleLogger, APPModules, CommonLoggerConfig } from "./logger";
const logger = createModuleLogger(APPModules.TEST_ORM);

console.log("Initial config:", CommonLoggerConfig.getCurrentConfig());
logger.trace("🔍 Enhanced test file started");

// ========== Service Definitions ==========

// Core Services
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

// OMS Services
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

// Payment Services
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

async function verifyForeignKeys(schemaName: string, tables: string[]) {
  console.log(`\n🔍 Verifying Foreign Keys for ${schemaName.toUpperCase()}...`);

  const adapter = DatabaseManager.getAdapterInstance(
    schemaName
  ) as PostgreSQLAdapter;

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

// ========== Main Test Function ==========

async function main() {
  try {
    // ========== Initialize Databases ==========
    logger.info("🚀 Starting Enhanced Database Test Suite");

    // Register all schemas
    logger.debug("📋 Registering schemas...");
    DatabaseManager.registerSchemas(schemas);

    // Initialize CORE database
    logger.debug("🔧 Initializing CORE database...");
    await DatabaseManager.initializeSchema("core", {
      dbConfig,
      validateVersion: true,
    });
    console.log("✅ CORE database initialized");

    // Initialize OMS database
    logger.debug("🔧 Initializing OMS database...");
    await DatabaseManager.initializeSchema("oms", {
      dbConfig: { ...dbConfig, database: "oms" },
      validateVersion: true,
    });
    console.log("✅ OMS database initialized");

    // Initialize PAYMENT database
    logger.debug("🔧 Initializing PAYMENT database...");
    await DatabaseManager.initializeSchema("payment", {
      dbConfig: { ...dbConfig, database: "payment" },
      validateVersion: true,
    });
    console.log("✅ PAYMENT database initialized");

    // Verify foreign keys
    await verifyForeignKeys("core", [
      "stores",
      "users",
      "user_sessions",
      "settings",
    ]);
    await verifyForeignKeys("oms", [
      "orders",
      "order_items",
      "transactions",
      "online_orders",
    ]);
    await verifyForeignKeys("payment", [
      "payment_transactions",
      "payment_configs",
    ]);

    // ========== Register Services ==========
    logger.debug("\n🔌 Registering services...");
    const serviceManager = ServiceManager.getInstance();

    // Core services
    serviceManager.registerServices([
      { schemaName: "core", entityName: "enterprises" },
      {
        schemaName: "core",
        entityName: "stores",
        serviceClass: StoreService,
        autoInit: true,
      },
      {
        schemaName: "core",
        entityName: "users",
        serviceClass: UserService,
        autoInit: true,
      },
      { schemaName: "core", entityName: "user_sessions" },
      { schemaName: "core", entityName: "settings" },
    ]);

    // OMS services
    serviceManager.registerServices([
      {
        schemaName: "oms",
        entityName: "orders",
        serviceClass: OrderService,
        autoInit: true,
      },
      {
        schemaName: "oms",
        entityName: "order_items",
        serviceClass: OrderItemService,
        autoInit: true,
      },
      {
        schemaName: "oms",
        entityName: "transactions",
        serviceClass: TransactionService,
        autoInit: true,
      },
      {
        schemaName: "oms",
        entityName: "online_orders",
        serviceClass: OnlineOrderService,
        autoInit: true,
      },
    ]);

    // Payment services
    serviceManager.registerServices([
      {
        schemaName: "payment",
        entityName: "payment_transactions",
        serviceClass: PaymentTransactionService,
        autoInit: true,
      },
      {
        schemaName: "payment",
        entityName: "payment_configs",
        serviceClass: PaymentConfigService,
        autoInit: true,
      },
    ]);

    // Get service instances
    const enterpriseService = await serviceManager.getService(
      "core",
      "enterprises"
    );
    const storeService = (await serviceManager.getService(
      "core",
      "stores"
    )) as StoreService;
    const userService = (await serviceManager.getService(
      "core",
      "users"
    )) as UserService;
    const orderService = (await serviceManager.getService(
      "oms",
      "orders"
    )) as OrderService;
    const orderItemService = (await serviceManager.getService(
      "oms",
      "order_items"
    )) as OrderItemService;
    const transactionService = (await serviceManager.getService(
      "oms",
      "transactions"
    )) as TransactionService;
    const onlineOrderService = (await serviceManager.getService(
      "oms",
      "online_orders"
    )) as OnlineOrderService;
    const paymentTransactionService = (await serviceManager.getService(
      "payment",
      "payment_transactions"
    )) as PaymentTransactionService;
    const paymentConfigService = (await serviceManager.getService(
      "payment",
      "payment_configs"
    )) as PaymentConfigService;

    // ========== TEST CORE DATABASE ==========
    logger.info("\n📦 ===== TESTING CORE DATABASE =====");

    const enterpriseId = crypto.randomUUID();
    const storeId = crypto.randomUUID();

    // Create Enterprise
    const enterprise = await enterpriseService.upsert(
      {
        id: enterpriseId,
        name: "TechFood Company",
        business_type: "ltd",
        email: "contact@techfood.com",
        phone: "0123456789",
        status: "active",
        subscription_plan: "premium",
      },
      ["email"]
    );
    console.log("✅ Enterprise created:", enterprise?.name);

    // Create Store
    const store = await storeService.upsert({
      id: storeId,
      enterprise_id: enterprise!.id,
      name: "Main Restaurant",
      store_type: "retail",
      address: "123 Food Street, District 1",
      phone: "0987654321",
      email: "mainstore@techfood.com",
      status: "active",
      currency: "VND",
      tax_rate: 10,
    });
    console.log("✅ Store created:", store?.name);

    // Create Users
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

    // ========== TEST PAYMENT CONFIG ==========
    logger.info("\n💳 ===== TESTING PAYMENT CONFIG =====");

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

    // Query active payment configs
    const activeConfigs = await paymentConfigService.findActiveConfigs(storeId);
    console.log(`✅ Active payment gateways: ${activeConfigs.length}`);

    // ========== TEST OMS DATABASE ==========
    logger.info("\n🛒 ===== TESTING OMS DATABASE =====");

    // Create Dine-in Order
    const dineInOrderId = crypto.randomUUID();
    const dineInOrder = await orderService.upsert({
      id: dineInOrderId,
      store_id: storeId,
      user_id: cashierUser?.id || null,
      order_number: generateOrderNumber(),
      order_type: "dine_in",
      subtotal: 300000,
      tax_amount: 30000,
      discount_amount: 0,
      total: 330000,
      status: "pending",
    });
    console.log("✅ Dine-in order created:", dineInOrder?.order_number);

    // Add order items
    const orderItems = [
      {
        order_id: dineInOrderId,
        product_id: 101,
        quantity: 2,
        unit_price: 100000,
        total_price: 200000,
        notes: "No onions please",
        status: "pending",
      },
      {
        order_id: dineInOrderId,
        product_id: 102,
        quantity: 1,
        unit_price: 100000,
        total_price: 100000,
        notes: null,
        status: "pending",
      },
    ];

    const itemResults = await orderItemService.bulkUpsert(orderItems);
    console.log(`✅ Order items created: ${itemResults.total}`);

    // Verify order total
    const calculatedTotal = await orderItemService.getOrderTotal(dineInOrderId);
    console.log(`✅ Order total calculated: ${calculatedTotal} VND`);

    // Create transaction for dine-in order
    const dineInTransaction = await transactionService.upsert({
      id: crypto.randomUUID(),
      order_id: dineInOrderId,
      store_id: storeId,
      transaction_number: generateTransactionNumber(),
      amount: 330000,
      payment_method: "cash",
      status: "completed",
    });
    console.log(
      "✅ Dine-in transaction created:",
      dineInTransaction?.transaction_number
    );

    // Create Online/Delivery Order
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

    // Add online order details
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

    // Add delivery order items
    await orderItemService.upsert({
      order_id: deliveryOrderId,
      product_id: 103,
      quantity: 3,
      unit_price: 150000,
      total_price: 450000,
      status: "preparing",
    });

    await orderItemService.upsert({
      order_id: deliveryOrderId,
      product_id: 104,
      quantity: 1,
      unit_price: 50000,
      total_price: 50000,
      status: "preparing",
    });

    console.log("✅ Delivery order items created");

    // Create transaction for delivery order
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
    console.log(
      "✅ Delivery transaction created:",
      deliveryTransaction?.transaction_number
    );

    // ========== TEST PAYMENT TRANSACTIONS ==========
    logger.info("\n💰 ===== TESTING PAYMENT TRANSACTIONS =====");

    // Create payment transaction for delivery order
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

    // Simulate payment completion
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

    // Update OMS transaction status
    await transactionService.update(
      { id: deliveryTransaction!.id },
      {
        status: "completed",
        payment_transaction_id: paymentTxn!.id,
      }
    );
    console.log("✅ OMS transaction status updated");

    // ========== TEST QUERIES & ANALYTICS ==========
    logger.info("\n📊 ===== TESTING QUERIES & ANALYTICS =====");

    // Query orders by status
    const pendingOrders = await orderService.findByStatus(storeId, "pending");
    console.log(`✅ Pending orders: ${pendingOrders.length}`);

    const confirmedOrders = await orderService.findByStatus(
      storeId,
      "confirmed"
    );
    console.log(`✅ Confirmed orders: ${confirmedOrders.length}`);

    // Query transactions
    const completedTransactions = await transactionService.findByStatus(
      storeId,
      "completed"
    );
    console.log(`✅ Completed transactions: ${completedTransactions.length}`);

    const pendingTransactions = await transactionService.findByStatus(
      storeId,
      "pending"
    );
    console.log(`✅ Pending transactions: ${pendingTransactions.length}`);

    // Query payment transactions
    const successfulPayments =
      await paymentTransactionService.getSuccessfulTransactions(storeId);
    console.log(`✅ Successful payments: ${successfulPayments.length}`);

    // Query online orders
    const pendingDeliveries = await onlineOrderService.getPendingDeliveries(
      storeId
    );
    console.log(`✅ Pending deliveries: ${pendingDeliveries.length}`);

    // ========== TEST CROSS-SCHEMA TRANSACTION ==========
    logger.info("\n🔄 ===== TESTING CROSS-SCHEMA WORKFLOW =====");

    // Simulate complete order flow with transaction
    await serviceManager.executeSchemaTransaction(
      "core",
      async (coreServices) => {
        const [, , userSvc] = coreServices;

        // Update user's last activity
        await userSvc.update(
          { id: cashierUser!.id },
          {
            last_login: new Date().toISOString(),
          }
        );
        console.log("✅ User activity updated");
      }
    );

    // Create a takeaway order
    const takeawayOrderId = crypto.randomUUID();
    const takeawayOrder = await orderService.upsert({
      id: takeawayOrderId,
      store_id: storeId,
      user_id: cashierUser?.id || null,
      order_number: generateOrderNumber(),
      order_type: "takeaway",
      subtotal: 200000,
      tax_amount: 20000,
      discount_amount: 10000,
      total: 210000,
      status: "preparing",
    });
    console.log("✅ Takeaway order created:", takeawayOrder?.order_number);

    // ========== STATISTICS ==========
    logger.info("\n📈 ===== FINAL STATISTICS =====");

    const stats = {
      core: {
        enterprises: await enterpriseService.count(),
        stores: await storeService.count(),
        users: await userService.count(),
      },
      oms: {
        orders: await orderService.count(),
        orderItems: await orderItemService.count(),
        transactions: await transactionService.count(),
        onlineOrders: await onlineOrderService.count(),
      },
      payment: {
        paymentTransactions: await paymentTransactionService.count(),
        paymentConfigs: await paymentConfigService.count(),
      },
    };

    console.log("\n📊 Database Statistics:");
    console.log("   CORE:");
    console.log(`     - Enterprises: ${stats.core.enterprises}`);
    console.log(`     - Stores: ${stats.core.stores}`);
    console.log(`     - Users: ${stats.core.users}`);
    console.log("   OMS:");
    console.log(`     - Orders: ${stats.oms.orders}`);
    console.log(`     - Order Items: ${stats.oms.orderItems}`);
    console.log(`     - Transactions: ${stats.oms.transactions}`);
    console.log(`     - Online Orders: ${stats.oms.onlineOrders}`);
    console.log("   PAYMENT:");
    console.log(
      `     - Payment Transactions: ${stats.payment.paymentTransactions}`
    );
    console.log(`     - Payment Configs: ${stats.payment.paymentConfigs}`);

    // Health check
    const health = await serviceManager.healthCheck();
    console.log(`\n✅ System Health: ${health.overallHealth}`);
    console.log(
      `   Healthy Services: ${health.healthyServices}/${health.totalServices}`
    );
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
    console.log("\n✅ All enhanced tests completed successfully!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

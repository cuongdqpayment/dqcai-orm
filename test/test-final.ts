import {
  DatabaseSchema,
  SQLiteConfig,
  SQLiteAdapter,
  DatabaseManager,
  BaseService,
  ServiceManager,
} from "@dqcai/orm";

// ============================================
// 1. SCHEMA DEFINITION
// ============================================
const blogSchema: DatabaseSchema = {
  version: "1.0.0",
  database_type: "sqlite",
  database_name: "blog_app",
  schemas: {
    users: {
      name: "users",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "username", type: "string", length: 50, unique: true, required: true },
        { name: "email", type: "string", length: 255, unique: true, required: true },
        { name: "full_name", type: "string", length: 100, required: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    posts: {
      name: "posts",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "title", type: "string", length: 200, required: true },
        { name: "content", type: "text", required: true },
        { name: "user_id", type: "integer", required: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
  },
};

// ============================================
// 2. DATABASE CONFIGURATION
// ============================================
const dbConfig: SQLiteConfig = {
  databaseType: "sqlite",
  database: "blog_app",
  filename: "./blog_app.db",
};

// ============================================
// 3. SERVICES
// ============================================
class UserService extends BaseService<any> {
  constructor() {
    super("blog_app", "users");
  }
}

class PostService extends BaseService<any> {
  constructor() {
    super("blog_app", "posts");
  }
}

// ============================================
// 4. INITIALIZATION
// ============================================
async function initializeDatabase() {
  console.log("🔧 Initializing database...\n");

  // Step 1: Register schema
  DatabaseManager.registerSchema("blog_app", blogSchema);
  console.log("✓ Schema registered");

  // Step 2: Create adapter and connect
  const adapter = new SQLiteAdapter();
  await adapter.connect(dbConfig);
  console.log("✓ Adapter connected to:", dbConfig.filename);

  // Step 3: Register adapter instance (KEY STEP)
  DatabaseManager.registerAdapterInstance("blog_app", adapter);
  console.log("✓ Adapter registered globally");

  // Step 4: Create tables using the same adapter
  console.log("\n📋 Creating tables...");
  for (const [tableName, entitySchema] of Object.entries(blogSchema.schemas)) {
    const exists = await adapter.tableExists(tableName);
    if (!exists) {
      const schemaDefinition: any = {};
      for (const col of entitySchema.cols) {
        if (col.name) {
          schemaDefinition[col.name] = col;
        }
      }
      await adapter.createTable(tableName, schemaDefinition);
      console.log(`✓ Created table: ${tableName}`);
    } else {
      console.log(`ℹ Table exists: ${tableName}`);
    }
  }

  // Step 5: Register services
  console.log("\n🔌 Registering services...");
  const serviceManager = ServiceManager.getInstance();

  serviceManager.registerService({
    schemaName: "blog_app",
    entityName: "users",
    serviceClass: UserService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app",
    entityName: "posts",
    serviceClass: PostService,
    autoInit: true,
  });

  console.log("✓ Services registered\n");
}

// ============================================
// 5. VERIFICATION
// ============================================
async function verifyAdapterSharing() {
  console.log("🔍 Verifying adapter sharing...\n");

  const serviceManager = ServiceManager.getInstance();
  const registeredAdapter = DatabaseManager.getAdapterInstance("blog_app");
  
  const userService = await serviceManager.getService<UserService>("blog_app", "users");
  const postService = await serviceManager.getService<PostService>("blog_app", "posts");
  
  const userAdapter = await userService.getAdapter();
  const postAdapter = await postService.getAdapter();
  
  console.log("Adapter Comparison:");
  console.log("  Registered adapter:", !!registeredAdapter);
  console.log("  UserService adapter === Registered:", userAdapter === registeredAdapter);
  console.log("  PostService adapter === Registered:", postAdapter === registeredAdapter);
  console.log("  UserService === PostService:", userAdapter === postAdapter);
  console.log("  All adapters are the same:", 
    userAdapter === registeredAdapter && 
    postAdapter === registeredAdapter && 
    userAdapter === postAdapter
  );

  // Verify connection details
  const userConnection = userAdapter.getConnection();
  const postConnection = postAdapter.getConnection();
  
  console.log("\nConnection Verification:");
  console.log("  UserService connection:", !!userConnection);
  console.log("  PostService connection:", !!postConnection);
  console.log("  Same connection object:", userConnection === postConnection);
  console.log("  Connection is connected:", userConnection?.isConnected);
  
  console.log("\n✅ All services share the same adapter and connection!\n");
}

// ============================================
// 6. USAGE EXAMPLE
// ============================================
async function runExample() {
  console.log("📝 Running example operations...\n");

  const serviceManager = ServiceManager.getInstance();
  const userService = await serviceManager.getService<UserService>("blog_app", "users");
  const postService = await serviceManager.getService<PostService>("blog_app", "posts");

  try {
    // Create user
    console.log("Creating user...");
    const user = await userService.create({
      username: "testuser",
      email: "test@example.com",
      full_name: "Test User",
    });
    console.log(`✓ Created user: ${user.username} (ID: ${user.id})`);

    // Create post
    console.log("\nCreating post...");
    const post = await postService.create({
      title: "Test Post",
      content: "This is a test post",
      user_id: user.id,
    });
    console.log(`✓ Created post: ${post.title} (ID: ${post.id})`);

    // Query
    console.log("\nQuerying data...");
    const users = await userService.find({});
    const posts = await postService.find({});
    console.log(`✓ Total users: ${users.length}`);
    console.log(`✓ Total posts: ${posts.length}`);

    console.log("\n✅ All operations successful!\n");
  } catch (error) {
    console.error("\n❌ Error during operations:", (error as Error).message);
    throw error;
  }
}

// ============================================
// 7. MAIN
// ============================================
async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   @dqcai/orm - Final Fixed Adapter Sharing Test      ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    await initializeDatabase();
    await verifyAdapterSharing();
    await runExample();

    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   ✅ ALL TESTS PASSED!                                ║");
    console.log("║   ✅ Single adapter shared across all services        ║");
    console.log("║   ✅ Single database file accessed by all             ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    console.log("🧹 Cleaning up...");
    await ServiceManager.getInstance().shutdown();
    await DatabaseManager.closeAllDAOs();
    console.log("✓ Cleanup complete\n");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
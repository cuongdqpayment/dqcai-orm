import {
  DatabaseSchema,
  SQLiteConfig,
  SQLiteAdapter,
  DatabaseManager,
  BaseService,
  ServiceManager,
} from "@dqcai/orm";


// import { createModuleLogger, APPModules } from "../logger";
// const logger = createModuleLogger(APPModules.TEST_ORM);

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
        { name: "password_hash", type: "string", length: 255, required: true },
        { name: "full_name", type: "string", length: 100, required: true },
        { name: "bio", type: "text", nullable: true },
        { name: "is_active", type: "boolean", default: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    posts: {
      name: "posts",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "title", type: "string", length: 200, required: true },
        { name: "slug", type: "string", length: 250, unique: true, required: true },
        { name: "content", type: "text", required: true },
        { name: "user_id", type: "integer", required: true },
        { name: "status", type: "string", length: 20, default: "draft" },
        { name: "view_count", type: "integer", default: 0 },
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
// 3. TYPE DEFINITIONS
// ============================================
interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  bio?: string;
  is_active: boolean;
  created_at: Date;
}

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  user_id: number;
  status: "draft" | "published" | "archived";
  view_count: number;
  created_at: Date;
}

// ============================================
// 4. SERVICE DEFINITIONS
// ============================================
class UserService extends BaseService<User> {
  constructor() {
    super("blog_app", "users");
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne({ username });
  }

  protected async afterCreate(result: User): Promise<User> {
    console.log(`✓ User created: ${result.username} (ID: ${result.id})`);
    return result;
  }
}

class PostService extends BaseService<Post> {
  constructor() {
    super("blog_app", "posts");
  }

  async findBySlug(slug: string): Promise<Post | null> {
    return this.findOne({ slug });
  }

  protected async beforeCreate(data: Partial<Post>): Promise<Partial<Post>> {
    if (!data.slug && data.title) {
      data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
    }
    return data;
  }

  protected async afterCreate(result: Post): Promise<Post> {
    console.log(`✓ Post created: ${result.title} (ID: ${result.id})`);
    return result;
  }
}

// ============================================
// 5. INITIALIZATION (✅ SIMPLIFIED - AUTO ADAPTER SHARING)
// ============================================
async function initializeDatabase() {
  console.log("🔧 Initializing database with auto adapter sharing...\n");

  // ✅ STEP 1: Register schema
  DatabaseManager.registerSchema("blog_app", blogSchema);
  console.log("✓ Schema registered");

  // ✅ STEP 2: Create and connect adapter
  const adapter = new SQLiteAdapter();
  await adapter.connect(dbConfig);
  console.log("✓ Adapter connected");

  // ✅ STEP 3: Register adapter instance
  // KEY: Đăng ký adapter này sẽ được tự động sử dụng bởi tất cả DAOs và Services
  DatabaseManager.registerAdapterInstance("blog_app", adapter);
  console.log("✓ Adapter registered globally");

  // ✅ STEP 4: Create tables
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
      console.log(`✓ Table '${tableName}' created`);
    } else {
      console.log(`ℹ Table '${tableName}' already exists`);
    }
  }

  // ✅ STEP 5: Register services
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

  console.log("✓ All services registered");

  // ✅ STEP 6: Verify adapter sharing
  console.log("\n🔍 Verifying adapter sharing...");
  const userService = await serviceManager.getService<UserService>("blog_app", "users");
  const postService = await serviceManager.getService<PostService>("blog_app", "posts");
  
  const userAdapter = await userService.getAdapter();
  const postAdapter = await postService.getAdapter();
  
  console.log("✓ UserService adapter === registered adapter:", userAdapter === adapter);
  console.log("✓ PostService adapter === registered adapter:", postAdapter === adapter);
  console.log("✓ UserService adapter === PostService adapter:", userAdapter === postAdapter);
  console.log("✓ All services share the same adapter instance!\n");
}

// ============================================
// 6. USAGE EXAMPLES
// ============================================
async function runExamples() {
  console.log("📝 Running examples...\n");

  const serviceManager = ServiceManager.getInstance();
  const userService = await serviceManager.getService<UserService>("blog_app", "users");
  const postService = await serviceManager.getService<PostService>("blog_app", "posts");

  // Example 1: Create user
  console.log("Example 1: Creating user...");
  const user = await userService.create({
    username: "johndoe",
    email: "john@example.com",
    password_hash: "hashed_password",
    full_name: "John Doe",
    bio: "Software developer",
  });
  console.log(`Created: ${user.username}\n`);

  // Example 2: Create posts
  console.log("Example 2: Creating posts...");
  await postService.create({
    title: "Getting Started with TypeScript",
    content: "TypeScript is amazing...",
    user_id: user.id,
  });
  
  await postService.create({
    title: "Building an ORM",
    content: "Let's build an ORM...",
    user_id: user.id,
  });
  console.log("Posts created\n");

  // Example 3: Query data
  console.log("Example 3: Querying data...");
  const foundUser = await userService.findByUsername("johndoe");
  console.log(`Found user: ${foundUser?.full_name}`);

  const userPosts = await postService.find({ user_id: user.id });
  console.log(`User has ${userPosts.length} posts`);
  
  userPosts.forEach(post => {
    console.log(`  - ${post.title} (${post.slug})`);
  });
  console.log();

  // Example 4: Statistics
  console.log("Example 4: Database statistics...");
  const totalUsers = await userService.count();
  const totalPosts = await postService.count();
  console.log(`Total users: ${totalUsers}`);
  console.log(`Total posts: ${totalPosts}\n`);

  // Example 5: Verify same database
  console.log("Example 5: Verifying same database access...");
  const status = DatabaseManager.getStatus();
  console.log(`Schemas: ${status.schemas}`);
  console.log(`DAOs: ${status.daos}`);
  console.log(`Adapter instances: ${status.adapterInstances}`);
  console.log(`Active connections: ${status.activeConnections.join(", ")}`);
  console.log("✓ All services accessing the same database!\n");
}

// ============================================
// 7. MAIN EXECUTION
// ============================================
async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║   @dqcai/orm - Auto Adapter Sharing Demo             ║");
    console.log("║   No Manual Adapter Management Required!             ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Initialize with auto adapter sharing
    await initializeDatabase();

    // Run examples
    await runExamples();

    console.log("✅ All operations completed successfully!");
    console.log("✅ All services automatically shared the same adapter!");
    console.log("✅ No manual adapter management needed!\n");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    // Cleanup
    console.log("🧹 Cleaning up...");
    await ServiceManager.getInstance().shutdown();
    await DatabaseManager.closeAllDAOs();
    console.log("✓ Cleanup complete\n");
  }
}

// Run the application
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
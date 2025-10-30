import {
  DatabaseSchema,
  SQLiteConfig,
  SQLiteAdapter,
  DatabaseManager,
  BaseService,
  ServiceManager,
  QueryFilter,
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
        {
          name: "username",
          type: "string",
          length: 50,
          unique: true,
          required: true,
        },
        {
          name: "email",
          type: "string",
          length: 255,
          unique: true,
          required: true,
        },
        { name: "password_hash", type: "string", length: 255, required: true },
        { name: "full_name", type: "string", length: 100, required: true },
        { name: "bio", type: "text", nullable: true },
        { name: "avatar_url", type: "string", length: 500, nullable: true },
        { name: "is_active", type: "boolean", default: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
        { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    posts: {
      name: "posts",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "title", type: "string", length: 200, required: true },
        {
          name: "slug",
          type: "string",
          length: 250,
          unique: true,
          required: true,
        },
        { name: "content", type: "text", required: true },
        { name: "excerpt", type: "text", nullable: true },
        { name: "user_id", type: "integer", required: true },
        { name: "status", type: "string", length: 20, default: "draft" },
        { name: "view_count", type: "integer", default: 0 },
        { name: "published_at", type: "timestamp", nullable: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
        { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    comments: {
      name: "comments",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "post_id", type: "integer", required: true },
        { name: "user_id", type: "integer", required: true },
        { name: "parent_id", type: "integer", nullable: true },
        { name: "content", type: "text", required: true },
        { name: "is_approved", type: "boolean", default: false },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    tags: {
      name: "tags",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        {
          name: "name",
          type: "string",
          length: 50,
          unique: true,
          required: true,
        },
        {
          name: "slug",
          type: "string",
          length: 60,
          unique: true,
          required: true,
        },
        { name: "description", type: "text", nullable: true },
      ],
    },
    post_tags: {
      name: "post_tags",
      cols: [
        { name: "id", type: "integer", primaryKey: true, autoIncrement: true },
        { name: "post_id", type: "integer", required: true },
        { name: "tag_id", type: "integer", required: true },
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
  // For File uncomment line below
  // filename: "./blog_app.db",
  // For in-memory: 
  memory: true
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
  avatar_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  user_id: number;
  status: "draft" | "published" | "archived";
  view_count: number;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id?: number;
  content: string;
  is_approved: boolean;
  created_at: Date;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface PostTag {
  id: number;
  post_id: number;
  tag_id: number;
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

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  async getActiveUsers(): Promise<User[]> {
    return this.find({ is_active: true });
  }

  async searchUsers(searchTerm: string): Promise<User[]> {
    return this.find({
      $or: [
        { username: { $like: `%${searchTerm}%` } },
        { full_name: { $like: `%${searchTerm}%` } },
      ],
    });
  }

  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    // Validate email format
    if (!data.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error("Invalid email format");
    }

    // Validate username
    if (!data.username?.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      throw new Error(
        "Username must be 3-30 characters (letters, numbers, underscore)"
      );
    }

    // Check for duplicates
    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) {
      throw new Error("Email already exists");
    }

    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new Error("Username already exists");
    }

    return data;
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

  async getPublishedPosts(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Post[]> {
    return this.find(
      { status: "published", published_at: { $exists: true } },
      {
        sort: { published_at: -1 },
        limit: options?.limit || 10,
        offset: options?.offset || 0,
      }
    );
  }

  async getPostsByUser(userId: number): Promise<Post[]> {
    return this.find({ user_id: userId }, { sort: { created_at: -1 } });
  }

  async getDraftsByUser(userId: number): Promise<Post[]> {
    return this.find({ user_id: userId, status: "draft" });
  }

  async publishPost(postId: number): Promise<boolean> {
    return this.updateById(postId, {
      status: "published",
      published_at: new Date().toISOString() as any,
    });
  }

  async incrementViewCount(postId: number): Promise<void> {
    const post = await this.findById(postId);
    if (post) {
      await this.updateById(postId, {
        view_count: post.view_count + 1,
      });
    }
  }

  async getPopularPosts(limit: number = 10): Promise<Post[]> {
    return this.find(
      { status: "published" },
      { sort: { view_count: -1 }, limit }
    );
  }

  async searchPosts(searchTerm: string): Promise<Post[]> {
    return this.find({
      status: "published",
      $or: [
        { title: { $like: `%${searchTerm}%` } },
        { content: { $like: `%${searchTerm}%` } },
      ],
    });
  }

  protected async beforeCreate(data: Partial<Post>): Promise<Partial<Post>> {
    // Generate slug from title if not provided
    if (!data.slug && data.title) {
      data.slug = this.generateSlug(data.title);
    }

    // Generate excerpt from content if not provided
    if (!data.excerpt && data.content) {
      data.excerpt = data.content.substring(0, 200) + "...";
    }

    // Set default status
    if (!data.status) {
      data.status = "draft";
    }

    return data;
  }

  protected async afterCreate(result: Post): Promise<Post> {
    console.log(`✓ Post created: ${result.title} (ID: ${result.id})`);
    return result;
  }

  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now()
    );
  }
}

class CommentService extends BaseService<Comment> {
  constructor() {
    super("blog_app", "comments");
  }

  async getCommentsByPost(postId: number): Promise<Comment[]> {
    return this.find(
      { post_id: postId, is_approved: true },
      { sort: { created_at: -1 } }
    );
  }

  async getPendingComments(): Promise<Comment[]> {
    return this.find({ is_approved: false }, { sort: { created_at: 1 } });
  }

  async approveComment(commentId: number): Promise<boolean> {
    return this.updateById(commentId, { is_approved: true });
  }

  async getCommentsByUser(userId: number): Promise<Comment[]> {
    return this.find({ user_id: userId }, { sort: { created_at: -1 } });
  }

  async getReplies(parentId: number): Promise<Comment[]> {
    return this.find({ parent_id: parentId }, { sort: { created_at: 1 } });
  }

  protected async afterCreate(result: Comment): Promise<Comment> {
    console.log(`✓ Comment created (ID: ${result.id})`);
    return result;
  }
}

class TagService extends BaseService<Tag> {
  constructor() {
    super("blog_app", "tags");
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.findOne({ slug });
  }

  async findByName(name: string): Promise<Tag | null> {
    return this.findOne({ name });
  }

  protected async beforeCreate(data: Partial<Tag>): Promise<Partial<Tag>> {
    // Generate slug from name if not provided
    if (!data.slug && data.name) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    return data;
  }
}

class PostTagService extends BaseService<PostTag> {
  constructor() {
    super("blog_app", "post_tags");
  }

  async addTagToPost(postId: number, tagId: number): Promise<PostTag> {
    // Check if already exists
    const existing = await this.findOne({ post_id: postId, tag_id: tagId });
    if (existing) {
      return existing;
    }
    return this.create({ post_id: postId, tag_id: tagId });
  }

  async removeTagFromPost(postId: number, tagId: number): Promise<boolean> {
    return this.deleteOne({ post_id: postId, tag_id: tagId });
  }

  async getTagsForPost(postId: number): Promise<number[]> {
    const postTags = await this.find({ post_id: postId });
    return postTags.map((pt) => pt.tag_id);
  }

  async getPostsForTag(tagId: number): Promise<number[]> {
    const postTags = await this.find({ tag_id: tagId });
    return postTags.map((pt) => pt.post_id);
  }
}

// ============================================
// 5. INITIALIZATION (FIXED)
// ============================================
async function initializeDatabase() {
  console.log("🔧 Initializing database...\n");

  // 1. Register schema FIRST
  DatabaseManager.registerSchema("blog_app", blogSchema);
  console.log("✓ Schema registered");

  // 2. Create and connect adapter
  const adapter = new SQLiteAdapter();
  await adapter.connect(dbConfig);
  console.log("✓ Database connected");

  // 3. Register adapter instance in DatabaseManager
  // This is the KEY FIX - register adapter BEFORE creating DAO
  DatabaseManager.registerAdapterInstance("blog_app", adapter);
  console.log("✓ Adapter registered in DatabaseManager");

  // 4. Create DAO using the registered adapter
  // Now when DAO is created, it will use the adapter we just registered
  await DatabaseManager.getDAO("blog_app");
  console.log("✓ DAO created with shared adapter");

  // 5. Verify adapter is shared
  const registeredAdapter = DatabaseManager.getAdapterInstance("blog_app");
  console.log("✓ Adapter verification:", registeredAdapter === adapter);

  // 6. Create tables using the shared adapter
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

  // 7. Register services
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

  serviceManager.registerService({
    schemaName: "blog_app",
    entityName: "comments",
    serviceClass: CommentService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app",
    entityName: "tags",
    serviceClass: TagService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app",
    entityName: "post_tags",
    serviceClass: PostTagService,
    autoInit: true,
  });

  console.log("✓ All services registered\n");

  // 8. Test that services use the same adapter
  console.log("🔍 Verifying adapter sharing...");
  const userService = await serviceManager.getService<UserService>(
    "blog_app",
    "users"
  );
  
  // Try to create a test user to verify database access
  try {
    await userService.create({
      username: "test_init",
      email: "test@init.com",
      password_hash: "test_hash",
      full_name: "Test Init User",
    });
    console.log("✓ Services can access the same database\n");
  } catch (error) {
    console.log("ℹ Test user creation:", (error as Error).message, "\n");
  }
}

// ============================================
// 6. USAGE EXAMPLES (Same as before)
// ============================================

async function example1_BasicCRUD() {
  console.log("📝 Example 1: Basic CRUD Operations\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app",
      "users"
    );

  // CREATE
  const user = await userService.create({
    username: "johndoe",
    email: "john@example.com",
    password_hash: "hashed_password_here",
    full_name: "John Doe",
    bio: "Software developer and blogger",
  });
  console.log("Created user:", user.username);

  // READ
  const foundUser = await userService.findByEmail("john@example.com");
  console.log("Found user:", foundUser?.full_name);

  // UPDATE
  await userService.updateById(user.id, {
    bio: "Senior software developer and tech blogger",
  });
  console.log("Updated user bio");

  console.log();
}

async function example2_AdvancedQueries() {
  console.log("🔍 Example 2: Advanced Query Operations\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app",
      "users"
    );

  // Search users
  const searchResults = await userService.searchUsers("john");
  console.log(`Search 'john': Found ${searchResults.length} users`);

  // Get active users with pagination
  const activeUsers = await userService.find(
    { is_active: true },
    { limit: 10, offset: 0, sort: { created_at: -1 } }
  );
  console.log(`Active users: ${activeUsers.length}`);

  console.log();
}

async function example3_Relationships() {
  console.log("🔗 Example 3: Working with Relationships\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app",
      "posts"
    );

  // Get user
  const user = await userService.findByUsername("johndoe");
  if (!user) {
    console.log("User not found");
    return;
  }

  // Create posts for user
  const post1 = await postService.create({
    title: "Getting Started with TypeScript",
    content: "TypeScript is a powerful superset of JavaScript...",
    user_id: user.id,
    status: "draft",
  });

  const post2 = await postService.create({
    title: "Advanced ORM Techniques",
    content: "Building a flexible ORM requires...",
    user_id: user.id,
    status: "draft",
  });

  console.log(`Created ${2} posts for user: ${user.username}`);

  // Publish a post
  await postService.publishPost(post1.id);
  console.log(`Published post: ${post1.title}`);

  // Get all posts by user
  const userPosts = await postService.getPostsByUser(user.id);
  console.log(`User has ${userPosts.length} total posts`);

  console.log();
}

async function example4_Tags() {
  console.log("🏷️  Example 4: Tags and Many-to-Many Relationships\n");

  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app",
      "posts"
    );
  const tagService = await ServiceManager.getInstance().getService<TagService>(
    "blog_app",
    "tags"
  );
  const postTagService =
    await ServiceManager.getInstance().getService<PostTagService>(
      "blog_app",
      "post_tags"
    );

  // Create tags
  const tag1 = await tagService.create({
    name: "TypeScript",
    description: "Posts about TypeScript programming",
  });

  const tag2 = await tagService.create({
    name: "ORM",
    description: "Object-Relational Mapping topics",
  });

  console.log("✓ Created 2 tags");

  // Get a post
  const posts = await postService.find({}, { limit: 1 });
  if (posts.length === 0) {
    console.log("No posts available");
    return;
  }

  const post = posts[0];

  // Add tags to post
  await postTagService.addTagToPost(post.id, tag1.id);
  await postTagService.addTagToPost(post.id, tag2.id);
  console.log(`✓ Added 2 tags to post: ${post.title}`);

  // Get tags for post
  const postTagIds = await postTagService.getTagsForPost(post.id);
  console.log(`Post has ${postTagIds.length} tags`);

  console.log();
}

async function example5_Comments() {
  console.log("💬 Example 5: Comments and Nested Data\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app",
      "posts"
    );
  const commentService =
    await ServiceManager.getInstance().getService<CommentService>(
      "blog_app",
      "comments"
    );

  // Get user and post
  const user = await userService.findByUsername("johndoe");
  const posts = await postService.getPublishedPosts({ limit: 1 });

  if (!user || posts.length === 0) {
    console.log("User or post not found");
    return;
  }

  const post = posts[0];

  // Create root comment
  const comment1 = await commentService.create({
    post_id: post.id,
    user_id: user.id,
    content: "Great article! Very informative.",
    is_approved: true,
  });

  console.log(`✓ Created comment on post: ${post.title}`);

  // Get all comments for post
  const postComments = await commentService.getCommentsByPost(post.id);
  console.log(`Post has ${postComments.length} approved comments`);

  console.log();
}

async function example6_Statistics() {
  console.log("📊 Example 6: Database Statistics\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app",
      "posts"
    );
  const commentService =
    await ServiceManager.getInstance().getService<CommentService>(
      "blog_app",
      "comments"
    );

  // Count statistics
  const totalUsers = await userService.count();
  const activeUsers = await userService.count({ is_active: true });
  const totalPosts = await postService.count();
  const publishedPosts = await postService.count({ status: "published" });
  const totalComments = await commentService.count();

  console.log("Database Statistics:");
  console.log(`  Total Users: ${totalUsers} (${activeUsers} active)`);
  console.log(`  Total Posts: ${totalPosts} (${publishedPosts} published)`);
  console.log(`  Total Comments: ${totalComments}`);

  console.log();
}

// ============================================
// 7. MAIN EXECUTION
// ============================================
async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║     @dqcai/orm SQLite Blog Application Demo          ║");
    console.log("║     (Fixed Adapter Sharing Version)                   ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Initialize
    await initializeDatabase();

    // Run examples
    await example1_BasicCRUD();
    await example2_AdvancedQueries();
    await example3_Relationships();
    await example4_Tags();
    await example5_Comments();
    await example6_Statistics();

    console.log("✅ All examples completed successfully!\n");
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
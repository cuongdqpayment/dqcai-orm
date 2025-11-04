import {
  DatabaseSchema,
  MongoDBConfig,
  MongoDBAdapter,
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
  database_type: "mongodb",
  database_name: "blog_app_mongo",
  schemas: {
    users: {
      name: "users",
      cols: [
        { name: "_id", type: "string", primaryKey: true },
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
        { name: "_id", type: "string", primaryKey: true },
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
        { name: "user_id", type: "string", required: true },
        { name: "status", type: "string", length: 20, default: "draft" },
        { name: "view_count", type: "number", default: 0 },
        { name: "published_at", type: "timestamp", nullable: true },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
        { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    comments: {
      name: "comments",
      cols: [
        { name: "_id", type: "string", primaryKey: true },
        { name: "post_id", type: "string", required: true },
        { name: "user_id", type: "string", required: true },
        { name: "parent_id", type: "string", nullable: true },
        { name: "content", type: "text", required: true },
        { name: "is_approved", type: "boolean", default: false },
        { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
    tags: {
      name: "tags",
      cols: [
        { name: "_id", type: "string", primaryKey: true },
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
        { name: "_id", type: "string", primaryKey: true },
        { name: "post_id", type: "string", required: true },
        { name: "tag_id", type: "string", required: true },
      ],
    },
  },
};

// ============================================
// 2. DATABASE CONFIGURATION
// ============================================
const dbConfig: MongoDBConfig = {
  databaseType: "mongodb",
  database: "blog_app_mongo",
  url: "mongodb://admin:Cng888xHome@127.0.0.1:27017/blog_content?authSource=admin",
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
  },
};

// ============================================
// 3. TYPE DEFINITIONS
// ============================================
interface User {
  id: string;
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
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  user_id: string;
  status: "draft" | "published" | "archived";
  view_count: number;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  is_approved: boolean;
  created_at: Date;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface PostTag {
  id: string;
  post_id: string;
  tag_id: string;
}

// ============================================
// 4. SERVICE DEFINITIONS
// ============================================

class UserService extends BaseService<User> {
  constructor() {
    super("blog_app_mongo", "users");
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
        { username: { $regex: searchTerm, $options: "i" } },
        { full_name: { $regex: searchTerm, $options: "i" } },
      ],
    } as any);
  }

  protected async beforeCreate(data: Partial<User>): Promise<Partial<User>> {
    if (!data.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error("Invalid email format");
    }

    if (!data.username?.match(/^[a-zA-Z0-9_]{3,30}$/)) {
      throw new Error(
        "Username must be 3-30 characters (letters, numbers, underscore)"
      );
    }

    // điều kiện trùng email và username sẽ được xử lý trong upsert rồi nhé
    // const existingEmail = await this.findByEmail(data.email);
    // if (existingEmail) {
    //   throw new Error("Email already exists");
    // }

    // const existingUsername = await this.findByUsername(data.username);
    // if (existingUsername) {
    //   throw new Error("Username already exists");
    // }

    return data;
  }

  protected async afterCreate(result: User): Promise<User> {
    console.log(`✓ User created: ${result.username} (ID: ${result.id})`);
    return result;
  }
}

class PostService extends BaseService<Post> {
  constructor() {
    super("blog_app_mongo", "posts");
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

  async getPostsByUser(userId: string): Promise<Post[]> {
    return this.find({ user_id: userId }, { sort: { created_at: -1 } });
  }

  async getDraftsByUser(userId: string): Promise<Post[]> {
    return this.find({ user_id: userId, status: "draft" });
  }

  async publishPost(postId: string): Promise<boolean> {
    return this.updateById(postId, {
      status: "published",
      published_at: new Date() as any,
    });
  }

  async incrementViewCount(postId: string): Promise<void> {
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
        { title: { $regex: searchTerm, $options: "i" } },
        { content: { $regex: searchTerm, $options: "i" } },
      ],
    } as any);
  }

  protected async beforeCreate(data: Partial<Post>): Promise<Partial<Post>> {
    if (!data.slug && data.title) {
      data.slug = this.generateSlug(data.title);
    }

    if (!data.excerpt && data.content) {
      data.excerpt = data.content.substring(0, 200) + "...";
    }

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
    super("blog_app_mongo", "comments");
  }

  async getCommentsByPost(postId: string): Promise<Comment[]> {
    return this.find(
      { post_id: postId, is_approved: true },
      { sort: { created_at: -1 } }
    );
  }

  async getPendingComments(): Promise<Comment[]> {
    return this.find({ is_approved: false }, { sort: { created_at: 1 } });
  }

  async approveComment(commentId: string): Promise<boolean> {
    return this.updateById(commentId, { is_approved: true });
  }

  async getCommentsByUser(userId: string): Promise<Comment[]> {
    return this.find({ user_id: userId }, { sort: { created_at: -1 } });
  }

  async getReplies(parentId: string): Promise<Comment[]> {
    return this.find({ parent_id: parentId }, { sort: { created_at: 1 } });
  }

  protected async afterCreate(result: Comment): Promise<Comment> {
    console.log(`✓ Comment created (ID: ${result.id})`);
    return result;
  }
}

class TagService extends BaseService<Tag> {
  constructor() {
    super("blog_app_mongo", "tags");
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.findOne({ slug });
  }

  async findByName(name: string): Promise<Tag | null> {
    return this.findOne({ name });
  }

  protected async beforeCreate(data: Partial<Tag>): Promise<Partial<Tag>> {
    if (!data.slug && data.name) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    }
    return data;
  }
}

class PostTagService extends BaseService<PostTag> {
  constructor() {
    super("blog_app_mongo", "post_tags");
  }

  async addTagToPost(postId: string, tagId: string): Promise<PostTag> {
    const existing = await this.findOne({ post_id: postId, tag_id: tagId });
    if (existing) {
      return existing;
    }
    return this.create({ post_id: postId, tag_id: tagId });
  }

  async removeTagFromPost(postId: string, tagId: string): Promise<boolean> {
    return this.deleteOne({ post_id: postId, tag_id: tagId });
  }

  async getTagsForPost(postId: string): Promise<string[]> {
    const postTags = await this.find({ post_id: postId });
    return postTags.map((pt) => pt.tag_id);
  }

  async getPostsForTag(tagId: string): Promise<string[]> {
    const postTags = await this.find({ tag_id: tagId });
    return postTags.map((pt) => pt.post_id);
  }
}

// ============================================
// 5. INITIALIZATION
// ============================================
async function initializeDatabase() {
  console.log("🔧 Initializing MongoDB database...\n");

  DatabaseManager.registerSchema("blog_app_mongo", blogSchema);
  console.log("✓ Schema registered");

  const adapter = new MongoDBAdapter();
  await adapter.connect(dbConfig);
  console.log("✓ Database connected");

  DatabaseManager.registerAdapterInstance("blog_app_mongo", adapter);
  console.log("✓ Adapter registered in DatabaseManager");

  await DatabaseManager.getDAO("blog_app_mongo");
  console.log("✓ DAO created with shared adapter");

  const registeredAdapter =
    DatabaseManager.getAdapterInstance("blog_app_mongo");
  console.log("✓ Adapter verification:", registeredAdapter === adapter);

  console.log("\n📋 Creating collections...");
  for (const [collectionName, entitySchema] of Object.entries(
    blogSchema.schemas
  )) {
    const exists = await adapter.tableExists(collectionName);
    if (!exists) {
      const schemaDefinition: any = {};
      for (const col of entitySchema.cols) {
        if (col.name) {
          schemaDefinition[col.name] = col;
        }
      }
      await adapter.createTable(collectionName, schemaDefinition);
      console.log(`✓ Collection '${collectionName}' created`);
    } else {
      console.log(`ℹ Collection '${collectionName}' already exists`);
    }
  }

  console.log("\n🔌 Registering services...");
  const serviceManager = ServiceManager.getInstance();

  serviceManager.registerService({
    schemaName: "blog_app_mongo",
    entityName: "users",
    serviceClass: UserService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app_mongo",
    entityName: "posts",
    serviceClass: PostService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app_mongo",
    entityName: "comments",
    serviceClass: CommentService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app_mongo",
    entityName: "tags",
    serviceClass: TagService,
    autoInit: true,
  });

  serviceManager.registerService({
    schemaName: "blog_app_mongo",
    entityName: "post_tags",
    serviceClass: PostTagService,
    autoInit: true,
  });

  console.log("✓ All services registered\n");

  console.log("🔍 Verifying adapter sharing...");
  const userService = await serviceManager.getService<UserService>(
    "blog_app_mongo",
    "users"
  );

  try {
    await userService.upsert(
      {
        email: "test@init.com",
      },
      {
        username: "test_init",
        email: "test@init.com",
        password_hash: "test_hash",
        full_name: "Test Init User",
      }
    );
    console.log("✓ Services can access the same database\n");
  } catch (error) {
    console.log("ℹ Test user creation:", (error as Error).message, "\n");
  }
}

// ============================================
// 6. USAGE EXAMPLES
// ============================================

async function example1_BasicCRUD() {
  console.log("📝 Example 1: Basic CRUD Operations\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app_mongo",
      "users"
    );

  const user = await userService.upsert(
    { email: "john@example.com" },
    {
      username: "johndoe",
      email: "john@example.com",
      password_hash: "hashed_password_here",
      full_name: "John Doe",
      bio: "Software developer and blogger",
    }
  );
  console.log("Created user:", user.username);

  const foundUser = await userService.findByEmail("john@example.com");
  console.log("Found user:", foundUser?.full_name);

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
      "blog_app_mongo",
      "users"
    );

  const searchResults = await userService.searchUsers("john");
  console.log(`Search 'john': Found ${searchResults.length} users`);

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
      "blog_app_mongo",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app_mongo",
      "posts"
    );

  const user = await userService.findByUsername("johndoe");
  if (!user) {
    console.log("User not found");
    return;
  }

  const post1 = await postService.create({
    title: "Getting Started with MongoDB",
    content: "MongoDB is a powerful NoSQL database...",
    user_id: user.id,
    status: "draft",
  });

  const post2 = await postService.create({
    title: "Advanced Aggregation Techniques",
    content: "MongoDB aggregation pipeline is...",
    user_id: user.id,
    status: "draft",
  });

  console.log(`Created ${2} posts for user: ${user.username}`);

  await postService.publishPost(post1.id);
  console.log(`Published post: ${post1.title}`);

  const userPosts = await postService.getPostsByUser(user.id);
  console.log(`User has ${userPosts.length} total posts`);

  console.log();
}

async function example4_Tags() {
  console.log("🏷️  Example 4: Tags and Many-to-Many Relationships\n");

  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app_mongo",
      "posts"
    );
  const tagService = await ServiceManager.getInstance().getService<TagService>(
    "blog_app_mongo",
    "tags"
  );
  const postTagService =
    await ServiceManager.getInstance().getService<PostTagService>(
      "blog_app_mongo",
      "post_tags"
    );

  const tag1 = await tagService.create({
    name: "MongoDB",
    description: "Posts about MongoDB database",
  });

  const tag2 = await tagService.create({
    name: "NoSQL",
    description: "NoSQL database topics",
  });

  console.log("✓ Created 2 tags");

  const posts = await postService.find({}, { limit: 1 });
  if (posts.length === 0) {
    console.log("No posts available");
    return;
  }

  const post = posts[0];

  await postTagService.addTagToPost(post.id, tag1.id);
  await postTagService.addTagToPost(post.id, tag2.id);
  console.log(`✓ Added 2 tags to post: ${post.title}`);

  const postTagIds = await postTagService.getTagsForPost(post.id);
  console.log(`Post has ${postTagIds.length} tags`);

  console.log();
}

async function example5_Comments() {
  console.log("💬 Example 5: Comments and Nested Data\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app_mongo",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app_mongo",
      "posts"
    );
  const commentService =
    await ServiceManager.getInstance().getService<CommentService>(
      "blog_app_mongo",
      "comments"
    );

  const user = await userService.findByUsername("johndoe");
  const posts = await postService.getPublishedPosts({ limit: 1 });

  if (!user || posts.length === 0) {
    console.log("User or post not found");
    return;
  }

  const post = posts[0];

  await commentService.create({
    post_id: post.id,
    user_id: user.id,
    content: "Great article! Very informative.",
    is_approved: true,
  });

  console.log(`✓ Created comment on post: ${post.title}`);

  const postComments = await commentService.getCommentsByPost(post.id);
  console.log(`Post has ${postComments.length} approved comments`);

  console.log();
}

async function example6_Statistics() {
  console.log("📊 Example 6: Database Statistics\n");

  const userService =
    await ServiceManager.getInstance().getService<UserService>(
      "blog_app_mongo",
      "users"
    );
  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app_mongo",
      "posts"
    );
  const commentService =
    await ServiceManager.getInstance().getService<CommentService>(
      "blog_app_mongo",
      "comments"
    );

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

async function example7_MongoAggregation() {
  console.log("🔢 Example 7: MongoDB Aggregation Pipeline\n");

  const postService =
    await ServiceManager.getInstance().getService<PostService>(
      "blog_app_mongo",
      "posts"
    );

  const adapter = await postService.getAdapter();

  // Aggregate posts by status
  const postsByStatus = await adapter.aggregate("posts", [
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgViews: { $avg: "$view_count" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  console.log("Posts by status:");
  postsByStatus.forEach((stat: any) => {
    console.log(
      `  ${stat._id}: ${stat.count} posts, avg views: ${Math.round(
        stat.avgViews || 0
      )}`
    );
  });

  // Top 5 users by post count
  const topAuthors = await adapter.aggregate("posts", [
    {
      $group: {
        _id: "$user_id",
        postCount: { $sum: 1 },
        totalViews: { $sum: "$view_count" },
      },
    },
    { $sort: { postCount: -1 } },
    { $limit: 5 },
  ]);

  console.log("\nTop 5 authors by post count:");
  topAuthors.forEach((author: any, idx: number) => {
    console.log(
      `  ${idx + 1}. User ${author._id}: ${author.postCount} posts, ${
        author.totalViews
      } total views`
    );
  });

  console.log();
}

// ============================================
// 7. MAIN EXECUTION
// ============================================
async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║     @dqcai/orm MongoDB Blog Application Demo         ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    await initializeDatabase();

    await example1_BasicCRUD();
    await example2_AdvancedQueries();
    await example3_Relationships();
    await example4_Tags();
    await example5_Comments();
    await example6_Statistics();
    await example7_MongoAggregation();

    console.log("✅ All examples completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
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

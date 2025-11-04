import {
  DatabaseSchema,
  MySQLAdapter,
  MySQLConfig,
  DatabaseManager,
  BaseService,
  ServiceManager,
  QueryFilter,
  IConnection,
} from "@dqcai/orm";

import { createModuleLogger, ORMModules } from "../src/logger";
// const logger = createModuleLogger(ORMModules.TEST_ORM);

// ============================================
// 1. SCHEMA DEFINITION
// ============================================
const blogSchema: DatabaseSchema = {
  version: "1.0.0",
  database_type: "mysql",
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
const dbConfig: MySQLConfig = {
  databaseType: "mysql",
  database: "test",
  host: "localhost",
  port: 3306,
  user: "cuongdq",
  password: "Cng3500888@",
  connectionLimit: 5,
  timezone: "+07:00",
  charset: "utf8mb4",
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

// Extended types for JOIN results
interface PostWithAuthor extends Post {
  author_username?: string;
  author_full_name?: string;
  author_email?: string;
}

interface CommentWithDetails extends Comment {
  post_title?: string;
  user_username?: string;
  user_full_name?: string;
}

interface PostWithTags extends Post {
  tags?: Tag[];
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

  // ==========================================
  // 🔧 FIX ALL CUSTOM QUERIES - test-mySQL.ts
  // Thay đổi MySQL placeholders ($1, $2) → MySQL placeholders (?)
  // ==========================================

  // ==========================================
  // 1️⃣ PostService.getPostsWithAuthors()
  // ==========================================
  async getPostsWithAuthors(options?: {
    limit?: number;
    offset?: number;
  }): Promise<PostWithAuthor[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ FIX: Thay $1, $2, $3 → ?
    const query = `
    SELECT 
      p.*,
      u.username as author_username,
      u.full_name as author_full_name,
      u.email as author_email
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.status = ?
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

    const result = await adapter.executeRaw(query, [
      "published",
      options?.limit || 10,
      options?.offset || 0,
    ]);

    return result.rows;
  }

  // ==========================================
  // 2️⃣ PostService.getPostWithAuthor()
  // ==========================================
  async getPostWithAuthor(postId: number): Promise<PostWithAuthor | null> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ FIX: Thay $1 → ?
    const query = `
    SELECT 
      p.*,
      u.username as author_username,
      u.full_name as author_full_name,
      u.email as author_email,
      u.avatar_url as author_avatar_url
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;

    const result = await adapter.executeRaw(query, [postId]);
    return result.rows[0] || null;
  }
  // ==========================================
  // 4️⃣ PostTagService.getPostsWithTags() - CRITICAL FIX
  // ==========================================
  // ⚠️ QUAN TRỌNG: MySQL KHÔNG HỖ TRỢ json_agg() và json_build_object()
  // Phải dùng JSON_ARRAYAGG() và JSON_OBJECT()

  async getPostsWithTags(options?: {
    limit?: number;
    status?: string;
  }): Promise<PostWithTags[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ FIX 1: Thay MySQL JSON functions → MySQL JSON functions
    // ✅ FIX 2: Thay $1 → ?
    let query = `
    SELECT 
      p.id,
      p.title,
      p.slug,
      p.content,
      p.excerpt,
      p.user_id,
      p.status,
      p.view_count,
      p.published_at,
      p.created_at,
      p.updated_at,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'description', t.description
        )
      ) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

    const params: any[] = [];

    if (options?.status) {
      query += ` WHERE p.status = ?`;
      params.push(options.status);
    }

    // ✅ MySQL: GROUP BY tất cả các cột non-aggregate
    query += ` 
    GROUP BY 
      p.id, 
      p.title, 
      p.slug, 
      p.content, 
      p.excerpt, 
      p.user_id, 
      p.status, 
      p.view_count, 
      p.published_at, 
      p.created_at, 
      p.updated_at
    ORDER BY p.created_at DESC
  `;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const result = await adapter.executeRaw(query, params);
    return result.rows;
  }

  // ==========================================
  // 5️⃣ PostTagService.getTagsWithPostCount()
  // ==========================================
  async getTagsWithPostCount(): Promise<Array<Tag & { post_count: number }>> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ MySQL syntax (không cần thay đổi, không có placeholder)
    const query = `
    SELECT 
      t.id,
      t.name,
      t.slug,
      t.description,
      COUNT(pt.post_id) as post_count
    FROM tags t
    LEFT JOIN post_tags pt ON t.id = pt.tag_id
    GROUP BY t.id, t.name, t.slug, t.description
    ORDER BY post_count DESC, t.name ASC
  `;

    const result = await adapter.executeRaw(query, []);
    return result.rows;
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

  // ==========================================
  // 3️⃣ CommentService.getCommentsWithDetails()
  // ==========================================
  async getCommentsWithDetails(options?: {
    postId?: number;
    limit?: number;
  }): Promise<CommentWithDetails[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ FIX: Thay $1, $2 → ?
    let query = `
    SELECT 
      c.*,
      p.title as post_title,
      u.username as user_username,
      u.full_name as user_full_name
    FROM comments c
    INNER JOIN posts p ON c.post_id = p.id
    INNER JOIN users u ON c.user_id = u.id
    WHERE c.is_approved = ?
  `;

    const params: any[] = [true];

    if (options?.postId) {
      query += ` AND c.post_id = ?`;
      params.push(options.postId);
    }

    query += ` ORDER BY c.created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const result = await adapter.executeRaw(query, params);
    return result.rows;
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

  async getPostsWithTags(options?: {
    limit?: number;
    status?: string;
  }): Promise<PostWithTags[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // ✅ MySQL 5.7+ Version - Using JSON_ARRAYAGG and JSON_OBJECT
    let query = `
    SELECT 
      p.id,
      p.title,
      p.slug,
      p.content,
      p.excerpt,
      p.user_id,
      p.status,
      p.view_count,
      p.published_at,
      p.created_at,
      p.updated_at,
      CASE 
        WHEN COUNT(t.id) > 0 THEN
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', t.id,
              'name', t.name,
              'slug', t.slug,
              'description', t.description
            )
          )
        ELSE NULL
      END as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

    const params: any[] = [];

    if (options?.status) {
      query += ` WHERE p.status = ?`;
      params.push(options.status);
    }

    // ✅ MySQL: GROUP BY tất cả non-aggregate columns
    query += ` 
    GROUP BY 
      p.id, 
      p.title, 
      p.slug, 
      p.content, 
      p.excerpt, 
      p.user_id, 
      p.status, 
      p.view_count, 
      p.published_at, 
      p.created_at, 
      p.updated_at
    ORDER BY p.created_at DESC
  `;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const result = await adapter.executeRaw(query, params);
    
    // console.log("Kết quả là gì?:",result.rows);

    // ✅ Parse JSON strings to objects
    const posts = result.rows.map((row: any) => ({
      ...row,
      tags: row.tags //? JSON.parse(row.tags) : [],
    }));

    return posts;
  }

  // ==========================================
  // 🎯 Alternative: Simple Version (Không dùng JSON aggregation)
  // ==========================================

  async getPostsWithTagsSimple(options?: {
    limit?: number;
    status?: string;
  }): Promise<PostWithTags[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // Bước 1: Lấy posts
    let postsQuery = `SELECT * FROM posts`;
    const params: any[] = [];

    if (options?.status) {
      postsQuery += ` WHERE status = ?`;
      params.push(options.status);
    }

    postsQuery += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      postsQuery += ` LIMIT ?`;
      params.push(options.limit);
    }

    const postsResult = await adapter.executeRaw(postsQuery, params);
    const posts = postsResult.rows;

    if (posts.length === 0) return [];

    // Bước 2: Lấy tags cho mỗi post
    const postIds = posts.map((p: any) => p.id);
    const placeholders = postIds.map(() => "?").join(",");

    const tagsQuery = `
    SELECT 
      pt.post_id,
      t.id,
      t.name,
      t.slug,
      t.description
    FROM post_tags pt
    INNER JOIN tags t ON pt.tag_id = t.id
    WHERE pt.post_id IN (${placeholders})
  `;

    const tagsResult = await adapter.executeRaw(tagsQuery, postIds);
    const tagsByPost = tagsResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.post_id]) acc[row.post_id] = [];
      acc[row.post_id].push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
      });
      return acc;
    }, {});

    // Bước 3: Gắn tags vào posts
    const postsWithTags = posts.map((post: any) => ({
      ...post,
      tags: tagsByPost[post.id] || [],
    }));

    return postsWithTags;
  }

  // 🎯 ALTERNATIVE: Cách viết ngắn gọn hơn (GROUP BY primary key)
  // MySQL cho phép GROUP BY chỉ primary key nếu có UNIQUE constraint
  async getPostsWithTagsSimplified(options?: {
    limit?: number;
    status?: string;
  }): Promise<PostWithTags[]> {
    const adapter: MySQLAdapter = await this.getAdapter();

    // Cách này chỉ work nếu p.id là primary key
    let query = `
    SELECT 
      p.*,
      json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'slug', t.slug,
          'description', t.description
        )
      ) FILTER (WHERE t.id IS NOT NULL) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

    const params: any[] = [];

    if (options?.status) {
      query += ` WHERE p.status = ?`;
      params.push(options.status);
    }

    // ✅ Với MySQL 9.1+, GROUP BY primary key là đủ
    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await adapter.executeRaw(query, params);
    return result.rows;
  }

  // 🆕 JOIN: Get tags with post count
  async getTagsWithPostCount(): Promise<Array<Tag & { post_count: number }>> {
    const adapter: MySQLAdapter = await this.getAdapter();

    const query = `
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.description,
        COUNT(pt.post_id) as post_count
      FROM tags t
      LEFT JOIN post_tags pt ON t.id = pt.tag_id
      GROUP BY t.id, t.name, t.slug, t.description
      ORDER BY post_count DESC, t.name ASC
    `;

    const result = await adapter.executeRaw(query, []);
    return result.rows;
  }
}

// Kiểm tra đảm bảo là Database Schema Tồn tại trước đó
async function ensureDatabaseExists() {
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool(dbConfig);
  const databaseName = dbConfig.database;

  const connection: IConnection = {
    rawConnection: pool,
    isConnected: true,
    close: async () => {
      await pool.end();
    },
  };

  try {
    // Kiểm tra xem database đã tồn tại chưa
    const [databases] = await pool.query<any[]>("SHOW DATABASES LIKE ?", [
      databaseName,
    ]);

    if (databases.length === 0) {
      // Tạo database nếu chưa tồn tại
      await pool.query(
        `CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        [databaseName]
      );
      console.log(`✓ Database "${databaseName}" created successfully`);
    } else {
      console.log(`✓ Database "${databaseName}" already exists`);
    }
  } catch (error) {
    console.error("Error ensuring database exists:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// ============================================
// 5. INITIALIZATION
// ============================================
async function initializeDatabase() {
  console.log("🔧 Initializing MySQL database...\n");

  // 1. Register schema FIRST
  DatabaseManager.registerSchema("blog_app", blogSchema);
  console.log("✓ Schema registered");

  // 2. Create and connect adapter
  const adapter = new MySQLAdapter();
  await adapter.connect(dbConfig);
  console.log("✓ Database connected");

  // 3. Register adapter instance in DatabaseManager
  DatabaseManager.registerAdapterInstance("blog_app", adapter);
  console.log("✓ Adapter registered in DatabaseManager");

  // 4. Create DAO using the registered adapter
  await DatabaseManager.getDAO("blog_app");
  console.log("✓ DAO created with shared adapter");

  // 5. Verify adapter is shared
  const registeredAdapter = DatabaseManager.getAdapterInstance("blog_app");
  console.log("✓ Adapter verification:", registeredAdapter === adapter);

  // 6. Drop existing tables if they exist (for clean test)
  console.log("\n🗑️  Dropping existing tables...");
  const tablesToDrop = ["post_tags", "comments", "tags", "posts", "users"];
  for (const tableName of tablesToDrop) {
    try {
      await adapter.executeRaw(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      console.log(`✓ Dropped table '${tableName}'`);
    } catch (error) {
      console.log(`ℹ Error dropping '${tableName}':`, (error as Error).message);
    }
  }

  // 7. Create tables
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

  // 8. Register services
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
}

// ============================================
// 6. USAGE EXAMPLES
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

async function example6_JoinOperations() {
  console.log("🔀 Example 6: JOIN Operations\n");

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
  const postTagService =
    await ServiceManager.getInstance().getService<PostTagService>(
      "blog_app",
      "post_tags"
    );

  // 1. Get posts with author information
  console.log("📰 Posts with Authors:");
  const postsWithAuthors = await postService.getPostsWithAuthors({ limit: 5 });
  postsWithAuthors.forEach((post) => {
    console.log(
      `  - "${post.title}" by ${post.author_full_name} (@${post.author_username})`
    );
  });
  console.log();

  // 2. Get single post with author details
  if (postsWithAuthors.length > 0) {
    const postDetail = await postService.getPostWithAuthor(
      postsWithAuthors[0].id
    );
    if (postDetail) {
      console.log("📄 Post Detail:");
      console.log(`  Title: ${postDetail.title}`);
      console.log(`  Author: ${postDetail.author_full_name}`);
      console.log(`  Email: ${postDetail.author_email}`);
      console.log(`  Views: ${postDetail.view_count}`);
      console.log();
    }
  }

  // 3. Get comments with post and user details
  console.log("💭 Comments with Details:");
  const commentsWithDetails = await commentService.getCommentsWithDetails({
    limit: 5,
  });
  commentsWithDetails.forEach((comment) => {
    console.log(
      `  - "${comment.content.substring(0, 50)}..." on "${
        comment.post_title
      }" by ${comment.user_full_name}`
    );
  });
  console.log();

  // 4. Get posts with their tags (using JSON aggregation)
  console.log("🏷️  Posts with Tags:");
  const postsWithTags = await postTagService.getPostsWithTags({
    status: "published",
    limit: 5,
  });
  postsWithTags.forEach((post) => {
    const tagNames = post.tags?.map((t) => t.name).join(", ") || "No tags";
    console.log(`  - "${post.title}" [${tagNames}]`);
  });
  console.log();

  // 5. Get tags with post count
  console.log("📊 Tags with Post Count:");
  const tagsWithCount = await postTagService.getTagsWithPostCount();
  tagsWithCount.forEach((tag) => {
    console.log(`  - ${tag.name}: ${tag.post_count} posts`);
  });
  console.log();
}

async function example7_Statistics() {
  console.log("📊 Example 7: Database Statistics\n");

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
  const approvedComments = await commentService.count({ is_approved: true });

  console.log("Database Statistics:");
  console.log(`  Total Users: ${totalUsers} (${activeUsers} active)`);
  console.log(`  Total Posts: ${totalPosts} (${publishedPosts} published)`);
  console.log(
    `  Total Comments: ${totalComments} (${approvedComments} approved)`
  );

  console.log();
}

async function example8_ComplexJoins() {
  console.log("🔗 Example 8: Complex JOIN Queries\n");

  const adapter = DatabaseManager.getAdapterInstance("blog_app");
  if (!adapter) {
    console.log("Adapter not found");
    return;
  }

  // ==========================================
  // 1️⃣ User Activity Summary - ✅ OK (không có json_agg)
  // ==========================================
  console.log("👤 User Activity Summary:");
  const userActivityQuery = `
    SELECT 
      u.id,
      u.username,
      u.full_name,
      COUNT(DISTINCT p.id) as post_count,
      COUNT(DISTINCT c.id) as comment_count,
      COALESCE(SUM(p.view_count), 0) as total_views
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    LEFT JOIN comments c ON u.id = c.user_id
    WHERE u.is_active = ?
    GROUP BY u.id, u.username, u.full_name
    ORDER BY total_views DESC
    LIMIT ?
  `;

  const userActivity = await adapter.raw(userActivityQuery, [true, 10]);
  userActivity.rows.forEach((user: any) => {
    console.log(
      `  - ${user.full_name}: ${user.post_count} posts, ${user.comment_count} comments, ${user.total_views} views`
    );
  });
  console.log();

  // ==========================================
  // 2️⃣ Most Commented Posts - ✅ OK (không có json_agg)
  // ==========================================
  console.log("💬 Most Commented Posts:");
  const mostCommentedQuery = `
    SELECT 
      p.id,
      p.title,
      u.full_name as author,
      COUNT(c.id) as comment_count,
      p.view_count
    FROM posts p
    INNER JOIN users u ON p.user_id = u.id
    LEFT JOIN comments c ON p.id = c.post_id AND c.is_approved = ?
    WHERE p.status = ?
    GROUP BY p.id, p.title, u.full_name, p.view_count
    ORDER BY comment_count DESC, p.view_count DESC
    LIMIT ?
  `;

  const mostCommented = await adapter.raw(mostCommentedQuery, [
    true,
    "published",
    5,
  ]);
  mostCommented.rows.forEach((post: any) => {
    console.log(
      `  - "${post.title}" by ${post.author}: ${post.comment_count} comments, ${post.view_count} views`
    );
  });
  console.log();

  // ==========================================
  // 3️⃣ Popular Tags - ⚠️ CẦN FIX (có json_agg)
  // ==========================================
  console.log("🔥 Popular Tags with Recent Posts:");

  // ✅ FIX: Thay json_agg() → JSON_ARRAYAGG()
  const popularTagsQuery = `
    SELECT 
      t.id,
      t.name,
      t.slug,
      COUNT(DISTINCT pt.post_id) as post_count,
      CASE 
        WHEN COUNT(p.id) > 0 THEN
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'title', p.title,
              'slug', p.slug,
              'published_at', p.published_at
            )
          )
        ELSE NULL
      END as recent_posts
    FROM tags t
    LEFT JOIN post_tags pt ON t.id = pt.tag_id
    LEFT JOIN posts p ON pt.post_id = p.id AND p.status = ?
    GROUP BY t.id, t.name, t.slug
    HAVING COUNT(DISTINCT pt.post_id) > 0
    ORDER BY post_count DESC
    LIMIT ?
  `;

  const popularTags = await adapter.raw(popularTagsQuery, ["published", 5]);
  popularTags.rows.forEach((tag: any) => {
    console.log(`  - ${tag.name} (${tag.post_count} posts)`);
    if (tag.recent_posts) {
      // ✅ Parse JSON string to array
      const posts =
        typeof tag.recent_posts === "string"
          ? JSON.parse(tag.recent_posts)
          : tag.recent_posts;

      const recentPosts = posts.slice(0, 2);
      recentPosts.forEach((post: any) => {
        console.log(`    • ${post.title}`);
      });
    }
  });
  console.log();

  // ==========================================
  // 4️⃣ Comment Threads - ⚠️ CẦN FIX (MySQL CTE syntax)
  // ==========================================
  console.log("🧵 Comment Threads:");

  // ✅ MySQL 8.0+ hỗ trợ CTE, nhưng syntax hơi khác
  const commentThreadQuery = `
    WITH RECURSIVE comment_tree AS (
      -- Base case: root comments
      SELECT 
        c.id,
        c.content,
        c.parent_id,
        u.username,
        u.full_name,
        p.title as post_title,
        0 as depth
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      INNER JOIN posts p ON c.post_id = p.id
      WHERE c.parent_id IS NULL AND c.is_approved = ?
      
      UNION ALL
      
      -- Recursive case: replies
      SELECT 
        c.id,
        c.content,
        c.parent_id,
        u.username,
        u.full_name,
        ct.post_title,
        ct.depth + 1
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      INNER JOIN comment_tree ct ON c.parent_id = ct.id
      WHERE c.is_approved = ?
    )
    SELECT * FROM comment_tree
    ORDER BY post_title, parent_id, id
    LIMIT ?
  `;

  try {
    const commentThreads = await adapter.raw(commentThreadQuery, [
      true,
      true,
      10,
    ]);
    let currentPost = "";
    commentThreads.rows.forEach((comment: any) => {
      if (comment.post_title !== currentPost) {
        currentPost = comment.post_title;
        console.log(`\n  Post: "${currentPost}"`);
      }
      const indent = "  ".repeat(comment.depth + 1);
      const preview = comment.content.substring(0, 50);
      console.log(
        `${indent}↳ @${comment.username}: ${preview}${
          comment.content.length > 50 ? "..." : ""
        }`
      );
    });
  } catch (error) {
    // ⚠️ Nếu MySQL < 8.0, CTE không được hỗ trợ
    console.log("  ⚠️ CTE not supported in MySQL < 8.0");
    console.log("  Skipping recursive comment thread example");
  }
  console.log();
}

async function example9_Transactions() {
  console.log("💰 Example 9: Transaction-like Operations\n");

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
  const tagService = await ServiceManager.getInstance().getService<TagService>(
    "blog_app",
    "tags"
  );
  const postTagService =
    await ServiceManager.getInstance().getService<PostTagService>(
      "blog_app",
      "post_tags"
    );

  try {
    // Create a new user
    const newUser = await userService.create({
      username: "janedoe",
      email: "jane@example.com",
      password_hash: "hashed_password",
      full_name: "Jane Doe",
      bio: "Tech enthusiast and writer",
    });
    console.log(`✓ Created user: ${newUser.username}`);

    // Create a post for the new user
    const newPost = await postService.create({
      title: "My First Blog Post",
      content:
        "This is my introduction to the blogging world. Excited to share my thoughts!",
      user_id: newUser.id,
      status: "published",
      published_at: new Date().toISOString() as any,
    });
    console.log(`✓ Created post: ${newPost.title}`);

    // Create tags and associate with post
    const tag1 = await tagService.create({
      name: "Introduction",
      description: "Introduction posts",
    });

    const tag2 = await tagService.create({
      name: "Personal",
      description: "Personal blog posts",
    });

    await postTagService.addTagToPost(newPost.id, tag1.id);
    await postTagService.addTagToPost(newPost.id, tag2.id);
    console.log(`✓ Added tags to post`);

    // Get the complete post with author and tags
    const completePost = await postService.getPostWithAuthor(newPost.id);
    const postTags = await postTagService.getTagsForPost(newPost.id);

    console.log("\n📦 Complete Post Package:");
    console.log(`  Title: ${completePost?.title}`);
    console.log(`  Author: ${completePost?.author_full_name}`);
    console.log(`  Tags: ${postTags.length} assigned`);
    console.log(`  Status: ${completePost?.status}`);

    console.log("\n✅ Transaction-like operation completed successfully!");
  } catch (error) {
    console.error("❌ Error during operation:", (error as Error).message);
    // In real application, you would rollback here
  }

  console.log();
}

async function example10_BulkOperations() {
  console.log("📦 Example 10: Bulk Operations\n");

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

  // Create multiple users
  console.log("Creating multiple users...");
  const usernames = ["alice", "bob", "charlie", "diana", "eve"];
  const createdUsers: User[] = [];

  for (const username of usernames) {
    try {
      const user = await userService.create({
        username: username,
        email: `${username}@example.com`,
        password_hash: "hashed_password",
        full_name: username.charAt(0).toUpperCase() + username.slice(1),
        bio: `I am ${username}`,
      });
      createdUsers.push(user);
      console.log(`  ✓ Created: ${username}`);
    } catch (error) {
      console.log(`  ℹ ${username}: ${(error as Error).message}`);
    }
  }

  // Create multiple posts for each user
  console.log("\nCreating posts for users...");
  let totalPosts = 0;
  for (const user of createdUsers) {
    const postCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < postCount; i++) {
      await postService.create({
        title: `${user.username}'s Post #${i + 1}`,
        content: `This is post number ${i + 1} by ${
          user.full_name
        }. Contains interesting content about various topics.`,
        user_id: user.id,
        status: i % 2 === 0 ? "published" : "draft",
      });
      totalPosts++;
    }
  }
  console.log(
    `✓ Created ${totalPosts} posts across ${createdUsers.length} users`
  );

  // Bulk update: Activate all users
  console.log("\nBulk activating all users...");
  const adapter = DatabaseManager.getAdapterInstance("blog_app");
  if (adapter) {
    await adapter.raw(`UPDATE users SET is_active = ? WHERE is_active = ?`, [
      true,
      false,
    ]);
    console.log("✓ All users activated");
  }

  console.log();
}

// ============================================
// 7. MAIN EXECUTION
// ============================================
async function main() {
  try {
    console.log("╔═══════════════════════════════════════════════════════╗");
    console.log("║  @dqcai/orm MySQL Blog Application Demo         ║");
    console.log("║  with Advanced JOIN Operations                        ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Đảm bảo database tồn tại TRƯỚC KHI initialize
    await ensureDatabaseExists();

    // Initialize
    await initializeDatabase();

    // Run examples
    await example1_BasicCRUD();
    await example2_AdvancedQueries();
    await example3_Relationships();
    await example4_Tags();
    await example5_Comments();
    await example6_JoinOperations();
    await example7_Statistics();
    await example8_ComplexJoins();
    await example9_Transactions();
    await example10_BulkOperations();

    console.log("✅ All examples completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
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

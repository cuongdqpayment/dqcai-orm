import { DatabaseSchema, MONGODB_TYPE_MAPPING } from "../src/index";

// Schema core cho hệ thống
export const coreSchema: DatabaseSchema = {
  version: "1.0",
  database_type: "mongodb",
  database_name: "core",
  description:
    "Cơ sở dữ liệu hệ thống cốt lõi quản lý toàn bộ hoạt động của doanh nghiệp, bao gồm thông tin doanh nghiệp, cửa hàng và người dùng",
  type_mapping: MONGODB_TYPE_MAPPING,
  schemas: {
    enterprises: {
      description: "Bảng quản lý thông tin các doanh nghiệp trong hệ thống",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "NOT NULL UNIQUE PRIMARY KEY",
          description: "Mã định danh duy nhất của doanh nghiệp",
        },
        {
          name: "name",
          type: "varchar",
          length: 255,
          constraints: "NOT NULL",
          description: "Tên chính thức của doanh nghiệp",
        },
        {
          name: "business_type",
          type: "varchar",
          length: 100,
          description:
            "Loại hình kinh doanh (công ty TNHH, cổ phần, tư nhân, v.v.)",
          /* enum: [
            "ltd",
            "joint_stock",
            "private",
            "partnership",
            "sole_proprietorship",
          ], */
        },
        {
          name: "industries",
          type: "json",
          length: 1024,
          description: "Các ngành nghề kinh doanh",
        },
        {
          name: "address",
          type: "string",
          description: "Địa chỉ trụ sở chính của doanh nghiệp",
        },
        {
          name: "tax_code",
          type: "varchar",
          length: 20,
          description: "Mã số thuế của doanh nghiệp",
        },
        {
          name: "phone",
          type: "varchar",
          length: 20,
          description: "Số điện thoại liên hệ",
        },
        {
          name: "email",
          type: "email",
          description: "Địa chỉ email chính của doanh nghiệp",
        },
        {
          name: "website",
          type: "url",
          description: "Website chính thức của doanh nghiệp",
        },
        {
          name: "logo_url",
          type: "url",
          description: "Đường dẫn đến logo của doanh nghiệp",
        },
        {
          name: "status",
          type: "varchar",
          length: 20,
          constraints: "DEFAULT 'active'",
          description: "Trạng thái hoạt động của doanh nghiệp",
          enum: ["active", "inactive", "suspended", "pending"],
        },
        {
          name: "subscription_plan",
          type: "varchar",
          length: 20,
          constraints: "DEFAULT 'basic'",
          description: "Gói dịch vụ đang sử dụng",
          enum: ["basic", "premium", "enterprise"],
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian tạo bản ghi",
        },
        {
          name: "updated_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian cập nhật bản ghi lần cuối",
        },
      ],
      indexes: [
        {
          name: "idx_enterprises_tax_code",
          fields: ["tax_code"],
          unique: true,
          description: "Index duy nhất cho mã số thuế",
        },
        {
          name: "idx_enterprises_status_plan",
          fields: ["status", "subscription_plan"],
          unique: false,
          description: "Index composite cho trạng thái và gói dịch vụ",
        },
        {
          name: "idx_enterprises_created_at",
          fields: ["created_at"],
          unique: false,
          description: "Index cho thời gian tạo để sắp xếp",
        },
        {
          name: "idx_enterprises_email",
          fields: ["email"],
          unique: true,
          description: "Index duy nhất cho email",
        },
      ],
    },
    stores: {
      description:
        "Bảng quản lý thông tin các cửa hàng/chi nhánh thuộc doanh nghiệp",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "NOT NULL UNIQUE PRIMARY KEY",
          description: "Mã định danh duy nhất của cửa hàng",
        },
        {
          name: "enterprise_id",
          type: "uuid",
          constraints: "NOT NULL",
          description: "Mã doanh nghiệp sở hữu cửa hàng này",
        },
        {
          name: "name",
          type: "varchar",
          length: 255,
          constraints: "NOT NULL",
          description: "Tên cửa hàng/chi nhánh",
        },
        {
          name: "store_type",
          type: "varchar",
          length: 50,
          description: "Loại cửa hàng",
        },
        {
          name: "address",
          type: "string",
          description: "Địa chỉ cửa hàng",
        },
        {
          name: "phone",
          type: "varchar",
          length: 20,
          description: "Số điện thoại cửa hàng",
        },
        {
          name: "email",
          type: "email",
          description: "Email liên hệ của cửa hàng",
        },
        {
          name: "manager_name",
          type: "varchar",
          length: 100,
          description: "Tên quản lý cửa hàng",
        },
        {
          name: "operating_hours",
          type: "json",
          description: "Giờ hoạt động của cửa hàng (JSON format)",
        },
        {
          name: "timezone",
          type: "varchar",
          length: 50,
          constraints: "DEFAULT 'Asia/Ho_Chi_Minh'",
          description: "Múi giờ của cửa hàng",
        },
        {
          name: "currency",
          type: "varchar",
          length: 3,
          constraints: "DEFAULT 'VND'",
          description: "Đơn vị tiền tệ sử dụng (ISO 4217)",
        },
        {
          name: "tax_rate",
          type: "decimal",
          precision: 5,
          scale: 2,
          constraints: "DEFAULT 0",
          description: "Tỷ lệ thuế áp dụng tại cửa hàng (%)",
        },
        {
          name: "status",
          type: "varchar",
          length: 20,
          constraints: "DEFAULT 'active'",
          description: "Trạng thái hoạt động",
          enum: ["active", "inactive", "maintenance", "closed"],
        },
        {
          name: "sync_enabled",
          type: "boolean",
          constraints: "DEFAULT TRUE",
          description: "Cho phép đồng bộ dữ liệu",
        },
        {
          name: "last_sync",
          type: "timestamp",
          description: "Thời gian đồng bộ dữ liệu lần cuối",
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian tạo bản ghi",
        },
        {
          name: "updated_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian cập nhật bản ghi lần cuối",
        },
      ],
      indexes: [
        {
          name: "idx_stores_enterprise_id",
          fields: ["enterprise_id"],
          unique: false,
          description: "Index cho enterprise_id để tăng tốc join",
        },
        {
          name: "idx_stores_status",
          fields: ["status"],
          unique: false,
          description: "Index cho trạng thái cửa hàng",
        },
        {
          name: "idx_stores_enterprise_status",
          fields: ["enterprise_id", "status"],
          unique: false,
          description: "Index composite cho doanh nghiệp và trạng thái",
        },
      ],
      foreignKeys: [
        {
          name: "fk_stores_enterprise_id",
          fields: ["enterprise_id"],
          references: {
            table: "enterprises",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Khóa ngoại liên kết với bảng enterprises",
        },
      ],
    },
    users: {
      description: "Bảng quản lý thông tin người dùng hệ thống",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "NOT NULL UNIQUE PRIMARY KEY",
          description:
            "Mã định danh duy nhất của người dùng (được sử dụng trong hệ thống)",
        },
        {
          name: "store_id",
          type: "uuid",
          constraints: "NOT NULL",
          description: "Mã cửa hàng mà người dùng thuộc về",
        },
        {
          name: "username",
          type: "varchar",
          length: 50,
          constraints: "NOT NULL UNIQUE",
          description: "Tên đăng nhập của người dùng",
        },
        {
          name: "password_hash",
          type: "varchar",
          length: 255,
          constraints: "NOT NULL",
          description: "Mật khẩu đã được mã hóa",
        },
        {
          name: "full_name",
          type: "varchar",
          length: 100,
          constraints: "NOT NULL",
          description: "Họ và tên đầy đủ của người dùng",
        },
        {
          name: "email",
          type: "email",
          constraints: "UNIQUE",
          description: "Địa chỉ email của người dùng",
        },
        {
          name: "phone",
          type: "varchar",
          length: 20,
          description: "Số điện thoại của người dùng",
        },
        {
          name: "role",
          type: "varchar",
          length: 20,
          constraints: "NOT NULL DEFAULT 'guest'",
          /* enum: [
            "superadmin",
            "admin",
            "manager",
            "staff",
            "editor",
            "author",
            "moderator",
            "viewer",
            "guest",
          ], */
          description: "Vai trò trong hệ thống",
        },
        {
          name: "permissions",
          type: "json",
          description: "Quyền hạn chi tiết của người dùng (JSON format)",
        },
        {
          name: "avatar_url",
          type: "url",
          description: "Đường dẫn đến ảnh đại diện",
        },
        {
          name: "is_active",
          type: "boolean",
          constraints: "DEFAULT TRUE",
          description: "Trạng thái tài khoản",
        },
        {
          name: "last_login",
          type: "timestamp",
          description: "Thời gian đăng nhập lần cuối",
        },
        {
          name: "failed_login_attempts",
          type: "integer",
          constraints: "DEFAULT 0",
          description: "Số lần đăng nhập thất bại liên tiếp",
        },
        {
          name: "locked_until",
          type: "timestamp",
          description: "Thời gian khóa tài khoản đến",
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian tạo tài khoản",
        },
        {
          name: "updated_at",
          type: "timestamp",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian cập nhật thông tin lần cuối",
        },
      ],
      indexes: [
        {
          name: "idx_users_username",
          fields: ["username"],
          unique: true,
          description: "Index duy nhất cho tên đăng nhập",
        },
        {
          name: "idx_users_email",
          fields: ["email"],
          unique: true,
          description: "Index duy nhất cho email",
        },
        {
          name: "idx_users_store_id",
          fields: ["store_id"],
          unique: false,
          description: "Index cho store_id để tăng tốc join",
        },
        {
          name: "idx_users_store_role",
          fields: ["store_id", "role"],
          unique: false,
          description: "Index composite cho cửa hàng và vai trò",
        },
        {
          name: "idx_users_active_status",
          fields: ["is_active"],
          unique: false,
          description: "Index cho trạng thái hoạt động",
        },
      ],
      foreignKeys: [
        {
          name: "fk_users_store_id",
          fields: ["store_id"],
          references: {
            table: "stores",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Khóa ngoại liên kết với bảng stores",
        },
      ],
    },
    // Bổ sung 2 bảng thiếu vào MongoDB schema
    user_sessions: {
      description: "Collection quản lý phiên đăng nhập của người dùng",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của phiên đăng nhập",
        },
        {
          name: "user_id",
          type: "objectid",
          constraints: "NOT NULL",
          description: "Mã người dùng sở hữu phiên đăng nhập",
        },
        {
          name: "store_id",
          type: "objectid",
          constraints: "NOT NULL",
          description: "Mã cửa hàng nơi người dùng đăng nhập",
        },
        {
          name: "session_token",
          type: "string",
          length: 255,
          constraints: "NOT NULL UNIQUE",
          description: "Token phiên đăng nhập duy nhất",
        },
        {
          name: "refresh_token",
          type: "string",
          length: 255,
          description: "Token làm mới phiên đăng nhập",
        },
        {
          name: "device_info",
          type: "object",
          description: "Thông tin thiết bị đăng nhập (Object format)",
        },
        {
          name: "ip_address",
          type: "string",
          length: 45,
          description: "Địa chỉ IP đăng nhập (hỗ trợ IPv6)",
        },
        {
          name: "user_agent",
          type: "string",
          description: "Thông tin trình duyệt/ứng dụng",
        },
        {
          name: "login_time",
          type: "datetime",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian bắt đầu phiên đăng nhập",
        },
        {
          name: "logout_time",
          type: "datetime",
          description: "Thời gian kết thúc phiên đăng nhập",
        },
        {
          name: "expires_at",
          type: "datetime",
          description: "Thời gian hết hạn phiên đăng nhập",
        },
        {
          name: "is_active",
          type: "bool",
          constraints: "DEFAULT TRUE",
          description: "Trạng thái phiên",
        },
      ],
      indexes: [
        {
          name: "idx_sessions_user_id",
          fields: ["user_id"],
          unique: false,
          description: "Index cho user_id để tăng tốc join",
        },
        {
          name: "idx_sessions_store_id",
          fields: ["store_id"],
          unique: false,
          description: "Index cho store_id để tăng tốc join",
        },
        {
          name: "idx_sessions_token",
          fields: ["session_token"],
          unique: true,
          description: "Index duy nhất cho session token",
        },
        {
          name: "idx_sessions_active",
          fields: ["is_active"],
          unique: false,
          description: "Index cho phiên đang hoạt động",
        },
        {
          name: "idx_sessions_expires_at",
          fields: ["expires_at"],
          unique: false,
          description: "Index cho thời gian hết hạn để cleanup",
        },
      ],
      foreignKeys: [
        {
          name: "fk_sessions_user_id",
          fields: ["user_id"],
          references: {
            table: "users",
            fields: ["_id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Khóa ngoại liên kết với bảng users",
        },
        {
          name: "fk_sessions_store_id",
          fields: ["store_id"],
          references: {
            table: "stores",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Khóa ngoại liên kết với bảng stores",
        },
      ],
    },
    settings: {
      description: "Collection lưu trữ các cấu hình và thiết lập của hệ thống",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của thiết lập",
        },
        {
          name: "store_id",
          type: "objectid",
          constraints: "NOT NULL",
          description: "Mã cửa hàng áp dụng thiết lập này",
        },
        {
          name: "category",
          type: "string",
          length: 50,
          constraints: "NOT NULL",
          description: "Danh mục thiết lập",
          enum: [
            "system",
            "payment",
            "notification",
            "display",
            "security",
            "integration",
          ],
        },
        {
          name: "key",
          type: "string",
          length: 100,
          constraints: "NOT NULL",
          description: "Khóa định danh của thiết lập",
        },
        {
          name: "value",
          type: "string",
          description: "Giá trị của thiết lập",
        },
        {
          name: "default_value",
          type: "string",
          description: "Giá trị mặc định của thiết lập",
        },
        {
          name: "description",
          type: "string",
          description: "Mô tả chi tiết về thiết lập này",
        },
        {
          name: "data_type",
          type: "string",
          length: 20,
          constraints: "DEFAULT 'string'",
          description: "Kiểu dữ liệu của giá trị",
          enum: ["string", "number", "boolean", "json", "array"],
        },
        {
          name: "validation_rules",
          type: "object",
          description: "Quy tắc validation cho giá trị (Object format)",
        },
        {
          name: "is_encrypted",
          type: "bool",
          constraints: "DEFAULT FALSE",
          description: "Giá trị có được mã hóa không",
        },
        {
          name: "is_system",
          type: "bool",
          constraints: "DEFAULT FALSE",
          description: "Thiết lập hệ thống (không được phép xóa)",
        },
        {
          name: "created_at",
          type: "datetime",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian tạo thiết lập",
        },
        {
          name: "updated_at",
          type: "datetime",
          constraints: "DEFAULT CURRENT_TIMESTAMP",
          description: "Thời gian cập nhật thiết lập lần cuối",
        },
      ],
      indexes: [
        {
          name: "idx_settings_store_id",
          fields: ["store_id"],
          unique: false,
          description: "Index cho store_id để tăng tốc join",
        },
        {
          name: "idx_settings_category",
          fields: ["category"],
          unique: false,
          description: "Index cho danh mục thiết lập",
        },
        {
          name: "idx_settings_store_category_key",
          fields: ["store_id", "category", "key"],
          unique: true,
          description: "Index composite duy nhất cho store, category và key",
        },
      ],
      foreignKeys: [
        {
          name: "fk_settings_store_id",
          fields: ["store_id"],
          references: {
            table: "stores",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Khóa ngoại liên kết với bảng stores",
        },
      ],
    },
  },
};

// Schema blog cho quản lý tin bài
export const blogSchema: DatabaseSchema = {
  version: "1.0",
  database_type: "mongodb",
  database_name: "blog_content",
  description:
    "Cơ sở dữ liệu lưu trữ nội dung, thống kê, cảm xúc và bình luận cho một hệ thống blog.",
  type_mapping: {
    mongodb: {
      string: "String",
      varchar: "String",
      char: "String",
      email: "String",
      url: "String",
      uuid: "String",
      integer: "Number",
      bigint: "Number",
      smallint: "Number",
      tinyint: "Number",
      decimal: "Number",
      numeric: "Number",
      float: "Number",
      double: "Number",
      boolean: "Boolean",
      timestamp: "Date",
      datetime: "Date",
      date: "Date",
      time: "String",
      json: "Object",
      array: "Array",
      blob: "Binary",
      binary: "Binary",
    },
  },
  schemas: {
    articles: {
      description: "Bảng lưu trữ thông tin và nội dung của các bài viết.",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của tài liệu (bài viết).",
        },
        {
          name: "store_id",
          type: "uuid",
          constraints: "NOT NULL",
          description:
            "Mã định danh của cửa hàng, dùng để liên kết với dữ liệu cửa hàng.",
        },
        {
          name: "title",
          type: "string",
          constraints: "NOT NULL",
          description: "Tiêu đề của bài viết, tối ưu cho SEO (<60 ký tự).",
        },
        {
          name: "slug",
          type: "string",
          constraints: "NOT NULL UNIQUE",
          description:
            "URL thân thiện của bài viết, chứa từ khóa chính, không dấu và dấu gạch ngang.",
        },
        {
          name: "image",
          type: "url",
          description: "URL hình ảnh đại diện của bài viết.",
        },
        {
          name: "image_alt",
          type: "string",
          description:
            "Văn bản thay thế (alt text) cho hình ảnh, mô tả nội dung hình ảnh để hỗ trợ SEO và khả năng tiếp cận.",
        },
        {
          name: "description",
          type: "string",
          description:
            "Mô tả meta của bài viết, tóm tắt nội dung chính (<160 ký tự).",
        },
        {
          name: "excerpt",
          type: "string",
          description:
            "Đoạn trích ngắn của bài viết, dùng để hiển thị trong danh sách bài viết hoặc preview.",
        },
        {
          name: "author",
          type: "string",
          constraints: "NOT NULL",
          description: "Tác giả của bài viết.",
        },
        {
          name: "status",
          type: "string",
          enum: ["draft", "published", "archived"],
          constraints: "NOT NULL",
          description:
            "Trạng thái xuất bản của bài viết (bản nháp, đã xuất bản, lưu trữ).",
        },
        {
          name: "tags",
          type: "array",
          description: "Danh sách các từ khóa liên quan đến bài viết.",
        },
        {
          name: "category",
          type: "string",
          description: "Chuyên mục của bài viết.",
        },
        {
          name: "content",
          type: "string",
          constraints: "NOT NULL",
          description:
            "Toàn bộ nội dung bài viết được lưu dưới dạng text/HTML/Markdown.",
        },
        {
          name: "seo_keywords",
          type: "string",
          description: "Các từ khóa SEO chính, được phân cách bằng dấu phẩy.",
        },
        {
          name: "canonical_url",
          type: "url",
          description:
            "URL chính thức của bài viết, dùng để tránh trùng lặp nội dung.",
        },
        {
          name: "og_title",
          type: "string",
          description: "Tiêu đề Open Graph để chia sẻ trên mạng xã hội.",
        },
        {
          name: "og_description",
          type: "string",
          description: "Mô tả Open Graph để chia sẻ trên mạng xã hội.",
        },
        {
          name: "og_image",
          type: "url",
          description: "URL hình ảnh Open Graph để chia sẻ trên mạng xã hội.",
        },
        {
          name: "featured_image",
          type: "url",
          description:
            "URL hình ảnh nổi bật của bài viết, hiển thị ở đầu bài hoặc trong danh sách.",
        },
        {
          name: "google_map",
          type: "string",
          description:
            "Mã nhúng hoặc URL của Google Map liên quan đến bài viết.",
        },
        {
          name: "map_title",
          type: "string",
          description: "Tiêu đề hoặc mô tả cho Google Map được nhúng.",
        },
        {
          name: "youtube",
          type: "string",
          description: "URL hoặc mã video YouTube liên quan đến bài viết.",
        },
        {
          name: "youtube_title",
          type: "string",
          description: "Tiêu đề hoặc mô tả cho video YouTube được nhúng.",
        },
        {
          name: "is_hidden",
          type: "boolean",
          constraints: "NOT NULL DEFAULT false",
          description: "Trạng thái ẩn bài viết (true: ẩn, false: hiển thị).",
        },
        {
          name: "is_comments_locked",
          type: "boolean",
          constraints: "NOT NULL DEFAULT false",
          description: "Trạng thái khóa bình luận (true: khóa, false: mở).",
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "NOT NULL",
          description: "Thời gian tạo bài viết.",
        },
        {
          name: "updated_at",
          type: "timestamp",
          constraints: "NOT NULL",
          description: "Thời gian cập nhật gần nhất của bài viết.",
        },
        {
          name: "published_at",
          type: "timestamp",
          description: "Thời gian bài viết được xuất bản.",
        },
      ],
      indexes: [
        {
          name: "idx_slug",
          fields: ["slug"],
          unique: true,
          description:
            "Index duy nhất cho trường slug để đảm bảo không trùng lặp và truy vấn nhanh.",
        },
        {
          name: "idx_status",
          fields: ["status"],
          unique: false,
          description:
            "Index cho trường status để tìm kiếm bài viết theo trạng thái.",
        },
        {
          name: "idx_created_at",
          fields: ["created_at"],
          unique: false,
          description:
            "Index để sắp xếp và truy vấn bài viết theo thời gian tạo.",
        },
        {
          name: "idx_store_id",
          fields: ["store_id"],
          unique: false,
          description: "Index để tìm kiếm bài viết theo mã cửa hàng.",
        },
        {
          name: "idx_category",
          fields: ["category"],
          unique: false,
          description: "Index để tìm kiếm bài viết theo chuyên mục.",
        },
      ],
      foreignKeys: [],
    },
    article_metrics: {
      description:
        "Bảng thống kê lượt xem và người đọc duy nhất của mỗi bài viết.",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của tài liệu thống kê.",
        },
        {
          name: "article_id",
          type: "uuid",
          constraints: "NOT NULL",
          description: "Mã định danh của bài viết được thống kê.",
        },
        {
          name: "total_views",
          type: "integer",
          constraints: "NOT NULL DEFAULT 0",
          description: "Tổng số lượt xem của bài viết.",
        },
        {
          name: "unique_views",
          type: "integer",
          constraints: "NOT NULL DEFAULT 0",
          description:
            "Số lượt xem duy nhất (dựa trên thiết bị/IP) của bài viết.",
        },
        {
          name: "last_viewed_at",
          type: "timestamp",
          description: "Thời gian lượt xem gần nhất.",
        },
        {
          name: "device_fingerprints",
          type: "array",
          description:
            "Mảng lưu trữ các dấu vân tay thiết bị để đếm lượt xem duy nhất.",
        },
      ],
      indexes: [
        {
          name: "idx_article_id",
          fields: ["article_id"],
          unique: true,
          description:
            "Index duy nhất cho article_id để mỗi bài viết chỉ có một tài liệu thống kê.",
        },
      ],
      foreignKeys: [
        {
          name: "fk_article_metrics_articles",
          fields: ["article_id"],
          references: {
            table: "articles",
            fields: ["_id"],
          },
          on_delete: "CASCADE",
          description:
            "Liên kết khóa ngoại với bảng articles, xóa bài viết thì xóa cả thống kê.",
        },
      ],
    },
    article_comments: {
      description: "Bảng lưu trữ bình luận của người đọc trên các bài viết.",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của bình luận.",
        },
        {
          name: "article_id",
          type: "uuid",
          constraints: "NOT NULL",
          description: "Mã định danh của bài viết được bình luận.",
        },
        {
          name: "parent_id",
          type: "uuid",
          description: "Mã định danh của bình luận gốc (nếu là bình luận con).",
        },
        {
          name: "author_name",
          type: "string",
          constraints: "NOT NULL",
          description: "Tên người bình luận.",
        },
        {
          name: "author_email",
          type: "email",
          description: "Email người bình luận (tùy chọn).",
        },
        {
          name: "content",
          type: "string",
          constraints: "NOT NULL",
          description: "Nội dung của bình luận.",
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "NOT NULL",
          description: "Thời gian bình luận.",
        },
        {
          name: "status",
          type: "string",
          enum: ["pending", "approved", "rejected"],
          constraints: "NOT NULL DEFAULT 'pending'",
          description:
            "Trạng thái duyệt bình luận (chờ duyệt, đã duyệt, từ chối).",
        },
      ],
      indexes: [
        {
          name: "idx_article_id",
          fields: ["article_id"],
          unique: false,
          description:
            "Index cho article_id để truy vấn bình luận theo bài viết.",
        },
        {
          name: "idx_parent_id",
          fields: ["parent_id"],
          unique: false,
          description: "Index để tìm kiếm các bình luận con.",
        },
      ],
      foreignKeys: [
        {
          name: "fk_comments_articles",
          fields: ["article_id"],
          references: {
            table: "articles",
            fields: ["_id"],
          },
          on_delete: "CASCADE",
          description:
            "Liên kết khóa ngoại với bảng articles, xóa bài viết thì xóa cả bình luận.",
        },
      ],
    },
    article_reactions: {
      description: "Bảng lưu trữ thông tin cảm xúc (reactions) của người đọc.",
      cols: [
        {
          name: "_id",
          type: "uuid",
          constraints: "PRIMARY KEY",
          description: "Mã định danh duy nhất của reaction.",
        },
        {
          name: "article_id",
          type: "uuid",
          constraints: "NOT NULL",
          description: "Mã định danh của bài viết được tương tác.",
        },
        {
          name: "reaction_type",
          type: "string",
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
          constraints: "NOT NULL",
          description: "Loại cảm xúc của người đọc.",
        },
        {
          name: "user_id",
          type: "uuid",
          description: "Mã định danh người dùng (nếu có, ví dụ: đã đăng nhập).",
        },
        {
          name: "fingerprint",
          type: "string",
          description: "Dấu vân tay thiết bị để cho phép like duy nhất.",
        },
        {
          name: "ip_address",
          type: "string",
          description: "Địa chỉ IP của người dùng để ngăn chặn spam.",
        },
        {
          name: "created_at",
          type: "timestamp",
          constraints: "NOT NULL",
          description: "Thời gian tạo reaction.",
        },
      ],
      indexes: [
        {
          name: "idx_article_id_reaction",
          fields: ["article_id"],
          unique: false,
          description: "Index để tìm kiếm reactions theo bài viết.",
        },
      ],
      foreignKeys: [
        {
          name: "fk_reactions_articles",
          fields: ["article_id"],
          references: {
            table: "articles",
            fields: ["_id"],
          },
          on_delete: "CASCADE",
          description:
            "Liên kết khóa ngoại với bảng articles, xóa bài viết thì xóa cả reactions.",
        },
      ],
    },
  },
};

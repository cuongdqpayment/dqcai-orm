import { DatabaseSchema, SQLITE_TYPE_MAPPING } from "../src/index";

// ========================
// COMMON FIELD DEFINITIONS
// ========================

const CommonFields = {
  id: {
    uuid: {
      name: "id",
      type: "uuid" as const,
      primaryKey: true,
      required: true,
      unique: true,
      description: "Mã định danh duy nhất",
    },
    autoIncrement: {
      name: "id",
      type: "integer" as const,
      primaryKey: true,
      autoIncrement: true,
      required: true,
      description: "Khóa chính tự động tăng",
    },
    bigint: {
      name: "id",
      type: "bigint" as const,
      primaryKey: true,
      autoIncrement: true,
      required: true,
      description: "Khóa chính tự động tăng dạng bigint",
    },
  },

  storeId: {
    name: "store_id",
    type: "uuid" as const,
    required: true,
    index: true,
    description: "Mã định danh cửa hàng",
  },

  timestamps: {
    createdAt: {
      name: "created_at",
      type: "timestamp" as const,
      default: "CURRENT_TIMESTAMP",
      description: "Thời gian tạo bản ghi",
    },
    updatedAt: {
      name: "updated_at",
      type: "timestamp" as const,
      default: "CURRENT_TIMESTAMP",
      description: "Thời gian cập nhật bản ghi lần cuối",
    },
  },

  status: {
    active: {
      name: "status",
      type: "varchar" as const,
      length: 20,
      default: "active",
      enum: ["active", "inactive"],
      description: "Trạng thái hoạt động",
    },
    withSuspended: {
      name: "status",
      type: "varchar" as const,
      length: 20,
      default: "active",
      enum: ["active", "inactive", "suspended", "pending"],
      description: "Trạng thái hoạt động của doanh nghiệp",
    },
  },

  boolean: {
    isActive: {
      name: "is_active",
      type: "boolean" as const,
      default: true,
      description: "Trạng thái hoạt động",
    },
    isEncrypted: {
      name: "is_encrypted",
      type: "boolean" as const,
      default: false,
      description: "Giá trị có được mã hóa không",
    },
    isSystem: {
      name: "is_system",
      type: "boolean" as const,
      default: false,
      description: "Thiết lập hệ thống (không được phép xóa)",
    },
  },
};

// ========================
// CORE DATABASE SCHEMA
// ========================

const core: DatabaseSchema = {
  version: "1.0",
  database_name: "core",
  description:
    "Cơ sở dữ liệu hệ thống cốt lõi quản lý toàn bộ hoạt động của doanh nghiệp",
  type_mapping: SQLITE_TYPE_MAPPING,
  schemas: {
    enterprises: {
      description: "Bảng quản lý thông tin các doanh nghiệp trong hệ thống",
      cols: [
        { ...CommonFields.id.uuid },
        {
          name: "name",
          type: "varchar",
          length: 255,
          required: true,
          description: "Tên chính thức của doanh nghiệp",
        },
        {
          name: "business_type",
          type: "varchar",
          length: 100,
          enum: [
            "ltd",
            "joint_stock",
            "private",
            "partnership",
            "sole_proprietorship",
          ],
          description: "Loại hình kinh doanh",
        },
        {
          name: "industries",
          type: "json",
          description: "Các ngành nghề kinh doanh",
        },
        {
          name: "address",
          type: "string",
          description: "Địa chỉ trụ sở chính",
        },
        {
          name: "tax_code",
          type: "varchar",
          length: 20,
          unique: true,
          index: true,
          description: "Mã số thuế",
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
          unique: true,
          index: true,
          description: "Email chính",
        },
        {
          name: "website",
          type: "url",
          description: "Website chính thức",
        },
        {
          name: "logo_url",
          type: "url",
          description: "Đường dẫn logo",
        },
        {
          ...CommonFields.status.withSuspended,
        },
        {
          name: "subscription_plan",
          type: "varchar",
          length: 20,
          default: "basic",
          enum: ["basic", "premium", "enterprise"],
          description: "Gói dịch vụ đang sử dụng",
        },
        { ...CommonFields.timestamps.createdAt },
        { ...CommonFields.timestamps.updatedAt },
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
          description: "Index composite cho trạng thái và gói dịch vụ",
        },
        {
          name: "idx_enterprises_created_at",
          fields: ["created_at"],
          description: "Index cho thời gian tạo",
        },
      ],
    },

    stores: {
      description: "Bảng quản lý thông tin các cửa hàng/chi nhánh",
      cols: [
        { ...CommonFields.id.uuid },
        {
          name: "enterprise_id",
          type: "uuid",
          required: true,
          index: true,
          description: "Mã doanh nghiệp sở hữu",
        //   references: {
        //     table: "enterprises",
        //     fields: ["id"],
        //     on_delete: "CASCADE",
        //     on_update: "CASCADE",
        //   },
        },
        {
          name: "name",
          type: "varchar",
          length: 255,
          required: true,
          description: "Tên cửa hàng/chi nhánh",
        },
        {
          name: "store_type",
          type: "varchar",
          length: 50,
          enum: ["retail", "warehouse", "showroom", "factory", "office"],
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
          description: "Email liên hệ",
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
          description: "Giờ hoạt động (JSON format)",
        },
        {
          name: "timezone",
          type: "varchar",
          length: 50,
          default: "Asia/Ho_Chi_Minh",
          description: "Múi giờ",
        },
        {
          name: "currency",
          type: "varchar",
          length: 3,
          default: "VND",
          description: "Đơn vị tiền tệ (ISO 4217)",
        },
        {
          name: "tax_rate",
          type: "decimal",
          precision: 5,
          scale: 2,
          default: 0,
          description: "Tỷ lệ thuế (%)",
        },
        {
          name: "status",
          type: "varchar",
          length: 20,
          default: "active",
          enum: ["active", "inactive", "maintenance", "closed"],
          description: "Trạng thái hoạt động",
        },
        {
          name: "sync_enabled",
          type: "boolean",
          default: true,
          description: "Cho phép đồng bộ dữ liệu",
        },
        {
          name: "last_sync",
          type: "timestamp",
          nullable: true,
          description: "Thời gian đồng bộ dữ liệu lần cuối",
        },
        { ...CommonFields.timestamps.createdAt },
        { ...CommonFields.timestamps.updatedAt },
      ],
      indexes: [
        {
          name: "idx_stores_enterprise_id",
          fields: ["enterprise_id"],
          description: "Index cho enterprise_id",
        },
        {
          name: "idx_stores_status",
          fields: ["status"],
          description: "Index cho trạng thái",
        },
        {
          name: "idx_stores_enterprise_status",
          fields: ["enterprise_id", "status"],
          description: "Index composite",
        },
      ],
      foreign_keys: [
        {
          name: "fk_stores_enterprise_id",
          fields: ["enterprise_id"],
          references: {
            table: "enterprises",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Liên kết với bảng enterprises",
        },
      ],
    },

    users: {
      description: "Bảng quản lý thông tin người dùng hệ thống",
      cols: [
        { ...CommonFields.id.uuid },
        {
          name: "store_id",
          type: "uuid",
          required: true,
          index: true,
          description: "Mã cửa hàng",
        //   references: {
        //     table: "stores",
        //     fields: ["id"],
        //     on_delete: "CASCADE",
        //     on_update: "CASCADE",
        //   },
        },
        {
          name: "username",
          type: "varchar",
          length: 50,
          required: true,
          unique: true,
          index: true,
          description: "Tên đăng nhập",
        },
        {
          name: "password_hash",
          type: "varchar",
          length: 255,
          required: true,
          description: "Mật khẩu đã mã hóa",
        },
        {
          name: "full_name",
          type: "varchar",
          length: 100,
          required: true,
          description: "Họ và tên đầy đủ",
        },
        {
          name: "email",
          type: "email",
          unique: true,
          index: true,
          nullable: true,
          description: "Email người dùng",
        },
        {
          name: "phone",
          type: "varchar",
          length: 20,
          nullable: true,
          description: "Số điện thoại",
        },
        {
          name: "role",
          type: "varchar",
          length: 20,
          required: true,
          default: "staff",
          enum: ["admin", "manager", "staff", "cashier", "viewer"],
          index: true,
          description: "Vai trò trong hệ thống",
        },
        {
          name: "permissions",
          type: "json",
          nullable: true,
          description: "Quyền hạn chi tiết (JSON format)",
        },
        {
          name: "avatar_url",
          type: "url",
          nullable: true,
          description: "Đường dẫn ảnh đại diện",
        },
        {
          ...CommonFields.boolean.isActive,
        },
        {
          name: "last_login",
          type: "timestamp",
          nullable: true,
          description: "Thời gian đăng nhập lần cuối",
        },
        {
          name: "failed_login_attempts",
          type: "integer",
          default: 0,
          description: "Số lần đăng nhập thất bại liên tiếp",
        },
        {
          name: "locked_until",
          type: "timestamp",
          nullable: true,
          description: "Thời gian khóa tài khoản đến",
        },
        { ...CommonFields.timestamps.createdAt },
        { ...CommonFields.timestamps.updatedAt },
      ],
      indexes: [
        {
          name: "idx_users_store_id",
          fields: ["store_id"],
          description: "Index cho store_id",
        },
        {
          name: "idx_users_store_role",
          fields: ["store_id", "role"],
          description: "Index composite cho cửa hàng và vai trò",
        },
        {
          name: "idx_users_active_status",
          fields: ["is_active"],
          description: "Index cho trạng thái hoạt động",
        },
      ],
      foreign_keys: [
        {
          name: "fk_users_store_id",
          fields: ["store_id"],
          references: {
            table: "stores",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Liên kết với bảng stores",
        },
      ],
    },

    user_sessions: {
      description: "Bảng quản lý phiên đăng nhập",
      cols: [
        { ...CommonFields.id.bigint },
        {
          name: "user_id",
          type: "uuid",
          required: true,
          index: true,
          description: "Mã người dùng",
        //   references: {
        //     table: "users",
        //     fields: ["id"],
        //     on_delete: "CASCADE",
        //     on_update: "CASCADE",
        //   },
        },
        {
          name: "store_id",
          type: "uuid",
          required: true,
          index: true,
          description: "Mã cửa hàng",
        //   references: {
        //     table: "stores",
        //     fields: ["id"],
        //     on_delete: "CASCADE",
        //     on_update: "CASCADE",
        //   },
        },
        {
          name: "session_token",
          type: "varchar",
          length: 255,
          required: true,
          unique: true,
          index: true,
          description: "Token phiên đăng nhập duy nhất",
        },
        {
          name: "refresh_token",
          type: "varchar",
          length: 255,
          nullable: true,
          description: "Token làm mới phiên",
        },
        {
          name: "device_info",
          type: "json",
          nullable: true,
          description: "Thông tin thiết bị (JSON)",
        },
        {
          name: "ip_address",
          type: "varchar",
          length: 45,
          nullable: true,
          description: "Địa chỉ IP (hỗ trợ IPv6)",
        },
        {
          name: "user_agent",
          type: "string",
          nullable: true,
          description: "Thông tin trình duyệt",
        },
        {
          name: "login_time",
          type: "timestamp",
          default: "CURRENT_TIMESTAMP",
          description: "Thời gian bắt đầu phiên",
        },
        {
          name: "logout_time",
          type: "timestamp",
          nullable: true,
          description: "Thời gian kết thúc phiên",
        },
        {
          name: "expires_at",
          type: "timestamp",
          nullable: true,
          index: true,
          description: "Thời gian hết hạn phiên",
        },
        {
          ...CommonFields.boolean.isActive,
          description: "Trạng thái phiên",
        },
      ],
      indexes: [
        {
          name: "idx_sessions_user_id",
          fields: ["user_id"],
          description: "Index cho user_id",
        },
        {
          name: "idx_sessions_store_id",
          fields: ["store_id"],
          description: "Index cho store_id",
        },
        {
          name: "idx_sessions_active",
          fields: ["is_active"],
          description: "Index cho phiên đang hoạt động",
        },
      ],
      foreign_keys: [
        {
          name: "fk_sessions_user_id",
          fields: ["user_id"],
          references: {
            table: "users",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Liên kết với bảng users",
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
          description: "Liên kết với bảng stores",
        },
      ],
    },

    settings: {
      description: "Bảng lưu trữ các cấu hình và thiết lập",
      cols: [
        { ...CommonFields.id.autoIncrement },
        { ...CommonFields.storeId },
        {
          name: "category",
          type: "varchar",
          length: 50,
          required: true,
          enum: [
            "system",
            "payment",
            "notification",
            "display",
            "security",
            "integration",
          ],
          index: true,
          description: "Danh mục thiết lập",
        },
        {
          name: "key",
          type: "varchar",
          length: 100,
          required: true,
          description: "Khóa định danh",
        },
        {
          name: "value",
          type: "string",
          nullable: true,
          description: "Giá trị của thiết lập",
        },
        {
          name: "default_value",
          type: "string",
          nullable: true,
          description: "Giá trị mặc định",
        },
        {
          name: "description",
          type: "string",
          nullable: true,
          description: "Mô tả chi tiết",
        },
        {
          name: "data_type",
          type: "varchar",
          length: 20,
          default: "string",
          enum: ["string", "number", "boolean", "json", "array"],
          description: "Kiểu dữ liệu",
        },
        {
          name: "validation_rules",
          type: "json",
          nullable: true,
          description: "Quy tắc validation (JSON)",
        },
        {
          ...CommonFields.boolean.isEncrypted,
        },
        {
          ...CommonFields.boolean.isSystem,
        },
        { ...CommonFields.timestamps.createdAt },
        { ...CommonFields.timestamps.updatedAt },
      ],
      indexes: [
        {
          name: "idx_settings_store_id",
          fields: ["store_id"],
          description: "Index cho store_id",
        },
        {
          name: "idx_settings_category",
          fields: ["category"],
          description: "Index cho category",
        },
        {
          name: "idx_settings_store_category_key",
          fields: ["store_id", "category", "key"],
          unique: true,
          description: "Index composite duy nhất",
        },
      ],
      foreign_keys: [
        {
          name: "fk_settings_store_id",
          fields: ["store_id"],
          references: {
            table: "stores",
            fields: ["id"],
          },
          on_delete: "CASCADE",
          on_update: "CASCADE",
          description: "Liên kết với bảng stores",
        },
      ],
    },
  },
};

// ========================
// EXPORTS
// ========================

export { core, CommonFields };

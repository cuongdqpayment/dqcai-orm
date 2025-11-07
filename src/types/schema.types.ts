export const CommonFields = {
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

// ========================== POSTGRESQL TYPE MAPPING ==========================
export const POSTGRESQL_TYPE_MAPPING = {
  postgresql: {
    // String types
    string: "VARCHAR(255)",
    varchar: "VARCHAR",
    char: "CHAR",
    text: "TEXT",
    email: "VARCHAR(255)",
    url: "TEXT",
    uuid: "UUID",

    // Numeric types
    integer: "INTEGER",
    int: "INTEGER",
    bigint: "BIGINT",
    smallint: "SMALLINT",
    tinyint: "SMALLINT",
    number: "NUMERIC",
    decimal: "DECIMAL",
    numeric: "NUMERIC",
    float: "REAL",
    double: "DOUBLE PRECISION",

    // Boolean
    boolean: "BOOLEAN",
    bool: "BOOLEAN",

    // Date/Time types
    timestamp: "TIMESTAMP",
    datetime: "TIMESTAMP",
    date: "DATE",
    time: "TIME",

    // Complex types
    json: "JSON",
    jsonb: "JSONB",
    array: "ARRAY",
    object: "JSONB",

    // Binary types
    blob: "BYTEA",
    binary: "BYTEA",

    // MongoDB specific (fallback)
    objectid: "VARCHAR(24)",
  },
};

// ========================== MYSQL TYPE MAPPING ==========================
export const MYSQL_TYPE_MAPPING = {
  mysql: {
    // String types
    string: "VARCHAR(255)",
    varchar: "VARCHAR",
    char: "CHAR",
    text: "TEXT",
    email: "VARCHAR(255)",
    url: "TEXT",
    uuid: "CHAR(36)",

    // Numeric types
    integer: "INT",
    int: "INT",
    bigint: "BIGINT",
    smallint: "SMALLINT",
    tinyint: "TINYINT",
    number: "DECIMAL",
    decimal: "DECIMAL",
    numeric: "DECIMAL",
    float: "FLOAT",
    double: "DOUBLE",

    // Boolean
    boolean: "TINYINT(1)",
    bool: "TINYINT(1)",

    // Date/Time types
    timestamp: "TIMESTAMP",
    datetime: "DATETIME",
    date: "DATE",
    time: "TIME",

    // Complex types
    json: "JSON",
    jsonb: "JSON",
    array: "JSON",
    object: "JSON",

    // Binary types
    blob: "BLOB",
    binary: "VARBINARY",

    // MongoDB specific (fallback)
    objectid: "VARCHAR(24)",
  },
};

// ========================== MARIADB TYPE MAPPING ==========================
export const MARIADB_TYPE_MAPPING = {
  mariadb: {
    // String types
    string: "VARCHAR(255)",
    varchar: "VARCHAR",
    char: "CHAR",
    text: "TEXT",
    email: "VARCHAR(255)",
    url: "TEXT",
    uuid: "CHAR(36)",

    // Numeric types
    integer: "INT",
    int: "INT",
    bigint: "BIGINT",
    smallint: "SMALLINT",
    tinyint: "TINYINT",
    number: "DECIMAL",
    decimal: "DECIMAL",
    numeric: "DECIMAL",
    float: "FLOAT",
    double: "DOUBLE",

    // Boolean
    boolean: "TINYINT(1)",
    bool: "TINYINT(1)",

    // Date/Time types
    timestamp: "TIMESTAMP",
    datetime: "DATETIME",
    date: "DATE",
    time: "TIME",

    // Complex types
    json: "JSON",
    jsonb: "JSON",
    array: "JSON",
    object: "JSON",

    // Binary types
    blob: "BLOB",
    binary: "VARBINARY",

    // MongoDB specific (fallback)
    objectid: "VARCHAR(24)",
  },
};

// ========================== SQLITE TYPE MAPPING ==========================
export const SQLITE_TYPE_MAPPING = {
  sqlite: {
    // String types
    string: "TEXT",
    varchar: "TEXT",
    char: "TEXT",
    text: "TEXT",
    email: "TEXT",
    url: "TEXT",
    uuid: "TEXT",

    // Numeric types
    integer: "INTEGER",
    int: "INTEGER",
    bigint: "INTEGER",
    smallint: "INTEGER",
    tinyint: "INTEGER",
    number: "REAL",
    decimal: "REAL",
    numeric: "REAL",
    float: "REAL",
    double: "REAL",

    // Boolean
    boolean: "INTEGER",
    bool: "INTEGER",

    // Date/Time types
    timestamp: "TEXT",
    datetime: "TEXT",
    date: "TEXT",
    time: "TEXT",

    // Complex types
    json: "TEXT",
    jsonb: "TEXT",
    array: "TEXT",
    object: "TEXT",

    // Binary types
    blob: "BLOB",
    binary: "BLOB",

    // MongoDB specific (fallback)
    objectid: "TEXT",
  },
};

// ========================== SQL SERVER TYPE MAPPING ==========================
export const SQLSERVER_TYPE_MAPPING = {
  sqlserver: {
    // String types
    string: "NVARCHAR(255)",
    varchar: "VARCHAR",
    char: "CHAR",
    text: "NVARCHAR(MAX)",
    email: "NVARCHAR(255)",
    url: "NVARCHAR(MAX)",
    uuid: "UNIQUEIDENTIFIER",

    // Numeric types
    integer: "INT",
    int: "INT",
    bigint: "BIGINT",
    smallint: "SMALLINT",
    tinyint: "TINYINT",
    number: "DECIMAL",
    decimal: "DECIMAL",
    numeric: "NUMERIC",
    float: "FLOAT",
    double: "FLOAT(53)",

    // Boolean
    boolean: "BIT",
    bool: "BIT",

    // Date/Time types
    timestamp: "DATETIME2",
    datetime: "DATETIME2",
    date: "DATE",
    time: "TIME",

    // Complex types
    json: "NVARCHAR(MAX)",
    jsonb: "NVARCHAR(MAX)",
    array: "NVARCHAR(MAX)",
    object: "NVARCHAR(MAX)",

    // Binary types
    blob: "VARBINARY(MAX)",
    binary: "VARBINARY",

    // MongoDB specific (fallback)
    objectid: "VARCHAR(24)",
  },
};

// ========================== MONGODB TYPE MAPPING ==========================
export const MONGODB_TYPE_MAPPING = {
  mongodb: {
    // String types
    string: "String",
    varchar: "String",
    char: "String",
    text: "String",
    email: "String",
    url: "String",
    uuid: "String",

    // Numeric types
    integer: "Number",
    int: "Number",
    bigint: "Number",
    smallint: "Number",
    tinyint: "Number",
    number: "Number",
    decimal: "Number",
    numeric: "Number",
    float: "Number",
    double: "Number",

    // Boolean
    boolean: "Boolean",
    bool: "Boolean",

    // Date/Time types
    timestamp: "Date",
    datetime: "Date",
    date: "Date",
    time: "Date",

    // Complex types
    json: "Object",
    jsonb: "Object",
    array: "Array",
    object: "Object",

    // Binary types
    blob: "Buffer",
    binary: "Buffer",

    // MongoDB specific
    objectid: "ObjectId",
  },
};

// ========================== ORACLE TYPE MAPPING ==========================
export const ORACLE_TYPE_MAPPING = {
  oracle: {
    // String types
    string: "VARCHAR2(255)",
    varchar: "VARCHAR2",
    char: "CHAR",
    text: "CLOB",
    email: "VARCHAR2(255)",
    url: "CLOB",
    uuid: "VARCHAR2(36)",

    // Numeric types
    integer: "NUMBER(10)",
    int: "NUMBER(10)",
    bigint: "NUMBER(19)",
    smallint: "NUMBER(5)",
    tinyint: "NUMBER(3)",
    number: "NUMBER",
    decimal: "NUMBER",
    numeric: "NUMBER",
    float: "BINARY_FLOAT",
    double: "BINARY_DOUBLE",

    // Boolean
    boolean: "NUMBER(1)",
    bool: "NUMBER(1)",

    // Date/Time types
    timestamp: "TIMESTAMP",
    datetime: "TIMESTAMP",
    date: "DATE",
    time: "TIMESTAMP",

    // Complex types
    json: "CLOB",
    jsonb: "CLOB",
    array: "CLOB",
    object: "CLOB",

    // Binary types
    blob: "BLOB",
    binary: "RAW",

    // MongoDB specific (fallback)
    objectid: "VARCHAR2(24)",
  },
};

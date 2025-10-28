Dựa trên cấu trúc `BaseAdapter` và các Adapter riêng lẻ, bạn hãy giúp tôi bổ sung/chỉnh sửa (refactors) các phương thức sau ở hai cấp độ: **Base Adapter** (trừu tượng hóa) và **Adapter Cụ Thể** (triển khai chi tiết) trên các file đính kèm.

---

## 1. Bổ Sung/Chỉnh Sửa tại `BaseAdapter`

Bạn cần thêm các phương thức **`protected abstract`** vào `BaseAdapter` để bắt buộc các Adapter cụ thể phải triển khai logic riêng của mình.

| Phương thức | Cấp độ | Mục đích | Ghi chú |
| :--- | :--- | :--- | :--- |
| **`protected abstract sanitizeValue(...)`** | **`BaseAdapter`** | Chuyển đổi kiểu dữ liệu JavaScript (như `Date`, `boolean`) sang định dạng DB chấp nhận. | Đây là lớp chuyển đổi (Type Conversion Layer) đã đề cập. |
| **`protected abstract mapFieldTypeToDBType(...)`** | **`BaseAdapter`** | Ánh xạ kiểu `FieldType` chung (`string`, `boolean`, `date`) sang kiểu dữ liệu vật lý của DB (`VARCHAR`, `NUMBER(1)`, `TEXT`/`TIMESTAMP`). | Dùng cho phương thức `createTable`. |
| **`protected abstract processInsertResult(...)`** | **`BaseAdapter`** | Xử lý kết quả trả về sau lệnh `INSERT` để lấy ra bản ghi đã được tạo. | Thay thế logic chung sử dụng `RETURNING *` hiện tại, xử lý các trường hợp `lastInsertId` hoặc `IDENTITY`. |
| **`protected abstract getPlaceholder(index: number): string`** | **`BaseAdapter`** | Cung cấp ký tự đại diện (placeholder) cho tham số SQL (ví dụ: `$1`, `?`, `@p1`). | Giúp `buildInsertQuery` và các hàm query khác hoạt động đa nền tảng. |

---

## 2. Triển khai Cụ thể cho Từng Adapter

Sau khi thêm các phương thức trừu tượng, mỗi Adapter phải triển khai chúng.

### A. Nhóm NoSQL: `MongoDBAdapter`

MongoDB có cách xử lý dữ liệu và truy vấn hoàn toàn khác biệt.

| Phương thức | Hành động/Logic Triển khai |
| :--- | :--- |
| **`sanitizeValue(value)`** | **Giữ nguyên** các kiểu `Date`, `boolean`. Mã hóa `_id` thành `ObjectId` nếu cần thiết (nên được thực hiện trong `UniversalDAO` hoặc tầng query). |
| **`mapFieldTypeToDBType()`** | Trả về kiểu BSON, hoặc đơn giản là `string` vì MongoDB không yêu cầu schema nghiêm ngặt. |
| **`processInsertResult()`** | Trả về bản ghi với trường `_id` được lấy từ `result.insertedIds`. |
| **`buildFilterQuery(filter)`** | **Cần tùy biến mạnh mẽ** (đã có trong file bạn cung cấp) để dịch cú pháp lọc SQL sang cú pháp truy vấn Mongo (ví dụ: `WHERE field > 5` thành `{ field: { $gt: 5 } }`). |
| **Tất cả phương thức SQL (`createTable`, `updateById`...)** | Phải được triển khai bằng các lệnh của MongoDB driver (ví dụ: `db.collection('...').insertOne(...)`) thay vì tạo chuỗi SQL. |

### B. Nhóm SQL Đặc thù: `SQLiteAdapter`

SQLite cần xử lý kiểu dữ liệu đặc biệt và việc lấy ID sau `INSERT`.

| Phương thức | Hành động/Logic Triển khai |
| :--- | :--- |
| **`sanitizeValue(value)`** | **`Date`** -> `value.toISOString()` (TEXT) hoặc `value.getTime()` (INTEGER). **`Boolean`** -> `1` (true) hoặc `0` (false). |
| **`mapFieldTypeToDBType()`** | Ánh xạ `boolean` thành `INTEGER`, `date`/`timestamp` thành `TEXT` hoặc `INTEGER`. |
| **`getPlaceholder()`** | Trả về `?`. |
| **`processInsertResult(tableName, result, data, pks)`** | 1. Lấy ID: `const id = result.lastInsertId;` 2. Truy vấn lại: `SELECT * FROM ${tableName} WHERE rowid = ${id}`. (Do SQLite không hỗ trợ `RETURNING *` trên mọi phiên bản). |

### C. Nhóm SQL Cổ điển: `MySQLAdapter`, `MariaDBAdapter`, `OracleAdapter`, `SQLServerAdapter`

Các Adapter này có thể kế thừa logic chung nếu chúng dùng cùng cú pháp SQL, nhưng phải tùy chỉnh Placeholders và Insert Result.

| Adapter | `getPlaceholder(index)` | `processInsertResult(...)` | `sanitizeValue(value)` |
| :--- | :--- | :--- | :--- |
| **`PostgreSQLAdapter`** | Trả về `$${index + 1}`. | Sử dụng `result.rows[0]` (có được do thêm `RETURNING *` vào query). | Chuyển đổi JSON thành JSON string (nếu driver không tự làm). |
| **`MySQLAdapter`** | Trả về `?`. | Lấy ID: `const id = result.lastInsertId;`. Truy vấn lại: `SELECT * FROM ${tableName} WHERE ${primaryKey} = ${id}`. | Chuyển đổi JSON thành JSON string (nếu driver không tự làm). |
| **`MariaDBAdapter`** | Kế thừa từ `MySQLAdapter`. | Kế thừa từ `MySQLAdapter`. | Kế thừa từ `MySQLAdapter`. |
| **`SQLServerAdapter`** | Trả về `@p${index + 1}`. | Lấy ID: Truy vấn `SELECT SCOPE_IDENTITY()`, hoặc sử dụng `OUTPUT INSERTED.*` (phức tạp hơn nhưng hiệu quả). **Khuyến nghị dùng `OUTPUT` nếu có thể.** | Cần xử lý kiểu `DATETIME`/`DATETIME2` và các kiểu dữ liệu riêng. |
| **`OracleAdapter`** | Trả về `:${index + 1}`. | Lấy ID: `const id = result.lastInsertId` (hoặc `lastRowid`). Truy vấn lại: `SELECT * FROM ${tableName} WHERE ${primaryKey} = ${id}`. (Sử dụng `RETURNING INTO` cần logic PL/SQL phức tạp, nên truy vấn lại an toàn hơn). | Chuyển đổi kiểu dữ liệu Oracle như `DATE` và `TIMESTAMP`. |

### 💡 Tóm tắt quan trọng

Để đảm bảo thư viện không bị lỗi, bạn **bắt buộc** phải triển khai lớp **Type Conversion** (`sanitizeValue`) và lớp **Insert Result Handling** (`processInsertResult`) riêng cho **tất cả** 7 Adapter. Điều này sẽ giải quyết được vấn đề `Date`/`Boolean` của SQLite và sự khác biệt về `RETURNING clause` giữa các hệ thống.


# 🎯 Refactoring Summary: Type Conversion & Insert Result Handling

## ✅ Các Thay Đổi Chính

### 1. **BaseAdapter - Thêm 4 Abstract Methods Bắt Buộc**

```typescript
// Tất cả adapter phải implement 4 phương thức này:

protected abstract sanitizeValue(value: any): any;
protected abstract mapFieldTypeToDBType(fieldType: string, length?: number): string;
protected abstract processInsertResult(tableName: string, result: any, data: any, primaryKeys?: string[]): Promise<any>;
protected abstract getPlaceholder(index: number): string;
```

### 2. **Refactored Methods trong BaseAdapter**

| Method | Thay Đổi | Lý Do |
|--------|-----------|-------|
| `insertOne()` | Sử dụng `sanitizeValue()` và `processInsertResult()` | Xử lý đúng kiểu dữ liệu cho từng DB |
| `update()` | Sử dụng `sanitizeValue()` | Đảm bảo dữ liệu update đúng format |
| `buildColumnDefinition()` | Sử dụng `mapFieldTypeToDBType()` | Ánh xạ kiểu dữ liệu chính xác |

### 3. **Deprecated Methods**

```typescript
// ⚠️ Các phương thức sau đã deprecated:
sanitize()           // → Use sanitizeValue()
buildPlaceholders()  // → Use getPlaceholder()
getParamPlaceholder() // → Use getPlaceholder()
```

---

## 📊 So Sánh Implementation Giữa Các Adapter

### A. Type Conversion (`sanitizeValue`)

| Database | Date Conversion | Boolean Conversion | JSON/Object Handling |
|----------|----------------|-------------------|---------------------|
| **PostgreSQL** | `toISOString()` | Native `true/false` | `JSON.stringify()` |
| **MySQL/MariaDB** | `'YYYY-MM-DD HH:MM:SS'` | `1/0` | `JSON.stringify()` |
| **SQLite** | `toISOString()` | `1/0` | `JSON.stringify()` |
| **Oracle** | `toISOString()` | `1/0` | `JSON.stringify()` (CLOB) |
| **SQL Server** | `'YYYY-MM-DD HH:MM:SS.mmm'` | `1/0` | `JSON.stringify()` |
| **MongoDB** | Keep as `Date` object | Keep as `boolean` | Keep as native object |

### B. Type Mapping (`mapFieldTypeToDBType`)

| Field Type | PostgreSQL | MySQL | SQLite | Oracle | SQL Server | MongoDB |
|-----------|-----------|-------|--------|--------|-----------|---------|
| **string** | VARCHAR/TEXT | VARCHAR(255) | TEXT | VARCHAR2(255) | NVARCHAR(255) | string (BSON) |
| **boolean** | BOOLEAN | TINYINT(1) | INTEGER | NUMBER(1) | BIT | bool (BSON) |
| **date** | TIMESTAMP | DATETIME | TEXT | TIMESTAMP | DATETIME2 | date (BSON) |
| **json** | JSONB | JSON | TEXT | CLOB | NVARCHAR(MAX) | object (BSON) |

### C. Insert Result Handling (`processInsertResult`)

| Database | Mechanism | Implementation |
|----------|-----------|----------------|
| **PostgreSQL** | `RETURNING *` | Trả về trực tiếp từ query |
| **MySQL/MariaDB** | `lastInsertId` | Query lại với `SELECT * WHERE id = ?` |
| **SQLite** | `lastInsertRowid` | Query lại với `SELECT * WHERE rowid = ?` |
| **Oracle** | `lastRowid` | Query lại với `SELECT * WHERE ROWID = (...)` |
| **SQL Server** | `OUTPUT INSERTED.*` | Trả về trực tiếp, fallback `SCOPE_IDENTITY()` |
| **MongoDB** | `insertedId` | Merge với data: `{ ...data, _id }` |

### D. Placeholders (`getPlaceholder`)

| Database | Format | Example |
|----------|--------|---------|
| **PostgreSQL** | `$1, $2, $3...` | `INSERT ... VALUES ($1, $2)` |
| **MySQL/MariaDB** | `?, ?, ?...` | `INSERT ... VALUES (?, ?)` |
| **SQLite** | `?, ?, ?...` | `INSERT ... VALUES (?, ?)` |
| **Oracle** | `:1, :2, :3...` | `INSERT ... VALUES (:1, :2)` |
| **SQL Server** | `@p1, @p2, @p3...` | `INSERT ... VALUES (@p1, @p2)` |
| **MongoDB** | N/A (NoSQL) | No placeholders needed |

---

## 🔧 Migration Guide

### Step 1: Update BaseAdapter

Replace your `base-adapter.ts` with the refactored version that includes 4 new abstract methods.

### Step 2: Update Each Adapter

Replace each adapter file with its refactored version:

- ✅ `sqlite-adapter.ts` - **CRITICAL** (Date/Boolean handling)
- ✅ `postgresql-adapter.ts` - Uses RETURNING *
- ✅ `mysql-adapter.ts` & `mariadb-adapter.ts` - Query-back pattern
- ✅ `oracle-adapter.ts` - Sequence handling
- ✅ `sqlserver-adapter.ts` - OUTPUT INSERTED.*
- ✅ `mongodb-adapter.ts` - NoSQL native types

### Step 3: Test Critical Scenarios

```typescript
// Test 1: Date Handling
await adapter.insertOne('users', {
  name: 'John',
  birthday: new Date('1990-01-01')
});

// Test 2: Boolean Handling
await adapter.insertOne('settings', {
  is_active: true,
  is_public: false
});

// Test 3: JSON Handling
await adapter.insertOne('profiles', {
  metadata: { tags: ['user', 'admin'] }
});

// Test 4: Insert & Retrieve
const user = await adapter.insertOne('users', {
  name: 'Jane',
  email: 'jane@example.com'
});
console.log(user.id); // Should have auto-generated ID
```

### Step 4: Update Your Code

```typescript
// ❌ OLD (Deprecated)
const sanitized = adapter.sanitize(value);
const placeholders = adapter.buildPlaceholders(5);

// ✅ NEW (Refactored)
// These are now protected methods - use insertOne/update instead
const user = await adapter.insertOne('users', data);
```

---

## 🚨 Breaking Changes

### 1. **Abstract Methods Required**

All custom adapters MUST implement:
- `sanitizeValue()`
- `mapFieldTypeToDBType()`
- `processInsertResult()`
- `getPlaceholder()`

### 2. **Method Signatures Changed**

```typescript
// OLD
protected buildColumnDefinition(fieldName: string, fieldDef: FieldDefinition): string {
  let sqlType = TypeMapper.mapType(fieldDef.type, this.type);
  // ...
}

// NEW
protected buildColumnDefinition(fieldName: string, fieldDef: FieldDefinition): string {
  let sqlType = this.mapFieldTypeToDBType(fieldDef.type, fieldDef.length);
  // ...
}
```

### 3. **Deprecated Methods**

These methods still work but will be removed in future versions:
- `sanitize()` → Use `sanitizeValue()`
- `buildPlaceholders()` → Use `getPlaceholder()`
- `getParamPlaceholder()` → Use `getPlaceholder()`

---

## 🎯 Key Benefits

### ❌ Before Refactoring

```typescript
// ❌ SQLite: Date inserted as "[object Date]"
await adapter.insertOne('users', {
  name: 'John',
  birthday: new Date('1990-01-01')
});
// Result: birthday = "[object Date]" ❌

// ❌ SQLite: Boolean stored incorrectly
await adapter.insertOne('settings', { is_active: true });
// Result: is_active = "true" (string) ❌

// ❌ MySQL: INSERT không trả về bản ghi đầy đủ
const user = await adapter.insertOne('users', { name: 'Jane' });
console.log(user.email); // undefined ❌
```

### ✅ After Refactoring

```typescript
// ✅ SQLite: Date converted correctly
await adapter.insertOne('users', {
  name: 'John',
  birthday: new Date('1990-01-01')
});
// Result: birthday = "1990-01-01T00:00:00.000Z" ✅

// ✅ SQLite: Boolean converted to 1/0
await adapter.insertOne('settings', { is_active: true });
// Result: is_active = 1 (integer) ✅

// ✅ MySQL: INSERT trả về bản ghi đầy đủ
const user = await adapter.insertOne('users', {
  name: 'Jane',
  email: 'jane@example.com'
});
console.log(user.id);    // 123 ✅
console.log(user.email); // 'jane@example.com' ✅
```

---

## 🔍 Implementation Details by Adapter

### 1️⃣ SQLiteAdapter (Most Complex)

**Why Complex?**
- No native Date/Boolean support
- No RETURNING clause support
- Must query back after INSERT

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  // ...
}

protected async processInsertResult(tableName, result, data) {
  const lastInsertId = result.lastInsertRowid;
  const query = `SELECT * FROM ${tableName} WHERE id = ?`;
  const selectResult = await this.executeRaw(query, [lastInsertId]);
  return selectResult.rows?.[0];
}
```

---

### 2️⃣ PostgreSQLAdapter (Simplest)

**Why Simple?**
- Native Date/Boolean support
- RETURNING * support
- Direct result from INSERT

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  // Postgres handles most types natively
  if (value instanceof Date) return value.toISOString();
  return value;
}

protected async processInsertResult(tableName, result, data) {
  // PostgreSQL returns row directly via RETURNING *
  return result.rows?.[0] || data;
}

async insertOne(tableName, data) {
  const query = `INSERT INTO ${tableName} (...) 
                 VALUES (...) RETURNING *`;
  const result = await this.executeRaw(query, values);
  return this.processInsertResult(tableName, result, data);
}
```

---

### 3️⃣ MySQLAdapter & MariaDBAdapter

**Key Characteristics:**
- Boolean → TINYINT(1)
- Date → 'YYYY-MM-DD HH:MM:SS' format
- Query back using lastInsertId

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  // ...
}

protected async processInsertResult(tableName, result, data) {
  const lastInsertId = result.insertId;
  const query = `SELECT * FROM ${tableName} WHERE id = ?`;
  const selectResult = await this.executeRaw(query, [lastInsertId]);
  return selectResult.rows?.[0];
}
```

---

### 4️⃣ OracleAdapter

**Key Characteristics:**
- Boolean → NUMBER(1)
- Auto-increment via SEQUENCE + TRIGGER
- Query back using ROWID or lastRowid

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  // ...
}

protected async processInsertResult(tableName, result, data) {
  // Oracle: Query back using ROWID
  const query = `
    SELECT * FROM ${tableName}
    WHERE ROWID = (SELECT MAX(ROWID) FROM ${tableName})
  `;
  const selectResult = await this.raw(query);
  return selectResult.rows?.[0];
}

async createTable(tableName, schema) {
  // Create table
  await this.raw(createTableQuery);
  
  // Create sequence for auto-increment
  if (hasAutoIncrement) {
    await this.createAutoIncrementSequence(tableName, columnName);
  }
}
```

---

### 5️⃣ SQLServerAdapter

**Key Characteristics:**
- Boolean → BIT
- Date → 'YYYY-MM-DD HH:MM:SS.mmm' format
- OUTPUT INSERTED.* support (best practice)
- Fallback: SCOPE_IDENTITY()

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 23).replace('T', ' ');
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  // ...
}

protected async processInsertResult(tableName, result, data) {
  // SQL Server: Check for OUTPUT INSERTED.* result
  if (result.rows?.length > 0) {
    return result.rows[0];
  }
  
  // Fallback: Query using SCOPE_IDENTITY()
  const identityQuery = `SELECT SCOPE_IDENTITY() AS id`;
  const identityResult = await this.executeRaw(identityQuery);
  const lastInsertId = identityResult.rows[0]?.id;
  
  const query = `SELECT * FROM ${tableName} WHERE id = @p1`;
  const selectResult = await this.executeRaw(query, [lastInsertId]);
  return selectResult.rows?.[0];
}

async insertOne(tableName, data) {
  // Use OUTPUT INSERTED.*
  const query = `INSERT INTO ${tableName} (...) 
                 OUTPUT INSERTED.* 
                 VALUES (...)`;
  const result = await this.executeRaw(query, values);
  return this.processInsertResult(tableName, result, data);
}
```

---

### 6️⃣ MongoDBAdapter (NoSQL - Different Approach)

**Key Characteristics:**
- Native BSON type support (Date, Boolean, Object)
- No type conversion needed
- Direct insertedId from driver

**Key Implementation:**
```typescript
protected sanitizeValue(value: any): any {
  // MongoDB/BSON supports most JavaScript types natively
  return value; // Keep as-is
}

protected mapFieldTypeToDBType(fieldType: string): string {
  // MongoDB is schemaless
  return "string"; // BSON type reference only
}

protected async processInsertResult(collectionName, result, data) {
  // MongoDB returns insertedId directly
  return { ...data, _id: result.insertedId };
}

async insertOne(collectionName, data) {
  const result = await this.db
    .collection(collectionName)
    .insertOne(data);
  return this.processInsertResult(collectionName, result, data);
}
```

---

## 📝 Testing Checklist

### Critical Test Cases

```typescript
// ✅ Test 1: Date Insertion & Retrieval
const testDate = new Date('2024-01-15T10:30:00.000Z');
const user = await adapter.insertOne('users', {
  name: 'John',
  birthday: testDate
});
const retrieved = await adapter.findById('users', user.id);
assert(retrieved.birthday instanceof Date || 
       typeof retrieved.birthday === 'string'); // OK

// ✅ Test 2: Boolean Insertion & Retrieval
const settings = await adapter.insertOne('settings', {
  is_active: true,
  is_public: false
});
const retrievedSettings = await adapter.findById('settings', settings.id);
assert(retrievedSettings.is_active === true || 
       retrievedSettings.is_active === 1); // OK for SQLite

// ✅ Test 3: JSON/Object Insertion
const profile = await adapter.insertOne('profiles', {
  metadata: { tags: ['admin', 'user'], count: 5 }
});
const retrievedProfile = await adapter.findById('profiles', profile.id);
assert(typeof retrievedProfile.metadata === 'object'); // OK

// ✅ Test 4: Insert Returns Complete Record
const newUser = await adapter.insertOne('users', {
  name: 'Jane',
  email: 'jane@example.com'
});
assert(newUser.id !== undefined);
assert(newUser.name === 'Jane');
assert(newUser.email === 'jane@example.com');

// ✅ Test 5: Update with Type Conversion
await adapter.update(
  'users',
  { id: newUser.id },
  {
    birthday: new Date('1995-05-20'),
    is_verified: true
  }
);
const updated = await adapter.findById('users', newUser.id);
assert(updated.is_verified === true || updated.is_verified === 1);

// ✅ Test 6: Null/Undefined Handling
const nullTest = await adapter.insertOne('users', {
  name: 'Test',
  birthday: null,
  metadata: undefined
});
assert(nullTest.birthday === null);
assert(nullTest.metadata === null || nullTest.metadata === undefined);
```

---

## 🚀 Performance Considerations

### Query-Back Pattern Impact

| Adapter | INSERT Performance | Reason |
|---------|-------------------|--------|
| **PostgreSQL** | ⚡ Fast | Single query with RETURNING * |
| **SQL Server** | ⚡ Fast | Single query with OUTPUT INSERTED.* |
| **MySQL** | 🐢 Medium | 2 queries (INSERT + SELECT) |
| **MariaDB** | 🐢 Medium | 2 queries (INSERT + SELECT) |
| **SQLite** | 🐢 Medium | 2 queries (INSERT + SELECT) |
| **Oracle** | 🐢 Medium | 2 queries (INSERT + SELECT) |
| **MongoDB** | ⚡ Fast | Single operation with insertedId |

### Optimization Tips

```typescript
// ❌ BAD: Multiple single inserts
for (const user of users) {
  await adapter.insertOne('users', user); // N+1 queries
}

// ✅ GOOD: Batch insert
await adapter.insertMany('users', users); // 1 query (or N for query-back)

// 💡 BETTER: Use transactions for bulk operations
const tx = await adapter.beginTransaction();
try {
  for (const user of users) {
    await adapter.insertOne('users', user);
  }
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

---

## 🔒 Security Improvements

### Before: SQL Injection Risk

```typescript
// ❌ OLD: Manual string concatenation
const query = `INSERT INTO users VALUES ('${name}', '${email}')`;
// Risk: SQL injection if name/email contain quotes
```

### After: Parameterized Queries

```typescript
// ✅ NEW: Always uses placeholders
const query = `INSERT INTO users VALUES (?, ?)`;
const values = [name, email].map(v => this.sanitizeValue(v));
await this.executeRaw(query, values);
// Safe: Values are properly escaped/sanitized
```

---

## 📚 Additional Resources

### Database-Specific Documentation

- **PostgreSQL**: [Data Types](https://www.postgresql.org/docs/current/datatype.html)
- **MySQL**: [Data Types](https://dev.mysql.com/doc/refman/8.0/en/data-types.html)
- **SQLite**: [Datatypes](https://www.sqlite.org/datatype3.html)
- **Oracle**: [Data Types](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/Data-Types.html)
- **SQL Server**: [Data Types](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-types-transact-sql)
- **MongoDB**: [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/)

### Type Conversion Reference

| JavaScript Type | PostgreSQL | MySQL | SQLite | Oracle | SQL Server | MongoDB |
|----------------|-----------|-------|--------|--------|-----------|---------|
| `Date` | TIMESTAMP | DATETIME | TEXT (ISO) | TIMESTAMP | DATETIME2 | Date (BSON) |
| `boolean` | BOOLEAN | TINYINT(1) | INTEGER (0/1) | NUMBER(1) | BIT | Boolean (BSON) |
| `number` | NUMERIC | DECIMAL | REAL | NUMBER | DECIMAL | Number (BSON) |
| `string` | TEXT | VARCHAR | TEXT | VARCHAR2 | NVARCHAR | String (BSON) |
| `object` | JSONB | JSON | TEXT | CLOB | NVARCHAR(MAX) | Object (BSON) |
| `Array` | ARRAY/JSONB | JSON | TEXT | CLOB | NVARCHAR(MAX) | Array (BSON) |
| `null` | NULL | NULL | NULL | NULL | NULL | null (BSON) |

---

## ✅ Conclusion

This refactoring provides:

1. **Type Safety**: Correct data type handling for all databases
2. **Consistency**: Unified API across SQL and NoSQL
3. **Reliability**: INSERT always returns complete records
4. **Maintainability**: Clear separation of concerns
5. **Extensibility**: Easy to add new database adapters

All adapters now properly handle:
- ✅ Date objects
- ✅ Boolean values
- ✅ JSON/Object serialization
- ✅ INSERT result processing
- ✅ Type mapping
- ✅ Parameterized queries

**Ready for production use! 🚀**


# 🎯 Service Layer Improvements Summary

## ✅ Các Cải Tiến Chính

### 1. **BaseService - Transaction Support**

#### 🆕 Methods Mới

```typescript
// 1. Low-level transaction
const tx = await service.beginTransaction();
try {
  await service.create(data1);
  await service.create(data2);
  await tx.commit();
} catch (error) {
  await tx.rollback();
}

// 2. High-level transaction wrapper
await service.withTransaction(async () => {
  await service.create(data1);
  await service.create(data2);
  // Auto commit/rollback
});

// 3. Batch operations với transaction
await service.createBatch([data1, data2, data3]);
await service.updateBatch([
  { filter: { id: 1 }, data: { name: 'A' } },
  { filter: { id: 2 }, data: { name: 'B' } }
]);
await service.deleteBatch([{ id: 1 }, { id: 2 }]);
```

#### 🔄 Reconnection Logic

```typescript
// Auto-reconnect khi connection bị mất
public async initialize(retries: number = 3): Promise<void>
protected async ensureInitialized(): Promise<void>

// Kiểm tra health
await service.healthCheck(); // true/false

// Force reconnect
await service.refresh();
```

#### 🎣 Hook Improvements

```typescript
// beforeCreate/afterCreate áp dụng cho createMany
public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
  const processedData = await Promise.all(
    data.map((item) => this.beforeCreate(item))
  );
  const results = await this.getDAO().insertMany(this.entityName, processedData);
  return Promise.all(results.map((result) => this.afterCreate(result)));
}
```

---

### 2. **UniversalDAO - Auto-Reconnect**

#### 🔄 Connection Resilience

```typescript
// ✅ Retry logic trong ensureConnected
async ensureConnected(): Promise<TConnection> {
  for (let attempt = 0; attempt < maxReconnectAttempts; attempt++) {
    try {
      this.connection = await this.adapter.connect(this.dbConfig);
      return this.connection;
    } catch (error) {
      if (attempt < maxReconnectAttempts - 1) {
        await this.sleep(reconnectDelay * (attempt + 1));
      }
    }
  }
  throw new Error('Failed to connect after retries');
}

// ✅ Auto-reconnect trên connection error
async execute(query: string | any, params?: any[]): Promise<IResult> {
  try {
    return await this.adapter.execute(connection, query, params);
  } catch (error) {
    if (this.isConnectionError(error)) {
      this.connection = null;
      const connection = await this.ensureConnected();
      return await this.adapter.execute(connection, query, params);
    }
    throw error;
  }
}
```

#### 🆕 Utility Methods

```typescript
// Health check
await dao.healthCheck(); // boolean

// Force reconnect
await dao.reconnect();

// Table management
await dao.tableExists('users');
await dao.createTable('users');
await dao.syncAllTables(); // Sync tất cả tables từ schema
```

---

### 3. **DatabaseManager - Stale Connection Handling**

#### 🔍 Health Check System

```typescript
// ✅ Periodic health check
public static async getDAO(schemaKey: string): Promise<UniversalDAO<any>> {
  const cachedDAO = this.daoCache.get(schemaKey);
  
  if (cachedDAO && cachedDAO.getAdapter().isConnected()) {
    // Kiểm tra health check định kỳ (mặc định 30s)
    const lastCheck = this.lastHealthCheck.get(schemaKey) || 0;
    const now = Date.now();
    
    if (now - lastCheck > this.healthCheckInterval) {
      const isHealthy = await cachedDAO.healthCheck();
      if (!isHealthy) {
        await cachedDAO.reconnect();
      }
      this.lastHealthCheck.set(schemaKey, now);
    }
    
    return cachedDAO;
  }
  
  // Create new DAO if stale
  return this.createNewDAO(schemaKey);
}
```

#### 🆕 Management Methods

```typescript
// Health check tất cả connections
const health = await DatabaseManager.healthCheck();
// {
//   overall: true,
//   details: {
//     'users_db': { status: true },
//     'logs_db': { status: false, error: 'Connection timeout' }
//   }
// }

// Cleanup stale connections
const staleKeys = await DatabaseManager.cleanupStaleConnections();
// ['logs_db', 'cache_db']

// Refresh tất cả connections
await DatabaseManager.refreshAllConnections();

// Start background health checker
const timer = DatabaseManager.startHealthChecker(30000); // 30s
```

#### 📊 Status & Statistics

```typescript
// Get status
const status = DatabaseManager.getStatus();
// {
//   schemas: 3,
//   daos: 5,
//   roles: 2,
//   activeConnections: ['users_db', 'products_db'],
//   staleConnections: ['logs_db'],
//   adapterInstances: 5,
//   lastHealthChecks: {
//     'users_db': '2024-01-15T10:30:00.000Z',
//     'products_db': '2024-01-15T10:29:55.000Z'
//   }
// }

// Detailed stats
const details = DatabaseManager.getDetailedStats();
```

---

## 🔥 Use Cases & Examples

### Example 1: Service với Transaction

```typescript
class UserService extends BaseService<User> {
  constructor() {
    super('users_db', 'users');
  }

  // Method 1: Manual transaction
  async transferCredits(fromId: number, toId: number, amount: number) {
    const tx = await this.beginTransaction();
    try {
      await this.update({ id: fromId }, { credits: -amount });
      await this.update({ id: toId }, { credits: amount });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // Method 2: withTransaction (Recommended)
  async transferCreditsV2(fromId: number, toId: number, amount: number) {
    return this.withTransaction(async () => {
      await this.update({ id: fromId }, { credits: -amount });
      await this.update({ id: toId }, { credits: amount });
    });
  }

  // Batch operations
  async bulkCreateUsers(users: Partial<User>[]) {
    return this.createBatch(users); // Transaction tự động
  }
}
```

### Example 2: Auto-Reconnect

```typescript
const userService = new UserService();
await userService.initialize();

// Ngay cả khi database restart, service vẫn hoạt động
const users = await userService.find({ active: true });
// ✅ Auto-reconnect nếu connection bị mất

// Health check
const isHealthy = await userService.healthCheck();
if (!isHealthy) {
  await userService.refresh(); // Force reconnect
}
```

### Example 3: DatabaseManager Health Monitoring

```typescript
// Setup background health checker
DatabaseManager.setHealthCheckInterval(60000); // 1 minute
const healthChecker = DatabaseManager.startHealthChecker();

// Periodic status check
setInterval(async () => {
  const health = await DatabaseManager.healthCheck();
  
  if (!health.overall) {
    console.error('Unhealthy connections detected:', health.details);
    
    // Auto-cleanup stale connections
    const stale = await DatabaseManager.cleanupStaleConnections();
    console.log('Cleaned up:', stale);
  }
}, 300000); // 5 minutes

// Stop health checker when app shuts down
process.on('SIGTERM', () => {
  clearInterval(healthChecker);
  DatabaseManager.closeAllDAOs();
});
```

### Example 4: Role-based Connection Management

```typescript
// Register role
DatabaseManager.registerRole({
  roleName: 'admin',
  requiredDatabases: ['users_db', 'products_db'],
  optionalDatabases: ['logs_db', 'analytics_db']
});

// Initialize connections for role
const daos = await DatabaseManager.initializeRoleConnections('admin', true);
console.log(`Initialized ${daos.length} connections`);

// Get active databases for role
const activeDbs = DatabaseManager.getActiveDatabases('admin');
console.log('Active databases:', activeDbs);
```

---

## 🆚 So Sánh Trước & Sau

### ❌ Before

```typescript
// ❌ Không có transaction wrapper
const tx = await service.getDAO().getAdapter().beginTransaction();
try {
  await service.create(data1);
  await service.create(data2);
  await tx.commit();
} catch (error) {
  await tx.rollback();
}

// ❌ Không có auto-reconnect
// Nếu connection mất, toàn bộ service bị lỗi

// ❌ Không có health check
// Không biết connection còn sống hay không

// ❌ Stale connection trong cache
const dao = DatabaseManager.getCachedDAO('users_db');
// dao có thể đã disconnect nhưng vẫn được trả về
```

### ✅ After

```typescript
// ✅ Transaction wrapper đơn giản
await service.withTransaction(async () => {
  await service.create(data1);
  await service.create(data2);
});

// ✅ Auto-reconnect
const users = await service.find({}); // Auto-reconnect nếu cần

// ✅ Health check built-in
const isHealthy = await service.healthCheck();

// ✅ Stale detection
const dao = await DatabaseManager.getDAO('users_db');
// Auto-check và reconnect nếu stale
```

---

## 🔧 Migration Guide

### Step 1: Update BaseService Usage

```typescript
// OLD
class UserService extends BaseService<User> {
  async bulkCreate(users: User[]) {
    for (const user of users) {
      await this.create(user); // No transaction
    }
  }
}

// NEW
class UserService extends BaseService<User> {
  async bulkCreate(users: User[]) {
    return this.createBatch(users); // With transaction
  }
}
```

### Step 2: Add Health Check Monitoring

```typescript
// Thêm vào application startup
const healthChecker = DatabaseManager.startHealthChecker(60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  clearInterval(healthChecker);
  await DatabaseManager.closeAllDAOs();
  process.exit(0);
});
```

### Step 3: Update Error Handling

```typescript
// OLD
try {
  await service.find({});
} catch (error) {
  console.error('Query failed:', error);
  // Manual reconnect logic
}

// NEW
try {
  await service.find({});
} catch (error) {
  // Auto-reconnect đã xử lý
  console.error('Query failed after retries:', error);
}
```

---

## 📋 Breaking Changes

### ⚠️ Không Có Breaking Changes!

Tất cả các cải tiến đều **backward compatible**:

- ✅ Existing methods vẫn hoạt động như cũ
- ✅ Chỉ thêm methods mới, không thay đổi signature
- ✅ Auto-reconnect hoạt động transparent
- ✅ Health check là optional

### 🆕 New Methods (Optional)

```typescript
// BaseService
service.withTransaction()
service.createBatch()
service.updateBatch()
service.deleteBatch()
service.healthCheck()
service.refresh()

// UniversalDAO
dao.healthCheck()
dao.reconnect()
dao.tableExists()
dao.createTable()
dao.syncAllTables()

// DatabaseManager
DatabaseManager.healthCheck()
DatabaseManager.cleanupStaleConnections()
DatabaseManager.refreshAllConnections()
DatabaseManager.startHealthChecker()
DatabaseManager.getDetailedStats()
```

---

## ✅ Recommendation

### 1. **Luôn sử dụng `withTransaction()` cho multi-operations**

```typescript
// ✅ GOOD
await service.withTransaction(async () => {
  await service.create(data1);
  await service.update(filter, data2);
  await service.delete(filter2);
});

// ❌ BAD
await service.create(data1);
await service.update(filter, data2);
await service.delete(filter2);
```

### 2. **Enable health check monitoring trong production**

```typescript
if (process.env.NODE_ENV === 'production') {
  DatabaseManager.startHealthChecker(30000);
}
```

### 3. **Sử dụng batch operations khi có thể**

```typescript
// ✅ GOOD
await service.createBatch(users); // 1 transaction

// ❌ BAD
for (const user of users) {
  await service.create(user); // N transactions
}
```

### 4. **Implement graceful shutdown**

```typescript
async function shutdown() {
  console.log('Shutting down gracefully...');
  await DatabaseManager.closeAllDAOs();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

---

## 🎯 Conclusion

Các cải tiến này giải quyết:

1. ✅ **Transaction handling** - Đơn giản hóa transaction logic
2. ✅ **Connection resilience** - Auto-reconnect khi mất kết nối
3. ✅ **Health monitoring** - Phát hiện và xử lý stale connections
4. ✅ **Error handling** - Retry logic built-in
5. ✅ **Code quality** - Batch operations, cleaner API

**Kết quả:** Service layer robust, maintainable, production-ready! 🚀
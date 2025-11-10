# 🐳 Hướng dẫn Docker Compose cho @dqcai/orm

Tài liệu này hướng dẫn cách sử dụng Docker Compose để thiết lập các cơ sở dữ liệu khác nhau nhằm test thư viện **@dqcai/orm**.

---

## 📋 Mục lục

- [Giới thiệu](#giới-thiệu)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Quy trình chung](#quy-trình-chung)
- [MariaDB](#1-mariadb)
- [MongoDB](#2-mongodb)
- [MySQL](#3-mysql)
- [PostgreSQL](#4-postgresql)
- [SQL Server](#5-sql-server)
- [Oracle](#6-oracle)
- [Lệnh Docker hữu ích](#lệnh-docker-hữu-ích)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Giới thiệu

Thư mục `docker/` chứa các cấu hình Docker Compose để chạy các cơ sở dữ liệu khác nhau phục vụ testing thư viện ORM. Mỗi loại database có một thư mục riêng với:
- File `docker-compose.yml` - Cấu hình container
- File `init-*.sql/js` - Script khởi tạo database và users
- File `README.md` - Hướng dẫn cụ thể cho database đó

---

## 📁 Cấu trúc thư mục

```
project-root/
├── docker/
│   ├── mariadb/
│   │   ├── docker-compose.yml
│   │   ├── init-db.sql
│   │   └── README.md
│   ├── mongodb/
│   │   ├── docker-compose.yml
│   │   ├── init-mongo.js
│   │   └── README.md
│   ├── mysql/
│   │   ├── docker-compose.yml
│   │   ├── init-db.sql
│   │   └── README.md
│   ├── postgresql/
│   │   ├── docker-compose.yml
│   │   ├── init-db.sql
│   │   └── README.md
│   ├── sqlserver/
│   │   ├── docker-compose.yml
│   │   ├── init-db.sql
│   │   └── README.md
│   └── oracle/
│       ├── docker-compose.yml
│       ├── init-db.sql
│       └── README.md
├── test/
│   ├── test-mariadb.ts
│   ├── test-mongodb.ts
│   ├── test-mysql.ts
│   ├── test-postgresql.ts
│   ├── test-sqlserver.ts
│   └── test-oracle.ts
└── README.md
```

---

## 🔄 Quy trình chung

### Bước 1: Di chuyển vào thư mục database

```bash
# Từ thư mục gốc của project
cd docker/<database-type>

# Ví dụ:
cd docker/mariadb
# hoặc
cd docker/mongodb
```

### Bước 2: Kiểm tra các Docker container đang chạy

```bash
# Xem tất cả containers đang chạy
docker ps

# Xem tất cả containers (bao gồm cả đã dừng)
docker ps -a

# Xem chỉ container cụ thể
docker ps | grep mariadb
```

**Output mẫu:**
```
CONTAINER ID   IMAGE          STATUS         PORTS                    NAMES
abc123def456   mariadb:latest Up 5 minutes   0.0.0.0:3307->3306/tcp  mariadb-dev
```

### Bước 3: Dừng và xóa container hiện tại (nếu có)

```bash
# ⚠️ CHÚ Ý: Lệnh này sẽ XÓA TOÀN BỘ DỮ LIỆU!
# Chỉ dùng trong môi trường development/testing

# Dừng và xóa containers + volumes + networks
docker-compose down -v

# Nếu chỉ muốn dừng mà không xóa dữ liệu:
docker-compose down

# Nếu muốn xóa images đã tải về (tiết kiệm dung lượng):
docker-compose down -v --rmi all
```

### Bước 4: Khởi động Docker Compose

```bash
# Khởi động ở chế độ background (daemon)
docker-compose up -d

# Nếu muốn xem logs trực tiếp:
docker-compose up

# Build lại image trước khi start (nếu có thay đổi):
docker-compose up -d --build
```

### Bước 5: Kiểm tra trạng thái services

#### Windows (Docker Desktop):
1. Mở Docker Desktop
2. Chọn tab **Containers**
3. Kiểm tra status: **Running** (màu xanh)

#### Linux/macOS (Command line):
```bash
# Xem status các services trong docker-compose
docker-compose ps

# Output mẫu:
# NAME            STATE    PORTS
# mariadb-dev     Up       0.0.0.0:3307->3306/tcp
```

### Bước 6: Xem logs của services

```bash
# Xem logs của tất cả services
docker-compose logs

# Xem logs real-time (follow)
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f <service_name>

# Ví dụ:
docker-compose logs -f mariadb-db
docker-compose logs -f mongodb-db

# Xem 100 dòng log cuối
docker-compose logs --tail=100

# Xem logs trong khoảng thời gian
docker-compose logs --since 10m  # 10 phút gần đây
```

### Bước 7: Kết nối vào container

```bash
# Format chung:
docker exec -it <container_name> <command>

# Sẽ có ví dụ cụ thể cho từng loại database ở bên dưới
```

### Bước 8: Test ORM với database

```bash
# Quay về thư mục gốc của project
cd ../..

# Chạy test cho database tương ứng
tsx ./test/test-<database-type>.ts

# Ví dụ:
tsx ./test/test-mariadb.ts
tsx ./test/test-mongodb.ts
```

---

## 1. 🐬 MariaDB

### Cấu hình mặc định

```yaml
Service name: mariadb-db
Container name: mariadb-dev
Port: 3307:3306
Database: test
Root: root / Root@123
Admin User: admin / Admin@123
Test User: test / Test@123
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/mariadb
docker ps
docker-compose down -v
docker-compose up -d
docker-compose ps
docker-compose logs -f mariadb-db
```

### Bước 7: Kết nối vào MariaDB container

#### Sử dụng MariaDB client

```bash
# Kết nối với root user
docker exec -it mariadb-dev mariadb -uroot -pRoot@123

# Kết nối với admin user
docker exec -it mariadb-dev mariadb -uadmin -pAdmin@123 --database=test

# Kết nối với test user
docker exec -it mariadb-dev mariadb -utest -pTest@123 --database=test
```

#### Sử dụng bash shell

```bash
# Vào bash shell của container
docker exec -it mariadb-dev bash

# Trong bash, kết nối MariaDB:
mariadb -uroot -pRoot@123

# Hoặc dùng mysql command (tương thích):
mysql -uroot -pRoot@123
```

### Bước 8: Các lệnh SQL kiểm tra

```sql
-- Xem tất cả databases
SHOW DATABASES;

-- Xem users và quyền
SELECT User, Host FROM mysql.user;

-- Kiểm tra quyền của user cụ thể
SHOW GRANTS FOR 'admin'@'%';

-- Sử dụng database test
USE test;

-- Xem các bảng
SHOW TABLES;

-- Kiểm tra foreign keys của một bảng
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'test'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Test tạo database mới
CREATE DATABASE IF NOT EXISTS test_orm;
USE test_orm;

-- Test tạo bảng
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test data
INSERT INTO users (username, email) VALUES 
    ('john_doe', 'john@example.com'),
    ('jane_smith', 'jane@example.com');

-- Query data
SELECT * FROM users;

-- Cleanup
DROP TABLE users;
DROP DATABASE test_orm;

-- Thoát
EXIT;
```

### Bước 9: Chạy test ORM

```bash
# Quay về thư mục gốc
cd ../..

# Chạy test MariaDB
tsx ./test/test-mariadb.ts
```

**File test mẫu** (`test/test-mariadb.ts`):

```typescript
import { DatabaseManager, ServiceManager } from "@dqcai/orm";
import { MariaDBConfig } from "@dqcai/orm/types";

const dbConfig: MariaDBConfig = {
  databaseType: "mariadb",
  database: "test",
  host: "localhost",
  port: 3307,
  user: "admin",
  password: "Admin@123",
  connectionLimit: 5,
  timezone: "+07:00",
  charset: "utf8mb4",
};

async function testMariaDB() {
  try {
    console.log("🔧 Testing MariaDB connection...");
    
    // Register schema
    DatabaseManager.registerSchema("test", testSchema);
    
    // Initialize
    await DatabaseManager.initializeSchema("test", {
      dbConfig,
      validateVersion: true,
    });
    
    console.log("✅ MariaDB connection successful!");
    
    // Test CRUD operations
    const service = await ServiceManager.getInstance()
      .getService("test", "users");
    
    // Create
    const user = await service.create({
      username: "test_user",
      email: "test@example.com",
    });
    
    console.log("✅ Created user:", user);
    
    // Read
    const users = await service.find({});
    console.log("✅ Found users:", users.length);
    
    // Update
    await service.update({ id: user.id }, { email: "updated@example.com" });
    console.log("✅ Updated user");
    
    // Delete
    await service.delete({ id: user.id });
    console.log("✅ Deleted user");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await DatabaseManager.closeAll();
  }
}

testMariaDB();
```

---

## 2. 🍃 MongoDB

### Cấu hình mặc định

```yaml
Service name: mongodb-db
Container name: mongodb-dev
Port: 27017:27017
Database: test
Root: root / Root@123
Admin User: admin / Admin@123
Test User: test / Test@123
Web UI: http://localhost:8081 (webadmin / Web@123)
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/mongodb
docker ps
docker-compose down -v
docker-compose up -d
docker-compose ps
docker-compose logs -f mongodb-db
```

### Bước 7: Kết nối vào MongoDB container

#### Sử dụng mongosh (MongoDB Shell)

```bash
# Kết nối với root user
docker exec -it mongodb-dev mongosh -u root -p Root@123 --authenticationDatabase admin

# Kết nối với admin user
docker exec -it mongodb-dev mongosh -u admin -p Admin@123 --authenticationDatabase admin

# Kết nối với test user (chỉ có quyền trên database 'test')
docker exec -it mongodb-dev mongosh -u test -p Test@123 --authenticationDatabase admin test

# Kết nối không authentication (chỉ hoạt động nếu auth tắt)
docker exec -it mongodb-dev mongosh
```

#### Sử dụng bash shell

```bash
# Vào bash shell
docker exec -it mongodb-dev bash

# Trong bash, chạy mongosh:
mongosh -u root -p Root@123 --authenticationDatabase admin

# Hoặc dùng mongo client cũ (nếu có):
mongo -u root -p Root@123 --authenticationDatabase admin
```

### Bước 8: Các lệnh MongoDB kiểm tra

```javascript
// ============================================
// Kiểm tra databases và collections
// ============================================

// Xem tất cả databases
show dbs

// Chuyển sang database
use test

// Xem collections
show collections

// ============================================
// Kiểm tra users và quyền
// ============================================

// Chuyển sang admin database
use admin

// Xem tất cả users
db.getUsers()

// Xem quyền của user cụ thể
db.getUser("admin")

// ============================================
// Test CRUD operations
// ============================================

// Sử dụng database test
use test

// Insert document
db.users.insertOne({
    username: "john_doe",
    email: "john@example.com",
    age: 30,
    createdAt: new Date()
})

// Insert many documents
db.users.insertMany([
    { username: "jane_smith", email: "jane@example.com", age: 25 },
    { username: "bob_wilson", email: "bob@example.com", age: 35 }
])

// Find all documents
db.users.find()

// Find with pretty print
db.users.find().pretty()

// Find with filter
db.users.find({ age: { $gte: 30 } })

// Find one
db.users.findOne({ username: "john_doe" })

// Update document
db.users.updateOne(
    { username: "john_doe" },
    { $set: { email: "john.doe@example.com", age: 31 } }
)

// Update many
db.users.updateMany(
    { age: { $lt: 30 } },
    { $set: { status: "young" } }
)

// Delete document
db.users.deleteOne({ username: "john_doe" })

// Delete many
db.users.deleteMany({ age: { $gt: 40 } })

// Count documents
db.users.countDocuments()

// ============================================
// Test database creation (với admin user)
// ============================================

// Tạo database mới
use test_orm

// Tạo collection và insert data (database sẽ được tạo)
db.createCollection("products")
db.products.insertOne({
    name: "Laptop",
    price: 1500,
    category: "Electronics"
})

// Verify
show dbs
db.products.find()

// ============================================
// Indexes
// ============================================

// Tạo index
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 })

// Xem indexes
db.users.getIndexes()

// Drop index
db.users.dropIndex("email_1")

// ============================================
// Aggregation
// ============================================

db.users.aggregate([
    { $match: { age: { $gte: 25 } } },
    { $group: {
        _id: "$status",
        count: { $sum: 1 },
        avgAge: { $avg: "$age" }
    }}
])

// ============================================
// Cleanup
// ============================================

// Xóa collection
db.users.drop()
db.products.drop()

// Xóa database
use test_orm
db.dropDatabase()

// Thoát
exit
```

### Bước 9: Sử dụng Mongo Express (Web UI)

```bash
# Mở trình duyệt tại:
http://localhost:8081

# Login:
# Username: webadmin
# Password: Web@123

# Sau đó bạn có thể:
# - Xem tất cả databases
# - Tạo/xóa databases
# - Xem/sửa/xóa documents
# - Thực thi queries
# - Export/Import data
```

### Bước 10: Chạy test ORM

```bash
cd ../..
tsx ./test/test-mongodb.ts
```

**File test mẫu** (`test/test-mongodb.ts`):

```typescript
import { DatabaseManager, ServiceManager } from "@dqcai/orm";
import { MongoDBConfig } from "@dqcai/orm/types";

const dbConfig: MongoDBConfig = {
  databaseType: "mongodb",
  database: "test",
  host: "localhost",
  port: 27017,
  user: "admin",
  password: "Admin@123",
  authSource: "admin",
};

async function testMongoDB() {
  try {
    console.log("🔧 Testing MongoDB connection...");
    
    await DatabaseManager.initializeSchema("test", {
      dbConfig,
      validateVersion: true,
    });
    
    console.log("✅ MongoDB connection successful!");
    
    const service = await ServiceManager.getInstance()
      .getService("test", "users");
    
    // Create
    const user = await service.create({
      username: "test_user",
      email: "test@example.com",
      age: 25,
    });
    
    console.log("✅ Created user:", user);
    
    // Find
    const users = await service.find({ age: { $gte: 20 } });
    console.log("✅ Found users:", users.length);
    
    // Update
    await service.update(
      { _id: user._id }, 
      { $set: { age: 26 } }
    );
    
    // Delete
    await service.delete({ _id: user._id });
    
    console.log("✅ All tests passed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await DatabaseManager.closeAll();
  }
}

testMongoDB();
```

---

## 3. 🐬 MySQL

### Cấu hình mặc định

```yaml
Service name: mysql-db
Container name: mysql-dev
Port: 3308:3306
Database: test
Root: root / Root@123
Admin User: admin / Admin@123
Test User: test / Test@123
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/mysql
docker ps
docker-compose down -v
docker-compose up -d
docker-compose ps
docker-compose logs -f mysql-db
```

### Bước 7: Kết nối vào MySQL container

```bash
# Kết nối với root
docker exec -it mysql-dev mysql -uroot -pRoot@123

# Kết nối với admin user
docker exec -it mysql-dev mysql -uadmin -pAdmin@123 --database=test

# Vào bash shell
docker exec -it mysql-dev bash
```

### Bước 8: Các lệnh SQL kiểm tra

```sql
-- Tương tự như MariaDB (MySQL và MariaDB syntax gần như giống nhau)

-- Xem databases
SHOW DATABASES;

-- Xem users
SELECT User, Host FROM mysql.user;

-- Xem version
SELECT VERSION();

-- Xem storage engines
SHOW ENGINES;

-- Xem character sets
SHOW CHARACTER SET;

-- Test query
USE test;
SELECT NOW(), USER(), DATABASE();

EXIT;
```

### Bước 9: Chạy test ORM

```bash
cd ../..
tsx ./test/test-mysql.ts
```

---

## 4. 🐘 PostgreSQL

### Cấu hình mặc định

```yaml
Service name: postgres-db
Container name: postgres-dev
Port: 5432:5432
Database: test
Superuser: postgres / Postgres@123
Admin User: admin / Admin@123
Test User: test / Test@123
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/postgresql
docker ps
docker-compose down -v
docker-compose up -d
docker-compose ps
docker-compose logs -f postgres-db
```

### Bước 7: Kết nối vào PostgreSQL container

```bash
# Kết nối với postgres superuser
docker exec -it postgres-dev psql -U postgres

# Kết nối với admin user vào database test
docker exec -it postgres-dev psql -U admin -d test

# Kết nối với test user
docker exec -it postgres-dev psql -U test -d test

# Vào bash shell
docker exec -it postgres-dev bash

# Trong bash, dùng psql:
psql -U postgres
```

### Bước 8: Các lệnh PostgreSQL kiểm tra

```sql
-- ============================================
-- Kiểm tra databases và schemas
-- ============================================

-- Xem tất cả databases
\l
-- hoặc
SELECT datname FROM pg_database;

-- Kết nối vào database
\c test

-- Xem schemas
\dn

-- Xem tables trong schema public
\dt
-- hoặc
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Xem tất cả tables trong tất cả schemas
\dt *.*

-- ============================================
-- Kiểm tra users và quyền
-- ============================================

-- Xem users/roles
\du
-- hoặc
SELECT usename FROM pg_user;

-- Xem quyền của user trên database
\l

-- Xem quyền trên tables
\dp
-- hoặc
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='users';

-- ============================================
-- Test CRUD operations
-- ============================================

-- Tạo schema mới (nếu cần)
CREATE SCHEMA IF NOT EXISTS test_schema;

-- Set search path
SET search_path TO public;

-- Tạo bảng
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100),
    age INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data
INSERT INTO users (username, email, age) VALUES 
    ('john_doe', 'john@example.com', 30),
    ('jane_smith', 'jane@example.com', 25),
    ('bob_wilson', 'bob@example.com', 35);

-- Select
SELECT * FROM users;

-- Select with WHERE
SELECT * FROM users WHERE age >= 30;

-- Update
UPDATE users 
SET email = 'john.doe@example.com', age = 31 
WHERE username = 'john_doe';

-- Delete
DELETE FROM users WHERE username = 'bob_wilson';

-- Count
SELECT COUNT(*) FROM users;

-- ============================================
-- Indexes
-- ============================================

-- Tạo index
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_age ON users(age);

-- Xem indexes
\di
-- hoặc
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users';

-- Drop index
DROP INDEX idx_users_age;

-- ============================================
-- Foreign Keys
-- ============================================

-- Tạo bảng có foreign key
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert
INSERT INTO posts (user_id, title, content) VALUES 
    (1, 'First Post', 'Hello World!'),
    (1, 'Second Post', 'Learning PostgreSQL');

-- Join query
SELECT u.username, p.title, p.created_at
FROM users u
INNER JOIN posts p ON u.id = p.user_id;

-- ============================================
-- Database operations
-- ============================================

-- Tạo database mới (cần superuser)
CREATE DATABASE test_orm;

-- Kết nối vào database mới
\c test_orm

-- Tạo schema
CREATE SCHEMA app;

-- Tạo table trong schema
CREATE TABLE app.products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);

-- Insert
INSERT INTO app.products (name, price) VALUES 
    ('Laptop', 1500.00),
    ('Mouse', 25.50);

-- Query
SELECT * FROM app.products;

-- ============================================
-- Views
-- ============================================

-- Tạo view
CREATE VIEW active_users AS 
SELECT username, email 
FROM users 
WHERE is_active = TRUE;

-- Query view
SELECT * FROM active_users;

-- ============================================
-- Transactions
-- ============================================

-- Begin transaction
BEGIN;

UPDATE users SET age = age + 1 WHERE id = 1;
INSERT INTO posts (user_id, title) VALUES (1, 'Transaction Test');

-- Commit hoặc Rollback
COMMIT;
-- hoặc
ROLLBACK;

-- ============================================
-- System info
-- ============================================

-- Xem version
SELECT version();

-- Xem current database
SELECT current_database();

-- Xem current user
SELECT current_user;

-- Xem server settings
SHOW ALL;

-- Xem table size
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================
-- Cleanup
-- ============================================

-- Drop tables
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS active_users;

-- Drop schema
DROP SCHEMA IF EXISTS test_schema CASCADE;

-- Kết nối về postgres database
\c postgres

-- Drop database
DROP DATABASE IF EXISTS test_orm;

-- Thoát
\q
```

### Bước 9: Chạy test ORM

```bash
cd ../..
tsx ./test/test-postgresql.ts
```

**File test mẫu** (`test/test-postgresql.ts`):

```typescript
import { DatabaseManager, ServiceManager } from "@dqcai/orm";
import { PostgreSQLConfig } from "@dqcai/orm/types";

const dbConfig: PostgreSQLConfig = {
  databaseType: "postgresql",
  database: "test",
  host: "localhost",
  port: 5432,
  user: "admin",
  password: "Admin@123",
  max: 10, // Connection pool size
  idleTimeoutMillis: 30000,
};

async function testPostgreSQL() {
  try {
    console.log("🔧 Testing PostgreSQL connection...");
    
    await DatabaseManager.initializeSchema("test", {
      dbConfig,
      validateVersion: true,
    });
    
    console.log("✅ PostgreSQL connection successful!");
    
    // Test operations...
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await DatabaseManager.closeAll();
  }
}

testPostgreSQL();
```

---

## 5. 🗄️ SQL Server

### Cấu hình mặc định

```yaml
Service name: sqlserver-db
Container name: sqlserver-dev
Port: 1433:1433
Database: test
SA Password: YourStrong@Passw0rd
Admin User: admin / Admin@123
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/sqlserver
docker ps
docker-compose down -v
docker-compose up -d

# ⚠️ SQL Server cần thời gian khởi động lâu hơn (30-60s)
sleep 60

docker-compose ps
docker-compose logs -f sqlserver-db
```

### Bước 7: Kết nối vào SQL Server container

```bash
# Kết nối với SA user
docker exec -it sqlserver-dev /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Root@123' -C

# Kết nối với admin user
docker exec -it sqlserver-dev /opt/mssql-tools18/bin/sqlcmd -S localhost -U admin -P 'Admin@123' -d test

# Vào bash shell
docker exec -it sqlserver-dev bash

# Chạy script khi kết nối vào docker
# docker exec -it sqlserver	Mở terminal trong container đang chạy
# /opt/mssql-tools18/bin/sqlcmd	Đường dẫn mới của sqlcmd (trong SQL Server 2022+ images)
# -S localhost	Kết nối tới SQL Server nội bộ trong container
# -U sa -P 'Root@123'	Tài khoản và mật khẩu
# -C	Bỏ qua xác thực chứng chỉ SSL (TrustServerCertificate=True)
# Lệnh chạy script bằng tay này ok nhé
docker exec -it sqlserver-dev /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'Root@123' -C -i "/docker-entrypoint-initdb.d/init-db.sql" -e -b 
```

### Bước 8: Các lệnh T-SQL kiểm tra

```sql
-- ============================================
-- Kiểm tra databases
-- ============================================

-- Xem tất cả databases
SELECT name FROM sys.databases;
GO

-- Chuyển database
USE test;
GO

-- Xem tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
GO

-- ============================================
-- Kiểm tra users
-- ============================================

-- Xem logins
SELECT name, type_desc FROM sys.server_principals WHERE type IN ('S', 'U');
GO

-- Xem users trong database hiện tại
SELECT name, type_desc FROM sys.database_principals WHERE type IN ('S', 'U');
GO

-- ============================================
-- Test CRUD operations
-- ============================================

-- Tạo bảng
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) NOT NULL UNIQUE,
    email NVARCHAR(100),
    age INT,
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- Insert data
INSERT INTO users (username, email, age) VALUES 
    ('john_doe', 'john@example.com', 30),
    ('jane_smith', 'jane@example.com', 25),
    ('bob_wilson', 'bob@example.com', 35);
GO

-- Select
SELECT * FROM users;
GO

-- Update
UPDATE users 
SET email = 'john.doe@example.com', age = 31 
WHERE username = 'john_doe';
GO

-- Delete
DELETE FROM users WHERE username = 'bob_wilson';
GO

-- ============================================
-- Indexes
-- ============================================

-- Tạo index
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_age
```sql
CREATE INDEX idx_users_age ON users(age);
GO

-- Xem indexes
SELECT 
    i.name AS IndexName,
    t.name AS TableName,
    c.name AS ColumnName
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name = 'users';
GO

-- Drop index
DROP INDEX idx_users_age ON users;
GO

-- ============================================
-- Foreign Keys
-- ============================================

-- Tạo bảng có foreign key
CREATE TABLE posts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    title NVARCHAR(200),
    content NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Insert
INSERT INTO posts (user_id, title, content) VALUES 
    (1, 'First Post', 'Hello World!'),
    (1, 'Second Post', 'Learning SQL Server');
GO

-- Join query
SELECT u.username, p.title, p.created_at
FROM users u
INNER JOIN posts p ON u.id = p.user_id;
GO

-- ============================================
-- Transactions
-- ============================================

BEGIN TRANSACTION;

UPDATE users SET age = age + 1 WHERE id = 1;
INSERT INTO posts (user_id, title) VALUES (1, 'Transaction Test');

-- Commit hoặc Rollback
COMMIT;
-- hoặc
-- ROLLBACK;
GO

-- ============================================
-- Database operations
-- ============================================

-- Tạo database mới
CREATE DATABASE test_orm;
GO

-- Chuyển sang database mới
USE test_orm;
GO

-- Tạo schema
CREATE SCHEMA app;
GO

-- Tạo table trong schema
CREATE TABLE app.products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100),
    price DECIMAL(10,2)
);
GO

-- Insert
INSERT INTO app.products (name, price) VALUES 
    ('Laptop', 1500.00),
    ('Mouse', 25.50);
GO

-- Query
SELECT * FROM app.products;
GO

-- ============================================
-- Views
-- ============================================

USE test;
GO

-- Tạo view
CREATE VIEW active_users AS 
SELECT username, email 
FROM users 
WHERE is_active = 1;
GO

-- Query view
SELECT * FROM active_users;
GO

-- ============================================
-- Stored Procedures
-- ============================================

-- Tạo stored procedure
CREATE PROCEDURE GetUsersByAge
    @MinAge INT
AS
BEGIN
    SELECT * FROM users WHERE age >= @MinAge;
END;
GO

-- Execute procedure
EXEC GetUsersByAge @MinAge = 25;
GO

-- ============================================
-- System info
-- ============================================

-- Xem version
SELECT @@VERSION;
GO

-- Xem current database
SELECT DB_NAME();
GO

-- Xem current user
SELECT CURRENT_USER;
GO

-- Xem server properties
SELECT 
    SERVERPROPERTY('ProductVersion') AS Version,
    SERVERPROPERTY('ProductLevel') AS ProductLevel,
    SERVERPROPERTY('Edition') AS Edition;
GO

-- Xem database size
EXEC sp_spaceused;
GO

-- Xem table sizes
SELECT 
    t.NAME AS TableName,
    p.rows AS RowCounts,
    SUM(a.total_pages) * 8 AS TotalSpaceKB, 
    SUM(a.used_pages) * 8 AS UsedSpaceKB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE t.is_ms_shipped = 0
GROUP BY t.Name, p.Rows
ORDER BY t.Name;
GO

-- ============================================
-- Cleanup
-- ============================================

-- Drop objects
DROP VIEW IF EXISTS active_users;
GO

DROP PROCEDURE IF EXISTS GetUsersByAge;
GO

DROP TABLE IF EXISTS posts;
GO

DROP TABLE IF EXISTS users;
GO

-- Chuyển về master database
USE master;
GO

-- Drop database
DROP DATABASE IF EXISTS test_orm;
GO

-- Thoát (Ctrl+C hoặc)
EXIT
```

### Bước 9: Chạy test ORM

```bash
cd ../..
tsx ./test/test-sqlserver.ts
```

**File test mẫu** (`test/test-sqlserver.ts`):

```typescript
import { DatabaseManager, ServiceManager } from "@dqcai/orm";
import { SQLServerConfig } from "@dqcai/orm/types";

const dbConfig: SQLServerConfig = {
  databaseType: "sqlserver",
  database: "test",
  server: "localhost",
  port: 1433,
  user: "admin",
  password: "Admin@123",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function testSQLServer() {
  try {
    console.log("🔧 Testing SQL Server connection...");
    
    await DatabaseManager.initializeSchema("test", {
      dbConfig,
      validateVersion: true,
    });
    
    console.log("✅ SQL Server connection successful!");
    
    // Test operations...
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await DatabaseManager.closeAll();
  }
}

testSQLServer();
```

---

## 6. 🏛️ Oracle

### Cấu hình mặc định

```yaml
Service name: oracle-db
Container name: oracle-dev
Port: 1521:1521
Database: ORCLPDB1
System User: sys / Oracle@123 (as sysdba)
Admin User: admin / Admin@123
Service Name: ORCLPDB1
```

### Bước 1-6: Theo quy trình chung

```bash
cd docker/oracle
docker ps
docker-compose down -v
docker-compose up -d

# ⚠️ Oracle cần thời gian khởi động RẤT LÂU (5-10 phút lần đầu)
# Theo dõi logs để biết khi nào ready
docker-compose logs -f oracle-db

# Chờ đến khi thấy: "DATABASE IS READY TO USE!"
```

### Bước 7: Kết nối vào Oracle container

```bash
# Kết nối với SYSDBA
docker exec -it oracle-dev sqlplus sys/Oracle@123@ORCLPDB1 as sysdba

# Kết nối với admin user
docker exec -it oracle-dev sqlplus admin/Admin@123@ORCLPDB1

# Vào bash shell
docker exec -it oracle-dev bash

# Trong bash, dùng sqlplus:
sqlplus sys/Oracle@123@ORCLPDB1 as sysdba
```

### Bước 8: Các lệnh Oracle SQL kiểm tra

```sql
-- ============================================
-- Kiểm tra databases và users
-- ============================================

-- Xem current container database
SHOW CON_NAME;

-- Xem tất cả PDBs (Pluggable Databases)
SELECT name, open_mode FROM v$pdbs;

-- Xem users
SELECT username, account_status FROM dba_users ORDER BY username;

-- Xem current user
SELECT USER FROM DUAL;

-- ============================================
-- Chuyển sang PDB (nếu cần)
-- ============================================

-- Kết nối từ CDB sang PDB
ALTER SESSION SET CONTAINER = ORCLPDB1;

-- ============================================
-- Kiểm tra tablespaces
-- ============================================

-- Xem tablespaces
SELECT tablespace_name, status FROM dba_tablespaces;

-- Xem datafiles
SELECT file_name, tablespace_name, bytes/1024/1024 AS size_mb 
FROM dba_data_files;

-- ============================================
-- Test CRUD operations
-- ============================================

-- Tạo bảng
CREATE TABLE users (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR2(50) NOT NULL UNIQUE,
    email VARCHAR2(100),
    age NUMBER,
    is_active NUMBER(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert data
INSERT INTO users (username, email, age) VALUES 
    ('john_doe', 'john@example.com', 30);
INSERT INTO users (username, email, age) VALUES 
    ('jane_smith', 'jane@example.com', 25);
INSERT INTO users (username, email, age) VALUES 
    ('bob_wilson', 'bob@example.com', 35);
COMMIT;

-- Select
SELECT * FROM users;

-- Select với WHERE
SELECT * FROM users WHERE age >= 30;

-- Update
UPDATE users 
SET email = 'john.doe@example.com', age = 31 
WHERE username = 'john_doe';
COMMIT;

-- Delete
DELETE FROM users WHERE username = 'bob_wilson';
COMMIT;

-- Count
SELECT COUNT(*) FROM users;

-- ============================================
-- Sequences (Oracle's auto-increment)
-- ============================================

-- Tạo sequence
CREATE SEQUENCE user_seq
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

-- Sử dụng sequence
INSERT INTO users (id, username, email) 
VALUES (user_seq.NEXTVAL, 'test_user', 'test@example.com');
COMMIT;

-- Xem giá trị hiện tại
SELECT user_seq.CURRVAL FROM DUAL;

-- ============================================
-- Indexes
-- ============================================

-- Tạo index
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_age ON users(age);

-- Xem indexes
SELECT index_name, table_name, uniqueness 
FROM user_indexes 
WHERE table_name = 'USERS';

-- Xem columns trong index
SELECT index_name, column_name, column_position
FROM user_ind_columns
WHERE table_name = 'USERS'
ORDER BY index_name, column_position;

-- Drop index
DROP INDEX idx_users_age;

-- ============================================
-- Foreign Keys
-- ============================================

-- Tạo bảng có foreign key
CREATE TABLE posts (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id NUMBER,
    title VARCHAR2(200),
    content CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- Insert
INSERT INTO posts (user_id, title, content) VALUES 
    (1, 'First Post', 'Hello World!');
INSERT INTO posts (user_id, title, content) VALUES 
    (1, 'Second Post', 'Learning Oracle');
COMMIT;

-- Join query
SELECT u.username, p.title, p.created_at
FROM users u
INNER JOIN posts p ON u.id = p.user_id;

-- Xem foreign key constraints
SELECT 
    a.constraint_name,
    a.table_name,
    a.column_name,
    c_pk.table_name AS referenced_table,
    c_pk.column_name AS referenced_column
FROM user_cons_columns a
JOIN user_constraints c ON a.constraint_name = c.constraint_name
JOIN user_constraints c_pk ON c.r_constraint_name = c_pk.constraint_name
JOIN user_cons_columns c_pk_col ON c_pk.constraint_name = c_pk_col.constraint_name
WHERE c.constraint_type = 'R'
AND a.table_name = 'POSTS';

-- ============================================
-- Transactions
-- ============================================

-- Begin transaction (implicit in Oracle)
UPDATE users SET age = age + 1 WHERE id = 1;
INSERT INTO posts (user_id, title) VALUES (1, 'Transaction Test');

-- Commit hoặc Rollback
COMMIT;
-- hoặc
-- ROLLBACK;

-- ============================================
-- Views
-- ============================================

-- Tạo view
CREATE VIEW active_users AS 
SELECT username, email 
FROM users 
WHERE is_active = 1;

-- Query view
SELECT * FROM active_users;

-- Xem views
SELECT view_name FROM user_views;

-- ============================================
-- Stored Procedures
-- ============================================

-- Tạo procedure
CREATE OR REPLACE PROCEDURE get_users_by_age(
    p_min_age IN NUMBER
) AS
BEGIN
    FOR rec IN (SELECT * FROM users WHERE age >= p_min_age) LOOP
        DBMS_OUTPUT.PUT_LINE('User: ' || rec.username || ', Age: ' || rec.age);
    END LOOP;
END;
/

-- Enable output
SET SERVEROUTPUT ON;

-- Execute procedure
EXEC get_users_by_age(25);

-- ============================================
-- System info
-- ============================================

-- Xem version
SELECT * FROM v$version;

-- Xem database name
SELECT name FROM v$database;

-- Xem instance info
SELECT instance_name, status, version FROM v$instance;

-- Xem session info
SELECT sid, serial#, username, status FROM v$session WHERE username IS NOT NULL;

-- Xem table sizes
SELECT 
    segment_name AS table_name,
    ROUND(bytes/1024/1024, 2) AS size_mb
FROM user_segments
WHERE segment_type = 'TABLE'
ORDER BY bytes DESC;

-- ============================================
-- Cleanup
-- ============================================

-- Drop objects
DROP VIEW active_users;
DROP PROCEDURE get_users_by_age;
DROP TABLE posts CASCADE CONSTRAINTS;
DROP TABLE users CASCADE CONSTRAINTS;
DROP SEQUENCE user_seq;

-- Thoát
EXIT;
```

### Bước 9: Chạy test ORM

```bash
cd ../..
tsx ./test/test-oracle.ts
```

**File test mẫu** (`test/test-oracle.ts`):

```typescript
import { DatabaseManager, ServiceManager } from "@dqcai/orm";
import { OracleConfig } from "@dqcai/orm/types";

const dbConfig: OracleConfig = {
  databaseType: "oracle",
  user: "admin",
  password: "Admin@123",
  connectString: "localhost:1521/ORCLPDB1",
  // Hoặc dùng format riêng:
  // host: "localhost",
  // port: 1521,
  // serviceName: "ORCLPDB1",
};

async function testOracle() {
  try {
    console.log("🔧 Testing Oracle connection...");
    
    await DatabaseManager.initializeSchema("test", {
      dbConfig,
      validateVersion: true,
    });
    
    console.log("✅ Oracle connection successful!");
    
    // Test operations...
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await DatabaseManager.closeAll();
  }
}

testOracle();
```

---

## 🛠️ Lệnh Docker hữu ích

### Quản lý containers

```bash
# Liệt kê containers đang chạy
docker ps

# Liệt kê tất cả containers (bao gồm stopped)
docker ps -a

# Xem thông tin chi tiết container
docker inspect <container_name>

# Xem resource usage (CPU, Memory)
docker stats <container_name>

# Stop container
docker stop <container_name>

# Start container đã stop
docker start <container_name>

# Restart container
docker restart <container_name>

# Remove container
docker rm <container_name>

# Remove container đang chạy (force)
docker rm -f <container_name>
```

### Quản lý images

```bash
# Liệt kê images
docker images

# Pull image mới nhất
docker pull mariadb:latest
docker pull mongo:latest

# Remove image
docker rmi <image_name>

# Remove tất cả unused images
docker image prune -a
```

### Quản lý volumes

```bash
# Liệt kê volumes
docker volume ls

# Xem thông tin volume
docker volume inspect <volume_name>

# Remove volume
docker volume rm <volume_name>

# Remove tất cả unused volumes
docker volume prune

# Remove tất cả volumes (⚠️ CẨNTHẬN!)
docker volume prune -a
```

### Quản lý networks

```bash
# Liệt kê networks
docker network ls

# Xem thông tin network
docker network inspect <network_name>

# Remove network
docker network rm <network_name>

# Remove tất cả unused networks
docker network prune
```

### Docker Compose commands

```bash
# Khởi động services
docker-compose up -d

# Dừng services
docker-compose stop

# Dừng và xóa containers
docker-compose down

# Dừng, xóa containers và volumes
docker-compose down -v

# Rebuild images
docker-compose build

# Rebuild và restart
docker-compose up -d --build

# Scale services (nếu support)
docker-compose up -d --scale service_name=3

# Xem logs
docker-compose logs
docker-compose logs -f
docker-compose logs -f <service_name>
docker-compose logs --tail=100

# Xem processes
docker-compose top

# Execute command trong service
docker-compose exec <service_name> <command>

# Restart service
docker-compose restart <service_name>

# Pull latest images
docker-compose pull

# Validate docker-compose.yml
docker-compose config
```

### Cleanup commands

```bash
# Xóa tất cả stopped containers
docker container prune

# Xóa tất cả unused images
docker image prune -a

# Xóa tất cả unused volumes
docker volume prune

# Xóa tất cả unused networks
docker network prune

# Xóa tất cả (containers, images, volumes, networks)
docker system prune -a --volumes

# Xem disk usage
docker system df
```

---

## 🐛 Troubleshooting

### 1. Container không khởi động được

```bash
# Xem logs để tìm lỗi
docker-compose logs <service_name>

# Xem 100 dòng logs cuối
docker-compose logs --tail=100 <service_name>

# Kiểm tra port đã được sử dụng chưa
# Windows:
netstat -ano | findstr :3307

# Linux/macOS:
lsof -i :3307
netstat -tlnp | grep 3307
```

**Giải pháp:**
- Thay đổi port mapping trong `docker-compose.yml`
- Dừng service đang dùng port đó
- Kiểm tra file cấu hình có lỗi syntax không

### 2. Init script không chạy

```bash
# Kiểm tra file có được mount không
docker exec -it <container_name> ls -la /docker-entrypoint-initdb.d/

# Xem logs init
docker-compose logs <service_name> | grep -i init
```

**Giải pháp:**
- Init script chỉ chạy khi volume mới được tạo
- Phải xóa volume và tạo lại: `docker-compose down -v && docker-compose up -d`
- Kiểm tra đường dẫn file trong `docker-compose.yml`
- Kiểm tra quyền file: `chmod +r init-*.sql`

### 3. Không kết nối được vào database

```bash
# Kiểm tra container đang chạy
docker ps

# Kiểm tra network
docker network inspect <network_name>

# Test connection từ host
# MariaDB/MySQL:
telnet localhost 3307

# PostgreSQL:
telnet localhost 5432

# MongoDB:
telnet localhost 27017
```

**Giải pháp:**
- Đảm bảo container đã healthy: `docker-compose ps`
- Kiểm tra firewall
- Kiểm tra credentials trong config
- Đợi thêm vài giây (một số DB cần thời gian khởi động)

### 4. Permission denied errors

```bash
# Xem user trong container
docker exec -it <container_name> whoami

# Xem quyền của volumes
docker volume inspect <volume_name>
```

**Giải pháp:**
- Thêm user vào docker group (Linux): `sudo usermod -aG docker $USER`
- Chạy Docker Desktop với quyền administrator (Windows)
- Kiểm tra SELinux settings (Linux): `setenforce 0`

### 5. Out of disk space

```bash
# Kiểm tra disk usage
docker system df

# Xem chi tiết
docker system df -v
```

**Giải pháp:**
```bash
# Cleanup images không dùng
docker image prune -a

# Cleanup volumes không dùng
docker volume prune

# Cleanup tất cả
docker system prune -a --volumes
```

### 6. Container restart liên tục

```bash
# Xem logs
docker logs <container_name>

# Xem restart count
docker inspect <container_name> | grep -i restart
```

**Giải pháp:**
- Kiểm tra memory limit
- Kiểm tra health check configuration
- Xem logs để tìm lỗi cụ thể
- Tạm thời set `restart: "no"` để debug

### 7. Slow performance

```bash
# Kiểm tra resource usage
docker stats

# Kiểm tra disk I/O
docker stats --no-stream
```

**Giải pháp:**
- Tăng memory/CPU limits trong `docker-compose.yml`
- Sử dụng volume thay vì bind mount
- Enable BuildKit: `export DOCKER_BUILDKIT=1`
- Cleanup unused resources

---

## 📚 Tài liệu tham khảo

### Official Documentation

- **Docker Compose**: https://docs.docker.com/compose/
- **MariaDB**: https://mariadb.com/kb/en/docker-official-image/
- **MongoDB**: https://hub.docker.com/_/mongo
- **MySQL**: https://hub.docker.com/_/mysql
- **PostgreSQL**: https://hub.docker.com/_/postgres
- **SQL Server**: https://hub.docker.com/_/microsoft-mssql-server
- **Oracle**: https://container-registry.oracle.com/

### @dqcai/orm Documentation

- **Main README**: `../README.md`
- **API Documentation**: `../docs/API.md`
- **Configuration Guide**: `../docs/CONFIGURATION.md`
- **Migration Guide**: `../docs/MIGRATION.md`

---

## 📝 Best Practices

### 1. Development Environment

✅ **DO:**
- Sử dụng `docker-compose.yml` cho local development
- Mount init scripts để tự động setup database
- Sử dụng `.env` file cho credentials
- Set `restart: unless-stopped` cho stability

❌ **DON'T:**
- Commit credentials vào git
- Sử dụng production passwords trong development
- Skip volume cleanup khi test

### 2. Testing

✅ **DO:**
- Luôn dùng `docker-compose down -v` trước khi test lại
- Kiểm tra logs sau khi start containers
- Verify database đã sẵn sàng trước khi chạy test
- Sử dụng health checks

❌ **DON'T:**
- Chạy multiple tests song song trên cùng database
- Bỏ qua error messages
- Test trực tiếp trên production database

### 3. Cleanup

```bash
# Script cleanup tự động
#!/bin/bash

echo "🧹 Cleaning up Docker resources..."

# Stop all containers
docker-compose down -v

# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Remove unused networks
docker network prune -f

echo "✅ Cleanup completed!"
```

---

## 🎓 Tips & Tricks

### 1. Alias hữu ích

Thêm vào `~/.bashrc` hoặc `~/.zshrc`:

```bash
# Docker aliases
alias dc='docker-compose'
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcdv='docker-compose down -v'
alias dcl='docker-compose logs -f'
alias dps='docker ps'
alias dpsa='docker ps -a'

# Docker cleanup
alias dclean='docker system prune -a --volumes'
alias dclean-containers='docker container prune -f'
alias dclean-images='docker image prune -a -f'
alias dclean-volumes='docker volume prune -f'
```

### 2. Quick test script

Tạo file `test-all-databases.sh`:

```bash
#!/bin/bash

databases=("mariadb" "mongodb" "mysql" "postgresql" "sqlserver" "oracle")

for db in "${databases[@]}"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Testing $db..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    cd "docker/$db"
    docker-compose down -v
    docker-compose up -d
    
    # Wait for database to be ready
    sleep 30
    
    cd ../..
    tsx "./test/test-$db.ts"
    
    echo "✅ $db test completed"
    echo ""
done

echo "🎉 All tests completed!"
```

### 3. Monitor all containers

```bash
# Watch all containers
watch -n 2 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'

# Or use ctop (install: https://github.com/bcicen/ctop)
ctop
```

---

## ✅ Checklist

Trước khi chạy tests, hãy đảm bảo:

- [ ] Docker Desktop đang chạy
- [ ] Đã cd vào đúng thư mục database
- [ ] File `docker-compose.yml` và init scripts tồn tại
- [ ] Port không bị conflict với service khác
- [ ] Đã chạy `docker-compose down -v` nếu test lại
- [ ] Container đã healthy sau khi start
- [ ] Đã verify kết nối vào database
- [ ] File test ORM đã được cập nhật đúng config

---

## 🤝 Support

Nếu gặp vấn đề:

1. Kiểm tra logs: `docker-compose logs -f`
2. Xem phần Troubleshooting ở trên
3. Tìm issues tương tự trong GitHub repository
4. Tạo issue mới với:
   - Output của `docker-compose logs`
   - File `docker-compose.yml`
   - Steps to reproduce
   - Expected vs actual behavior

---

**Happy Testing! 🚀**
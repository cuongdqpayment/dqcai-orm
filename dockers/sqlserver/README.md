Dưới đây là phiên bản đã được cải thiện với init script để tạo user `admin`:

## 📁 Cấu trúc thư mục

```
docker/sqlserver/
├── docker-compose.yml
├── init-db.sql
└── entrypoint.sh
```

## 1️⃣ File `docker-compose.yml` (Đã sửa và giải thích)

```yaml
# version: '3.8'
# Không cần khai báo version nữa (deprecated từ Docker Compose v1.27.0+)

services:
  # ============================================
  # Tên dịch vụ: sqlserver-db
  # Đây là tên service được dùng trong docker-compose
  # Có thể tham chiếu bởi các service khác qua tên này
  # ============================================
  sqlserver-db:
    # ============================================
    # Image: SQL Server 2022 Developer Edition
    # mcr.microsoft.com = Microsoft Container Registry
    # mssql/server = Repository name
    # 2022-latest = Tag version
    # ============================================
    image: mcr.microsoft.com/mssql/server:2022-latest
    
    # ============================================
    # Container name: Tên container khi chạy
    # Giúp dễ dàng identify container khi dùng docker commands
    # ============================================
    container_name: sqlserver-dev
    
    # ============================================
    # Hostname: Tên hostname bên trong container
    # Hữu ích khi cần reference từ các container khác
    # ============================================
    hostname: sqlserver-host
    
    # ============================================
    # Environment variables
    # Các biến môi trường cấu hình SQL Server
    # ============================================
    environment:
      # ACCEPT_EULA=Y: Chấp nhận End-User License Agreement
      # BẮT BUỘC để SQL Server container có thể start
      ACCEPT_EULA: "Y"
      
      # SA_PASSWORD: Mật khẩu cho SA (System Administrator) user
      # Yêu cầu: Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số, ký tự đặc biệt
      # SA là superuser mặc định của SQL Server
      SA_PASSWORD: "YourStrong@Passw0rd"
      
      # MSSQL_PID: Product ID - Phiên bản SQL Server
      # Developer: Free, đầy đủ tính năng, chỉ dùng cho dev/test
      # Express: Free, giới hạn tính năng
      # Standard/Enterprise: Yêu cầu license key
      MSSQL_PID: "Developer"
      
      # MSSQL_COLLATION: Bộ mã sắp xếp và so sánh ký tự
      # SQL_Latin1_General_CP1_CI_AS:
      #   - Latin1_General: Bộ ký tự Latin
      #   - CP1: Code Page 1
      #   - CI: Case Insensitive (không phân biệt hoa thường)
      #   - AS: Accent Sensitive (phân biệt dấu)
      MSSQL_COLLATION: "SQL_Latin1_General_CP1_CI_AS"
      
      # MSSQL_LCID: Locale ID - Ngôn ngữ và khu vực
      # 1033 = English (United States)
      # 1066 = Vietnamese
      MSSQL_LCID: 1033
      
      # MSSQL_MEMORY_LIMIT_MB: Giới hạn memory SQL Server sử dụng
      # 2048 = 2GB RAM
      # Mặc định SQL Server sẽ dùng tối đa 80% RAM hệ thống
      MSSQL_MEMORY_LIMIT_MB: 2048
      
    # ============================================
    # Port mapping: host_port:container_port
    # 1433 là port mặc định của SQL Server
    # Map port 1433 của host -> port 1433 của container
    # Có thể đổi thành "1434:1433" nếu port 1433 đã được dùng
    # ============================================
    ports:
      - "1433:1433"
      
    # ============================================
    # Volumes: Persistent storage
    # ============================================
    volumes:
      # Data volume: Lưu trữ database files
      # sqlserver_data = named volume (managed by Docker)
      # /var/opt/mssql = thư mục data mặc định của SQL Server trong Linux container
      # Bao gồm: data files (.mdf), log files (.ldf), system databases
      - sqlserver_data:/var/opt/mssql
      
      # Init SQL script: Script khởi tạo database
      # ./init-db.sql = file SQL trong thư mục hiện tại
      # /docker-entrypoint-initdb.d/ = thư mục init scripts
      # :ro = read-only mount (bảo vệ file không bị ghi đè)
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
      
      # Entrypoint script: Script thực thi init-db.sql
      # Cần thiết vì SQL Server container không tự động chạy .sql files
      - ./entrypoint.sh:/usr/local/bin/entrypoint.sh:ro
    
    # ============================================
    # User: Chạy container với user cụ thể
    # mssql = user mặc định trong SQL Server container
    # Không nên chạy với root để bảo mật
    # ============================================
    user: mssql
    
    # ============================================
    # Command: Override default command
    # Chạy entrypoint.sh thay vì command mặc định
    # Script này sẽ:
    #   1. Start SQL Server
    #   2. Đợi SQL Server ready
    #   3. Chạy init-db.sql
    # ============================================
    command: /bin/bash /usr/local/bin/entrypoint.sh
    
    # ============================================
    # Restart policy
    # always = luôn restart container khi:
    #   - Container bị crash
    #   - Docker daemon restart
    #   - Server reboot
    # Alternatives: "no", "on-failure", "unless-stopped"
    # ============================================
    restart: always
    
    # ============================================
    # Health check: Kiểm tra container có healthy không
    # ============================================
    healthcheck:
      # Test command: Chạy lệnh kiểm tra
      # sqlcmd: SQL Server command-line tool
      # -S localhost: Connect tới localhost
      # -U sa: Sử dụng SA user
      # -P: Mật khẩu SA
      # -Q: Query để thực thi
      # SELECT 1: Query đơn giản nhất để test connection
      test: >
        /opt/mssql-tools/bin/sqlcmd 
        -S localhost 
        -U sa 
        -P "YourStrong@Passw0rd" 
        -Q "SELECT 1" 
        || exit 1
      
      # interval: Khoảng thời gian giữa các lần check (10 giây)
      interval: 10s
      
      # timeout: Thời gian tối đa cho mỗi lần check (5 giây)
      timeout: 5s
      
      # retries: Số lần thử lại trước khi đánh dấu unhealthy (5 lần)
      retries: 5
      
      # start_period: Thời gian chờ ban đầu trước khi bắt đầu check
      # SQL Server cần ~30-40s để khởi động lần đầu
      start_period: 40s
    
    # ============================================
    # Networks: Container sẽ join vào network nào
    # Nếu không khai báo, sẽ dùng default network
    # ============================================
    networks:
      - sqlserver-network

# ============================================
# Volumes Definition
# Khai báo các named volumes
# ============================================
volumes:
  # sqlserver_data: Volume lưu trữ database files
  # driver: local = lưu trữ trên disk của host machine
  # Docker sẽ tự động tạo và quản lý volume này
  # Location (Linux): /var/lib/docker/volumes/sqlserver_data
  # Location (Windows): C:\ProgramData\Docker\volumes\sqlserver_data
  sqlserver_data:
    driver: local

# ============================================
# Networks Definition
# Khai báo custom networks
# ============================================
networks:
  # sqlserver-network: Network riêng cho SQL Server
  # driver: bridge = default network driver
  # Cho phép containers trong cùng network giao tiếp với nhau
  sqlserver-network:
    driver: bridge
```

## 2️⃣ File `init-db.sql` (Script khởi tạo)

```sql
-- ============================================
-- init-db.sql
-- Script khởi tạo database và user cho SQL Server
-- ============================================

-- Bật chế độ hiển thị thông báo
-- NOCOUNT ON: Không hiển thị số dòng bị ảnh hưởng sau mỗi query
SET NOCOUNT ON;
GO

-- In ra thông báo bắt đầu
PRINT '========================================';
PRINT 'Starting SQL Server initialization...';
PRINT '========================================';
GO

-- ============================================
-- BƯỚC 1: Tạo database 'test'
-- ============================================

-- Kiểm tra xem database đã tồn tại chưa
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'test')
BEGIN
    PRINT 'Creating database [test]...';
    
    -- Tạo database với các tùy chọn:
    CREATE DATABASE [test]
    ON PRIMARY  -- File group chính
    (
        NAME = N'test_data',                    -- Tên logical của data file
        FILENAME = N'/var/opt/mssql/data/test.mdf',  -- Đường dẫn file .mdf
        SIZE = 100MB,                           -- Kích thước ban đầu
        MAXSIZE = UNLIMITED,                    -- Không giới hạn kích thước
        FILEGROWTH = 10MB                       -- Tăng 10MB mỗi lần hết chỗ
    )
    LOG ON      -- Log file
    (
        NAME = N'test_log',                     -- Tên logical của log file
        FILENAME = N'/var/opt/mssql/data/test_log.ldf', -- Đường dẫn file .ldf
        SIZE = 50MB,                            -- Kích thước ban đầu
        MAXSIZE = 1GB,                          -- Tối đa 1GB
        FILEGROWTH = 10MB                       -- Tăng 10MB mỗi lần
    );
    
    PRINT '✅ Database [test] created successfully';
END
ELSE
BEGIN
    PRINT '⚠️  Database [test] already exists';
END
GO

-- ============================================
-- BƯỚC 2: Tạo database 'core'
-- ============================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'core')
BEGIN
    PRINT 'Creating database [core]...';
    
    CREATE DATABASE [core]
    ON PRIMARY
    (
        NAME = N'core_data',
        FILENAME = N'/var/opt/mssql/data/core.mdf',
        SIZE = 100MB,
        MAXSIZE = UNLIMITED,
        FILEGROWTH = 10MB
    )
    LOG ON
    (
        NAME = N'core_log',
        FILENAME = N'/var/opt/mssql/data/core_log.ldf',
        SIZE = 50MB,
        MAXSIZE = 1GB,
        FILEGROWTH = 10MB
    );
    
    PRINT '✅ Database [core] created successfully';
END
ELSE
BEGIN
    PRINT '⚠️  Database [core] already exists';
END
GO

-- ============================================
-- BƯỚC 3: Tạo SQL Server Login 'admin'
-- Login = tài khoản để kết nối vào SQL Server instance
-- ============================================

-- Kiểm tra login đã tồn tại chưa
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'admin')
BEGIN
    PRINT 'Creating login [admin]...';
    
    -- Tạo login với SQL authentication
    CREATE LOGIN [admin]
    WITH PASSWORD = N'Admin@123',           -- Mật khẩu (phải đủ mạnh)
         DEFAULT_DATABASE = [test],         -- Database mặc định khi login
         CHECK_EXPIRATION = OFF,            -- Không kiểm tra hết hạn password
         CHECK_POLICY = OFF;                -- Không áp dụng Windows password policy
    
    PRINT '✅ Login [admin] created successfully';
END
ELSE
BEGIN
    PRINT '⚠️  Login [admin] already exists';
END
GO

-- ============================================
-- BƯỚC 4: Cấp quyền server-level cho login 'admin'
-- Server-level permissions: Quyền trên toàn bộ SQL Server instance
-- ============================================

PRINT 'Granting server-level permissions to [admin]...';

-- ALTER ANY DATABASE: Quyền tạo, sửa, xóa bất kỳ database nào
ALTER SERVER ROLE [dbcreator] ADD MEMBER [admin];

-- VIEW ANY DATABASE: Quyền xem metadata của tất cả databases
GRANT VIEW ANY DATABASE TO [admin];

-- VIEW SERVER STATE: Quyền xem trạng thái server (DMVs, system views)
GRANT VIEW SERVER STATE TO [admin];

PRINT '✅ Server-level permissions granted';
GO

-- ============================================
-- BƯỚC 5: Tạo User trong database 'test' và cấp quyền
-- User = mapping của Login vào một database cụ thể
-- ============================================

-- Chuyển sang database 'test'
USE [test];
GO

-- Kiểm tra user đã tồn tại chưa
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'admin')
BEGIN
    PRINT 'Creating user [admin] in database [test]...';
    
    -- Tạo user từ login
    CREATE USER [admin] FOR LOGIN [admin];
    
    PRINT '✅ User [admin] created in [test]';
END
ELSE
BEGIN
    PRINT '⚠️  User [admin] already exists in [test]';
END
GO

-- Cấp quyền database-level
PRINT 'Granting database permissions in [test]...';

-- db_owner: Full quyền trên database này
-- Bao gồm: tạo/xóa tables, views, procedures, permissions, etc.
ALTER ROLE [db_owner] ADD MEMBER [admin];

-- Hoặc cấp quyền chi tiết hơn:
-- ALTER ROLE [db_datareader] ADD MEMBER [admin];  -- Đọc dữ liệu
-- ALTER ROLE [db_datawriter] ADD MEMBER [admin];  -- Ghi dữ liệu
-- ALTER ROLE [db_ddladmin] ADD MEMBER [admin];    -- Tạo/sửa schema objects

PRINT '✅ Permissions granted in [test]';
GO

-- ============================================
-- BƯỚC 6: Tạo User trong database 'core' và cấp quyền
-- ============================================

USE [core];
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'admin')
BEGIN
    PRINT 'Creating user [admin] in database [core]...';
    CREATE USER [admin] FOR LOGIN [admin];
    PRINT '✅ User [admin] created in [core]';
END
ELSE
BEGIN
    PRINT '⚠️  User [admin] already exists in [core]';
END
GO

PRINT 'Granting database permissions in [core]...';
ALTER ROLE [db_owner] ADD MEMBER [admin];
PRINT '✅ Permissions granted in [core]';
GO

-- ============================================
-- BƯỚC 7: Tạo test table và sample data
-- ============================================

USE [test];
GO

-- Tạo bảng test nếu chưa có
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    PRINT 'Creating test table [users]...';
    
    CREATE TABLE [users] (
        id INT IDENTITY(1,1) PRIMARY KEY,      -- Auto-increment primary key
        username NVARCHAR(50) NOT NULL UNIQUE, -- Tên đăng nhập (unique)
        email NVARCHAR(100),                   -- Email
        full_name NVARCHAR(100),               -- Họ tên
        is_active BIT DEFAULT 1,               -- Trạng thái (1=active, 0=inactive)
        created_at DATETIME2 DEFAULT GETDATE(),-- Thời gian tạo
        updated_at DATETIME2 DEFAULT GETDATE() -- Thời gian cập nhật
    );
    
    PRINT '✅ Table [users] created';
    
    -- Insert sample data
    PRINT 'Inserting sample data...';
    
    INSERT INTO [users] (username, email, full_name) VALUES
        ('admin', 'admin@example.com', 'Administrator'),
        ('john_doe', 'john@example.com', 'John Doe'),
        ('jane_smith', 'jane@example.com', 'Jane Smith');
    
    PRINT '✅ Sample data inserted';
END
ELSE
BEGIN
    PRINT '⚠️  Table [users] already exists';
END
GO

-- ============================================
-- BƯỚC 8: Tạo metadata table trong database 'core'
-- ============================================

USE [core];
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_metadata')
BEGIN
    PRINT 'Creating metadata table...';
    
    CREATE TABLE [_metadata] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        [key] NVARCHAR(100) NOT NULL UNIQUE,   -- Key name
        [value] NVARCHAR(MAX),                 -- Value (JSON/text)
        description NVARCHAR(500),             -- Mô tả
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert initialization record
    INSERT INTO [_metadata] ([key], [value], description) VALUES
        ('initialized', 'true', 'Database initialized successfully'),
        ('version', '1.0.0', 'Database schema version'),
        ('created_date', CONVERT(NVARCHAR, GETDATE(), 120), 'Database creation date');
    
    PRINT '✅ Metadata table created and initialized';
END
ELSE
BEGIN
    PRINT '⚠️  Metadata table already exists';
END
GO

-- ============================================
-- BƯỚC 9: Summary
-- ============================================

-- Chuyển về master database
USE [master];
GO

PRINT '';
PRINT '========================================';
PRINT '✅ SQL Server initialization completed!';
PRINT '========================================';
PRINT '';
PRINT '📋 Summary:';
PRINT '   • Databases created: test, core';
PRINT '   • Login created: admin';
PRINT '   • Password: Admin@123';
PRINT '   • Permissions: db_owner on all databases';
PRINT '   • Sample data: users table in test database';
PRINT '';
PRINT '🔌 Connection strings:';
PRINT '   • Server=localhost,1433;Database=test;User Id=admin;Password=Admin@123;';
PRINT '   • Server=localhost,1433;Database=core;User Id=admin;Password=Admin@123;';
PRINT '';
PRINT '========================================';
GO
```

## 3️⃣ File `entrypoint.sh` (Script khởi động)

```bash
#!/bin/bash
# ============================================
# entrypoint.sh
# Script khởi động SQL Server và chạy init-db.sql
# ============================================

# set -e: Thoát ngay khi có lỗi
# set -u: Thoát khi sử dụng biến chưa được định nghĩa
# set -o pipefail: Thoát khi có lỗi trong pipeline
set -euo pipefail

# ============================================
# Hàm: Log với timestamp
# ============================================
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

# ============================================
# Hàm: Đợi SQL Server sẵn sàng
# ============================================
wait_for_sqlserver() {
    log "⏳ Waiting for SQL Server to be ready..."
    
    # Số lần thử tối đa (60 lần = 60 giây)
    local max_attempts=60
    local attempt=0
    
    # Loop cho đến khi SQL Server sẵn sàng hoặc timeout
    while [ $attempt -lt $max_attempts ]; do
        # Thử kết nối bằng sqlcmd
        # -S localhost: Server name
        # -U sa: Username
        # -P: Password
        # -Q: Query to execute
        # -b: Batch mode (exit with error code on failure)
        # 2>&1: Redirect stderr to stdout
        # | grep -q "1": Kiểm tra output có chứa "1" không
        if /opt/mssql-tools/bin/sqlcmd \
            -S localhost \
            -U sa \
            -P "${SA_PASSWORD}" \
            -Q "SELECT 1" \
            -b \
            2>&1 | grep -q "1"; then
            
            log "✅ SQL Server is ready!"
            return 0
        fi
        
        # Tăng số lần thử
        attempt=$((attempt + 1))
        
        # Log progress mỗi 10 giây
        if [ $((attempt % 10)) -eq 0 ]; then
            log "   Still waiting... (attempt $attempt/$max_attempts)"
        fi
        
        # Đợi 1 giây trước khi thử lại
        sleep 1
    done
    
    # Timeout
    log "❌ ERROR: SQL Server did not become ready in time!"
    return 1
}

# ============================================
# Hàm: Chạy init script
# ============================================
run_init_script() {
    local script_file="/docker-entrypoint-initdb.d/init-db.sql"
    
    # Kiểm tra file tồn tại
    if [ ! -f "$script_file" ]; then
        log "⚠️  Init script not found: $script_file"
        log "   Skipping initialization..."
        return 0
    fi
    
    log "📝 Running initialization script..."
    
    # Chạy SQL script
    # -i: Input file
    # -e: Echo input (hiển thị các lệnh đang chạy)
    # -v: Verbose mode
    if /opt/mssql-tools/bin/sqlcmd \
        -S localhost \
        -U sa \
        -P "${SA_PASSWORD}" \
        -i "$script_file" \
        -e \
        2>&1; then
        
        log "✅ Initialization script completed successfully!"
        
        # Tạo flag file để đánh dấu đã init
        # Tránh chạy lại script khi container restart
        touch /var/opt/mssql/.initialized
        
        return 0
    else
        log "❌ ERROR: Initialization script failed!"
        return 1
    fi
}

# ============================================
# Main execution
# ============================================

log "========================================="
log "🚀 Starting SQL Server container..."
log "========================================="

# Hiển thị thông tin cấu hình
log "Configuration:"
log "  • SQL Server version: 2022"
log "  • Product ID: ${MSSQL_PID}"
log "  • Collation: ${MSSQL_COLLATION:-default}"
log "  • Memory limit: ${MSSQL_MEMORY_LIMIT_MB:-unlimited} MB"

# ============================================
# BƯỚC 1: Khởi động SQL Server ở background
# ============================================

log "Starting SQL Server in background..."

# /opt/mssql/bin/sqlservr: SQL Server daemon
# &: Chạy ở background process
/opt/mssql/bin/sqlservr &

# Lưu PID của SQL Server process
SQLSERVER_PID=$!

log "SQL Server process started (PID: $SQLSERVER_PID)"

# ============================================
# BƯỚC 2: Đợi SQL Server sẵn sàng
# ============================================

# Gọi hàm wait_for_sqlserver
# || exit 1: Thoát nếu timeout
wait_for_sqlserver || exit 1

# ============================================
# BƯỚC 3: Chạy init script (chỉ lần đầu)
# ============================================

# Kiểm tra flag file
if [ ! -f /var/opt/mssql/.initialized ]; then
    log "First time initialization detected"
    
    # Chạy init script
    # || true: Không thoát nếu script fail (optional)
    run_init_script || {
        log "⚠️  Initialization failed, but SQL Server will continue running"
    }
else
    log "✅ Already initialized (skipping init script)"
fi

# ============================================
# BƯỚC 4: Keep container running
# ============================================

log "========================================="
log "✅ SQL Server is running and ready!"
log "========================================="
log ""
log "📋 Connection Info:"
log "   • Server: localhost,1433"
log "   • SA User: sa"
log "   • SA Password: ${SA_PASSWORD}"
log "   • Admin User: admin"
log "   • Admin Password: Admin@123"
log ""
log "💡 Use Ctrl+C to stop"
log "========================================="

# Đợi SQL Server process kết thúc
# Giữ container chạy cho đến khi SQL Server dừng
wait $SQLSERVER_PID

# Cleanup khi container dừng
log "SQL Server process ended. Container shutting down..."
exit 0
```

## 4️⃣ Cấp quyền thực thi cho script

```bash
# Linux/macOS
chmod +x entrypoint.sh

# Windows (Git Bash)
chmod +x entrypoint.sh

# Hoặc update git config
git update-index --chmod=+x entrypoint.sh
```

## 5️⃣ Chạy và kiểm tra

```bash
# Bước 1: Dừng và xóa container cũ
docker-compose down -v

# Bước 2: Khởi động
docker-compose up -d

# Bước 3: Xem logs để kiểm tra init process
docker-compose logs -f sqlserver-db

# Output mong đợi:
# =========================================
# 🚀 Starting SQL Server container...
# =========================================
# Starting SQL Server in background...
# SQL Server process started (PID: 123)
# ⏳ Waiting for SQL Server to be ready...
# ✅ SQL Server is ready!
# 📝 Running initialization script...
# Creating database [test]...
# ✅ Database [test] created successfully
# ...
# ✅ SQL Server initialization completed!
```

## 6️⃣ Test kết nối

```bash
# Test với SA user
docker exec -it sqlserver-dev /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U sa -P 'YourStrong@Passw0rd' \
    -Q "SELECT name FROM sys.databases;"

# Test với admin user
docker exec -it sqlserver-dev /opt/mssql-tools/bin/sqlcmd \
    -S localhost -U admin -P 'Admin@123' -d test \
    -Q "SELECT * FROM users;"

# Kết quả mong đợi:
# username     email                 full_name
# ------------ -------------------- --------------
# admin        admin@example.com     Administrator
# john_doe     john@example.com      John Doe
# jane_smith   jane@example.com      Jane Smith
```

## 7️⃣ Cập nhật test ORM

```typescript
// test/test-sqlserver.ts
const dbConfig: SQLServerConfig = {
  databaseType: "sqlserver",
  database: "test",
  server: "localhost",
  port: 1433,
  user: "admin",              // ✅ Dùng admin thay vì sa
  password: "Admin@123",      // ✅ Password mới
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};
```

Với cấu hình này, bạn có:
- ✅ Database `test` và `core` tự động tạo
- ✅ User `admin` với password `Admin@123`
- ✅ Full quyền tạo/xóa databases
- ✅ Sample data để test
- ✅ Health check để đảm bảo SQL Server sẵn sàng
- ✅ Init script chỉ chạy 1 lần duy nhất
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
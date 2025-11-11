-- Tạo user admin với quyền CREATE DATABASE
CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY 'Admin@123';

-- Cấp quyền tạo database
GRANT CREATE ON *.* TO 'admin'@'%';

-- Cấp full quyền trên tất cả database
GRANT ALL PRIVILEGES ON *.* TO 'admin'@'%';

-- Cấp quyền đọc INFORMATION_SCHEMA
GRANT SELECT ON `information_schema`.* TO 'admin'@'%';

FLUSH PRIVILEGES;
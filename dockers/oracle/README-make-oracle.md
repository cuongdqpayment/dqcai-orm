Tạo Docker cho cơ sở dữ liệu **Oracle** phức tạp hơn đáng kể so với PostgreSQL, MySQL hay MariaDB vì Oracle không cung cấp các image chính thức trên Docker Hub theo cách tương tự.

Thay vào đó, bạn cần sử dụng một **script của Oracle** để tự xây dựng (build) image Docker từ các file cài đặt (binaries) của Oracle Database mà bạn phải tải về trước.

Dưới đây là hướng dẫn các bước bạn cần thực hiện:

-----

## ⚠️ Bước 1: Tải File Cài Đặt Oracle

Bạn cần tải xuống file cài đặt Oracle Database từ trang web chính thức của Oracle.

  * Truy cập trang [Oracle Technology Network (OTN) - Downloads](https://www.oracle.com/database/technologies/oracle-database-software-downloads.html) và tải phiên bản bạn muốn (ví dụ: **Oracle Database 23c Free**, **19c Express Edition (XE)** hoặc **Standard Edition**).
  * Đảm bảo bạn tải file cài đặt phù hợp với Linux (thường là file ZIP hoặc RPM).

-----

## 🛠️ Bước 2: Chuẩn bị Script Build Image

Oracle cung cấp các script giúp tự động hóa việc xây dựng image Docker.

1.  **Tải Script Docker Oracle:**

      * Clone hoặc tải về repository chứa các script Docker của Oracle từ GitHub:
        ```bash
        git clone https://github.com/oracle/docker-images.git
        ```

2.  **Đặt File Cài Đặt vào Đúng Thư mục:**

      * Điều hướng đến thư mục script tương ứng với phiên bản bạn đã tải (ví dụ: nếu bạn tải Oracle XE 21c, vào thư mục `docker-images/OracleDatabase/SingleInstance/dockerfiles/21.3.0`).
      * **Đặt file ZIP** cài đặt Oracle bạn đã tải ở Bước 1 vào thư mục này.

-----

## 🚀 Bước 3: Build Image Docker Oracle

Chạy script để build image. Sử dụng lệnh `docker build` (không dùng `docker-compose` ở bước này):

1.  **Điều hướng đến thư mục script:**
    ```bash
    cd docker-images/OracleDatabase/SingleInstance/dockerfiles/21.3.0
    ```
2.  **Chạy lệnh build:**
    ```bash
    # Thay thế tên file zip nếu cần
    docker build -t oracle/database:21.3.0-xe .
    ```
    Quá trình này sẽ mất thời gian vì Docker phải giải nén file cài đặt và xây dựng toàn bộ image.

-----

## ⚙️ Bước 4: Chạy Container bằng Docker Compose

Sau khi image đã được build thành công, bạn có thể tạo file `docker-compose.yml` để khởi động container và quản lý nó.

```yaml
version: '3.8'

services:
  oracle-db:
    # Sử dụng tên image bạn vừa build
    image: oracle/database:21.3.0-xe
    
    # Đặt biến môi trường
    environment:
      # BẮT BUỘC: Đặt mật khẩu, phải đáp ứng các yêu cầu về độ phức tạp của Oracle
      ORACLE_PWD: YourStrongPassword123
      # Tên PDB (Pluggable Database) mặc định
      ORACLE_PDB: ORCLPDB1 
      
    # Ánh xạ cổng (Mặc định của Oracle là 1521)
    ports:
      - "1521:1521"
      - "5500:5500" # Cổng cho Enterprise Manager (APEX)
      
    # Thiết lập Volume
    volumes:
      - oracle_data:/opt/oracle/oradata
      
    # Tăng giới hạn bộ nhớ (Oracle cần nhiều RAM)
    shm_size: 2g 
    restart: always

volumes:
  oracle_data:
```

### Chạy Dịch vụ:

```bash
docker-compose up -d
```

### Thông tin Kết nối:

  * **Host:** `localhost`
  * **Cổng:** `1521`
  * **Service Name (Tên Dịch vụ):** Thường là `ORCLPDB1` (tùy thuộc vào biến môi trường `ORACLE_PDB` hoặc cấu hình image)
  * **User:** `SYSTEM` hoặc `SYS`
  * **Password:** Mật khẩu bạn đã đặt trong `ORACLE_PWD`

Quá trình này yêu cầu nhiều bước chuẩn bị hơn, nhưng sau khi image được build, việc quản lý bằng Docker Compose sẽ trở nên dễ dàng.

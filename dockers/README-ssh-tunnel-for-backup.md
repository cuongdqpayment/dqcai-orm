# Hướng dẫn thiết lập SSH Tunnel cho Database Replication và Backup

## 📋 Tổng quan

SSH Tunnel là giải pháp mạnh mẽ cho phép bạn kết nối an toàn đến các database server từ xa, đặc biệt hữu ích khi:
- Server từ xa không expose port database ra Internet
- Cần mã hóa kết nối giữa client và server
- Vượt qua firewall hoặc NAT
- Thiết lập đồng bộ active/standby giữa các database server
- Backup/restore dữ liệu an toàn qua mạng

Hướng dẫn này áp dụng cho mọi loại database: **MongoDB, PostgreSQL, MySQL, Redis, Elasticsearch**, v.v.

---

## 🔐 Phần 1: Cơ bản về SSH Tunnel và Port Forwarding

### 1.1. Các loại Port Forwarding

#### **Local Port Forwarding** (Phổ biến nhất)
Chuyển tiếp port local đến remote server qua SSH. Sử dụng khi bạn muốn truy cập service trên remote server từ local machine.

```bash
ssh -L [local_port]:[remote_host]:[remote_port] user@ssh_server
```

**Ví dụ:**
```bash
# MongoDB
ssh -L 27017:localhost:27017 user@remote_server

# PostgreSQL
ssh -L 5432:localhost:5432 user@remote_server

# MySQL
ssh -L 3306:localhost:3306 user@remote_server

# Redis
ssh -L 6379:localhost:6379 user@remote_server
```

#### **Remote Port Forwarding**
Chuyển tiếp port từ remote server về local machine. Sử dụng khi remote server cần truy cập service trên local machine của bạn.

```bash
ssh -R [remote_port]:[local_host]:[local_port] user@ssh_server
```

**Ví dụ:**
```bash
# Cho phép remote server truy cập local database
ssh -R 5432:localhost:5432 user@remote_server
```

#### **Dynamic Port Forwarding** (SOCKS Proxy)
Tạo SOCKS proxy để chuyển tiếp nhiều kết nối động.

```bash
ssh -D [local_port] user@ssh_server
```

---

## 🚀 Phần 2: Thiết lập SSH Tunnel cho các Database

### 2.1. Chuẩn bị SSH Key Authentication

#### **Tạo SSH Key Pair**

**Linux/macOS:**
```bash
# Tạo key Ed25519 (khuyến nghị)
ssh-keygen -t ed25519 -C "database-tunnel"

# Hoặc RSA 4096-bit
ssh-keygen -t rsa -b 4096 -C "database-tunnel"
```

**Windows (PowerShell):**
```powershell
ssh-keygen -t ed25519 -C "database-tunnel"
```

#### **Copy Public Key lên Server**

**Linux/macOS:**
```bash
# Copy key lên server
ssh-copy-id user@remote_server

# Nếu SSH dùng port khác
ssh-copy-id -p 2222 user@remote_server
```

**Windows hoặc copy thủ công:**
```bash
# 1. Hiển thị public key
cat ~/.ssh/id_ed25519.pub

# 2. SSH vào server
ssh user@remote_server

# 3. Thêm vào authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste public key vào, lưu lại

# 4. Set permissions
chmod 600 ~/.ssh/authorized_keys
```

---

### 2.2. Thiết lập SSH Tunnel cơ bản

#### **Kịch bản 1: Database trên Remote Server, truy cập từ Local**

```bash
# Cú pháp chung
ssh -L [local_port]:localhost:[database_port] user@remote_server

# MongoDB
ssh -L 27017:localhost:27017 user@remote_server

# PostgreSQL
ssh -L 5432:localhost:5432 user@remote_server

# MySQL/MariaDB
ssh -L 3306:localhost:3306 user@remote_server

# Redis
ssh -L 6379:localhost:6379 user@remote_server

# Elasticsearch
ssh -L 9200:localhost:9200 user@remote_server

# Nếu SSH dùng port khác
ssh -p 2222 -L 5432:localhost:5432 user@remote_server

# Forward về port local khác để tránh conflict
ssh -L 5433:localhost:5432 user@remote_server
```

**Sau khi tunnel được thiết lập, mở terminal mới và kết nối:**

```bash
# MongoDB
mongosh "mongodb://localhost:27017"

# PostgreSQL
psql -h localhost -p 5432 -U username -d database

# MySQL
mysql -h 127.0.0.1 -P 3306 -u username -p

# Redis
redis-cli -h localhost -p 6379
```

#### **Kịch bản 2: Database trong Docker Container**

```bash
# Nếu container đã map port ra host
ssh -L 5432:localhost:5432 user@remote_server

# Nếu container không map port, forward trực tiếp đến container IP
# (Cần biết container IP, kiểm tra bằng: docker inspect container_name)
ssh -L 5432:172.17.0.2:5432 user@remote_server

# Forward đến container thông qua Docker network
ssh -L 5432:postgres-container:5432 user@remote_server
```

#### **Kịch bản 3: Chạy SSH Tunnel ở Background**

```bash
# Thêm option -f (fork) và -N (no command)
ssh -f -N -L 27017:localhost:27017 user@remote_server

# Kiểm tra tunnel đang chạy
ps aux | grep ssh
# hoặc
ps aux | grep "ssh.*27017"

# Kiểm tra port đang listen
netstat -tuln | grep 27017
# hoặc
ss -tuln | grep 27017
# hoặc (macOS/Linux)
lsof -i :27017

# Đóng tunnel cụ thể
pkill -f "ssh.*27017"

# Đóng tất cả SSH tunnel
pkill -f "ssh -f -N"
```

#### **Kịch bản 4: Multiple Port Forwarding**

```bash
# Forward nhiều database ports cùng lúc
ssh -L 27017:localhost:27017 \
    -L 5432:localhost:5432 \
    -L 3306:localhost:3306 \
    -L 6379:localhost:6379 \
    user@remote_server

# Hoặc background mode
ssh -f -N \
    -L 27017:localhost:27017 \
    -L 5432:localhost:5432 \
    -L 3306:localhost:3306 \
    user@remote_server
```

#### **Kịch bản 5: Forward đến nhiều Remote Hosts**

```bash
# Kết nối đến database server khác thông qua SSH bastion
ssh -L 5432:db-server-1.internal:5432 \
    -L 3306:db-server-2.internal:3306 \
    user@bastion-host

# Sau đó kết nối
psql -h localhost -p 5432 -U user -d dbname
mysql -h 127.0.0.1 -P 3306 -u user -p
```

---

### 2.3. Cấu hình SSH Config (Strongly Recommended)

Tạo file config để không phải gõ lệnh dài và dễ quản lý.

**Linux/macOS:**
```bash
nano ~/.ssh/config
```

**Windows:**
```cmd
notepad %USERPROFILE%\.ssh\config
```

**Nội dung file config:**

```conf
# MongoDB Production Server
Host mongo-prod
    HostName 203.0.113.10
    User dbadmin
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    LocalForward 27017 localhost:27017
    ServerAliveInterval 60
    ServerAliveCountMax 3
    Compression yes

# PostgreSQL Server
Host postgres-prod
    HostName db.example.com
    User postgres
    Port 22
    IdentityFile ~/.ssh/id_rsa
    LocalForward 5432 localhost:5432
    ServerAliveInterval 60

# MySQL Server with custom SSH port
Host mysql-prod
    HostName mysql.example.com
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    LocalForward 3306 localhost:3306
    ServerAliveInterval 60

# Multiple databases on same server
Host all-db-prod
    HostName alldb.example.com
    User dbadmin
    LocalForward 27017 localhost:27017
    LocalForward 5432 localhost:5432
    LocalForward 3306 localhost:3306
    LocalForward 6379 localhost:6379
    ServerAliveInterval 60

# Database server behind bastion/jump host
Host secure-db
    HostName 10.0.1.100
    User dbadmin
    ProxyJump bastion.example.com
    LocalForward 5432 localhost:5432
    ServerAliveInterval 60

# Redis Cluster với multiple nodes
Host redis-cluster
    HostName redis.example.com
    User redis
    LocalForward 6379 localhost:6379
    LocalForward 6380 localhost:6380
    LocalForward 6381 localhost:6381
    ServerAliveInterval 60
```

**Sử dụng:**

```bash
# Kết nối đơn giản, tự động setup port forwarding
ssh mongo-prod

# Chạy background
ssh -f -N postgres-prod

# Kết nối qua bastion host
ssh secure-db

# Kiểm tra connection
ssh -T mongo-prod
```

---

## 🔄 Phần 3: Backup và Restore Database qua SSH Tunnel

### 3.1. MongoDB

#### **Backup qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 27017:localhost:27017 user@remote_server

# 2. Backup toàn bộ database
mongodump --uri="mongodb://localhost:27017" \
    --out="./backup/$(date +%Y%m%d_%H%M%S)"

# 3. Backup database cụ thể
mongodump --uri="mongodb://localhost:27017" \
    --db="production_db" \
    --out="./backup" \
    --gzip

# 4. Backup với authentication
mongodump --uri="mongodb://username:password@localhost:27017/admin" \
    --db="production_db" \
    --out="./backup" \
    --gzip

# 5. Đóng tunnel
pkill -f "ssh.*27017"
```

#### **Restore qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 27017:localhost:27017 user@remote_server

# 2. Restore database
mongorestore --uri="mongodb://localhost:27017" \
    --db="production_db" \
    --gzip \
    --drop \
    "./backup/production_db"

# 3. Restore collection cụ thể
mongorestore --uri="mongodb://localhost:27017" \
    --db="production_db" \
    --collection="users" \
    --gzip \
    "./backup/production_db/users.bson.gz"

# 4. Đóng tunnel
pkill -f "ssh.*27017"
```

---

### 3.2. PostgreSQL

#### **Backup qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 5432:localhost:5432 user@remote_server

# 2. Backup toàn bộ database
pg_dump -h localhost -p 5432 -U username -d database_name \
    > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Backup compressed
pg_dump -h localhost -p 5432 -U username -d database_name \
    | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 4. Backup custom format (khuyên dùng, hỗ trợ parallel restore)
pg_dump -h localhost -p 5432 -U username -Fc -d database_name \
    -f backup_$(date +%Y%m%d_%H%M%S).dump

# 5. Backup only schema
pg_dump -h localhost -p 5432 -U username -d database_name \
    --schema-only > schema_backup.sql

# 6. Backup only data
pg_dump -h localhost -p 5432 -U username -d database_name \
    --data-only > data_backup.sql

# 7. Backup specific tables
pg_dump -h localhost -p 5432 -U username -d database_name \
    -t users -t orders > tables_backup.sql

# 8. Đóng tunnel
pkill -f "ssh.*5432"
```

#### **Restore qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 5432:localhost:5432 user@remote_server

# 2. Restore từ SQL file
psql -h localhost -p 5432 -U username -d database_name \
    < backup.sql

# 3. Restore compressed backup
gunzip -c backup.sql.gz | psql -h localhost -p 5432 -U username -d database_name

# 4. Restore custom format
pg_restore -h localhost -p 5432 -U username -d database_name \
    -j 4 backup.dump  # -j 4: sử dụng 4 parallel jobs

# 5. Restore với clean (drop existing objects)
pg_restore -h localhost -p 5432 -U username -d database_name \
    --clean --if-exists backup.dump

# 6. Restore specific tables
pg_restore -h localhost -p 5432 -U username -d database_name \
    -t users -t orders backup.dump

# 7. Đóng tunnel
pkill -f "ssh.*5432"
```

---

### 3.3. MySQL/MariaDB

#### **Backup qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 3306:localhost:3306 user@remote_server

# 2. Backup toàn bộ database
mysqldump -h 127.0.0.1 -P 3306 -u username -p database_name \
    > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Backup compressed
mysqldump -h 127.0.0.1 -P 3306 -u username -p database_name \
    | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 4. Backup all databases
mysqldump -h 127.0.0.1 -P 3306 -u root -p --all-databases \
    > all_databases_backup.sql

# 5. Backup with routines, triggers, events
mysqldump -h 127.0.0.1 -P 3306 -u username -p database_name \
    --routines --triggers --events \
    > full_backup.sql

# 6. Backup specific tables
mysqldump -h 127.0.0.1 -P 3306 -u username -p database_name \
    users orders products \
    > tables_backup.sql

# 7. Backup only schema
mysqldump -h 127.0.0.1 -P 3306 -u username -p \
    --no-data database_name > schema_backup.sql

# 8. Đóng tunnel
pkill -f "ssh.*3306"
```

#### **Restore qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 3306:localhost:3306 user@remote_server

# 2. Restore database
mysql -h 127.0.0.1 -P 3306 -u username -p database_name \
    < backup.sql

# 3. Restore compressed backup
gunzip -c backup.sql.gz | mysql -h 127.0.0.1 -P 3306 -u username -p database_name

# 4. Restore all databases
mysql -h 127.0.0.1 -P 3306 -u root -p < all_databases_backup.sql

# 5. Restore với progress indicator
pv backup.sql | mysql -h 127.0.0.1 -P 3306 -u username -p database_name

# 6. Đóng tunnel
pkill -f "ssh.*3306"
```

---

### 3.4. Redis

#### **Backup qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 6379:localhost:6379 user@remote_server

# 2. Trigger BGSAVE
redis-cli -h localhost -p 6379 BGSAVE

# 3. Kiểm tra BGSAVE status
redis-cli -h localhost -p 6379 LASTSAVE

# 4. Copy RDB file từ remote (phương pháp khác)
ssh user@remote_server "cat /var/lib/redis/dump.rdb" > dump.rdb

# 5. Hoặc sử dụng redis-dump
redis-dump -h localhost -p 6379 > redis_backup.json

# 6. Đóng tunnel
pkill -f "ssh.*6379"
```

#### **Restore qua Tunnel**

```bash
# 1. Stop Redis trên target server (qua SSH)
ssh user@remote_server "sudo systemctl stop redis"

# 2. Copy RDB file lên server
scp dump.rdb user@remote_server:/var/lib/redis/

# 3. Set ownership
ssh user@remote_server "sudo chown redis:redis /var/lib/redis/dump.rdb"

# 4. Start Redis
ssh user@remote_server "sudo systemctl start redis"

# 5. Hoặc restore từ JSON (không cần stop Redis)
ssh -f -N -L 6379:localhost:6379 user@remote_server
redis-load -h localhost -p 6379 < redis_backup.json
pkill -f "ssh.*6379"
```

---

### 3.5. Elasticsearch

#### **Backup qua Tunnel (Snapshot)**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 9200:localhost:9200 user@remote_server

# 2. Đăng ký snapshot repository (chạy 1 lần)
curl -X PUT "localhost:9200/_snapshot/backup_repo" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/backup/elasticsearch",
    "compress": true
  }
}'

# 3. Tạo snapshot
curl -X PUT "localhost:9200/_snapshot/backup_repo/snapshot_$(date +%Y%m%d_%H%M%S)?wait_for_completion=true"

# 4. List snapshots
curl -X GET "localhost:9200/_snapshot/backup_repo/_all"

# 5. Snapshot specific indices
curl -X PUT "localhost:9200/_snapshot/backup_repo/snapshot_name" -H 'Content-Type: application/json' -d'
{
  "indices": "index1,index2",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# 6. Đóng tunnel
pkill -f "ssh.*9200"
```

#### **Restore qua Tunnel**

```bash
# 1. Thiết lập tunnel
ssh -f -N -L 9200:localhost:9200 user@remote_server

# 2. Close indices before restore
curl -X POST "localhost:9200/index_name/_close"

# 3. Restore snapshot
curl -X POST "localhost:9200/_snapshot/backup_repo/snapshot_name/_restore" -H 'Content-Type: application/json' -d'
{
  "indices": "index1,index2",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# 4. Monitor restore progress
curl -X GET "localhost:9200/_snapshot/backup_repo/snapshot_name/_status"

# 5. Reopen indices
curl -X POST "localhost:9200/index_name/_open"

# 6. Đóng tunnel
pkill -f "ssh.*9200"
```

---

## 🔁 Phần 4: Đồng bộ dữ liệu Active/Standby

### 4.1. Kiến trúc Active/Standby

```
Primary Server (Active)          Secondary Server (Standby)
    Database                  <---->    Database
    Port: [DB_PORT]                      Port: [DB_PORT]
         |                                   |
    SSH Tunnel <----------------------> SSH Tunnel
```

### 4.2. Đồng bộ sử dụng Cron Jobs

#### **Script đồng bộ tổng quát**

```bash
#!/bin/bash
# File: sync_database.sh

set -e  # Exit on error

# ==================== CẤU HÌNH ====================
DB_TYPE="postgres"  # mongodb, postgres, mysql, redis
PRIMARY_HOST="primary.example.com"
PRIMARY_USER="dbadmin"
SSH_PORT="22"
DB_PORT="5432"  # 27017 (MongoDB), 5432 (PostgreSQL), 3306 (MySQL), 6379 (Redis)
DB_NAME="production_db"
DB_USER="dbuser"
DB_PASS="password"

BACKUP_DIR="/tmp/db_sync"
LOG_FILE="/var/log/db_sync.log"
RETENTION_HOURS=24

# ==================== FUNCTIONS ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cleanup() {
    log "Cleaning up..."
    rm -rf "$BACKUP_DIR"
    pkill -f "ssh.*$DB_PORT:localhost:$DB_PORT" 2>/dev/null || true
}

trap cleanup EXIT

setup_tunnel() {
    log "Setting up SSH tunnel to $PRIMARY_HOST..."
    ssh -f -N -L $DB_PORT:localhost:$DB_PORT -p $SSH_PORT $PRIMARY_USER@$PRIMARY_HOST
    sleep 2
    
    if ! nc -z localhost $DB_PORT 2>/dev/null; then
        log "ERROR: SSH tunnel failed"
        exit 1
    fi
    log "SSH tunnel established"
}

backup_mongodb() {
    log "Backing up MongoDB from Primary..."
    mkdir -p "$BACKUP_DIR"
    mongodump --uri="mongodb://$DB_USER:$DB_PASS@localhost:$DB_PORT/$DB_NAME" \
        --out="$BACKUP_DIR" \
        --gzip
}

restore_mongodb() {
    log "Restoring MongoDB to Standby..."
    mongorestore --uri="mongodb://$DB_USER:$DB_PASS@localhost:27018/$DB_NAME" \
        --gzip \
        --drop \
        "$BACKUP_DIR/$DB_NAME"
}

backup_postgres() {
    log "Backing up PostgreSQL from Primary..."
    mkdir -p "$BACKUP_DIR"
    PGPASSWORD=$DB_PASS pg_dump -h localhost -p $DB_PORT -U $DB_USER \
        -Fc $DB_NAME \
        -f "$BACKUP_DIR/backup.dump"
}

restore_postgres() {
    log "Restoring PostgreSQL to Standby..."
    PGPASSWORD=$DB_PASS pg_restore -h localhost -p 5433 -U $DB_USER \
        -d $DB_NAME \
        --clean --if-exists \
        -j 4 \
        "$BACKUP_DIR/backup.dump"
}

backup_mysql() {
    log "Backing up MySQL from Primary..."
    mkdir -p "$BACKUP_DIR"
    mysqldump -h 127.0.0.1 -P $DB_PORT -u $DB_USER -p$DB_PASS \
        --single-transaction \
        --routines --triggers --events \
        $DB_NAME \
        | gzip > "$BACKUP_DIR/backup.sql.gz"
}

restore_mysql() {
    log "Restoring MySQL to Standby..."
    gunzip -c "$BACKUP_DIR/backup.sql.gz" | \
        mysql -h 127.0.0.1 -P 3307 -u $DB_USER -p$DB_PASS $DB_NAME
}

backup_redis() {
    log "Backing up Redis from Primary..."
    redis-cli -h localhost -p $DB_PORT -a $DB_PASS BGSAVE
    sleep 5
    ssh $PRIMARY_USER@$PRIMARY_HOST "cat /var/lib/redis/dump.rdb" > "$BACKUP_DIR/dump.rdb"
}

restore_redis() {
    log "Restoring Redis to Standby..."
    redis-cli -h localhost -p 6380 -a $DB_PASS SHUTDOWN NOSAVE || true
    sleep 2
    cat "$BACKUP_DIR/dump.rdb" | ssh standby.example.com "cat > /var/lib/redis/dump.rdb"
    ssh standby.example.com "sudo systemctl start redis"
}

# ==================== MAIN ====================

log "========== Starting Database Sync =========="
log "Database Type: $DB_TYPE"
log "Primary: $PRIMARY_HOST:$DB_PORT"

# Setup tunnel
setup_tunnel

# Backup and Restore based on DB type
case $DB_TYPE in
    mongodb)
        backup_mongodb
        restore_mongodb
        ;;
    postgres)
        backup_postgres
        restore_postgres
        ;;
    mysql)
        backup_mysql
        restore_mysql
        ;;
    redis)
        backup_redis
        restore_redis
        ;;
    *)
        log "ERROR: Unknown database type: $DB_TYPE"
        exit 1
        ;;
esac

# Cleanup old logs
find /var/log -name "db_sync.log" -mtime +7 -delete 2>/dev/null || true

log "========== Sync Completed Successfully =========="
```

**Cấp quyền và thiết lập cron:**

```bash
# Cấp quyền execute
chmod +x sync_database.sh

# Test chạy script
./sync_database.sh

# Thêm vào crontab
crontab -e
```

**Các lịch sync phổ biến:**

```cron
# Sync mỗi giờ
0 * * * * /path/to/sync_database.sh >> /var/log/db_sync_cron.log 2>&1

# Sync mỗi 30 phút
*/30 * * * * /path/to/sync_database.sh >> /var/log/db_sync_cron.log 2>&1

# Sync mỗi 4 giờ
0 */4 * * * /path/to/sync_database.sh >> /var/log/db_sync_cron.log 2>&1

# Sync mỗi ngày lúc 2 giờ sáng
0 2 * * * /path/to/sync_database.sh >> /var/log/db_sync_cron.log 2>&1

# Sync mỗi tuần (Chủ nhật lúc 3 giờ sáng)
0 3 * * 0 /path/to/sync_database.sh >> /var/log/db_sync_cron.log 2>&1
```

---

### 4.3. Native Replication (Phương án tốt nhất)

#### **MongoDB Replica Set qua SSH Tunnel**

**1. Trên Primary Server:**

```bash
# Khởi động MongoDB với replica set
docker run -d --name mongodb-primary \
    -p 27017:27017 \
    -v /data/mongodb:/data/db \
    mongo:latest --replSet rs0 --bind_ip_all

# Hoặc nếu cài đặt native
sudo nano /etc/mongod.conf
```

```yaml
replication:
  replSetName: "rs0"
net:
  bindIp: 0.0.0.0
```

```bash
sudo systemctl restart mongod

# Khởi tạo replica set
mongosh "mongodb://localhost:27017"
```

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "primary.example.com:27017", priority: 2 }
  ]
})
```

**2. Trên Standby Server:**

```bash
# Tạo reverse SSH tunnel để Primary có thể reach Standby
ssh -R 27018:localhost:27017 user@primary.example.com -N -f

# Hoặc thiết lập VPN để có kết nối 2 chiều
```

**3. Thêm Standby vào Replica Set:**

```javascript
// Trên Primary mongosh
rs.add("standby.example.com:27017")

// Hoặc nếu dùng reverse tunnel
rs.add("localhost:27018")

// Kiểm tra status
rs.status()

// Set priority để Standby không bao giờ thành Primary
cfg = rs.conf()
cfg.members[1].priority = 0
cfg.members[1].votes = 0
rs.reconfig(cfg)
```

---

#### **PostgreSQL Streaming Replication qua SSH Tunnel**

**1. Trên Primary Server:**

```bash
# Cấu hình postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
```

```conf
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64
```

```bash
# Cấu hình pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

```conf
# Cho phép replication từ Standby
host    replication     replica_user    10.0.0.2/32    md5
```

```bash
# Tạo replication user
sudo -u postgres psql
```

```sql
CREATE USER replica_user REPLICATION LOGIN ENCRYPTED PASSWORD 'replica_password';
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

**2. Trên Standby Server:**

```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Backup và xóa data directory
sudo -u postgres mv /var/lib/postgresql/15/main /var/lib/postgresql/15/main.bak

# Thiết lập SSH tunnel đến Primary
ssh -f -N -L 5432:localhost:5432 user@primary.example.com

# Base backup từ Primary qua tunnel
sudo -u postgres pg_basebackup -h localhost -p 5432 -U replica_user \
    -D /var/lib/postgresql/15/main \
    -Fp -Xs -P -R

# File standby.signal sẽ được tạo tự động bởi -R flag

# Cấu hình postgresql.auto.conf (đã được tạo bởi -R)
# Kiểm tra và điều chỉnh nếu cần
sudo nano /var/lib/postgresql/15/main/postgresql.auto.conf
```

```conf
primary_conninfo = 'host=localhost port=5432 user=replica_user password=replica_password'
```

```bash
# Đóng tunnel tạm thời
pkill -f "ssh.*5432"

# Tạo systemd service để duy trì tunnel
sudo nano /etc/systemd/system/postgres-tunnel.service
```

```ini
[Unit]
Description=SSH Tunnel for PostgreSQL Replication
After=network.target

[Service]
Type=simple
User=postgres
ExecStart=/usr/bin/ssh -N -L 5432:localhost:5432 user@primary.example.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable và start tunnel service
sudo systemctl daemon-reload
sudo systemctl enable postgres-tunnel.service
sudo systemctl start postgres-tunnel.service

# Start PostgreSQL Standby
sudo systemctl start postgresql

# Kiểm tra replication status
sudo -u postgres psql -c "SELECT * FROM pg_stat_wal_receiver;"
```

**3. Trên Primary, kiểm tra Standby connection:**

```sql
SELECT * FROM pg_stat_replication;
```

---

#### **MySQL/MariaDB Replication qua SSH Tunnel**

**1. Trên Primary Server:**

```bash
# Cấu hình my.cnf
sudo nano /etc/mysql/my.cnf
```

```ini
[mysqld]
server-id = 1
log_bin = /var/log/mysql/mysql-bin.log
binlog_do_db = production_db
bind-address = 0.0.0.0
```

```bash
# Restart MySQL
sudo systemctl restart mysql

# Tạo replication user
mysql -u root -p
```

```sql
CREATE USER 'replica_user'@'%' IDENTIFIED BY 'replica_password';
GRANT REPLICATION SLAVE ON *.* TO 'replica_user'@'%';
FLUSH PRIVILEGES;

-- Lấy binary log position
FLUSH TABLES WITH READ LOCK;
SHOW MASTER STATUS;
-- Ghi nhớ File và Position
-- Ví dụ: mysql-bin.000003, Position: 12345
```

**2. Backup database (trong khi còn lock):**

```bash
# Trên terminal khác
mysqldump -u root -p --all-databases --master-data > backup.sql

# Quay lại MySQL prompt
UNLOCK TABLES;
```

**3. Trên Standby Server:**

```bash
# Thiết lập tunnel
ssh -f -N -L 3306:localhost:3306 user@primary.example.com

# Restore backup
mysql -u root -p < backup.sql

# Cấu hình my.cnf
sudo nano /etc/mysql/my.cnf
```

```ini
[mysqld]
server-id = 2
relay-log = /var/log/mysql/mysql-relay-bin
log_bin = /var/log/mysql/mysql-bin.log
read_only = 1
```

```bash
sudo systemctl restart mysql

# Cấu hình replication
mysql -u root -p
```

```sql
CHANGE MASTER TO
    MASTER_HOST='localhost',
    MASTER_PORT=3306,
    MASTER_USER='replica_user',
    MASTER_PASSWORD='replica_password',
    MASTER_LOG_FILE='mysql-bin.000003',  -- Từ SHOW MASTER STATUS
    MASTER_LOG_POS=12345;                -- Từ SHOW MASTER STATUS

-- Start replication
START SLAVE;

-- Kiểm tra status
SHOW SLAVE STATUS\G
```

**Tạo systemd service cho tunnel:**

```bash
sudo nano /etc/systemd/system/mysql-tunnel.service
```

```ini
[Unit]
Description=SSH Tunnel for MySQL Replication
After=network.target

[Service]
Type=simple
User=mysql
ExecStart=/usr/bin/ssh -N -L 3306:localhost:3306 user@primary.example.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mysql-tunnel.service
sudo systemctl start mysql-tunnel.service
```

---

#### **Redis Replication qua SSH Tunnel**

**1. Trên Primary Server:**

```bash
# Cấu hình redis.conf
sudo nano /etc/redis/redis.conf
```

```conf
bind 0.0.0.0
protected-mode yes
requirepass primary_password
masterauth primary_password  # Nếu có authentication
```

```bash
sudo systemctl restart redis
```

**2. Trên Standby Server:**

```bash
# Thiết lập tunnel
ssh -f -N -L 6379:localhost:6379 user@primary.example.com

# Cấu hình redis.conf
sudo nano /etc/redis/redis.conf
```

```conf
replicaof localhost 6379
masterauth primary_password
requirepass standby_password
replica-read-only yes
```

```bash
# Tạo systemd service cho tunnel
sudo nano /etc/systemd/system/redis-tunnel.service
```

```ini
[Unit]
Description=SSH Tunnel for Redis Replication
After=network.target
Before=redis.service

[Service]
Type=simple
User=redis
ExecStart=/usr/bin/ssh -N -L 6379:localhost:6379 user@primary.example.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable services
sudo systemctl daemon-reload
sudo systemctl enable redis-tunnel.service
sudo systemctl start redis-tunnel.service
sudo systemctl restart redis

# Kiểm tra replication
redis-cli -a standby_password
```

```redis
INFO replication
```

---

## 📊 Phần 5: Monitoring và Health Check

### 5.1. Script kiểm tra Tunnel và Database

```bash
#!/bin/bash
# File: monitor_db_tunnel.sh

# ==================== CẤU HÌNH ====================
DB_TYPE="postgres"  # mongodb, postgres, mysql, redis
REMOTE_HOST="user@primary.example.com"
LOCAL_PORT=5432
REMOTE_PORT=5432
DB_USER="dbuser"
DB_PASS="password"
DB_NAME="production_db"

# Alert configuration
ALERT_EMAIL="admin@example.com"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
LOG_FILE="/var/log/db_tunnel_monitor.log"

# ==================== FUNCTIONS ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_email_alert() {
    echo "$1" | mail -s "Database Tunnel Alert" $ALERT_EMAIL
}

send_slack_alert() {
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 $1\"}" \
        $SLACK_WEBHOOK 2>/dev/null
}

check_tunnel() {
    if nc -z localhost $LOCAL_PORT 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

restart_tunnel() {
    log "Restarting SSH tunnel..."
    pkill -f "ssh.*$LOCAL_PORT:localhost:$REMOTE_PORT" 2>/dev/null
    sleep 2
    ssh -f -N -L $LOCAL_PORT:localhost:$REMOTE_PORT $REMOTE_HOST
    sleep 3
}

check_mongodb() {
    mongosh "mongodb://$DB_USER:$DB_PASS@localhost:$LOCAL_PORT/$DB_NAME" \
        --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1
    return $?
}

check_postgres() {
    PGPASSWORD=$DB_PASS psql -h localhost -p $LOCAL_PORT -U $DB_USER -d $DB_NAME \
        -c "SELECT 1" >/dev/null 2>&1
    return $?
}

check_mysql() {
    mysql -h 127.0.0.1 -P $LOCAL_PORT -u $DB_USER -p$DB_PASS \
        -e "SELECT 1" >/dev/null 2>&1
    return $?
}

check_redis() {
    redis-cli -h localhost -p $LOCAL_PORT -a $DB_PASS PING >/dev/null 2>&1
    return $?
}

check_database() {
    case $DB_TYPE in
        mongodb) check_mongodb ;;
        postgres) check_postgres ;;
        mysql) check_mysql ;;
        redis) check_redis ;;
        *) return 1 ;;
    esac
}

# ==================== MAIN ====================

log "Starting health check for $DB_TYPE tunnel..."

# Check tunnel
if ! check_tunnel; then
    log "ERROR: SSH tunnel is down"
    send_slack_alert "SSH Tunnel is down on $(hostname), attempting restart..."
    
    restart_tunnel
    
    if check_tunnel; then
        log "SUCCESS: SSH tunnel restarted"
        send_slack_alert "SSH Tunnel restarted successfully on $(hostname)"
    else
        log "CRITICAL: Failed to restart SSH tunnel"
        send_email_alert "CRITICAL: Failed to restart SSH tunnel on $(hostname)"
        send_slack_alert "CRITICAL: Failed to restart SSH tunnel on $(hostname)"
        exit 1
    fi
fi

# Check database connection
if ! check_database; then
    log "ERROR: Database connection failed"
    send_slack_alert "Database ($DB_TYPE) connection failed on $(hostname)"
    exit 1
fi

log "All checks passed"
exit 0
```

**Thêm vào crontab (chạy mỗi 5 phút):**

```bash
chmod +x monitor_db_tunnel.sh

crontab -e
```

```cron
*/5 * * * * /path/to/monitor_db_tunnel.sh
```

---

### 5.2. Advanced Monitoring với Prometheus

**Script exporter cho tunnel metrics:**

```bash
#!/bin/bash
# File: tunnel_exporter.sh
# Expose metrics cho Prometheus

METRICS_FILE="/var/lib/node_exporter/textfile_collector/tunnel_metrics.prom"
mkdir -p "$(dirname $METRICS_FILE)"

DB_PORTS=(27017 5432 3306 6379)
TEMP_FILE="${METRICS_FILE}.$$"

cat > "$TEMP_FILE" <<EOF
# HELP ssh_tunnel_up SSH tunnel status (1 = up, 0 = down)
# TYPE ssh_tunnel_up gauge
EOF

for port in "${DB_PORTS[@]}"; do
    if nc -z localhost $port 2>/dev/null; then
        echo "ssh_tunnel_up{port=\"$port\"} 1" >> "$TEMP_FILE"
    else
        echo "ssh_tunnel_up{port=\"$port\"} 0" >> "$TEMP_FILE"
    fi
done

mv "$TEMP_FILE" "$METRICS_FILE"
```

**Thêm vào crontab:**

```cron
* * * * * /path/to/tunnel_exporter.sh
```

---

### 5.3. Logging và Debugging

**Enable SSH verbose logging:**

```bash
# Chạy SSH tunnel với debug output
ssh -vvv -L 5432:localhost:5432 user@remote_server 2>&1 | tee ssh_debug.log

# Hoặc với systemd, thêm vào service file
[Service]
StandardOutput=journal
StandardError=journal
```

**Xem logs:**

```bash
# SSH tunnel systemd service logs
journalctl -u postgres-tunnel.service -f

# Database logs
# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# MySQL
sudo tail -f /var/log/mysql/error.log

# MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# Redis
sudo tail -f /var/log/redis/redis-server.log
```

**Kiểm tra network connections:**

```bash
# Tất cả connections đến database ports
netstat -tuln | grep -E "(27017|5432|3306|6379)"

# Chi tiết về SSH tunnels
ps aux | grep ssh | grep -E "27017|5432|3306|6379"

# Kiểm tra established connections
ss -tnp | grep ssh

# Bandwidth monitoring
iftop -i eth0 -f "port 22"
```

---

## 🔒 Phần 6: Bảo mật nâng cao

### 6.1. SSH Key với Passphrase và ssh-agent

```bash
# Tạo key với passphrase
ssh-keygen -t ed25519 -C "db-tunnel" -f ~/.ssh/db_tunnel_key
# Nhập passphrase khi được hỏi

# Sử dụng ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/db_tunnel_key

# macOS: Lưu passphrase vào Keychain
ssh-add --apple-use-keychain ~/.ssh/db_tunnel_key

# Linux: Auto-start ssh-agent
cat >> ~/.bashrc <<'EOF'
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/db_tunnel_key 2>/dev/null
fi
EOF
```

---

### 6.2. Giới hạn SSH Key chỉ cho Port Forwarding

**Trên remote server, edit `~/.ssh/authorized_keys`:**

```bash
# Thêm restrictions trước public key
command="echo 'Port forwarding only'",no-pty,no-agent-forwarding,no-X11-forwarding,permitopen="localhost:27017",permitopen="localhost:5432",permitopen="localhost:3306" ssh-ed25519 AAAA...your-public-key...
```

Điều này đảm bảo key này chỉ có thể:
- Forward các ports được chỉ định
- Không thể chạy commands
- Không thể tạo PTY (pseudo-terminal)
- Không thể forward X11 hoặc agent

---

### 6.3. Two-Factor Authentication cho SSH

```bash
# Cài đặt Google Authenticator
sudo apt install libpam-google-authenticator

# Setup cho user
google-authenticator
# Trả lời:
# - Time-based tokens: Yes
# - Update .google_authenticator: Yes
# - Disallow reuse: Yes
# - Rate limiting: Yes

# Cấu hình PAM
sudo nano /etc/pam.d/sshd
```

Thêm dòng:
```
auth required pam_google_authenticator.so
```

```bash
# Cấu hình SSH
sudo nano /etc/ssh/sshd_config
```

```conf
ChallengeResponseAuthentication yes
AuthenticationMethods publickey,keyboard-interactive
```

```bash
sudo systemctl restart sshd
```

---

### 6.4. Firewall Rules

**UFW (Ubuntu/Debian):**

```bash
# Enable UFW
sudo ufw enable

# Chỉ cho phép SSH từ specific IPs
sudo ufw allow from 203.0.113.0/24 to any port 22

# Block tất cả incoming khác
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Status
sudo ufw status verbose
```

**iptables:**

```bash
# Chỉ cho phép SSH từ specific IP
sudo iptables -A INPUT -p tcp -s 203.0.113.0/24 --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j DROP

# Block database ports từ external
sudo iptables -A INPUT -p tcp --dport 27017 -j DROP
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP
sudo iptables -A INPUT -p tcp --dport 3306 -j DROP

# Lưu rules
sudo netfilter-persistent save
```

---

### 6.5. Fail2ban cho SSH Protection

```bash
# Cài đặt
sudo apt install fail2ban

# Cấu hình
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
destemail = admin@example.com
sendername = Fail2Ban

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
```

```bash
sudo systemctl restart fail2ban

# Kiểm tra status
sudo fail2ban-client status sshd

# Unban IP nếu cần
sudo fail2ban-client set sshd unbanip 203.0.113.100
```

---

### 6.6. Database Access Control

**MongoDB:**

```javascript
// Tạo user chỉ có quyền read
use production_db
db.createUser({
  user: "backup_user",
  pwd: "secure_password",
  roles: [
    { role: "read", db: "production_db" }
  ]
})

// User có quyền backup/restore
db.createUser({
  user: "admin_user",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "production_db" },
    { role: "backup", db: "admin" },
    { role: "restore", db: "admin" }
  ]
})
```

**PostgreSQL:**

```sql
-- Tạo read-only user
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE production_db TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly_user;

-- Tạo replication user
CREATE ROLE replication_user WITH REPLICATION LOGIN PASSWORD 'secure_password';
```

**MySQL:**

```sql
-- Read-only user
CREATE USER 'readonly_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT ON production_db.* TO 'readonly_user'@'localhost';

-- Backup user
CREATE USER 'backup_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON production_db.* TO 'backup_user'@'localhost';

FLUSH PRIVILEGES;
```

---

## 🚀 Phần 7: Automation và Best Practices

### 7.1. Systemd Service Templates

**Template cho Database Tunnel Service:**

```bash
sudo nano /etc/systemd/system/db-tunnel@.service
```

```ini
[Unit]
Description=SSH Tunnel for %i Database
After=network.target

[Service]
Type=simple
User=%i
Environment="AUTOSSH_GATETIME=0"
ExecStart=/usr/bin/autossh -M 0 -N -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" -L ${LOCAL_PORT}:localhost:${REMOTE_PORT} ${SSH_USER}@${SSH_HOST}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Environment file cho mỗi database:**

```bash
# /etc/default/db-tunnel-postgres
sudo nano /etc/default/db-tunnel-postgres
```

```bash
LOCAL_PORT=5432
REMOTE_PORT=5432
SSH_USER=dbadmin
SSH_HOST=primary.example.com
```

```bash
# Enable service
sudo systemctl enable db-tunnel@postgres.service
sudo systemctl start db-tunnel@postgres.service
```

---

### 7.2. Sử dụng AutoSSH (Khuyến nghị)

AutoSSH tự động reconnect khi tunnel bị drop.

```bash
# Cài đặt
sudo apt install autossh

# Chạy với autossh
autossh -M 0 -f -N \
    -o "ServerAliveInterval=60" \
    -o "ServerAliveCountMax=3" \
    -L 5432:localhost:5432 \
    user@remote_server

# Systemd service với autossh
sudo nano /etc/systemd/system/postgres-tunnel.service
```

```ini
[Unit]
Description=AutoSSH Tunnel for PostgreSQL
After=network.target

[Service]
Type=simple
User=postgres
Environment="AUTOSSH_GATETIME=0"
ExecStart=/usr/bin/autossh -M 0 -N \
    -o "ServerAliveInterval=60" \
    -o "ServerAliveCountMax=3" \
    -o "ExitOnForwardFailure=yes" \
    -L 5432:localhost:5432 \
    user@primary.example.com
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

### 7.3. Connection Multiplexing (Tăng tốc)

```bash
# Thêm vào ~/.ssh/config
Host *
    # Connection multiplexing
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h-%p
    ControlPersist 10m
    
    # Compression
    Compression yes
    
    # Keep alive
    ServerAliveInterval 60
    ServerAliveCountMax 3
    
    # Faster encryption
    Ciphers aes128-gcm@openssh.com,aes256-gcm@openssh.com
    
    # Reuse connections
    ControlMaster auto

# Tạo socket directory
mkdir -p ~/.ssh/sockets
chmod 700 ~/.ssh/sockets
```

---

### 7.4. Backup Rotation Script

```bash
#!/bin/bash
# File: backup_rotation.sh

BACKUP_DIR="/backup/databases"
RETENTION_DAYS=7
RETENTION_WEEKS=4
RETENTION_MONTHS=6

# Daily backups older than 7 days
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Weekly backups older than 4 weeks
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -mtime +$((RETENTION_WEEKS * 7)) -delete

# Monthly backups older than 6 months
find "$BACKUP_DIR/monthly" -name "*.sql.gz" -mtime +$((RETENTION_MONTHS * 30)) -delete

# Log cleanup
echo "[$(date)] Backup rotation completed" >> /var/log/backup_rotation.log
```

---

### 7.5. Complete Backup Script với Rotation

```bash
#!/bin/bash
# File: complete_backup.sh

set -euo pipefail

# ==================== CONFIGURATION ====================
DB_TYPE="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="production_db"
DB_USER="backup_user"
DB_PASS="backup_password"

BACKUP_ROOT="/backup/databases"
DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
MONTHLY_DIR="$BACKUP_ROOT/monthly"

DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1-7 (Monday-Sunday)
DAY_OF_MONTH=$(date +%d)

# SSH Tunnel config
SSH_HOST="user@primary.example.com"
TUNNEL_PORT="$DB_PORT"

LOG_FILE="/var/log/complete_backup.log"

# ==================== FUNCTIONS ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

setup_tunnel() {
    log "Setting up SSH tunnel..."
    ssh -f -N -L $TUNNEL_PORT:localhost:$TUNNEL_PORT $SSH_HOST
    sleep 2
    if ! nc -z localhost $TUNNEL_PORT 2>/dev/null; then
        log "ERROR: Tunnel setup failed"
        exit 1
    fi
}

cleanup_tunnel() {
    pkill -f "ssh.*$TUNNEL_PORT:localhost:$TUNNEL_PORT" 2>/dev/null || true
}

trap cleanup_tunnel EXIT

backup_postgres() {
    local output_dir=$1
    local backup_file="$output_dir/${DB_NAME}_${DATE}.sql.gz"
    
    mkdir -p "$output_dir"
    
    PGPASSWORD=$DB_PASS pg_dump \
        -h $DB_HOST -p $DB_PORT -U $DB_USER \
        -Fc $DB_NAME \
        | gzip > "$backup_file"
    
    echo "$backup_file"
}

backup_mysql() {
    local output_dir=$1
    local backup_file="$output_dir/${DB_NAME}_${DATE}.sql.gz"
    
    mkdir -p "$output_dir"
    
    mysqldump \
        -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS \
        --single-transaction --routines --triggers --events \
        $DB_NAME \
        | gzip > "$backup_file"
    
    echo "$backup_file"
}

backup_mongodb() {
    local output_dir=$1
    local backup_file="$output_dir/${DB_NAME}_${DATE}.tar.gz"
    local temp_dir="/tmp/mongo_backup_$$"
    
    mkdir -p "$output_dir"
    
    mongodump \
        --uri="mongodb://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME" \
        --out="$temp_dir" \
        --gzip
    
    tar -czf "$backup_file" -C "$temp_dir" .
    rm -rf "$temp_dir"
    
    echo "$backup_file"
}

do_backup() {
    local backup_type=$1
    local output_dir
    
    case $backup_type in
        daily) output_dir="$DAILY_DIR" ;;
        weekly) output_dir="$WEEKLY_DIR" ;;
        monthly) output_dir="$MONTHLY_DIR" ;;
        *) log "ERROR: Unknown backup type"; exit 1 ;;
    esac
    
    log "Starting $backup_type backup of $DB_TYPE..."
    
    case $DB_TYPE in
        postgres) backup_file=$(backup_postgres "$output_dir") ;;
        mysql) backup_file=$(backup_mysql "$output_dir") ;;
        mongodb) backup_file=$(backup_mongodb "$output_dir") ;;
        *) log "ERROR: Unsupported database type"; exit 1 ;;
    esac
    
    # Verify backup
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        local size=$(du -h "$backup_file" | cut -f1)
        log "SUCCESS: $backup_type backup created: $backup_file ($size)"
    else
        log "ERROR: Backup file is empty or missing"
        exit 1
    fi
}

rotate_backups() {
    log "Rotating old backups..."
    
    # Keep 7 daily backups
    find "$DAILY_DIR" -name "*.gz" -mtime +7 -delete
    
    # Keep 4 weekly backups
    find "$WEEKLY_DIR" -name "*.gz" -mtime +28 -delete
    
    # Keep 6 monthly backups
    find "$MONTHLY_DIR" -name "*.gz" -mtime +180 -delete
    
    log "Backup rotation completed"
}

# ==================== MAIN ====================

log "========== Starting Backup Process =========="

# Setup tunnel
setup_tunnel

# Determine backup type
if [ "$DAY_OF_MONTH" -eq 1 ]; then
    # Monthly backup on 1st of month
    do_backup "monthly"
elif [ "$DAY_OF_WEEK" -eq 7 ]; then
    # Weekly backup on Sunday
    do_backup "weekly"
fi

# Always do daily backup
do_backup "daily"

# Rotate old backups
rotate_backups

log "========== Backup Process Completed =========="
```

**Crontab schedule:**

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/complete_backup.sh >> /var/log/backup_cron.log 2>&1
```

---

## 📝 Tóm tắt Commands

### Thiết lập Tunnel cơ bản
```bash
# Local port forwarding
ssh -L [local_port]:localhost:[remote_port] user@remote_host

# Background mode
ssh -f -N -L [local_port]:localhost:[remote_port] user@remote_host

# Multiple ports
ssh -L 27017:localhost:27017 -L 5432:localhost:5432 user@remote_host

# With AutoSSH (auto-reconnect)
autossh -M 0 -f -N -o "ServerAliveInterval=60" -L [local_port]:localhost:[remote_port] user@remote_host
```

### SSH Config
```bash
# ~/.ssh/config
Host db-server
    HostName remote.example.com
    User dbadmin
    LocalForward 5432 localhost:5432
    ServerAliveInterval 60
```

### Quản lý Tunnel
```bash
# Kiểm tra tunnel
ps aux | grep ssh | grep [port]
netstat -tuln | grep [port]
nc -zv localhost [port]

# Đóng tunnel
pkill -f "ssh.*[port]"
```

### Database Operations
```bash
# MongoDB
mongodump --uri="mongodb://localhost:27017" --db="mydb" --out="./backup"
mongorestore --uri="mongodb://localhost:27017" --db="mydb" "./backup/mydb"

# PostgreSQL
pg_dump -h localhost -p 5432 -U user -Fc dbname > backup.dump
pg_restore -h localhost -p 5432 -U user -d dbname backup.dump

# MySQL
mysqldump -h 127.0.0.1 -P 3306 -u user -p dbname | gzip > backup.sql.gz
gunzip -c backup.sql.gz | mysql -h 127.0.0.1 -P 3306 -u user -p dbname

# Redis
redis-cli -h localhost -p 6379 BGSAVE
```

---

## 🎯 Best Practices Checklist

### Bảo mật
- ✅ Sử dụng SSH key authentication (không dùng password)
- ✅ Thêm passphrase cho SSH keys
- ✅ Giới hạn SSH key permissions (no-pty, permitopen)
- ✅ Enable two-factor authentication
- ✅ Sử dụng firewall để restrict SSH access
- ✅ Enable fail2ban cho SSH protection
- ✅ Audit logs định kỳ
- ✅ Rotate SSH keys theo lịch (mỗi 6 tháng)
- ✅ Sử dụng database user với quyền tối thiểu cần thiết
- ✅ Encrypt backup files
- ✅ Disable root login SSH

### Performance
- ✅ Enable SSH connection multiplexing
- ✅ Sử dụng compression cho tunnel
- ✅ Set ServerAliveInterval để maintain connections
- ✅ Sử dụng AutoSSH cho auto-reconnect
- ✅ Monitor bandwidth usage
- ✅ Optimize database dump/restore commands

### Reliability
- ✅ Sử dụng systemd services cho tunnels
- ✅ Enable auto-restart cho services
- ✅ Implement health checks và monitoring
- ✅ Setup alerting (email, Slack)
- ✅ Test restore procedures định kỳ
- ✅ Document disaster recovery procedures
- ✅ Maintain backup retention policies

### Backup Strategy
- ✅ Implement 3-2-1 backup rule
  - 3 copies của data
  - 2 different media types
  - 1 off-site backup
- ✅ Test backups thường xuyên
- ✅ Encrypt sensitive backups
- ✅ Automate backup rotation
- ✅ Monitor backup success/failure
- ✅ Document restore procedures

---

## 🔧 Troubleshooting Common Issues

### Issue 1: Tunnel Keeps Dropping

**Triệu chứng:**
```bash
channel 2: open failed: connect failed: Connection refused
```

**Giải pháp:**

```bash
# 1. Tăng keep-alive settings
ssh -o "ServerAliveInterval=30" -o "ServerAliveCountMax=3" \
    -L 5432:localhost:5432 user@remote_host

# 2. Sử dụng AutoSSH
autossh -M 0 -f -N \
    -o "ServerAliveInterval=30" \
    -o "ServerAliveCountMax=3" \
    -L 5432:localhost:5432 user@remote_host

# 3. Kiểm tra firewall settings
sudo ufw status
sudo iptables -L -n

# 4. Check MTU settings
ip link show | grep mtu
# Thử giảm MTU nếu có packet loss
sudo ip link set dev eth0 mtu 1400
```

---

### Issue 2: Port Already in Use

**Triệu chứng:**
```bash
bind: Address already in use
channel_setup_fwd_listener_tcpip: cannot listen to port: 5432
```

**Giải pháp:**

```bash
# 1. Tìm process đang dùng port
sudo lsof -i :5432
sudo netstat -tulpn | grep 5432

# 2. Kill process cũ
sudo kill -9 [PID]

# Hoặc kill tất cả SSH tunnels
pkill -f "ssh.*5432"

# 3. Hoặc dùng port khác
ssh -L 5433:localhost:5432 user@remote_host

# 4. Kết nối database với port mới
psql -h localhost -p 5433 -U user -d dbname
```

---

### Issue 3: Authentication Failed

**Triệu chứng:**
```bash
Permission denied (publickey,password)
```

**Giải pháp:**

```bash
# 1. Kiểm tra SSH key
ssh -vvv user@remote_host
# Xem log để identify vấn đề

# 2. Verify key permissions
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh

# 3. Test key manually
ssh -i ~/.ssh/id_ed25519 user@remote_host

# 4. Verify authorized_keys trên server
# SSH vào server bằng cách khác
cat ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 5. Regenerate key nếu cần
ssh-keygen -t ed25519 -C "new-tunnel-key"
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@remote_host
```

---

### Issue 4: Database Connection Timeout

**Triệu chứng:**
```bash
could not connect to server: Connection timed out
```

**Giải pháp:**

```bash
# 1. Verify tunnel is running
ps aux | grep "ssh.*5432"
nc -zv localhost 5432

# 2. Check database is listening
# Trên remote server
sudo netstat -tulpn | grep 5432

# 3. Verify database config allows connections
# PostgreSQL
sudo nano /etc/postgresql/15/main/postgresql.conf
# Check: listen_addresses = 'localhost' hoặc '0.0.0.0'

# MySQL
sudo nano /etc/mysql/my.cnf
# Check: bind-address = 127.0.0.1

# MongoDB
sudo nano /etc/mongod.conf
# Check: bindIp: 127.0.0.1

# 4. Test local connection trên remote server
# SSH vào server
psql -h localhost -p 5432 -U user -d dbname
```

---

### Issue 5: Slow Backup/Restore Performance

**Giải pháp:**

```bash
# 1. Enable compression
# PostgreSQL
pg_dump -h localhost -p 5432 -U user -Fc -Z9 dbname > backup.dump

# MySQL
mysqldump -h 127.0.0.1 -P 3306 -u user -p dbname | pigz -9 > backup.sql.gz

# 2. Use parallel operations
# PostgreSQL restore
pg_restore -h localhost -p 5432 -U user -d dbname -j 4 backup.dump

# MongoDB parallel export
mongodump --uri="mongodb://localhost:27017" --numParallelCollections=4

# 3. Optimize network settings
# Trong ~/.ssh/config
Host db-server
    Compression yes
    CompressionLevel 9
    Ciphers aes128-gcm@openssh.com

# 4. Increase SSH tunnel buffer
ssh -L 5432:localhost:5432 -o "TCPKeepAlive=yes" \
    -o "IPQoS=throughput" user@remote_host

# 5. Check available bandwidth
iperf3 -c remote_host
```

---

### Issue 6: Systemd Service Won't Start

**Triệu chứng:**
```bash
Job for postgres-tunnel.service failed
```

**Giải pháp:**

```bash
# 1. Check service status và logs
sudo systemctl status postgres-tunnel.service
sudo journalctl -u postgres-tunnel.service -n 50

# 2. Verify service file syntax
sudo systemd-analyze verify /etc/systemd/system/postgres-tunnel.service

# 3. Check SSH key permissions
# Service thường chạy với specific user
sudo -u postgres ssh user@remote_host
# Nếu fail, setup key cho user đó

# 4. Test command manually
sudo -u postgres /usr/bin/ssh -N -L 5432:localhost:5432 user@remote_host

# 5. Reload systemd daemon
sudo systemctl daemon-reload
sudo systemctl restart postgres-tunnel.service

# 6. Enable debug logging
# Thêm vào service file
[Service]
Environment="DEBUG=1"
StandardOutput=journal
StandardError=journal
```

---

### Issue 7: Memory or CPU Issues

**Giải pháp:**

```bash
# 1. Monitor resource usage
top -u postgres
htop

# 2. Limit backup process resources
# Sử dụng nice và ionice
nice -n 19 ionice -c 3 pg_dump -h localhost -p 5432 -U user dbname > backup.sql

# 3. Throttle network bandwidth
# Sử dụng trickle
trickle -d 5000 -u 5000 scp backup.sql.gz user@remote_host:/backup/
# -d: download limit (KB/s), -u: upload limit

# 4. Split large dumps
# PostgreSQL: dump by table
for table in $(psql -h localhost -p 5432 -U user -d dbname -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public'"); do
    pg_dump -h localhost -p 5432 -U user -d dbname -t "$table" > "${table}.sql"
done

# MySQL: dump by table
for table in $(mysql -h 127.0.0.1 -P 3306 -u user -p"pass" -D dbname -e "SHOW TABLES" -s); do
    mysqldump -h 127.0.0.1 -P 3306 -u user -p"pass" dbname "$table" > "${table}.sql"
done

# 5. Schedule intensive operations during low-traffic periods
# Sử dụng crontab với specific times
0 2 * * * /path/to/backup_script.sh  # 2 AM daily
```

---

## 🌐 Phần 8: Alternative Solutions

### 8.1. WireGuard VPN (Alternative to SSH Tunnel)

WireGuard là giải pháp VPN hiện đại, nhanh và ổn định hơn SSH tunnel cho kết nối lâu dài.

**Cài đặt WireGuard:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install wireguard

# CentOS/RHEL
sudo yum install epel-release
sudo yum install wireguard-tools
```

**Cấu hình Primary Server:**

```bash
# Generate keys
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey

# Tạo config
sudo nano /etc/wireguard/wg0.conf
```

```ini
[Interface]
PrivateKey = <PRIMARY_PRIVATE_KEY>
Address = 10.0.0.1/24
ListenPort = 51820

# Enable IP forwarding
PostUp = sysctl -w net.ipv4.ip_forward=1
PostDown = sysctl -w net.ipv4.ip_forward=0

[Peer]
PublicKey = <STANDBY_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
```

**Cấu hình Standby Server:**

```bash
# Generate keys
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey

# Tạo config
sudo nano /etc/wireguard/wg0.conf
```

```ini
[Interface]
PrivateKey = <STANDBY_PRIVATE_KEY>
Address = 10.0.0.2/24

[Peer]
PublicKey = <PRIMARY_PUBLIC_KEY>
Endpoint = primary.example.com:51820
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

**Start WireGuard:**

```bash
# Start manually
sudo wg-quick up wg0

# Enable auto-start
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Check status
sudo wg show

# Kết nối database qua VPN
psql -h 10.0.0.1 -p 5432 -U user -d dbname
mongosh "mongodb://10.0.0.1:27017/dbname"
```

---

### 8.2. Tailscale (Easiest VPN Solution)

Tailscale là WireGuard-based VPN được quản lý, rất dễ setup.

```bash
# Cài đặt Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start và authenticate
sudo tailscale up

# Lấy Tailscale IP
tailscale ip -4

# Kết nối database qua Tailscale
psql -h 100.x.x.x -p 5432 -U user -d dbname
```

**Ưu điểm:**
- Zero configuration NAT traversal
- Automatic key rotation
- Built-in ACLs
- Cross-platform support
- Free cho personal use (up to 100 devices)

---

### 8.3. Sử dụng Ngrok cho Development

Ngrok cho phép expose local services ra Internet một cách an toàn.

```bash
# Cài đặt ngrok
# Download từ https://ngrok.com/download

# Expose PostgreSQL
ngrok tcp 5432

# Kết nối từ xa
psql -h 0.tcp.ngrok.io -p 12345 -U user -d dbname

# Expose với authentication
ngrok tcp --auth="username:password" 5432
```

**⚠️ Lưu ý:** Ngrok không khuyến nghị cho production, chỉ phù hợp cho development/testing.

---

## 📊 Phần 9: Monitoring Dashboard Setup

### 9.1. Grafana Dashboard cho Tunnel Monitoring

**Install Prometheus và Node Exporter:**

```bash
# Install Prometheus
sudo apt install prometheus

# Install Node Exporter
sudo apt install prometheus-node-exporter

# Config Prometheus
sudo nano /etc/prometheus/prometheus.yml
```

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: 'db-server-1'
```

**Create custom metrics script:**

```bash
#!/bin/bash
# File: /usr/local/bin/tunnel_metrics.sh

METRICS_DIR="/var/lib/node_exporter/textfile_collector"
mkdir -p "$METRICS_DIR"

# Database ports to monitor
declare -A DB_PORTS=(
    ["mongodb"]="27017"
    ["postgres"]="5432"
    ["mysql"]="3306"
    ["redis"]="6379"
)

# Generate metrics
{
    echo "# HELP ssh_tunnel_up SSH tunnel status (1=up, 0=down)"
    echo "# TYPE ssh_tunnel_up gauge"
    
    for db in "${!DB_PORTS[@]}"; do
        port="${DB_PORTS[$db]}"
        if nc -z localhost "$port" 2>/dev/null; then
            echo "ssh_tunnel_up{database=\"$db\",port=\"$port\"} 1"
        else
            echo "ssh_tunnel_up{database=\"$db\",port=\"$port\"} 0"
        fi
    done
    
    echo "# HELP ssh_tunnel_processes Number of SSH tunnel processes"
    echo "# TYPE ssh_tunnel_processes gauge"
    count=$(ps aux | grep -c "[s]sh.*-L")
    echo "ssh_tunnel_processes $count"
    
    echo "# HELP database_connections Active database connections"
    echo "# TYPE database_connections gauge"
    
    # PostgreSQL connections
    if nc -z localhost 5432 2>/dev/null; then
        pg_conns=$(psql -h localhost -p 5432 -U monitor -t -c "SELECT count(*) FROM pg_stat_activity" 2>/dev/null || echo "0")
        echo "database_connections{database=\"postgres\"} $pg_conns"
    fi
    
    # Redis connections
    if nc -z localhost 6379 2>/dev/null; then
        redis_conns=$(redis-cli -h localhost -p 6379 INFO clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r' || echo "0")
        echo "database_connections{database=\"redis\"} $redis_conns"
    fi
    
} > "$METRICS_DIR/tunnel_metrics.prom.$$"

mv "$METRICS_DIR/tunnel_metrics.prom.$$" "$METRICS_DIR/tunnel_metrics.prom"
```

```bash
# Crontab cho metrics collection
* * * * * /usr/local/bin/tunnel_metrics.sh
```

---

### 9.2. Alerting với Prometheus Alertmanager

**Config alert rules:**

```yaml
# /etc/prometheus/alert_rules.yml
groups:
  - name: tunnel_alerts
    interval: 30s
    rules:
      - alert: SSHTunnelDown
        expr: ssh_tunnel_up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "SSH Tunnel Down for {{ $labels.database }}"
          description: "SSH tunnel for {{ $labels.database }} on port {{ $labels.port }} has been down for 5 minutes"
      
      - alert: NoSSHTunnelProcesses
        expr: ssh_tunnel_processes == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "No SSH tunnel processes running"
          description: "No SSH tunnel processes detected on {{ $labels.instance }}"
      
      - alert: HighDatabaseConnections
        expr: database_connections{database="postgres"} > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "PostgreSQL has {{ $value }} active connections"
```

**Configure Alertmanager:**

```yaml
# /etc/prometheus/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@example.com'
  smtp_auth_username: 'alerts@example.com'
  smtp_auth_password: 'your-app-password'

route:
  receiver: 'email-notifications'
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h

receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'admin@example.com'
        headers:
          Subject: '🚨 Database Tunnel Alert: {{ .GroupLabels.alertname }}'
  
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 📚 Phần 10: Documentation Template

### 10.1. Server Inventory Document

Tạo file để track tất cả tunnels và databases:

```markdown
# Database Infrastructure Documentation

## SSH Tunnel Inventory

| Environment | Database Type | Primary Host | SSH Port | DB Port | Local Port | User | Key Location | Status |
|-------------|--------------|--------------|----------|---------|------------|------|--------------|--------|
| Production  | PostgreSQL   | 203.0.113.10 | 22       | 5432    | 5432       | dbadmin | ~/.ssh/prod_key | Active |
| Production  | MongoDB      | 203.0.113.10 | 22       | 27017   | 27017      | dbadmin | ~/.ssh/prod_key | Active |
| Staging     | PostgreSQL   | 203.0.113.20 | 2222     | 5432    | 5433       | dbadmin | ~/.ssh/stage_key | Active |
| Development | MySQL        | 192.168.1.50 | 22       | 3306    | 3306       | devuser | ~/.ssh/dev_key | Active |

## Backup Schedule

| Database | Frequency | Retention | Last Backup | Next Backup | Script Location |
|----------|-----------|-----------|-------------|-------------|-----------------|
| prod_db  | Daily     | 7 days    | 2024-01-15  | 2024-01-16  | /opt/backup/prod_backup.sh |
| stage_db | Weekly    | 4 weeks   | 2024-01-14  | 2024-01-21  | /opt/backup/stage_backup.sh |

## Emergency Contacts

- Primary DBA: admin@example.com, +1-555-0100
- DevOps Lead: devops@example.com, +1-555-0200
- On-call: oncall@example.com

## Disaster Recovery Procedures

1. Verify backup integrity: `/opt/scripts/verify_backup.sh`
2. Provision new server: Follow runbook in `/docs/provision.md`
3. Restore from backup: `/opt/scripts/restore_backup.sh [backup_file]`
4. Update DNS/Load Balancer
5. Notify team
```

---

### 10.2. Runbook Template

```markdown
# Database Tunnel Runbook

## Daily Operations

### Starting SSH Tunnels

```bash
# All tunnels
sudo systemctl start postgres-tunnel
sudo systemctl start mongo-tunnel
sudo systemctl start mysql-tunnel

# Verify
sudo systemctl status *-tunnel
```

### Stopping SSH Tunnels

```bash
sudo systemctl stop postgres-tunnel
sudo systemctl stop mongo-tunnel
```

### Health Checks

```bash
# Run monitoring script
/opt/scripts/monitor_db_tunnel.sh

# Check logs
sudo journalctl -u postgres-tunnel -f
```

## Emergency Procedures

### Tunnel Connection Lost

1. Check tunnel status
```bash
sudo systemctl status postgres-tunnel
ps aux | grep ssh
```

2. Restart tunnel
```bash
sudo systemctl restart postgres-tunnel
```

3. Verify connection
```bash
nc -zv localhost 5432
psql -h localhost -p 5432 -U user -d dbname -c "SELECT 1"
```

### Database Restore Required

1. Stop application
2. Setup tunnel
```bash
ssh -f -N -L 5432:localhost:5432 user@backup_server
```

3. Restore
```bash
pg_restore -h localhost -p 5432 -U user -d dbname /backup/latest.dump
```

4. Verify data integrity
5. Start application

### Key Rotation

1. Generate new key
```bash
ssh-keygen -t ed25519 -f ~/.ssh/new_db_key
```

2. Copy to servers
```bash
ssh-copy-id -i ~/.ssh/new_db_key.pub user@server1
ssh-copy-id -i ~/.ssh/new_db_key.pub user@server2
```

3. Update systemd services
```bash
sudo nano /etc/systemd/system/postgres-tunnel.service
# Update IdentityFile path
sudo systemctl daemon-reload
sudo systemctl restart postgres-tunnel
```

4. Remove old key from servers
```bash
ssh user@server "nano ~/.ssh/authorized_keys"
# Delete old key line
```

5. Delete old local key
```bash
rm ~/.ssh/old_db_key*
```
```

---

## 🎓 Phần 11: Training Resources

### 11.1. Quick Reference Card

```
=== SSH TUNNEL QUICK REFERENCE ===

BASIC COMMANDS
--------------
Start tunnel:         ssh -L 5432:localhost:5432 user@host
Background:           ssh -f -N -L 5432:localhost:5432 user@host
Multiple ports:       ssh -L 5432:localhost:5432 -L 3306:localhost:3306 user@host
With SSH config:      ssh db-server

CHECK STATUS
------------
Port listening:       nc -zv localhost 5432
Process running:      ps aux | grep "ssh.*5432"
Systemd service:      sudo systemctl status postgres-tunnel

STOP TUNNEL
-----------
Kill specific:        pkill -f "ssh.*5432"
Stop service:         sudo systemctl stop postgres-tunnel

DATABASE OPERATIONS
-------------------
PostgreSQL backup:    pg_dump -h localhost -p 5432 -U user dbname > backup.sql
PostgreSQL restore:   psql -h localhost -p 5432 -U user dbname < backup.sql
MongoDB backup:       mongodump --uri="mongodb://localhost:27017/dbname"
MongoDB restore:      mongorestore --uri="mongodb://localhost:27017/dbname" dump/
MySQL backup:         mysqldump -h 127.0.0.1 -P 3306 -u user -p dbname > backup.sql
MySQL restore:        mysql -h 127.0.0.1 -P 3306 -u user -p dbname < backup.sql

TROUBLESHOOTING
---------------
Test connection:      telnet localhost 5432
SSH verbose:          ssh -vvv -L 5432:localhost:5432 user@host
Check logs:           sudo journalctl -u postgres-tunnel -f
Network stats:        netstat -tuln | grep 5432
```

---

## 🔚 Kết luận

Tài liệu này cung cấp hướng dẫn toàn diện về:

✅ **Thiết lập SSH Tunnel** cho tất cả loại database phổ biến
✅ **Backup và Restore** an toàn qua tunnel  
✅ **Đồng bộ Active/Standby** với nhiều phương án
✅ **Automation** với systemd, cron, scripts
✅ **Monitoring và Alerting** với Prometheus/Grafana
✅ **Security best practices** và hardening
✅ **Troubleshooting** các vấn đề thường gặp
✅ **Alternative solutions** như WireGuard, Tailscale

### Next Steps

1. **Implement từng bước** theo nhu cầu thực tế
2. **Test kỹ** trước khi deploy production
3. **Document** cấu hình của bạn
4. **Train team** về procedures
5. **Review và update** định kỳ

### Additional Resources

- SSH Documentation: `man ssh`, `man ssh_config`
- PostgreSQL Replication: https://www.postgresql.org/docs/current/high-availability.html
- MongoDB Replica Sets: https://docs.mongodb.com/manual/replication/
- MySQL Replication: https://dev.mysql.com/doc/refman/8.0/en/replication.html
- WireGuard: https://www.wireguard.com/quickstart/
- Prometheus: https://prometheus.io/docs/introduction/overview/

---

**Cập nhật lần cuối:** 2024-01-15  
**Version:** 2.0  
**Author:** Database Team
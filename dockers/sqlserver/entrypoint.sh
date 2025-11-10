#!/bin/bash
set -euo pipefail

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

wait_for_sqlserver() {
    log "⏳ Waiting for SQL Server to be ready..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if /opt/mssql-tools18/bin/sqlcmd \
            -S localhost \
            -U sa \
            -P "${SA_PASSWORD}" \
            -Q "SELECT 1" \
            -b \
            > /dev/null 2>&1; then
            log "✅ SQL Server is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        if [ $((attempt % 10)) -eq 0 ]; then
            log "   Still waiting... (attempt $attempt/$max_attempts)"
        fi
        sleep 1
    done
    
    log "❌ SQL Server timeout!"
    return 1
}

run_init_script() {
    local script_file="/docker-entrypoint-initdb.d/init-db.sql"
    local flag_file="/var/opt/mssql/.initialized"
    
    # Kiểm tra đã init chưa
    if [ -f "$flag_file" ]; then
        log "✅ Already initialized (skip)"
        return 0
    fi
    
    if [ ! -f "$script_file" ]; then
        log "⚠️  Init script not found: $script_file"
        return 0
    fi
    
    log "📝 Running init script..."
    
    # Chạy script với error handling tốt hơn
    if /opt/mssql-tools18/bin/sqlcmd \
        -S localhost \
        -U sa \
        -P "${SA_PASSWORD}" \
        -i "$script_file" \
        -e \
        -b \
        2>&1 | tee /tmp/init-db.log; then
        
        # Tạo flag file CHỈ KHI THÀNH CÔNG
        touch "$flag_file"
        log "✅ Init script completed!"
        return 0
    else
        log "❌ Init script FAILED! Check /tmp/init-db.log"
        cat /tmp/init-db.log
        return 1
    fi
}

# ============================================
# MAIN
# ============================================

log "========================================="
log "🚀 Starting SQL Server..."
log "========================================="

log "Configuration:"
log "  • Version: 2022"
log "  • Product: ${MSSQL_PID}"
log "  • Memory: ${MSSQL_MEMORY_LIMIT_MB:-unlimited} MB"

# Start SQL Server trong background
log "Starting SQL Server in background..."
/opt/mssql/bin/sqlservr &
SQLSERVER_PID=$!
log "SQL Server PID: $SQLSERVER_PID"

# Đợi SQL Server ready
if ! wait_for_sqlserver; then
    log "❌ Cannot start SQL Server!"
    exit 1
fi

# Chạy init script
if ! run_init_script; then
    log "❌ Init failed, but SQL Server continues..."
fi

# Log connection info
log "========================================="
log "✅ SQL Server is READY!"
log "========================================="
log ""
log "📋 Connection Info:"
log "   Server: localhost,1433"
log "   SA User: sa / ${SA_PASSWORD}"
log "   Admin User: admin / Admin@123"
log ""
log "💡 Press Ctrl+C to stop"
log "========================================="

# Keep container running
wait $SQLSERVER_PID
log "SQL Server stopped. Container exiting..."
exit 0
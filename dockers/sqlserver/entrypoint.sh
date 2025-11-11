#!/bin/bash
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

wait_for_sqlserver() {
    log "⏳ Waiting for SQL Server to be ready..."
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if /opt/mssql-tools18/bin/sqlcmd \
            -S localhost \
            -U sa \
            -P "${SA_PASSWORD}" \
            -C \
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
    script_file="/docker-entrypoint-initdb.d/init-db.sql"
    flag_file="/var/opt/mssql/.initialized"
    
    if [ -f "$flag_file" ]; then
        log "✅ Already initialized (skip)"
        return 0
    fi
    
    if [ ! -f "$script_file" ]; then
        log "⚠️  Init script not found: $script_file"
        return 0
    fi
    
    log "📝 Running init script..."
    
    if /opt/mssql-tools18/bin/sqlcmd \
        -S localhost \
        -U sa \
        -P "${SA_PASSWORD}" \
        -C \
        -i "$script_file" \
        -e \
        -b \
        2>&1 | tee /tmp/init-db.log; then
        
        touch "$flag_file"
        log "✅ Init script completed!"
        return 0
    else
        log "❌ Init script FAILED! Check /tmp/init-db.log"
        cat /tmp/init-db.log
        return 1
    fi
}

log "========================================="
log "🚀 Starting SQL Server..."
log "========================================="

log "Configuration:"
log "  • Version: 2022"
log "  • Product: ${MSSQL_PID}"
log "  • Memory: ${MSSQL_MEMORY_LIMIT_MB:-unlimited} MB"

log "Starting SQL Server in background..."
/opt/mssql/bin/sqlservr &
SQLSERVER_PID=$!
log "SQL Server PID: $SQLSERVER_PID"

if ! wait_for_sqlserver; then
    log "❌ Cannot start SQL Server!"
    exit 1
fi

if ! run_init_script; then
    log "❌ Init failed, but SQL Server continues..."
fi

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

wait $SQLSERVER_PID
log "SQL Server stopped. Container exiting..."
exit 0
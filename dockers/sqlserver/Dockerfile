FROM mcr.microsoft.com/mssql/server:2022-latest

# Switch to root để cài đặt packages
USER root

# Cài đặt sqlcmd tools
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    # Add Microsoft repository
    curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - && \
    curl https://packages.microsoft.com/config/ubuntu/22.04/prod.list | tee /etc/apt/sources.list.d/mssql-release.list && \
    # Install sqlcmd
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev && \
    # Cleanup
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    # Add sqlcmd to PATH
    echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc

# Switch back to mssql user
USER mssql

# Expose port
EXPOSE 1433

# Default command
CMD ["/opt/mssql/bin/sqlservr"]
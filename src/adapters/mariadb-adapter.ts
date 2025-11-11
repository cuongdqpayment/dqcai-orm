// ========================
// src/adapters/mariadb-adapter.ts
// ========================

import { DatabaseType, DbConfig, IConnection } from "@/types/orm.types";
import { MySQLAdapter } from "./mysql-adapter";
import { createModuleLogger, ORMModules } from "@/logger";
import { MariaDBConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.MARIADB_ADAPTER);

export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";

  constructor(config: DbConfig) {
    super(config);
  }

  isSupported(): boolean {
    // Đã check và cache rồi
    if (this.dbModule !== null) {
      return true;
    }

    if (this.isConnected()) {
      return true;
    }

    logger.trace("=== Checking MariaDB support ===");

    // Try mariadb (preferred)
    try {
      this.dbModule = this.require("mariadb");
      logger.debug("✓ Using 'mariadb' module");
      return true;
    } catch (error) {
      logger.trace("✗ mariadb module not available:", (error as Error).message);
    }

    // Try mysql2 (fallback)
    try {
      this.dbModule = this.require("mysql2");
      logger.debug("✓ Using 'mysql2' fallback module");
      return true;
    } catch (error) {
      logger.trace("✗ mysql2 module not available:", (error as Error).message);
    }

    logger.debug("✗ No MariaDB modules supported");
    return false;
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    this.dbName = schemaKey || this.dbConfig.database || "default";
    const config = {
      ...this.dbConfig,
      database: this.dbName,
    } as MariaDBConfig;

    logger.debug("Connecting to MariaDB", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 3306,
    });

    try {
      let pool;
      let usingMariaDBDriver = false;

      // Try mariadb driver first
      try {
        logger.trace("Dynamically importing 'mariadb' module");
        const mariadb = await import("mariadb");

        // ✅ STEP 1: Check/create database with mariadb driver
        logger.trace("Checking if target database exists (mariadb driver)");

        try {
          const checkPool = mariadb.createPool({
            ...config,
            database: undefined, // Connect without database
          } as any);

          try {
            const rows = await checkPool.query(
              "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
              [config.database]
            );

            if ((rows as any[]).length === 0) {
              logger.info(
                "Target database does not exist, attempting to create it",
                {
                  database: config.database,
                }
              );

              try {
                const safeDatabaseName = config.database?.replace(
                  /[^a-zA-Z0-9_]/g,
                  ""
                );
                await checkPool.query(
                  `CREATE DATABASE \`${safeDatabaseName}\``
                );
                logger.info("Database created successfully", {
                  database: config.database,
                });
              } catch (createError: any) {
                // ✅ Xử lý lỗi không có quyền CREATE DATABASE
                if (
                  createError.code === "ER_DBACCESS_DENIED_ERROR" ||
                  createError.message?.includes("Access denied")
                ) {
                  logger.warn(
                    "Cannot create database (permission denied). Attempting direct connection...",
                    {
                      database: config.database,
                      error: createError.message,
                    }
                  );
                  // Tiếp tục thử kết nối trực tiếp - có thể database đã tồn tại
                } else {
                  throw createError; // Lỗi khác thì throw
                }
              }
            } else {
              logger.trace("Target database already exists", {
                database: config.database,
              });
            }
          } finally {
            await checkPool.end();
          }

          // ✅ STEP 2: Connect to target database (regardless of creation success)
          logger.trace("Creating MariaDB connection pool");
          pool = mariadb.createPool(config);

          // ✅ Verify connection by executing a simple query
          try {
            await pool.query("SELECT 1");
            logger.trace("Connection verified successfully");
          } catch (verifyError: any) {
            await pool.end();
            throw new Error(
              `Cannot connect to database '${config.database}': ${verifyError.message}`
            );
          }

          usingMariaDBDriver = true;
        } catch (dbCheckError: any) {
          // Nếu toàn bộ quá trình check/create thất bại
          logger.warn(
            "Database check/create failed, attempting direct connection",
            {
              error: dbCheckError.message,
            }
          );

          // ✅ Fallback: Thử kết nối trực tiếp tới database
          try {
            pool = mariadb.createPool(config);
            await pool.query("SELECT 1"); // Verify
            usingMariaDBDriver = true;
            logger.info("Direct connection successful", {
              database: config.database,
            });
          } catch (directConnError: any) {
            throw new Error(
              `Cannot connect to database '${config.database}': ${directConnError.message}`
            );
          }
        }
      } catch (mariadbError) {
        logger.debug("MariaDB module not available, falling back to mysql2");
        logger.trace("Dynamically importing 'mysql2/promise' module");
        const mysql = await import("mysql2/promise");

        try {
          const checkPool = mysql.createPool({
            ...config,
            database: undefined,
          } as any);

          try {
            const [rows] = await checkPool.query(
              "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
              [config.database]
            );

            if ((rows as any[]).length === 0) {
              logger.info(
                "Target database does not exist, attempting to create it",
                {
                  database: config.database,
                }
              );

              try {
                const safeDatabaseName = config.database?.replace(
                  /[^a-zA-Z0-9_]/g,
                  ""
                );
                await checkPool.query(
                  `CREATE DATABASE IF NOT EXISTS \`${safeDatabaseName}\``
                );
                logger.info("Database created successfully", {
                  database: config.database,
                });
              } catch (createError: any) {
                if (
                  createError.code === "ER_DBACCESS_DENIED_ERROR" ||
                  createError.message?.includes("Access denied")
                ) {
                  logger.warn(
                    "Cannot create database (permission denied). Attempting direct connection...",
                    {
                      database: config.database,
                    }
                  );
                } else {
                  throw createError;
                }
              }
            } else {
              logger.trace("Target database already exists", {
                database: config.database,
              });
            }
          } finally {
            await checkPool.end();
          }

          // ✅ STEP 2: Connect to target database
          logger.trace("Creating MySQL2 connection pool as fallback");
          pool = mysql.createPool(config as any);

          // Verify connection
          try {
            await pool.query("SELECT 1");
            logger.trace("Connection verified successfully");
          } catch (verifyError: any) {
            await pool.end();
            throw new Error(
              `Cannot connect to database '${config.database}': ${verifyError.message}`
            );
          }

          usingMariaDBDriver = false;
        } catch (dbCheckError: any) {
          // Fallback: Direct connection
          logger.warn(
            "Database check/create failed, attempting direct connection",
            {
              error: dbCheckError.message,
            }
          );

          try {
            pool = mysql.createPool(config as any);
            await pool.query("SELECT 1");
            usingMariaDBDriver = false;
            logger.info("Direct connection successful", {
              database: config.database,
            });
          } catch (directConnError: any) {
            throw new Error(
              `Cannot connect to database '${config.database}': ${directConnError.message}`
            );
          }
        }
      }

      logger.trace("Creating IConnection object");
      const connection: IConnection = {
        rawConnection: pool,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MariaDB connection pool");
          await pool.end();
        },
      };

      this.pool = pool;
      this.connection = connection;
      this.config = config;
      (this as any)._usingMariaDBDriver = usingMariaDBDriver;

      logger.info("MariaDB connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        driver: usingMariaDBDriver ? "mariadb" : "mysql2",
      });

      return connection;
    } catch (error) {
      logger.error("MariaDB connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 3306,
        error: (error as Error).message,
      });

      throw new Error(`MariaDB connection failed: ${error}`);
    }
  }

  // ==========================================
  // ✅ OVERRIDE: executeRaw() - Handle MariaDB driver differences
  // ==========================================
  async executeRaw(query: string, params?: any[]): Promise<any> {
    logger.trace("Executing raw MariaDB query", { query, params });

    if (!this.pool) {
      logger.error("Not connected to MariaDB");
      throw new Error("Not connected to MariaDB");
    }

    const sanitizedParams = params?.map((p) => {
      if (typeof p === "bigint") {
        const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
        const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
        return p <= MAX_SAFE && p >= MIN_SAFE ? Number(p) : p.toString();
      }
      return p;
    });

    const usingMariaDBDriver = (this as any)._usingMariaDBDriver;
    try {
      if (usingMariaDBDriver) {
        // Use sanitized params
        const result = await this.pool.query(query, sanitizedParams);

        if (Array.isArray(result)) {
          const resultData = {
            rows: result,
            rowCount: result.length,
            rowsAffected: result.length,
          };
          logger.trace("SELECT query executed (MariaDB driver)", {
            resultData,
          });
          return resultData;
        } else {
          const resultData = {
            rows: [],
            rowCount: result.affectedRows || 0,
            rowsAffected: result.affectedRows || 0,
            insertId: result.insertId,
          };
          logger.trace("Non-SELECT query executed (MariaDB driver)", {
            resultData,
          });
          return resultData;
        }
      } else {
        const [rows, fields] = await this.pool.query(query, sanitizedParams);

        if (Array.isArray(rows)) {
          const result = {
            rows,
            rowCount: rows.length,
            rowsAffected: rows.length,
          };
          logger.trace("SELECT query executed (MySQL2 driver)", { result });
          return result;
        } else {
          const result = {
            rows: [],
            rowCount: (rows as any).affectedRows || 0,
            rowsAffected: (rows as any).affectedRows || 0,
            insertId: (rows as any).insertId,
          };
          logger.trace("Non-SELECT query executed (MySQL2 driver)", { result });
          return result;
        }
      }
    } catch (error) {
      logger.error("Query execution failed", {
        query: query.substring(0, 200),
        error: (error as Error).message,
        code: (error as any).code,
      });
      throw error;
    }
  }
}

// ========================
// src/core/universal-dao.ts (FIXED CONNECTION HANDLING)
// ========================

import { IConnection, IResult, QueryFilter, QueryOptions } from "../types/orm.types";
import { IDAO } from "../interfaces/dao.interface";
import { IAdapter } from "../interfaces/adapter.interface";
import { DatabaseSchema, DatabaseType, DbConfig } from "../types/orm.types";
import { ServiceStatus } from "../types/service.types";

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.UNIVERSAL_DAO);

/**
 * Universal Data Access Object - FIXED to reuse existing adapter connection
 */
export class UniversalDAO<TConnection extends IConnection = IConnection> implements IDAO {
  protected adapter: IAdapter<TConnection>;
  protected connection: TConnection | null = null;
  public readonly schema: DatabaseSchema;
  public readonly databaseType: DatabaseType;
  public readonly dbConfig: DbConfig;
  
  // Reconnection tracking
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;

  constructor(adapter: IAdapter<TConnection>, schema: DatabaseSchema, dbConfig: DbConfig) {
    logger.debug("Creating UniversalDAO instance", {
      databaseName: schema.database_name,
      databaseType: schema.database_type
    });

    this.adapter = adapter;
    this.schema = schema;
    this.databaseType = schema.database_type;
    this.dbConfig = dbConfig;
  }

  /**
   * ✅ CRITICAL FIX: Ensure connected - Sử dụng lại connection của adapter
   */
  async ensureConnected(): Promise<TConnection> {
    logger.debug("Ensuring connection", {
      databaseName: this.schema.database_name,
      databaseType: this.databaseType,
      adapterConnected: this.adapter.isConnected()
    });

    // ✅ KEY FIX 1: Kiểm tra adapter đã có connection chưa
    const existingConnection = this.adapter.getConnection();
    if (existingConnection && existingConnection.isConnected) {
      logger.info("Adapter already has active connection, reusing it", {
        databaseName: this.schema.database_name,
        databaseType: this.databaseType
      });
      this.connection = existingConnection as TConnection;
      return this.connection;
    }

    // ✅ KEY FIX 2: Nếu DAO đã có connection và còn sống
    if (this.connection && this.connection.isConnected) {
      logger.trace("DAO connection already active", {
        databaseName: this.schema.database_name
      });
      return this.connection;
    }

    // ✅ KEY FIX 3: Nếu connection bị stale, reset
    if (this.connection && !this.connection.isConnected) {
      logger.debug("Stale connection detected, resetting", {
        databaseName: this.schema.database_name
      });
      this.connection = null;
    }

    // ✅ KEY FIX 4: Chỉ connect nếu adapter chưa connected
    if (!this.adapter.isConnected()) {
      logger.info("Adapter not connected, establishing new connection", {
        databaseName: this.schema.database_name,
        databaseType: this.databaseType
      });

      // Retry connection
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < this.maxReconnectAttempts; attempt++) {
        logger.debug("Connection attempt", {
          attempt: attempt + 1,
          maxAttempts: this.maxReconnectAttempts,
          databaseName: this.schema.database_name
        });

        try {
          this.connection = await this.adapter.connect(this.dbConfig);
          this.reconnectAttempts = 0; // Reset counter on success
          logger.info("Connected successfully", {
            databaseName: this.schema.database_name,
            databaseType: this.databaseType
          });
          return this.connection;
        } catch (error) {
          lastError = error as Error;
          this.reconnectAttempts++;
          
          logger.warn("Connection attempt failed", {
            attempt: attempt + 1,
            maxAttempts: this.maxReconnectAttempts,
            databaseName: this.schema.database_name,
            error: lastError.message
          });
          
          if (attempt < this.maxReconnectAttempts - 1) {
            await this.sleep(this.reconnectDelay * (attempt + 1));
          }
        }
      }

      logger.error("Failed to connect after all attempts", {
        databaseName: this.schema.database_name,
        attempts: this.maxReconnectAttempts,
        lastError: lastError?.message
      });

      throw new Error(
        `Failed to connect to ${this.schema.database_name} after ${this.maxReconnectAttempts} attempts: ${lastError?.message}`
      );
    }

    // ✅ KEY FIX 5: Adapter đã connected, lấy connection từ nó
    logger.info("Reusing adapter's existing connection", {
      databaseName: this.schema.database_name,
      databaseType: this.databaseType
    });
    
    const adapterConnection = this.adapter.getConnection();
    if (!adapterConnection) {
      logger.error("Adapter reports connected but has no connection object", {
        databaseName: this.schema.database_name
      });
      throw new Error(
        `Adapter for ${this.schema.database_name} is connected but has no connection object`
      );
    }

    this.connection = adapterConnection as TConnection;
    return this.connection;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ✅ IMPROVED: Execute với error handling tốt hơn
   */
  async execute(query: string | any, params?: any[]): Promise<IResult> {
    logger.trace("Executing query", {
      databaseName: this.schema.database_name,
      queryType: typeof query,
      paramsCount: params?.length || 0
    });

    try {
      const connection = await this.ensureConnected();
      return await this.adapter.execute(connection, query, params);
    } catch (error) {
      // Nếu lỗi connection, thử reconnect
      if (this.isConnectionError(error)) {
        logger.warn("Connection error detected, attempting reconnect", {
          databaseName: this.schema.database_name,
          error: (error as Error).message
        });
        this.connection = null;
        const connection = await this.ensureConnected();
        return await this.adapter.execute(connection, query, params);
      }
      logger.error("Query execution failed", {
        databaseName: this.schema.database_name,
        error: (error as Error).message,
        queryType: typeof query
      });
      throw error;
    }
  }

  private isConnectionError(error: any): boolean {
    const connectionErrorMessages = [
      'connection',
      'timeout',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'socket',
      'closed',
      'lost',
    ];
    
    const errorMessage = error?.message?.toLowerCase() || '';
    return connectionErrorMessages.some((msg) => errorMessage.includes(msg));
  }

  // ==================== CRUD OPERATIONS ====================
  // Tất cả methods đều sử dụng ensureConnected() nên đã có auto-reconnect

  async find<T = any>(entityName: string, query: QueryFilter, options?: QueryOptions): Promise<T[]> {
    logger.trace("Finding records", {
      entityName,
      queryKeys: Object.keys(query),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.find(entityName, query, options) as Promise<T[]>;
  }

  async findOne<T = any>(entityName: string, query: QueryFilter, options?: QueryOptions): Promise<T | null> {
    logger.trace("Finding one record", {
      entityName,
      queryKeys: Object.keys(query),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.findOne(entityName, query, options) as Promise<T | null>;
  }

  async findById<T = any>(entityName: string, id: any): Promise<T | null> {
    logger.trace("Finding record by ID", {
      entityName,
      id,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.findById(entityName, id) as Promise<T | null>;
  }

  async insert<T = any>(entityName: string, data: Partial<T>): Promise<T> {
    logger.debug("Inserting record", {
      entityName,
      dataKeys: Object.keys(data),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.insertOne(entityName, data) as Promise<T>;
  }

  async insertMany<T = any>(entityName: string, data: Partial<T>[]): Promise<T[]> {
    logger.debug("Inserting many records", {
      entityName,
      count: data.length,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.insertMany(entityName, data) as Promise<T[]>;
  }

  async update(entityName: string, filter: QueryFilter, data: any): Promise<number> {
    logger.debug("Updating records", {
      entityName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.update(entityName, filter, data);
  }

  async updateOne(entityName: string, filter: QueryFilter, data: any): Promise<boolean> {
    logger.trace("Updating one record", {
      entityName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.updateOne(entityName, filter, data);
  }

  async updateById(entityName: string, id: any, data: any): Promise<boolean> {
    logger.trace("Updating record by ID", {
      entityName,
      id,
      dataKeys: Object.keys(data),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.updateById(entityName, id, data);
  }

  async delete(entityName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", {
      entityName,
      filterKeys: Object.keys(filter),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.delete(entityName, filter);
  }

  async deleteOne(entityName: string, filter: QueryFilter): Promise<boolean> {
    logger.trace("Deleting one record", {
      entityName,
      filterKeys: Object.keys(filter),
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.deleteOne(entityName, filter);
  }

  async deleteById(entityName: string, id: any): Promise<boolean> {
    logger.trace("Deleting record by ID", {
      entityName,
      id,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.deleteById(entityName, id);
  }

  async count(entityName: string, filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", {
      entityName,
      hasFilter: !!filter,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.count(entityName, filter);
  }

  // ==================== LIFECYCLE ====================

  async close(): Promise<void> {
    logger.info("Closing DAO connection", {
      databaseName: this.schema.database_name,
      databaseType: this.databaseType
    });

    if (this.connection && this.connection.isConnected) {
      await this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Status với thông tin reconnection
   */
  getStatus(entityName: string): Partial<ServiceStatus> {
    return {
      schemaName: this.schema.database_name,
      entityName: entityName,
      isOpened: !!this.connection && this.connection.isConnected,
      hasDao: true,
      isInitialized: true,
      connectionStatus: this.adapter.isConnected() ? 'connected' : 'disconnected',
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  getAdapter(): IAdapter<TConnection> {
    return this.adapter;
  }

  getSchema(): DatabaseSchema {
    return this.schema;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    logger.debug("Performing health check", {
      databaseName: this.schema.database_name
    });

    try {
      await this.ensureConnected();
      return this.adapter.isConnected();
    } catch (error) {
      logger.warn("Health check failed", {
        databaseName: this.schema.database_name,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Force reconnect
   */
  async reconnect(): Promise<void> {
    logger.info("Force reconnecting DAO", {
      databaseName: this.schema.database_name,
      databaseType: this.databaseType
    });

    await this.close();
    this.connection = null;
    await this.ensureConnected();
  }

  /**
   * Kiểm tra table/collection exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    logger.trace("Checking table existence", {
      tableName,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    return this.adapter.tableExists(tableName);
  }

  /**
   * Tạo table/collection từ schema
   */
  async createTable(tableName: string): Promise<void> {
    logger.debug("Creating table", {
      tableName,
      databaseName: this.schema.database_name
    });

    await this.ensureConnected();
    
    const entitySchema = this.schema.schemas[tableName];
    if (!entitySchema) {
      logger.error("Entity schema not found", {
        tableName,
        databaseName: this.schema.database_name
      });
      throw new Error(`Entity '${tableName}' not found in schema`);
    }

    const schemaDefinition: any = {};
    for (const col of entitySchema.cols) {
      const fieldName = col.name || "";
      if (fieldName) {
        schemaDefinition[fieldName] = col;
      }
    }

    await this.adapter.createTable(tableName, schemaDefinition);
  }

  /**
   * Sync tất cả tables/collections
   */
  async syncAllTables(): Promise<void> {
    logger.info("Syncing all tables", {
      databaseName: this.schema.database_name,
      tableCount: Object.keys(this.schema.schemas).length
    });

    await this.ensureConnected();
    
    for (const [entityName, entitySchema] of Object.entries(this.schema.schemas)) {
      logger.trace("Checking table existence during sync", {
        entityName,
        databaseName: this.schema.database_name
      });
      
      const exists = await this.adapter.tableExists(entityName);
      
      if (!exists) {
        logger.info("Creating table/collection", {
          entityName,
          databaseName: this.schema.database_name
        });
        const schemaDefinition: any = {};
        for (const col of entitySchema.cols) {
          const fieldName = col.name || "";
          if (fieldName) {
            schemaDefinition[fieldName] = col;
          }
        }
        await this.adapter.createTable(entityName, schemaDefinition);
      } else {
        logger.debug("Table already exists, skipping creation", {
          entityName,
          databaseName: this.schema.database_name
        });
      }
    }
  }
}
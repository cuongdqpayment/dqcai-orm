// ========================
// src/adapters/postgresql-adapter.ts
// ========================

import { DatabaseType, DbConfig, EntitySchemaDefinition, IConnection } from '../types/orm.types';
import { BaseAdapter } from './base-adapter';

/**
 * PostgreSQL Configuration
 */
export interface PostgreSQLConfig extends DbConfig {
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | object;
  poolSize?: number;
}

/**
 * PostgreSQL Adapter
 * Requires: pg package
 */
export class PostgreSQLAdapter extends BaseAdapter {
  type: DatabaseType = 'postgresql';
  databaseType: DatabaseType = 'postgresql';
  
  private client: any = null;
  private pool: any = null;

  async connect(config: PostgreSQLConfig): Promise<IConnection> {
    try {
      // In real implementation, use: const { Pool } = require('pg');
      // this.pool = new Pool({ ...config });
      // const client = await this.pool.connect();
      
      this.connection = {
        rawConnection: this.pool,
        isConnected: true,
        close: async () => {
          if (this.pool) {
            await this.pool.end();
            this.connection = null;
          }
        }
      };
      
      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Not connected to PostgreSQL');
    }
    
    // In real implementation:
    // const result = await this.pool.query(query, params);
    // return result;
    
    console.log('PostgreSQL Query:', query, params);
    return { rows: [], rowCount: 0 };
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      ) as exists
    `;
    const result = await this.raw(query, [tableName]);
    return result.rows[0]?.exists || false;
  }

  async getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null> {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    
    const result = await this.raw(query, [tableName]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const cols = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default
    }));
    
    return {
      name: tableName,
      cols
    };
  }

  isSupported(): boolean {
    try {
      // Check if pg module is available
      require.resolve('pg');
      return true;
    } catch {
      return false;
    }
  }
}


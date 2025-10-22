
// ========================
// src/adapters/sqlite-adapter.ts
// ========================

import { BaseAdapter } from './base-adapter';
import {
  DatabaseType,
  DbConfig,
  IConnection,
  EntitySchemaDefinition
} from '../types/orm.types';

/**
 * SQLite Configuration
 */
export interface SQLiteConfig extends DbConfig {
  filename?: string;
  dbDirectory?: string;
  memory?: boolean;
}

/**
 * SQLite Adapter
 * Requires: better-sqlite3 or sqlite3 package
 */
export class SQLiteAdapter extends BaseAdapter {
  type: DatabaseType = 'sqlite';
  databaseType: DatabaseType = 'sqlite';
  
  private db: any = null;

  async connect(config: SQLiteConfig): Promise<IConnection> {
    try {
      // In real implementation: const Database = require('better-sqlite3');
      const filename = config.memory ? ':memory:' : 
        config.filename || `${config.dbDirectory || '.'}/${config.database || 'database'}.db`;
      
      // this.db = new Database(filename);
      
      this.connection = {
        rawConnection: this.db,
        isConnected: true,
        close: async () => {
          if (this.db) {
            this.db.close();
            this.connection = null;
          }
        }
      };
      
      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`SQLite connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async executeRaw(query: string, params?: any[]): Promise<any> {
    if (!this.db) {
      throw new Error('Not connected to SQLite');
    }
    
    // In real implementation:
    // if (query.trim().toUpperCase().startsWith('SELECT')) {
    //   const rows = this.db.prepare(query).all(params);
    //   return { rows, rowCount: rows.length };
    // } else {
    //   const info = this.db.prepare(query).run(params);
    //   return { rows: [], rowCount: info.changes, lastInsertId: info.lastInsertRowid };
    // }
    
    console.log('SQLite Query:', query, params);
    return { rows: [], rowCount: 0 };
  }

  async tableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name=?
    `;
    const result = await this.raw(query, [tableName]);
    return result.rows[0]?.count > 0;
  }

  async getTableInfo(tableName: string): Promise<EntitySchemaDefinition | null> {
    const query = `PRAGMA table_info(${tableName})`;
    const result = await this.raw(query);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const cols = result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      default: row.dflt_value,
      primaryKey: row.pk === 1
    }));
    
    return {
      name: tableName,
      cols
    };
  }

  protected buildAutoIncrementColumn(name: string, type: string): string {
    return `${name} INTEGER PRIMARY KEY AUTOINCREMENT`;
  }

  protected getParamPlaceholder(index: number): string {
    return '?';
  }

  isSupported(): boolean {
    try {
      require.resolve('better-sqlite3');
      return true;
    } catch {
      try {
        require.resolve('sqlite3');
        return true;
      } catch {
        return false;
      }
    }
  }
}


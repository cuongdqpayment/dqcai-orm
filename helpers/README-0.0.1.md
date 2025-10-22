// ========================
// Core Types & Interfaces
// ========================

/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'sqlserver' | 'mongodb';

/**
 * Field types for schema definition
 */
export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'json' 
  | 'array' 
  | 'object'
  | 'uuid'
  | 'text'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'timestamp';

/**
 * Field definition in schema
 */
export interface FieldDefinition {
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: any;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  index?: boolean;
  references?: {
    table: string;
    field: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

/**
 * Schema definition for a collection/table
 */
export interface SchemaDefinition {
  [fieldName: string]: FieldDefinition;
}

/**
 * Query operators
 */
export type QueryOperator = 
  | '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' 
  | '$in' | '$nin' | '$like' | '$regex' 
  | '$and' | '$or' | '$not';

/**
 * Query filter
 */
export type QueryFilter<T = any> = {
  [K in keyof T]?: T[K] | {
    [Op in QueryOperator]?: any;
  };
} & {
  $and?: QueryFilter<T>[];
  $or?: QueryFilter<T>[];
  $not?: QueryFilter<T>;
};

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  skip?: number;
  sort?: { [key: string]: 1 | -1 | 'ASC' | 'DESC' };
  select?: string[];
  populate?: string[];
}

/**
 * Transaction interface
 */
export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// ========================
// Adapter Interface
// ========================

/**
 * Base adapter interface that all database adapters must implement
 */
export interface DatabaseAdapter {
  type: DatabaseType;
  
  /**
   * Connect to database
   */
  connect(config: any): Promise<void>;
  
  /**
   * Disconnect from database
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if connected
   */
  isConnected(): boolean;
  
  /**
   * Create table/collection from schema
   */
  createTable(tableName: string, schema: SchemaDefinition): Promise<void>;
  
  /**
   * Drop table/collection
   */
  dropTable(tableName: string): Promise<void>;
  
  /**
   * Check if table/collection exists
   */
  tableExists(tableName: string): Promise<boolean>;
  
  /**
   * Insert one record
   */
  insertOne(tableName: string, data: any): Promise<any>;
  
  /**
   * Insert many records
   */
  insertMany(tableName: string, data: any[]): Promise<any[]>;
  
  /**
   * Find records
   */
  find(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any[]>;
  
  /**
   * Find one record
   */
  findOne(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any | null>;
  
  /**
   * Find by ID
   */
  findById(tableName: string, id: any): Promise<any | null>;
  
  /**
   * Update records
   */
  update(tableName: string, filter: QueryFilter, data: any): Promise<number>;
  
  /**
   * Update one record
   */
  updateOne(tableName: string, filter: QueryFilter, data: any): Promise<boolean>;
  
  /**
   * Update by ID
   */
  updateById(tableName: string, id: any, data: any): Promise<boolean>;
  
  /**
   * Delete records
   */
  delete(tableName: string, filter: QueryFilter): Promise<number>;
  
  /**
   * Delete one record
   */
  deleteOne(tableName: string, filter: QueryFilter): Promise<boolean>;
  
  /**
   * Delete by ID
   */
  deleteById(tableName: string, id: any): Promise<boolean>;
  
  /**
   * Count records
   */
  count(tableName: string, filter?: QueryFilter): Promise<number>;
  
  /**
   * Execute raw query
   */
  raw(query: string, params?: any[]): Promise<any>;
  
  /**
   * Begin transaction
   */
  beginTransaction(): Promise<Transaction>;
}

// ========================
// Model Class
// ========================

/**
 * Model class for database operations
 */
export class Model<T = any> {
  constructor(
    private tableName: string,
    private schema: SchemaDefinition,
    private adapter: DatabaseAdapter
  ) {}

  /**
   * Create the table/collection
   */
  async createTable(): Promise<void> {
    return this.adapter.createTable(this.tableName, this.schema);
  }

  /**
   * Drop the table/collection
   */
  async dropTable(): Promise<void> {
    return this.adapter.dropTable(this.tableName);
  }

  /**
   * Insert one document
   */
  async create(data: Partial<T>): Promise<T> {
    return this.adapter.insertOne(this.tableName, data);
  }

  /**
   * Insert many documents
   */
  async createMany(data: Partial<T>[]): Promise<T[]> {
    return this.adapter.insertMany(this.tableName, data);
  }

  /**
   * Find documents
   */
  async find(filter: QueryFilter<T> = {}, options?: QueryOptions): Promise<T[]> {
    return this.adapter.find(this.tableName, filter, options);
  }

  /**
   * Find one document
   */
  async findOne(filter: QueryFilter<T>, options?: QueryOptions): Promise<T | null> {
    return this.adapter.findOne(this.tableName, filter, options);
  }

  /**
   * Find by ID
   */
  async findById(id: any): Promise<T | null> {
    return this.adapter.findById(this.tableName, id);
  }

  /**
   * Update documents
   */
  async update(filter: QueryFilter<T>, data: Partial<T>): Promise<number> {
    return this.adapter.update(this.tableName, filter, data);
  }

  /**
   * Update one document
   */
  async updateOne(filter: QueryFilter<T>, data: Partial<T>): Promise<boolean> {
    return this.adapter.updateOne(this.tableName, filter, data);
  }

  /**
   * Update by ID
   */
  async updateById(id: any, data: Partial<T>): Promise<boolean> {
    return this.adapter.updateById(this.tableName, id, data);
  }

  /**
   * Delete documents
   */
  async delete(filter: QueryFilter<T>): Promise<number> {
    return this.adapter.delete(this.tableName, filter);
  }

  /**
   * Delete one document
   */
  async deleteOne(filter: QueryFilter<T>): Promise<boolean> {
    return this.adapter.deleteOne(this.tableName, filter);
  }

  /**
   * Delete by ID
   */
  async deleteById(id: any): Promise<boolean> {
    return this.adapter.deleteById(this.tableName, id);
  }

  /**
   * Count documents
   */
  async count(filter?: QueryFilter<T>): Promise<number> {
    return this.adapter.count(this.tableName, filter);
  }

  /**
   * Execute raw query
   */
  async raw(query: string, params?: any[]): Promise<any> {
    return this.adapter.raw(query, params);
  }
}

// ========================
// ORM Class
// ========================

/**
 * Main ORM class
 */
export class ORM {
  private adapter: DatabaseAdapter;
  private models: Map<string, Model> = new Map();

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Connect to database
   */
  async connect(config: any): Promise<void> {
    return this.adapter.connect(config);
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    return this.adapter.disconnect();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  /**
   * Define a model
   */
  model<T = any>(name: string, schema: SchemaDefinition): Model<T> {
    if (this.models.has(name)) {
      return this.models.get(name) as Model<T>;
    }

    const model = new Model<T>(name, schema, this.adapter);
    this.models.set(name, model);
    return model;
  }

  /**
   * Get existing model
   */
  getModel<T = any>(name: string): Model<T> | undefined {
    return this.models.get(name) as Model<T> | undefined;
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<Transaction> {
    return this.adapter.beginTransaction();
  }

  /**
   * Execute raw query
   */
  async raw(query: string, params?: any[]): Promise<any> {
    return this.adapter.raw(query, params);
  }
}

// ========================
// Example Adapter Implementation (PostgreSQL)
// ========================

/**
 * PostgreSQL adapter configuration
 */
export interface PostgreSQLConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

/**
 * Example PostgreSQL Adapter
 * Note: This requires 'pg' package to be installed
 */
export class PostgreSQLAdapter implements DatabaseAdapter {
  type: DatabaseType = 'postgresql';
  private client: any = null;
  private connected: boolean = false;

  async connect(config: PostgreSQLConfig): Promise<void> {
    // Implementation would use pg library
    // const { Pool } = require('pg');
    // this.client = new Pool(config);
    // await this.client.connect();
    this.connected = true;
    console.log('PostgreSQL connected');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async createTable(tableName: string, schema: SchemaDefinition): Promise<void> {
    const columns: string[] = [];
    const constraints: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      let columnDef = `"${fieldName}" ${this.mapTypeToPostgreSQL(fieldDef.type)}`;
      
      if (fieldDef.length) {
        columnDef += `(${fieldDef.length})`;
      }
      
      if (fieldDef.primaryKey) {
        columnDef += ' PRIMARY KEY';
      }
      
      if (fieldDef.autoIncrement) {
        columnDef = `"${fieldName}" SERIAL`;
      }
      
      if (fieldDef.required && !fieldDef.primaryKey) {
        columnDef += ' NOT NULL';
      }
      
      if (fieldDef.unique) {
        columnDef += ' UNIQUE';
      }
      
      if (fieldDef.default !== undefined) {
        columnDef += ` DEFAULT ${this.formatDefaultValue(fieldDef.default)}`;
      }
      
      columns.push(columnDef);
      
      if (fieldDef.references) {
        constraints.push(
          `FOREIGN KEY ("${fieldName}") REFERENCES "${fieldDef.references.table}"("${fieldDef.references.field}")` +
          (fieldDef.references.onDelete ? ` ON DELETE ${fieldDef.references.onDelete}` : '') +
          (fieldDef.references.onUpdate ? ` ON UPDATE ${fieldDef.references.onUpdate}` : '')
        );
      }
    }

    const allColumns = [...columns, ...constraints].join(', ');
    const query = `CREATE TABLE IF NOT EXISTS "${tableName}" (${allColumns})`;
    
    await this.raw(query);
  }

  async dropTable(tableName: string): Promise<void> {
    await this.raw(`DROP TABLE IF EXISTS "${tableName}"`);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.raw(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
      [tableName]
    );
    return result.rows[0].exists;
  }

  async insertOne(tableName: string, data: any): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.raw(query, values);
    return result.rows[0];
  }

  async insertMany(tableName: string, data: any[]): Promise<any[]> {
    const results = [];
    for (const item of data) {
      results.push(await this.insertOne(tableName, item));
    }
    return results;
  }

  async find(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any[]> {
    const { whereClause, params } = this.buildWhereClause(filter);
    let query = `SELECT * FROM "${tableName}"`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    if (options?.sort) {
      const orderBy = Object.entries(options.sort)
        .map(([field, dir]) => `"${field}" ${dir === 1 || dir === 'ASC' ? 'ASC' : 'DESC'}`)
        .join(', ');
      query += ` ORDER BY ${orderBy}`;
    }
    
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    
    const result = await this.raw(query, params);
    return result.rows;
  }

  async findOne(tableName: string, filter: QueryFilter, options?: QueryOptions): Promise<any | null> {
    const results = await this.find(tableName, filter, { ...options, limit: 1 });
    return results[0] || null;
  }

  async findById(tableName: string, id: any): Promise<any | null> {
    return this.findOne(tableName, { id });
  }

  async update(tableName: string, filter: QueryFilter, data: any): Promise<number> {
    const setClauses = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    const values = Object.values(data);
    
    const { whereClause, params: whereParams } = this.buildWhereClause(filter);
    const allParams = [...values, ...whereParams];
    
    let query = `UPDATE "${tableName}" SET ${setClauses}`;
    if (whereClause) {
      query += ` WHERE ${whereClause.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + values.length}`)}`;
    }
    
    const result = await this.raw(query, allParams);
    return result.rowCount;
  }

  async updateOne(tableName: string, filter: QueryFilter, data: any): Promise<boolean> {
    const count = await this.update(tableName, filter, data);
    return count > 0;
  }

  async updateById(tableName: string, id: any, data: any): Promise<boolean> {
    return this.updateOne(tableName, { id }, data);
  }

  async delete(tableName: string, filter: QueryFilter): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(filter);
    let query = `DELETE FROM "${tableName}"`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    const result = await this.raw(query, params);
    return result.rowCount;
  }

  async deleteOne(tableName: string, filter: QueryFilter): Promise<boolean> {
    const count = await this.delete(tableName, filter);
    return count > 0;
  }

  async deleteById(tableName: string, id: any): Promise<boolean> {
    return this.deleteOne(tableName, { id });
  }

  async count(tableName: string, filter?: QueryFilter): Promise<number> {
    const { whereClause, params } = this.buildWhereClause(filter || {});
    let query = `SELECT COUNT(*) FROM "${tableName}"`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    const result = await this.raw(query, params);
    return parseInt(result.rows[0].count);
  }

  async raw(query: string, params?: any[]): Promise<any> {
    // Implementation would use actual pg client
    // return this.client.query(query, params);
    console.log('Executing query:', query, params);
    return { rows: [], rowCount: 0 };
  }

  async beginTransaction(): Promise<Transaction> {
    await this.raw('BEGIN');
    
    return {
      commit: async () => {
        await this.raw('COMMIT');
      },
      rollback: async () => {
        await this.raw('ROLLBACK');
      }
    };
  }

  private mapTypeToPostgreSQL(type: FieldType): string {
    const typeMap: Record<FieldType, string> = {
      string: 'VARCHAR',
      text: 'TEXT',
      number: 'NUMERIC',
      integer: 'INTEGER',
      float: 'REAL',
      decimal: 'DECIMAL',
      boolean: 'BOOLEAN',
      date: 'DATE',
      timestamp: 'TIMESTAMP',
      json: 'JSONB',
      array: 'JSONB',
      object: 'JSONB',
      uuid: 'UUID'
    };
    return typeMap[type] || 'TEXT';
  }

  private formatDefaultValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    if (value === null) {
      return 'NULL';
    }
    return String(value);
  }

  private buildWhereClause(filter: QueryFilter): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and') {
        const andConditions = (value as QueryFilter[]).map(f => {
          const { whereClause } = this.buildWhereClause(f);
          return `(${whereClause})`;
        });
        conditions.push(andConditions.join(' AND '));
      } else if (key === '$or') {
        const orConditions = (value as QueryFilter[]).map(f => {
          const { whereClause } = this.buildWhereClause(f);
          return `(${whereClause})`;
        });
        conditions.push(`(${orConditions.join(' OR ')})`);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case '$eq':
              conditions.push(`"${key}" = $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$ne':
              conditions.push(`"${key}" != $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$gt':
              conditions.push(`"${key}" > $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$gte':
              conditions.push(`"${key}" >= $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$lt':
              conditions.push(`"${key}" < $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$lte':
              conditions.push(`"${key}" <= $${paramIndex++}`);
              params.push(opValue);
              break;
            case '$in':
              conditions.push(`"${key}" = ANY($${paramIndex++})`);
              params.push(opValue);
              break;
            case '$like':
              conditions.push(`"${key}" LIKE $${paramIndex++}`);
              params.push(opValue);
              break;
          }
        }
      } else {
        conditions.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      }
    }

    return {
      whereClause: conditions.join(' AND '),
      params
    };
  }
}

// ========================
// Usage Example
// ========================

/*
// 1. Create adapter
const adapter = new PostgreSQLAdapter();

// 2. Create ORM instance
const orm = new ORM(adapter);

// 3. Connect to database
await orm.connect({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'user',
  password: 'password'
});

// 4. Define schema
const userSchema: SchemaDefinition = {
  id: {
    type: 'integer',
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: 'string',
    required: true,
    length: 100
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
    length: 255
  },
  age: {
    type: 'integer'
  },
  isActive: {
    type: 'boolean',
    default: true
  },
  createdAt: {
    type: 'timestamp',
    default: 'NOW()'
  }
};

// 5. Create model
const User = orm.model('users', userSchema);

// 6. Create table
await User.createTable();

// 7. CRUD operations
// Create
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Find
const users = await User.find({ isActive: true });
const user = await User.findOne({ email: 'john@example.com' });
const user = await User.findById(1);

// Update
await User.updateById(1, { age: 31 });
await User.update({ isActive: false }, { isActive: true });

// Delete
await User.deleteById(1);
await User.delete({ isActive: false });

// Count
const count = await User.count({ isActive: true });

// 8. Disconnect
await orm.disconnect();
*/

// ========================
// src/orm/index.ts - Main ORM Class
// ========================

import { IAdapter } from "../interfaces/adapter.interface";
import { Model } from "../model";
import { IConnection, SchemaDefinition, Transaction } from "../types/orm.types";


/**
 * Main ORM class
 */
export class ORM {
  private adapter: IAdapter;
  private models: Map<string, Model> = new Map();

  constructor(adapter: IAdapter) {
    this.adapter = adapter;
  }

  /**
   * Connect to database
   */
  async connect(config: any): Promise<IConnection> {
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
   * Get adapter
   */
  getAdapter(): IAdapter {
    return this.adapter;
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
   * Check if model exists
   */
  hasModel(name: string): boolean {
    return this.models.has(name);
  }

  /**
   * Get all models
   */
  getModels(): Map<string, Model> {
    return new Map(this.models);
  }

  /**
   * Remove a model
   */
  removeModel(name: string): boolean {
    return this.models.delete(name);
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
  async raw(query: string | any, params?: any[]): Promise<any> {
    return this.adapter.raw(query, params);
  }

  /**
   * Create all tables from registered models
   */
  async sync(options?: { force?: boolean; alter?: boolean }): Promise<void> {
    for (const [name, model] of this.models) {
      const exists = await model.exists();
      
      if (options?.force && exists) {
        await model.dropTable();
        await model.createTable();
      } else if (options?.alter && exists) {
        // Alter table logic would go here
        console.warn(`Alter table not fully implemented for ${name}`);
      } else if (!exists) {
        await model.createTable();
      }
    }
  }

  /**
   * Drop all tables from registered models
   */
  async drop(): Promise<void> {
    for (const [name, model] of this.models) {
      const exists = await model.exists();
      if (exists) {
        await model.dropTable();
      }
    }
  }

  /**
   * Clear all data from tables (truncate)
   */
  async truncate(): Promise<void> {
    for (const [name, model] of this.models) {
      await model.truncate();
    }
  }

  /**
   * Get ORM status
   */
  getStatus(): {
    connected: boolean;
    adapter: string;
    models: number;
  } {
    return {
      connected: this.isConnected(),
      adapter: this.adapter.type,
      models: this.models.size
    };
  }
}

// Export all
// export { QueryBuilder } from './query-builder';
// export { Model } from './model';
// export { ORM };
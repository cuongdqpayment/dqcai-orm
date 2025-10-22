// ========================
// src/adapters/mongodb-adapter.ts
// ========================

import { BaseAdapter } from "./base-adapter";
import {
  DatabaseType,
  DbConfig,
  IConnection,
  EntitySchemaDefinition,
  SchemaDefinition,
  QueryFilter,
  QueryOptions,
  Transaction,
  BulkOperation,
} from "../types/orm.types";

/**
 * MongoDB Configuration
 */
export interface MongoDBConfig extends DbConfig {
  url?: string;
  connectionString?: string;
  database: string;
  options?: any;
}

/**
 * MongoDB Adapter
 * Requires: mongodb package
 */
export class MongoDBAdapter extends BaseAdapter {
  type: DatabaseType = "mongodb";
  databaseType: DatabaseType = "mongodb";

  private client: any = null;
  private db: any = null;

  async connect(config: MongoDBConfig): Promise<IConnection> {
    try {
      // In real implementation: const { MongoClient } = require('mongodb');
      const url =
        config.url || config.connectionString || "mongodb://localhost:27017";

      // this.client = new MongoClient(url, config.options);
      // await this.client.connect();
      // this.db = this.client.db(config.database);

      this.connection = {
        rawConnection: this.client,
        isConnected: true,
        close: async () => {
          if (this.client) {
            await this.client.close();
            this.connection = null;
          }
        },
      };

      this.config = config;
      return this.connection;
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async executeRaw(query: any, params?: any[]): Promise<any> {
    if (!this.db) {
      throw new Error("Not connected to MongoDB");
    }

    // MongoDB uses aggregation pipelines and commands
    console.log("MongoDB Command:", query);
    return { rows: [], rowCount: 0 };
  }

  // MongoDB-specific implementations

  async createTable(
    collectionName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    if (!this.db) throw new Error("Not connected");

    // MongoDB creates collections automatically
    // Optionally create validation schema
    // await this.db.createCollection(collectionName, { validator: ... });

    console.log(
      `MongoDB collection ${collectionName} will be created on first insert`
    );
  }

  async dropTable(collectionName: string): Promise<void> {
    if (!this.db) throw new Error("Not connected");

    // await this.db.collection(collectionName).drop();
    console.log(`MongoDB collection ${collectionName} dropped`);
  }

  async tableExists(collectionName: string): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    // const collections = await this.db.listCollections({ name: collectionName }).toArray();
    // return collections.length > 0;

    return true;
  }

  async getTableInfo(
    collectionName: string
  ): Promise<EntitySchemaDefinition | null> {
    // MongoDB is schemaless, but we can return collection stats
    return {
      name: collectionName,
      cols: [],
    };
  }

  async insertOne(collectionName: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Not connected");

    // const result = await this.db.collection(collectionName).insertOne(data);
    // return { ...data, _id: result.insertedId };

    console.log(`MongoDB insertOne to ${collectionName}`, data);
    return data;
  }

  async insertMany(collectionName: string, data: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    // const result = await this.db.collection(collectionName).insertMany(data);
    // return data.map((doc, i) => ({ ...doc, _id: result.insertedIds[i] }));

    console.log(`MongoDB insertMany to ${collectionName}`, data.length);
    return data;
  }

  async find(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // let cursor = this.db.collection(collectionName).find(mongoFilter);
    // if (options?.sort) cursor = cursor.sort(options.sort);
    // if (options?.limit) cursor = cursor.limit(options.limit);
    // if (options?.skip || options?.offset) cursor = cursor.skip(options.skip || options.offset);
    // return await cursor.toArray();

    console.log(`MongoDB find in ${collectionName}`, mongoFilter, options);
    return [];
  }

  async findOne(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // return await this.db.collection(collectionName).findOne(mongoFilter, options);

    console.log(`MongoDB findOne in ${collectionName}`, mongoFilter);
    return null;
  }

  async findById(collectionName: string, id: any): Promise<any | null> {
    // const ObjectId = require('mongodb').ObjectId;
    // return this.findOne(collectionName, { _id: new ObjectId(id) } as any);

    return this.findOne(collectionName, { _id: id } as any);
  }

  async update(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // const result = await this.db.collection(collectionName).updateMany(
    //   mongoFilter,
    //   { $set: data }
    // );
    // return result.modifiedCount;

    console.log(`MongoDB updateMany in ${collectionName}`, mongoFilter, data);
    return 0;
  }

  async updateOne(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // const result = await this.db.collection(collectionName).updateOne(
    //   mongoFilter,
    //   { $set: data }
    // );
    // return result.modifiedCount > 0;

    console.log(`MongoDB updateOne in ${collectionName}`, mongoFilter, data);
    return false;
  }

  async updateById(
    collectionName: string,
    id: any,
    data: any
  ): Promise<boolean> {
    // const ObjectId = require('mongodb').ObjectId;
    // return this.updateOne(collectionName, { _id: new ObjectId(id) } as any, data);

    return this.updateOne(collectionName, { _id: id } as any, data);
  }

  async delete(collectionName: string, filter: QueryFilter): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // const result = await this.db.collection(collectionName).deleteMany(mongoFilter);
    // return result.deletedCount;

    console.log(`MongoDB deleteMany in ${collectionName}`, mongoFilter);
    return 0;
  }

  async deleteOne(
    collectionName: string,
    filter: QueryFilter
  ): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    // const result = await this.db.collection(collectionName).deleteOne(mongoFilter);
    // return result.deletedCount > 0;

    console.log(`MongoDB deleteOne in ${collectionName}`, mongoFilter);
    return false;
  }

  async deleteById(collectionName: string, id: any): Promise<boolean> {
    // const ObjectId = require('mongodb').ObjectId;
    // return this.deleteOne(collectionName, { _id: new ObjectId(id) } as any);

    return this.deleteOne(collectionName, { _id: id } as any);
  }

  async count(collectionName: string, filter?: QueryFilter): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};

    // return await this.db.collection(collectionName).countDocuments(mongoFilter);

    console.log(`MongoDB count in ${collectionName}`, mongoFilter);
    return 0;
  }

  async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    // return await this.db.collection(collectionName).aggregate(pipeline).toArray();

    console.log(`MongoDB aggregate in ${collectionName}`, pipeline);
    return [];
  }

  async distinct(
    collectionName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};

    // return await this.db.collection(collectionName).distinct(field, mongoFilter);

    console.log(`MongoDB distinct in ${collectionName}`, field, mongoFilter);
    return [];
  }

  async bulkWrite(
    collectionName: string,
    operations: BulkOperation[]
  ): Promise<any> {
    if (!this.db) throw new Error("Not connected");

    const bulkOps = operations
      .map((op) => {
        if (op.insertOne)
          return { insertOne: { document: op.insertOne.document } };
        if (op.updateOne)
          return {
            updateOne: {
              filter: this.convertFilterToMongo(op.updateOne.filter),
              update: { $set: op.updateOne.update },
              upsert: op.updateOne.upsert,
            },
          };
        if (op.updateMany)
          return {
            updateMany: {
              filter: this.convertFilterToMongo(op.updateMany.filter),
              update: { $set: op.updateMany.update },
              upsert: op.updateMany.upsert,
            },
          };
        if (op.deleteOne)
          return {
            deleteOne: {
              filter: this.convertFilterToMongo(op.deleteOne.filter),
            },
          };
        if (op.deleteMany)
          return {
            deleteMany: {
              filter: this.convertFilterToMongo(op.deleteMany.filter),
            },
          };
        return null;
      })
      .filter((op) => op !== null);

    // const result = await this.db.collection(collectionName).bulkWrite(bulkOps);

    console.log(`MongoDB bulkWrite in ${collectionName}`, bulkOps);
    return { insertedCount: 0, modifiedCount: 0, deletedCount: 0 };
  }

  async beginTransaction(): Promise<Transaction> {
    if (!this.client) throw new Error("Not connected");

    // const session = this.client.startSession();
    // session.startTransaction();

    let active = true;

    return {
      commit: async () => {
        if (!active) throw new Error("Transaction already completed");
        // await session.commitTransaction();
        // session.endSession();
        active = false;
      },
      rollback: async () => {
        if (!active) throw new Error("Transaction already completed");
        // await session.abortTransaction();
        // session.endSession();
        active = false;
      },
      isActive: () => active,
    };
  }

  private convertFilterToMongo(filter: QueryFilter): any {
    const mongoFilter: any = {};

    for (const [key, value] of Object.entries(filter)) {
      if (key === "$and" || key === "$or" || key === "$not") {
        mongoFilter[key] = Array.isArray(value)
          ? value.map((f) => this.convertFilterToMongo(f))
          : this.convertFilterToMongo(value);
        continue;
      }

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const conditions: any = {};
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case "$eq":
              conditions.$eq = opValue;
              break;
            case "$ne":
              conditions.$ne = opValue;
              break;
            case "$gt":
              conditions.$gt = opValue;
              break;
            case "$gte":
              conditions.$gte = opValue;
              break;
            case "$lt":
              conditions.$lt = opValue;
              break;
            case "$lte":
              conditions.$lte = opValue;
              break;
            case "$in":
              conditions.$in = opValue;
              break;
            case "$nin":
              conditions.$nin = opValue;
              break;
            case "$regex":
              conditions.$regex = opValue;
              break;
            case "$exists":
              conditions.$exists = opValue;
              break;
            case "$like":
              // Convert SQL LIKE to MongoDB regex
              if (typeof opValue === "string") {
                const regexPattern = opValue
                  .replace(/%/g, ".*")
                  .replace(/_/g, ".");
                conditions.$regex = new RegExp(regexPattern, "i");
              }
              break;
          }
        }
        mongoFilter[key] = conditions;
      } else {
        mongoFilter[key] = value;
      }
    }

    return mongoFilter;
  }

  isSupported(): boolean {
    try {
      require.resolve("mongodb");
      return true;
    } catch {
      return false;
    }
  }
}

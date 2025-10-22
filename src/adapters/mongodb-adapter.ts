// ========================
// src/adapters/mongodb-adapter.ts
// ========================
import { createRequire } from "module";
import {
  BulkOperation,
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  IConnection,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "../types/orm.types";
import { BaseAdapter } from "../core/base-adapter";

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
  private ObjectId: any = null;

  async connect(config: MongoDBConfig): Promise<IConnection> {
    try {
      const { MongoClient, ObjectId: MongoObjectId } = await import("mongodb");
      this.ObjectId = MongoObjectId;
      const url =
        config.url || config.connectionString || "mongodb://localhost:27017";

      this.client = new MongoClient(url, config.options);
      await this.client.connect();
      this.db = this.client.db(config.database);

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
    const result = await this.db.admin().command(query);
    return { rows: [result], rowCount: 1 };
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

    await this.db.createCollection(collectionName);
  }

  async dropTable(collectionName: string): Promise<void> {
    if (!this.db) throw new Error("Not connected");

    await this.db.collection(collectionName).drop();
  }

  async tableExists(collectionName: string): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    const collections = await this.db
      .listCollections({ name: collectionName })
      .toArray();
    return collections.length > 0;
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

    const result = await this.db.collection(collectionName).insertOne(data);
    return { ...data, _id: result.insertedId };
  }

  async insertMany(collectionName: string, data: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    const result = await this.db.collection(collectionName).insertMany(data);
    return data.map((doc, i) => ({ ...doc, _id: result.insertedIds[i] }));
  }

  async find(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    let cursor = this.db.collection(collectionName).find(mongoFilter);
    if (options?.sort) cursor = cursor.sort(options.sort);
    if (options?.limit) cursor = cursor.limit(options.limit);
    if (options?.skip || options?.offset)
      cursor = cursor.skip(options.skip || options.offset || 0);
    return await cursor.toArray();
  }

  async findOne(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    const mongoOptions: any = {};
    if (options?.sort) mongoOptions.sort = options.sort;

    return await this.db
      .collection(collectionName)
      .findOne(mongoFilter, mongoOptions);
  }

  async findById(collectionName: string, id: any): Promise<any | null> {
    return this.findOne(collectionName, { _id: new this.ObjectId(id) } as any);
  }

  async update(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    const result = await this.db
      .collection(collectionName)
      .updateMany(mongoFilter, { $set: data });
    return result.modifiedCount;
  }

  async updateOne(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    const result = await this.db
      .collection(collectionName)
      .updateOne(mongoFilter, { $set: data });
    return result.modifiedCount > 0;
  }

  async updateById(
    collectionName: string,
    id: any,
    data: any
  ): Promise<boolean> {
    return this.updateOne(
      collectionName,
      { _id: new this.ObjectId(id) } as any,
      data
    );
  }

  async delete(collectionName: string, filter: QueryFilter): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    const result = await this.db
      .collection(collectionName)
      .deleteMany(mongoFilter);
    return result.deletedCount;
  }

  async deleteOne(
    collectionName: string,
    filter: QueryFilter
  ): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);

    const result = await this.db
      .collection(collectionName)
      .deleteOne(mongoFilter);
    return result.deletedCount > 0;
  }

  async deleteById(collectionName: string, id: any): Promise<boolean> {
    return this.deleteOne(collectionName, {
      _id: new this.ObjectId(id),
    } as any);
  }

  async count(collectionName: string, filter?: QueryFilter): Promise<number> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};

    return await this.db.collection(collectionName).countDocuments(mongoFilter);
  }

  async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    return await this.db
      .collection(collectionName)
      .aggregate(pipeline)
      .toArray();
  }

  async distinct(
    collectionName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};

    return await this.db
      .collection(collectionName)
      .distinct(field, mongoFilter);
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

    const result = await this.db.collection(collectionName).bulkWrite(bulkOps);

    return result;
  }

  async beginTransaction(): Promise<Transaction> {
    if (!this.client) throw new Error("Not connected");

    const session = this.client.startSession();
    await session.startTransaction();

    return {
      commit: async () => {
        if (!session.inTransaction)
          throw new Error("Transaction already completed");
        await session.commitTransaction();
        await session.endSession();
      },
      rollback: async () => {
        if (!session.inTransaction)
          throw new Error("Transaction already completed");
        await session.abortTransaction();
        await session.endSession();
      },
      isActive: () => session.inTransaction,
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
    // const require = createRequire(import.meta.url);
    try {
      require.resolve("mongodb");
      return true;
    } catch {
      return false;
    }
  }
}

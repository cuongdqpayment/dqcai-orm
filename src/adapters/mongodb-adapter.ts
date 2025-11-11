// ========================
// src/adapters/mongodb-adapter.ts
// ========================

import { BaseAdapter } from "@/core/base-adapter";
import {
  DatabaseType,
  DbConfig,
  EntitySchemaDefinition,
  ForeignKeyDefinition,
  ForeignKeyInfo,
  IConnection,
  IndexDefinition,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "@/types/orm.types";
import { createModuleLogger, ORMModules } from "@/logger";
import { MongoDBConfig } from "@/types/database-config-types";
const logger = createModuleLogger(ORMModules.MONGODB_ADAPTER);

/**
 * 🎯 MongoDB Adapter - Học từ UniversalDAO của @dqcai/mongo
 *
 * Key learnings:
 * 1. MongoDB hỗ trợ BSON → giữ nguyên Date, Boolean, Object, Array
 * 2. ObjectId conversion cho _id field
 * 3. Query filter conversion (SQL-like → MongoDB query)
 * 4. Schema validation với $jsonSchema
 */
export class MongoDBAdapter extends BaseAdapter {
  type: DatabaseType = "mongodb";
  databaseType: DatabaseType = "mongodb";
  private client: any = null;
  private db: any = null;
  private ObjectId: any = null;

  constructor(config: DbConfig) {
    super(config);
  }

  isSupported(): boolean {
    if (this.dbModule !== null) {
      return true;
    }
    if (this.db || this.isConnected()) {
      return true;
    }

    logger.trace("Checking MongoDB support");

    try {
      this.dbModule = this.require("mongodb");
      logger.debug("MongoDB module is supported");
      return true;
    } catch {
      logger.debug("MongoDB module is not supported");

      return false;
    }
  }

  async connect(schemaKey?: string): Promise<IConnection> {
    if (!this.dbConfig) throw Error("No database configuration provided.");
    this.dbName = schemaKey || this.dbConfig.database || "default";
    const config = {
      ...this.dbConfig,
      database: this.dbName,
    } as MongoDBConfig;

    logger.debug("Connecting to MongoDB", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 27017,
    });

    try {
      logger.trace("Dynamically importing 'mongodb' module");
      const { MongoClient, ObjectId } = await import("mongodb");

      const url =
        config.url || config.connectionString || "mongodb://localhost:27017";

      logger.trace("Creating MongoClient with URL", {
        url: url.replace(/\/\/.*@/, "//***REDACTED***@"),
      });

      const client = new MongoClient(url, config.options);

      logger.trace("Connecting MongoClient");
      await client.connect();

      // ✅ MongoDB automatically creates database when first document is inserted
      // But we can explicitly create it to verify connection
      const db = client.db(config.database);

      // ✅ Verify database connection by listing collections
      // This also ensures database is created in MongoDB
      try {
        logger.trace("Verifying database access");
        await db.listCollections().toArray();
        logger.trace("Database access verified", {
          database: config.database,
        });
      } catch (accessError) {
        logger.warn("Could not verify database access", {
          database: config.database,
          error: (accessError as Error).message,
        });
      }

      logger.trace("Creating IConnection object");
      const connection: IConnection = {
        rawConnection: client,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MongoDB connection");
          await client.close();
        },
      };

      this.client = client;
      this.db = db;
      this.ObjectId = ObjectId;
      this.connection = connection;
      this.config = config;

      logger.info("MongoDB connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 27017,
      });

      return connection;
    } catch (error) {
      logger.error("MongoDB connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 27017,
        error: (error as Error).message,
      });

      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  // ==========================================
  // ✅ SANITIZATION (LEARNED FROM @dqcai/mongo)
  // ==========================================

  /**
   * 🔄 MongoDB sanitization - Giữ nguyên JS types vì BSON hỗ trợ
   */
  protected sanitizeValue(value: any): any {
    logger.trace("Sanitizing value", { valueType: typeof value });

    if (value === null || value === undefined) {
      return null;
    }

    // ✅ Date: Giữ nguyên (BSON supports Date)
    if (value instanceof Date) {
      logger.trace("Value is Date, keeping native");
      return value;
    }

    // ✅ Boolean: Giữ nguyên (BSON supports Boolean)
    if (typeof value === "boolean") {
      logger.trace("Value is Boolean, keeping native");
      return value;
    }

    // ✅ Array/Object: Giữ nguyên (BSON supports them)
    if (typeof value === "object") {
      logger.trace("Value is Object/Array, keeping native");
      return value;
    }

    logger.trace("Value is primitive, returning as-is");
    return value;
  }

  // ==========================================
  // ✅ TYPE MAPPING (LEARNED FROM @dqcai/mongo)
  // ==========================================

  /**
   * 🗺️ MongoDB type mapping - BSON types
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    logger.trace("Mapping field type to BSON", { fieldType, length });

    const bsonTypeMap: Record<string, string> = {
      string: "string",
      text: "string",
      varchar: "string",
      char: "string",

      number: "number",
      integer: "int",
      int: "int",
      bigint: "long",
      float: "double",
      double: "double",
      decimal: "decimal",

      boolean: "bool",
      bool: "bool",

      date: "date",
      datetime: "date",
      timestamp: "date",

      json: "object",
      jsonb: "object",
      object: "object",
      array: "array",

      uuid: "string",
      binary: "binData",
      blob: "binData",
    };

    const mappedType = bsonTypeMap[fieldType.toLowerCase()] || "string";
    logger.trace("Mapped type result", { fieldType, mappedType });

    return mappedType;
  }

  // ==========================================
  // ✅ INSERT RESULT PROCESSING (LEARNED FROM @dqcai/mongo)
  // ==========================================

  /**
   * 📊 MongoDB trả về insertedId trực tiếp
   */
  protected async processInsertResult(
    collectionName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    logger.trace("Processing insert result", {
      collectionName,
      insertedId: result.insertedId?.toString(),
    });

    // MongoDB returns { insertedId, acknowledged }
    return {
      ...data,
      _id: result.insertedId,
      id: result.insertedId.toString(), // For compatibility
    };
  }

  // ==========================================
  // ✅ PLACEHOLDER (NoSQL - không dùng)
  // ==========================================

  protected getPlaceholder(index: number): string {
    logger.trace("Getting MongoDB placeholder (unused)", { index });
    return ""; // MongoDB không dùng placeholders
  }

  // ==========================================
  // ✅ EXECUTE RAW (LEARNED FROM @dqcai/mongo)
  // ==========================================

  async executeRaw(query: any, params?: any[]): Promise<any> {
    logger.trace("Executing raw MongoDB command", {
      query,
      params,
    });

    if (!this.db) {
      logger.error("Not connected to MongoDB");
      throw new Error("Not connected to MongoDB");
    }

    // MongoDB sử dụng command object, không phải SQL string
    const result = await this.db.admin().command(query);
    logger.trace("Raw command executed", { resultKeys: Object.keys(result) });
    return { rows: [result], rowCount: 1 };
  }

  // ==========================================
  // ✅ TABLE/COLLECTION OPERATIONS
  // ==========================================

  async tableExists(collectionName: string): Promise<boolean> {
    logger.trace("Checking collection existence", { collectionName });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }
    const collections = await this.db
      .listCollections({ name: collectionName })
      .toArray();

    const exists = collections.length > 0;
    logger.trace("Collection existence check result", {
      collectionName,
      exists,
    });
    return exists;
  }

  async getTableInfo(
    collectionName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.trace("Getting collection info", { collectionName });

    // MongoDB is schemaless, return basic info
    const info = { name: collectionName, cols: [] };
    logger.trace("Returned schemaless info", { collectionName });
    return info;
  }

  // Lớp này chỉ có mongo mới tạo kiểu này, còn các cơ sở dữ liệu SQL thì sẽ tạo chung một thủ tục
  async createTable(
    collectionName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    logger.debug("Creating collection with validation", {
      collectionName,
      schemaKeys: Object.keys(schema),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    // Build validation schema
    const validation = this.buildValidationSchema(schema);

    await this.db.createCollection(collectionName, {
      validator: validation,
      validationLevel: "moderate",
      validationAction: "warn",
    });

    logger.info("Collection created successfully", { collectionName });
  }

  async dropTable(collectionName: string): Promise<void> {
    logger.debug("Dropping collection", { collectionName });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }
    await this.db.collection(collectionName).drop();

    logger.info("Collection dropped successfully", { collectionName });
  }

  // ========================================
  // MONGODB ADAPTER - DDL Methods
  // ========================================
  // MongoDB là NoSQL, không có DDL truyền thống như SQL
  // Tuy nhiên vẫn cần implement interface để tương thích

  async createIndex(
    tableName: string,
    indexDef: IndexDefinition
  ): Promise<void> {
    logger.info("Creating index (MongoDB)", {
      collection: tableName,
      indexName: indexDef.name,
    });
    this.ensureConnected();

    const collection = this.db.collection(tableName);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const indexSpec: any = {};
    for (const field of indexDef.fields) {
      indexSpec[field] = 1; // 1 for ascending, -1 for descending
    }

    const options: any = {
      unique: indexDef.unique || false,
    };

    if (indexDef.name) {
      options.name = indexDef.name;
    }

    if (indexDef.type) {
      // MongoDB index types: text, 2d, 2dsphere, hashed
      if (indexDef.type === "TEXT") {
        for (const field of indexDef.fields) {
          indexSpec[field] = "text";
        }
      } else if (indexDef.type === "HASH") {
        for (const field of indexDef.fields) {
          indexSpec[field] = "hashed";
        }
      }
    }

    await collection.createIndex(indexSpec, options);
    logger.info("Index created successfully (MongoDB)", {
      collection: tableName,
      indexName: indexDef.name,
    });
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    logger.info("Dropping index (MongoDB)", {
      collection: tableName,
      indexName,
    });
    this.ensureConnected();

    const collection = this.db.collection(tableName);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await collection.dropIndex(indexName);
    logger.info("Index dropped successfully (MongoDB)", {
      collection: tableName,
      indexName,
    });
  }

  async createForeignKey(
    tableName: string,
    foreignKeyDef: ForeignKeyDefinition
  ): Promise<void> {
    logger.warn("MongoDB does not support foreign keys natively", {
      collection: tableName,
    });

    // MongoDB không hỗ trợ foreign key constraints
    // Có thể implement bằng application-level validation hoặc $lookup
    throw new Error(
      "MongoDB does not support foreign key constraints. Use application-level validation or $lookup for references."
    );
  }

  async dropForeignKey(
    tableName: string,
    foreignKeyName: string
  ): Promise<void> {
    logger.warn("MongoDB does not support foreign keys", {
      collection: tableName,
    });
    throw new Error("MongoDB does not support foreign key constraints.");
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    logger.trace("Getting foreign keys (MongoDB)", { collection: tableName });
    // MongoDB không có foreign keys
    return [];
  }

  async alterTable(
    tableName: string,
    changes: SchemaDefinition
  ): Promise<void> {
    logger.info("Altering collection schema (MongoDB)", {
      collection: tableName,
    });
    this.ensureConnected();

    // MongoDB là schema-less, nhưng có thể sử dụng validation rules
    const collection = this.db.collection(tableName);
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Tạo validation schema từ changes
    const validator: any = {
      $jsonSchema: {
        bsonType: "object",
        properties: {},
      },
    };

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      const fieldSchema: any = {
        bsonType: this.mapFieldTypeToMongoType(fieldDef.type),
      };

      if (fieldDef.required) {
        validator.$jsonSchema.required = validator.$jsonSchema.required || [];
        validator.$jsonSchema.required.push(fieldName);
      }

      validator.$jsonSchema.properties[fieldName] = fieldSchema;
    }

    // Update collection validation
    await this.db.command({
      collMod: tableName,
      validator: validator,
      validationLevel: "moderate",
    });

    logger.info("Collection schema updated successfully (MongoDB)", {
      collection: tableName,
    });
  }

  private mapFieldTypeToMongoType(fieldType: string): string {
    const typeMap: { [key: string]: string } = {
      string: "string",
      number: "number",
      integer: "int",
      boolean: "bool",
      date: "date",
      datetime: "date",
      timestamp: "date",
      text: "string",
      json: "object",
      array: "array",
    };

    return typeMap[fieldType.toLowerCase()] || "string";
  }
  // ==========================================
  // ✅ CRUD OPERATIONS (MONGODB-SPECIFIC)
  // ==========================================

  /**
   * 🔄 INSERT ONE - MongoDB native
   */
  async insertOne(collectionName: string, data: any): Promise<any> {
    logger.debug("Inserting one document", {
      collectionName,
      dataKeys: Object.keys(data),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    // ✅ Convert id to _id if present
    const mongoData = this.sqliteToMongoFormat(data);

    // ✅ Sanitize (though MongoDB handles most types)
    const sanitizedData = Object.entries(mongoData).reduce(
      (acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      },
      {} as any
    );

    const result = await this.db
      .collection(collectionName)
      .insertOne(sanitizedData);

    // ✅ Process result
    const inserted = await this.processInsertResult(
      collectionName,
      result,
      sanitizedData
    );

    logger.info("Inserted one document successfully", {
      collectionName,
      insertedId: inserted.id,
    });

    return inserted;
  }

  async insertMany(collectionName: string, data: any[]): Promise<any[]> {
    logger.debug("Inserting many documents", {
      collectionName,
      count: data.length,
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    // ✅ Convert and sanitize all documents
    const mongoData = data.map((doc) => this.sqliteToMongoFormat(doc));
    const sanitizedData = mongoData.map((doc) =>
      Object.entries(doc).reduce((acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      }, {} as any)
    );

    const result = await this.db
      .collection(collectionName)
      .insertMany(sanitizedData);

    const insertedDocs = sanitizedData.map((doc, i) => ({
      ...doc,
      _id: result.insertedIds[i],
      id: result.insertedIds[i].toString(),
    }));

    logger.info("Inserted many documents successfully", {
      collectionName,
      count: insertedDocs.length,
    });

    return insertedDocs;
  }

  /**
   * 🔍 FIND - With filter conversion
   */
  async find(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
    logger.trace("Finding documents", {
      collectionName,
      filterKeys: Object.keys(filter),
      optionsKeys: options ? Object.keys(options) : [],
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = this.convertFilterToMongo(filter);
    let cursor = this.db.collection(collectionName).find(mongoFilter);

    if (options?.sort) cursor = cursor.sort(options.sort);
    if (options?.limit) cursor = cursor.limit(options.limit);
    if (options?.skip || options?.offset)
      cursor = cursor.skip(options.skip || options.offset || 0);

    const results = await cursor.toArray();

    // Convert _id back to id for compatibility
    const formattedResults = results.map((doc: any) =>
      this.mongoToSQLiteFormat(doc)
    );

    logger.trace("Found documents", {
      collectionName,
      count: formattedResults.length,
    });

    return formattedResults;
  }

  async findOne(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    logger.trace("Finding one document", {
      collectionName,
      filterKeys: Object.keys(filter),
      optionsKeys: options ? Object.keys(options) : [],
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = this.convertFilterToMongo(filter);
    const mongoOptions: any = {};
    if (options?.sort) mongoOptions.sort = options.sort;

    const result = await this.db
      .collection(collectionName)
      .findOne(mongoFilter, mongoOptions);

    const formattedResult = result ? this.mongoToSQLiteFormat(result) : null;

    logger.trace("Found one document", {
      collectionName,
      found: !!formattedResult,
    });

    return formattedResult;
  }

  async findById(collectionName: string, id: any): Promise<any | null> {
    logger.trace("Finding document by ID", {
      collectionName,
      id,
    });

    return this.findOne(collectionName, { _id: new this.ObjectId(id) } as any);
  }

  /**
   * 🔄 UPDATE - With sanitization
   */
  async update(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    logger.debug("Updating documents", {
      collectionName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    // ✅ Sanitize update data
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = this.sanitizeValue(value);
      return acc;
    }, {} as any);

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .updateMany(mongoFilter, { $set: sanitizedData });

    const modifiedCount = result.modifiedCount;

    if (modifiedCount === 0) {
      logger.warn("No documents updated", { collectionName });
    } else {
      logger.info("Updated documents successfully", {
        collectionName,
        modifiedCount,
      });
    }

    return modifiedCount;
  }

  async updateOne(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    logger.trace("Updating one document", {
      collectionName,
      filterKeys: Object.keys(filter),
      dataKeys: Object.keys(data),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = this.sanitizeValue(value);
      return acc;
    }, {} as any);

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .updateOne(mongoFilter, { $set: sanitizedData });

    const updated = result.modifiedCount > 0;

    logger.trace("Updated one document result", {
      collectionName,
      updated,
    });

    return updated;
  }

  async updateById(
    collectionName: string,
    id: any,
    data: any
  ): Promise<boolean> {
    logger.trace("Updating document by ID", {
      collectionName,
      id,
      dataKeys: Object.keys(data),
    });

    return this.updateOne(
      collectionName,
      { _id: new this.ObjectId(id) } as any,
      data
    );
  }

  /**
   * 🗑️ DELETE
   */
  async delete(collectionName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting documents", {
      collectionName,
      filterKeys: Object.keys(filter),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .deleteMany(mongoFilter);

    const deletedCount = result.deletedCount;

    if (deletedCount === 0) {
      logger.warn("No documents deleted", { collectionName });
    } else {
      logger.info("Deleted documents successfully", {
        collectionName,
        deletedCount,
      });
    }

    return deletedCount;
  }

  async deleteOne(
    collectionName: string,
    filter: QueryFilter
  ): Promise<boolean> {
    logger.trace("Deleting one document", {
      collectionName,
      filterKeys: Object.keys(filter),
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .deleteOne(mongoFilter);

    const deleted = result.deletedCount > 0;

    logger.trace("Deleted one document result", {
      collectionName,
      deleted,
    });

    return deleted;
  }

  async deleteById(collectionName: string, id: any): Promise<boolean> {
    logger.trace("Deleting document by ID", {
      collectionName,
      id,
    });

    return this.deleteOne(collectionName, {
      _id: new this.ObjectId(id),
    } as any);
  }

  async count(collectionName: string, filter?: QueryFilter): Promise<number> {
    logger.trace("Counting documents", {
      collectionName,
      hasFilter: !!filter,
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};
    const countValue = await this.db
      .collection(collectionName)
      .countDocuments(mongoFilter);

    logger.trace("Count result", {
      collectionName,
      count: countValue,
    });

    return countValue;
  }

  // ==========================================
  // ✅ MONGODB AGGREGATION
  // ==========================================

  async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
    logger.debug("Executing aggregation pipeline", {
      collectionName,
      pipelineStages: pipeline.length,
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const results = await this.db
      .collection(collectionName)
      .aggregate(pipeline)
      .toArray();

    logger.trace("Aggregation completed", {
      collectionName,
      resultCount: results.length,
    });

    return results;
  }

  async distinct(
    collectionName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
    logger.trace("Getting distinct values", {
      collectionName,
      field,
      hasFilter: !!filter,
    });

    if (!this.db) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};
    const distinctValues = await this.db
      .collection(collectionName)
      .distinct(field, mongoFilter);

    logger.trace("Distinct values retrieved", {
      collectionName,
      field,
      count: distinctValues.length,
    });

    return distinctValues;
  }

  // ==========================================
  // ✅ TRANSACTION (LEARNED FROM @dqcai/mongo)
  // ==========================================

  async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning MongoDB transaction");

    if (!this.client) {
      logger.error("Not connected");
      throw new Error("Not connected");
    }

    const session = this.client.startSession();
    await session.startTransaction();

    return {
      commit: async () => {
        if (!session.inTransaction)
          throw new Error("Transaction already completed");
        await session.commitTransaction();
        await session.endSession();
        logger.info("Transaction committed");
      },
      rollback: async () => {
        if (!session.inTransaction)
          throw new Error("Transaction already completed");
        await session.abortTransaction();
        await session.endSession();
        logger.info("Transaction rolled back");
      },
      isActive: () => session.inTransaction,
    };
  }

  // ==========================================
  // ✅ HELPER METHODS (LEARNED FROM @dqcai/mongo)
  // ==========================================

  /**
   * 🔄 Convert SQLite format to MongoDB format
   */
  private sqliteToMongoFormat(
    record: Record<string, any>
  ): Record<string, any> {
    logger.trace("Converting SQLite format to Mongo", {
      recordKeys: Object.keys(record || {}),
    });

    if (!record) return record;

    const converted = { ...record };

    // Convert id to _id
    if (converted.id) {
      if (this.ObjectId && this.ObjectId.isValid(converted.id)) {
        converted._id = new this.ObjectId(converted.id);
      } else {
        converted._id = converted.id;
      }
      delete converted.id;
    }

    // Parse JSON strings back to objects/arrays
    for (const [key, value] of Object.entries(converted)) {
      if (typeof value === "string") {
        // Try to parse as date
        if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            converted[key] = date;
            continue;
          }
        }

        // Try to parse as JSON
        if (
          (value.startsWith("{") && value.endsWith("}")) ||
          (value.startsWith("[") && value.endsWith("]"))
        ) {
          try {
            converted[key] = JSON.parse(value);
          } catch {
            // Keep as string if parsing fails
          }
        }
      }
    }

    logger.trace("Conversion to Mongo complete", {
      resultKeys: Object.keys(converted),
    });
    return converted;
  }

  /**
   * 🔄 Convert MongoDB format to SQLite format
   */
  private mongoToSQLiteFormat(document: any): Record<string, any> {
    logger.trace("Converting Mongo format to SQLite", {
      documentKeys: Object.keys(document || {}),
    });

    if (!document) return document;

    const converted = { ...document };

    // Convert _id to id
    if (converted._id) {
      converted.id = converted._id.toString();
      delete converted._id;
    }

    // Convert ObjectIds to strings
    for (const [key, value] of Object.entries(converted)) {
      if (value && this.ObjectId && value instanceof this.ObjectId) {
        converted[key] = value.toString();
      } else if (value instanceof Date) {
        converted[key] = value.toISOString();
      }
    }

    logger.trace("Conversion to SQLite complete", {
      resultKeys: Object.keys(converted),
    });
    return converted;
  }

  /**
   * 🔍 Convert QueryFilter to MongoDB query format
   */
  private convertFilterToMongo(filter: QueryFilter): any {
    logger.trace("Converting filter to MongoDB query", {
      filterKeys: Object.keys(filter),
      filterType: typeof filter,
    });

    const mongoFilter: any = {};

    for (const [key, value] of Object.entries(filter)) {
      // Handle logical operators
      if (key === "$and" || key === "$or" || key === "$not") {
        mongoFilter[key] = Array.isArray(value)
          ? value.map((f) => this.convertFilterToMongo(f))
          : this.convertFilterToMongo(value);
        continue;
      }

      // Handle comparison operators
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
              // SQL LIKE to MongoDB regex
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

    logger.trace("Filter conversion complete", {
      mongoFilterKeys: Object.keys(mongoFilter),
    });
    return mongoFilter;
  }

  /**
   * 🏗️ Build validation schema for MongoDB
   */
  private buildValidationSchema(schema: SchemaDefinition): Record<string, any> {
    logger.trace("Building MongoDB validation schema", {
      schemaKeys: Object.keys(schema),
    });

    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const bsonType = this.mapFieldTypeToDBType(fieldDef.type);
      const fieldValidation: any = { bsonType };

      if (fieldDef.enum) {
        fieldValidation.enum = fieldDef.enum;
      }

      if (fieldDef.required && fieldName !== "id") {
        required.push(fieldName);
      }

      properties[fieldName] = fieldValidation;
    }

    const validationSchema = {
      $jsonSchema: {
        bsonType: "object",
        properties,
        required,
      },
    };

    logger.trace("Validation schema built", {
      propertyCount: Object.keys(properties).length,
      requiredCount: required.length,
    });

    return validationSchema;
  }

  // ==========================================
  // ✅ OBJECTID HELPERS
  // ==========================================

  createObjectId(id?: string): any {
    logger.trace("Creating ObjectId", { id });

    return id ? new this.ObjectId(id) : new this.ObjectId();
  }

  isValidObjectId(id: string): boolean {
    logger.trace("Validating ObjectId", { id });

    const isValid = this.ObjectId?.isValid(id) || false;

    logger.trace("ObjectId validation result", { id, isValid });

    return isValid;
  }
}

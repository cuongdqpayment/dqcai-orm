// ========================
// src/adapters/mongodb-adapter.ts - REFACTORED
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
  PrimaryKeyType,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "@/types/orm.types";
import { createModuleLogger, ORMModules } from "@/logger";
import { MongoDBConfig } from "@/types/database-config-types";

const logger = createModuleLogger(ORMModules.MONGODB_ADAPTER);

/**
 * 🎯 MongoDB Adapter - Unified ID Conversion Strategy
 *
 * CONVERSION RULES:
 * - ORM Layer uses: `id` (string)
 * - MongoDB uses: `_id` (ObjectId or any type)
 * - All input from ORM → toMongo() → MongoDB
 * - All output from MongoDB → fromMongo() → ORM
 */
export class MongoDBAdapter extends BaseAdapter {
  type: DatabaseType = "mongodb";
  databaseType: DatabaseType = "mongodb";
  private client: any = null;
  private db: any = null;
  private ObjectId: any = null;
  private primaryKeyType: PrimaryKeyType = "objectid";
  private autoMapId: boolean = true;

  constructor(config: DbConfig) {
    super(config);
    this.primaryKeyType = (config as any).primaryKeyType || "objectid";
    this.autoMapId = (config as any).autoMapId !== false;
  }

  // ==========================================
  // ✅ CONNECTION & SUPPORT
  // ==========================================

  isSupported(): boolean {
    if (this.dbModule !== null) return true;
    if (this.db || this.isConnected()) return true;

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
    const config = { ...this.dbConfig, database: this.dbName } as MongoDBConfig;
    const database = config.database;
    const url =
      config.url || config.connectionString || "mongodb://localhost:27017";
    logger.debug("Connecting to MongoDB", {
      database,
      url,
    });

    try {
      const { MongoClient, ObjectId } = await import("mongodb");
      const client = new MongoClient(url, config.options);

      await client.connect();
      const db = client.db(database);

      // Verify database access
      try {
        await db.listCollections().toArray();
        logger.trace("Database access verified", { database });
      } catch (accessError) {
        logger.warn("Could not verify database access", {
          database,
          error: (accessError as Error).message,
        });
      }

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
      });

      return connection;
    } catch (error) {
      logger.error("MongoDB connection failed", {
        database: config.database,
        error: (error as Error).message,
      });
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  // ==========================================
  // ✅ CORE CONVERSION METHODS (SINGLE SOURCE OF TRUTH)
  // ==========================================

  /**
   * 🔄 ORM → MongoDB: Convert `id` to `_id`
   * @param data - Single object or filter from ORM layer
   * @returns MongoDB-compatible object with `_id`
   */
  private toMongo(data: any): any {
    if (!this.autoMapId || !data) return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.toMongo(item));
    }

    const converted = { ...data };

    // Convert id → _id
    if (converted.id !== undefined) {
      if (this.primaryKeyType === "objectid" && this.ObjectId) {
        // Try to convert string to ObjectId
        if (
          typeof converted.id === "string" &&
          this.ObjectId.isValid(converted.id)
        ) {
          converted._id = new this.ObjectId(converted.id);
        } else if (converted.id instanceof this.ObjectId) {
          converted._id = converted.id;
        } else {
          // Keep as is for non-ObjectId types (string/number)
          converted._id = converted.id;
        }
      } else {
        // Direct mapping for string/number primary keys
        converted._id = converted.id;
      }
      delete converted.id;
    }

    // Recursively convert nested objects (e.g., foreign keys in filters)
    for (const [key, value] of Object.entries(converted)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Skip MongoDB operators
        if (!key.startsWith("$")) {
          converted[key] = this.toMongo(value);
        }
      }
    }

    return converted;
  }

  /**
   * 🔄 MongoDB → ORM: Convert `_id` to `id`
   * @param data - Single object or array from MongoDB
   * @returns ORM-compatible object with `id`
   */
  private fromMongo(data: any): any {
    if (!this.autoMapId || !data) return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.fromMongo(item));
    }

    const converted = { ...data };

    // Convert _id → id
    if (converted._id !== undefined) {
      if (converted._id instanceof this.ObjectId) {
        converted.id = converted._id.toString();
      } else {
        converted.id = converted._id;
      }
      delete converted._id;
    }

    // Recursively convert nested objects
    for (const [key, value] of Object.entries(converted)) {
      if (Array.isArray(value)) {
        converted[key] = value.map((item) => this.fromMongo(item));
      } else if (value && typeof value === "object") {
        // Convert nested ObjectIds to strings
        if (value instanceof this.ObjectId) {
          converted[key] = value.toString();
        } else {
          converted[key] = this.fromMongo(value);
        }
      } else if (value instanceof Date) {
        // Keep dates as ISO strings for consistency
        converted[key] = value.toISOString();
      }
    }

    return converted;
  }

  /**
   * 🎯 Create MongoDB filter for ID field
   * @param id - ID value (string, number, or ObjectId)
   * @returns MongoDB filter object { _id: ... }
   */
  private createIdFilter(id: any): any {
    logger.trace("🔑 Creating ID filter", {
      id,
      type: typeof id,
      primaryKeyType: this.primaryKeyType,
      isObjectId: id instanceof this.ObjectId,
    });
    if (id === null || id === undefined) {
      throw new Error("ID cannot be null or undefined");
    }

    // If primaryKeyType is not objectid, use direct value
    if (this.primaryKeyType !== "objectid") {
      logger.trace("Using direct ID value (non-ObjectId mode)");
      return { _id: id };
    }

    // For ObjectId: validate and convert
    if (this.ObjectId) {
      if (id instanceof this.ObjectId) {
        logger.trace("ID is already ObjectId");
        return { _id: id };
      }
      if (typeof id === "string" && this.ObjectId.isValid(id)) {
        const objectId = new this.ObjectId(id);
        logger.trace("Converted string to ObjectId", {
          original: id,
          converted: objectId.toString(),
        });
        return { _id: objectId };
      }
    }

    // Fallback: treat as direct value (for compatibility)
    logger.warn("ID is not valid ObjectId, using as-is", {
      id,
      type: typeof id,
    });
    return { _id: id };
  }

  /**
   * 🔍 Convert QueryFilter to MongoDB query format
   */
  private convertFilterToMongo(filter: QueryFilter): any {
    logger.trace("🔄 Converting filter to MongoDB format", {
      filter,
      filterKeys: Object.keys(filter || {}),
    });

    if (!filter || Object.keys(filter).length === 0) {
      logger.trace("Empty filter, returning {}");
      return {};
    }

    // First convert id → _id
    const converted = this.toMongo(filter);
    logger.trace("After toMongo conversion", { converted });

    // Then handle operators
    const mongoFilter: any = {};

    for (const [key, value] of Object.entries(converted)) {
      // Handle logical operators
      if (key === "$and" || key === "$or" || key === "$not") {
        mongoFilter[key] = Array.isArray(value)
          ? value.map((f) => this.convertFilterToMongo(f))
          : this.convertFilterToMongo(value as any);
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
            case "$ne":
            case "$gt":
            case "$gte":
            case "$lt":
            case "$lte":
            case "$in":
            case "$nin":
            case "$regex":
            case "$exists":
              conditions[op] = opValue;
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
            default:
              conditions[op] = opValue;
          }
        }

        mongoFilter[key] = conditions;
      } else {
        mongoFilter[key] = value;
      }
    }

    logger.trace("Final MongoDB filter", { mongoFilter });
    return mongoFilter;
  }

  // ==========================================
  // ✅ SANITIZATION & TYPE MAPPING
  // ==========================================

  protected sanitizeValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === "boolean") return value;
    if (typeof value === "object") return value; // BSON supports objects/arrays
    return value;
  }

  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
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
    return bsonTypeMap[fieldType.toLowerCase()] || "string";
  }

  protected async processInsertResult(
    collectionName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    // MongoDB returns { insertedId, acknowledged }
    return this.fromMongo({
      ...data,
      _id: result.insertedId,
    });
  }

  protected getPlaceholder(index: number): string {
    return ""; // MongoDB doesn't use placeholders
  }

  // ==========================================
  // ✅ OVERRIDE CRUD OPERATIONS (FROM BASE)
  // ==========================================

  /**
   * Override insertOne - Add conversion
   */
  async insertOne(collectionName: string, data: any): Promise<any> {
    logger.debug("Inserting one document", {
      collectionName,
      dataKeys: Object.keys(data),
    });

    if (!this.db) throw new Error("Not connected");

    // Convert ORM data to MongoDB format (id → _id)
    const mongoData = this.toMongo(data);

    // Sanitize values
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

    // Fetch inserted document and convert back to ORM format (_id → id)
    const inserted = await this.db
      .collection(collectionName)
      .findOne({ _id: result.insertedId });

    logger.info("Inserted one document successfully", { collectionName });
    return this.fromMongo(inserted);
  }

  /**
   * Override insertMany - Add conversion
   */
  async insertMany(collectionName: string, data: any[]): Promise<any[]> {
    logger.debug("Inserting many documents", {
      collectionName,
      count: data.length,
    });

    if (!this.db) throw new Error("Not connected");

    // Convert all documents
    const mongoData = data.map((doc) => {
      const converted = this.toMongo(doc);
      return Object.entries(converted).reduce((acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      }, {} as any);
    });

    const result = await this.db
      .collection(collectionName)
      .insertMany(mongoData);

    // Fetch inserted documents
    const insertedIds = Object.values(result.insertedIds);
    const insertedDocs = await this.db
      .collection(collectionName)
      .find({ _id: { $in: insertedIds } })
      .toArray();

    logger.info("Inserted many documents successfully", {
      collectionName,
      count: insertedDocs.length,
    });

    return this.fromMongo(insertedDocs);
  }

  /**
   * Override find - Add conversion
   */
  async find(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any[]> {
    logger.trace("Finding documents", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    let cursor = this.db.collection(collectionName).find(mongoFilter);

    if (options?.sort) cursor = cursor.sort(options.sort);
    if (options?.limit) cursor = cursor.limit(options.limit);
    if (options?.skip || options?.offset) {
      cursor = cursor.skip(options.skip || options.offset || 0);
    }

    const results = await cursor.toArray();
    return this.fromMongo(results);
  }

  /**
   * Override findOne - Add conversion
   */
  async findOne(
    collectionName: string,
    filter: QueryFilter,
    options?: QueryOptions
  ): Promise<any | null> {
    logger.trace("🔍 Finding one document", {
      collectionName,
      filter,
      options,
    });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    logger.debug("📋 MongoDB filter prepared", { mongoFilter });
    const mongoOptions: any = {};
    if (options?.sort) mongoOptions.sort = options.sort;

    try {
      const result = await this.db
        .collection(collectionName)
        .findOne(mongoFilter, mongoOptions);

      logger.debug("✅ MongoDB findOne result", {
        found: !!result,
        resultId: result?._id?.toString(),
      });

      return result ? this.fromMongo(result) : null;
    } catch (error) {
      logger.error("❌ MongoDB findOne error", {
        collectionName,
        mongoFilter,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Override findById - Add conversion
   */
  async findById(collectionName: string, id: any): Promise<any | null> {
    logger.trace("🆔 Finding document by ID", {
      collectionName,
      id,
      idType: typeof id,
    });

    const mongoFilter = this.createIdFilter(id);
    logger.debug("📋 Created ID filter", { mongoFilter });
    return this.findOne(collectionName, mongoFilter as QueryFilter);
  }

  /**
   * Override update - Add conversion
   */
  async update(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<number> {
    logger.debug("Updating documents", { collectionName });

    if (!this.db) throw new Error("Not connected");

    // Convert filter and data
    const mongoFilter = this.convertFilterToMongo(filter);
    const mongoData = this.toMongo(data);

    // Sanitize update data
    const sanitizedData = Object.entries(mongoData).reduce(
      (acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      },
      {} as any
    );

    const result = await this.db
      .collection(collectionName)
      .updateMany(mongoFilter, { $set: sanitizedData });

    if (result.modifiedCount === 0) {
      logger.warn("No documents updated", { collectionName });
    } else {
      logger.info("Updated documents successfully", {
        collectionName,
        modifiedCount: result.modifiedCount,
      });
    }

    return result.modifiedCount;
  }

  /**
   * Override updateOne - Add conversion
   */
  async updateOne(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    logger.trace("Updating one document", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    const mongoData = this.toMongo(data);

    const sanitizedData = Object.entries(mongoData).reduce(
      (acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      },
      {} as any
    );

    const result = await this.db
      .collection(collectionName)
      .updateOne(mongoFilter, { $set: sanitizedData });

    return result.modifiedCount > 0;
  }

  /**
   * Override updateById - Add conversion
   */
  async updateById(
    collectionName: string,
    id: any,
    data: any
  ): Promise<boolean> {
    logger.trace("Updating document by ID", { collectionName, id });

    const mongoFilter = this.createIdFilter(id);
    return this.updateOne(collectionName, mongoFilter as QueryFilter, data);
  }

  /**
   * Override delete - Add conversion
   */
  async delete(collectionName: string, filter: QueryFilter): Promise<number> {
    logger.debug("Deleting documents", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .deleteMany(mongoFilter);

    if (result.deletedCount === 0) {
      logger.warn("No documents deleted", { collectionName });
    } else {
      logger.info("Deleted documents successfully", {
        collectionName,
        deletedCount: result.deletedCount,
      });
    }

    return result.deletedCount;
  }

  /**
   * Override deleteOne - Add conversion
   */
  async deleteOne(
    collectionName: string,
    filter: QueryFilter
  ): Promise<boolean> {
    logger.trace("Deleting one document", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .deleteOne(mongoFilter);

    return result.deletedCount > 0;
  }

  /**
   * Override deleteById - Add conversion
   */
  async deleteById(collectionName: string, id: any): Promise<boolean> {
    logger.trace("Deleting document by ID", { collectionName, id });

    const mongoFilter = this.createIdFilter(id);
    return this.deleteOne(collectionName, mongoFilter as QueryFilter);
  }

  /**
   * Override count - Add conversion
   */
  async count(collectionName: string, filter?: QueryFilter): Promise<number> {
    logger.trace("Counting documents", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};
    const countValue = await this.db
      .collection(collectionName)
      .countDocuments(mongoFilter);

    return countValue;
  }

  // ==========================================
  // ✅ MONGODB-SPECIFIC OPERATIONS
  // ==========================================

  /**
   * Aggregate with automatic ID mapping
   */
  async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
    logger.debug("Executing aggregation pipeline", {
      collectionName,
      pipelineStages: pipeline.length,
    });

    if (!this.db) throw new Error("Not connected");

    // Enhance pipeline to map _id → id
    const enhancedPipeline = this.autoMapId
      ? this.enhanceAggregatePipeline(pipeline)
      : pipeline;

    const results = await this.db
      .collection(collectionName)
      .aggregate(enhancedPipeline)
      .toArray();

    return this.fromMongo(results);
  }

  /**
   * Add $project stage to map _id → id
   */
  private enhanceAggregatePipeline(pipeline: any[]): any[] {
    if (!this.autoMapId) return pipeline;

    const lastStage = pipeline[pipeline.length - 1];

    if (lastStage?.$project) {
      // Merge with existing $project
      lastStage.$project.id = { $toString: "$_id" };
      lastStage.$project._id = 0;
    } else {
      // Add new $project stage
      pipeline.push({
        $project: {
          id: { $toString: "$_id" },
          _id: 0,
        },
      });
    }

    return pipeline;
  }

  async distinct(
    collectionName: string,
    field: string,
    filter?: QueryFilter
  ): Promise<any[]> {
    logger.trace("Getting distinct values", { collectionName, field });

    if (!this.db) throw new Error("Not connected");

    // Convert field name if it's "id"
    const mongoField = field === "id" ? "_id" : field;
    const mongoFilter = filter ? this.convertFilterToMongo(filter) : {};

    const distinctValues = await this.db
      .collection(collectionName)
      .distinct(mongoField, mongoFilter);

    // Convert back if field was "id"
    if (field === "id" && this.autoMapId) {
      return distinctValues.map((val: any) =>
        val instanceof this.ObjectId ? val.toString() : val
      );
    }

    return distinctValues;
  }

  // ==========================================
  // ✅ SCHEMA OPERATIONS
  // ==========================================

  async executeRaw(query: any, params?: any[]): Promise<any> {
    logger.trace("Executing raw MongoDB command", { query });

    if (!this.db) throw new Error("Not connected to MongoDB");

    const result = await this.db.admin().command(query);
    return { rows: [result], rowCount: 1 };
  }

  async tableExists(collectionName: string): Promise<boolean> {
    logger.trace("Checking collection existence", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const collections = await this.db
      .listCollections({ name: collectionName })
      .toArray();

    return collections.length > 0;
  }

  async getTableInfo(
    collectionName: string
  ): Promise<EntitySchemaDefinition | null> {
    logger.trace("Getting collection info", { collectionName });
    // MongoDB is schemaless
    return { name: collectionName, cols: [] };
  }

  async createTable(
    collectionName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    logger.debug("Creating collection with validation", { collectionName });

    if (!this.db) throw new Error("Not connected");

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

    if (!this.db) throw new Error("Not connected");

    await this.db.collection(collectionName).drop();
    logger.info("Collection dropped successfully", { collectionName });
  }

  private buildValidationSchema(schema: SchemaDefinition): Record<string, any> {
    const properties: Record<string, any> = {};
    let required: string[] = [];

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      // Skip 'id' field as MongoDB uses '_id'
      if (fieldName === "id") continue;

      const bsonType = this.mapFieldTypeToDBType(fieldDef.type);
      const fieldValidation: any = { bsonType };

      if (fieldDef.enum) fieldValidation.enum = fieldDef.enum;
      if (fieldDef.required && fieldName !== "id") required.push(fieldName);

      properties[fieldName] = fieldValidation;
    }

    return {
      $jsonSchema: {
        bsonType: "object",
        properties,
        required,
      },
    };
  }

  // ==========================================
  // ✅ INDEX & DDL OPERATIONS
  // ==========================================

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
    const indexSpec: any = {};

    for (const field of indexDef.fields) {
      // Convert 'id' to '_id' for MongoDB
      const mongoField = field === "id" ? "_id" : field;
      indexSpec[mongoField] = 1;
    }

    const options: any = { unique: indexDef.unique || false };
    if (indexDef.name) options.name = indexDef.name;

    if (indexDef.type) {
      if (indexDef.type === "TEXT") {
        for (const field of indexDef.fields) {
          const mongoField = field === "id" ? "_id" : field;
          indexSpec[mongoField] = "text";
        }
      } else if (indexDef.type === "HASH") {
        for (const field of indexDef.fields) {
          const mongoField = field === "id" ? "_id" : field;
          indexSpec[mongoField] = "hashed";
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

    const validator: any = {
      $jsonSchema: {
        bsonType: "object",
        properties: {},
      },
    };

    for (const [fieldName, fieldDef] of Object.entries(changes)) {
      if (fieldName === "id") continue;

      const fieldSchema: any = {
        bsonType: this.mapFieldTypeToDBType(fieldDef.type),
      };

      if (fieldDef.required) {
        validator.$jsonSchema.required = validator.$jsonSchema.required || [];
        validator.$jsonSchema.required.push(fieldName);
      }

      validator.$jsonSchema.properties[fieldName] = fieldSchema;
    }

    await this.db.command({
      collMod: tableName,
      validator: validator,
      validationLevel: "moderate",
    });

    logger.info("Collection schema updated successfully (MongoDB)", {
      collection: tableName,
    });
  }

  // ==========================================
  // ✅ TRANSACTION SUPPORT
  // ==========================================

  async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning MongoDB transaction");

    if (!this.client) throw new Error("Not connected");

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
  // ✅ UTILITY METHODS
  // ==========================================

  /**
   * Create ObjectId from string or generate new one
   */
  createObjectId(id?: string): any {
    logger.trace("Creating ObjectId", { id });
    return id ? new this.ObjectId(id) : new this.ObjectId();
  }

  /**
   * Check if string is valid ObjectId
   */
  isValidObjectId(id: string): boolean {
    logger.trace("Validating ObjectId", { id });
    return this.ObjectId?.isValid(id) || false;
  }

  /**
   * Override upsert with proper conversion
   */
  async upsert(
    collectionName: string,
    data: any,
    filter: QueryFilter
  ): Promise<any> {
    logger.debug("Performing upsert", { collectionName });

    if (!this.db) throw new Error("Not connected");

    // Convert filter and data
    const mongoFilter = this.convertFilterToMongo(filter);
    const mongoData = this.toMongo(data);

    // Sanitize update data
    const sanitizedData = Object.entries(mongoData).reduce(
      (acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      },
      {} as any
    );

    const result = await this.db
      .collection(collectionName)
      .findOneAndUpdate(
        mongoFilter,
        { $set: sanitizedData },
        { upsert: true, returnDocument: "after" }
      );

    logger.info("Upsert completed", { collectionName });
    return this.fromMongo(result.value);
  }

  /**
   * Override exists with proper conversion
   */
  async exists(collectionName: string, filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", { collectionName });

    if (!this.db) throw new Error("Not connected");

    const mongoFilter = this.convertFilterToMongo(filter);
    const count = await this.db
      .collection(collectionName)
      .countDocuments(mongoFilter, { limit: 1 });

    return count > 0;
  }
}

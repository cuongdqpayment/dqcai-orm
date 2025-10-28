// ========================
// src/adapters/mongodb-adapter.ts (REFACTORED)
// ========================

import { BaseAdapter } from "../core/base-adapter";
import {
  DatabaseType,
  EntitySchemaDefinition,
  QueryFilter,
  QueryOptions,
  SchemaDefinition,
  Transaction,
} from "../types/orm.types";

export class MongoDBAdapter extends BaseAdapter {
  type: DatabaseType = "mongodb";
  databaseType: DatabaseType = "mongodb";
  private client: any = null;
  private db: any = null;
  private ObjectId: any = null;

  // ==========================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================

  /**
   * ✅ MONGODB: Giữ nguyên kiểu dữ liệu JavaScript
   * MongoDB hỗ trợ BSON nên không cần chuyển đổi nhiều
   */
  protected sanitizeValue(value: any): any {
    // MongoDB hỗ trợ Date, Boolean native
    // Chỉ cần xử lý ObjectId nếu cần
    if (value === null || value === undefined) {
      return null;
    }

    // Keep Date objects as-is (BSON supports Date)
    if (value instanceof Date) {
      return value;
    }

    // Keep Boolean as-is (BSON supports Boolean)
    if (typeof value === "boolean") {
      return value;
    }

    // Arrays và Objects giữ nguyên (BSON supports them)
    if (typeof value === "object") {
      return value;
    }

    return value;
  }

  /**
   * ✅ MONGODB: Không cần ánh xạ kiểu (schemaless)
   * MongoDB không yêu cầu schema nghiêm ngặt
   */
  protected mapFieldTypeToDBType(fieldType: string, length?: number): string {
    // MongoDB không cần type mapping vì là schemaless
    // Trả về tên BSON type để tham khảo
    const bsonTypeMap: Record<string, string> = {
      string: "string",
      text: "string",
      number: "number",
      integer: "int",
      bigint: "long",
      float: "double",
      double: "double",
      boolean: "bool",
      date: "date",
      datetime: "date",
      timestamp: "date",
      json: "object",
      jsonb: "object",
      array: "array",
      object: "object",
      uuid: "string",
      binary: "binData",
    };

    return bsonTypeMap[fieldType.toLowerCase()] || "string";
  }

  /**
   * ✅ MONGODB: Xử lý kết quả INSERT
   * MongoDB trả về insertedId trực tiếp
   */
  protected async processInsertResult(
    collectionName: string,
    result: any,
    data: any,
    primaryKeys?: string[]
  ): Promise<any> {
    // MongoDB trả về { ...data, _id: insertedId }
    return { ...data, _id: result.insertedId };
  }

  /**
   * ✅ MONGODB: Không sử dụng placeholder (NoSQL)
   */
  protected getPlaceholder(index: number): string {
    // MongoDB không dùng placeholders
    return "";
  }

  // ==========================================
  // MONGODB-SPECIFIC IMPLEMENTATIONS
  // ==========================================

  async executeRaw(query: any, params?: any[]): Promise<any> {
    if (!this.db) throw new Error("Not connected to MongoDB");
    const result = await this.db.admin().command(query);
    return { rows: [result], rowCount: 1 };
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
    return { name: collectionName, cols: [] };
  }

  async createTable(
    collectionName: string,
    schema: SchemaDefinition
  ): Promise<void> {
    if (!this.db) throw new Error("Not connected");
    await this.db.createCollection(collectionName);
  }

  async dropTable(collectionName: string): Promise<void> {
    if (!this.db) throw new Error("Not connected");
    await this.db.collection(collectionName).drop();
  }

  // ==========================================
  // CRUD OPERATIONS (MONGODB-SPECIFIC)
  // ==========================================

  /**
   * 🔄 OVERRIDE: MongoDB insertOne
   */
  async insertOne(collectionName: string, data: any): Promise<any> {
    if (!this.db) throw new Error("Not connected");
    
    // ✅ Sanitize values (though MongoDB handles most types)
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = this.sanitizeValue(value);
      return acc;
    }, {} as any);

    const result = await this.db.collection(collectionName).insertOne(sanitizedData);
    
    // ✅ Process result
    return this.processInsertResult(collectionName, result, sanitizedData);
  }

  async insertMany(collectionName: string, data: any[]): Promise<any[]> {
    if (!this.db) throw new Error("Not connected");
    
    // ✅ Sanitize all documents
    const sanitizedData = data.map(doc => 
      Object.entries(doc).reduce((acc, [key, value]) => {
        acc[key] = this.sanitizeValue(value);
        return acc;
      }, {} as any)
    );

    const result = await this.db.collection(collectionName).insertMany(sanitizedData);
    return sanitizedData.map((doc, i) => ({ ...doc, _id: result.insertedIds[i] }));
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
    
    // ✅ Sanitize update data
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = this.sanitizeValue(value);
      return acc;
    }, {} as any);

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .updateMany(mongoFilter, { $set: sanitizedData });
    return result.modifiedCount;
  }

  async updateOne(
    collectionName: string,
    filter: QueryFilter,
    data: any
  ): Promise<boolean> {
    if (!this.db) throw new Error("Not connected");
    
    // ✅ Sanitize update data
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = this.sanitizeValue(value);
      return acc;
    }, {} as any);

    const mongoFilter = this.convertFilterToMongo(filter);
    const result = await this.db
      .collection(collectionName)
      .updateOne(mongoFilter, { $set: sanitizedData });
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

  // ==========================================
  // MONGODB FILTER CONVERSION
  // ==========================================

  /**
   * Chuyển đổi QueryFilter sang MongoDB query format
   */
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
}
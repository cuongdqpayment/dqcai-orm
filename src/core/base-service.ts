// ========================
// src/core/base-service.ts
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseManager } from "./database-manager";
import {
  IResult,
  QueryFilter,
  QueryOptions,
  Transaction,
  SchemaDefinition,
  IndexDefinition,
  BulkOperation,
  ExtendedQueryOptions,
  FindWithPaginationOptions,
  PaginationResult,
  SearchOptions,
} from "@/types/orm.types";
import { ServiceStatus } from "@/types/service.types";
import { createModuleLogger, ORMModules } from "@/logger";

const logger = createModuleLogger(ORMModules.BASE_SERVICE);

/**
 * ✅ ENHANCED Base Service with MongoDB-style Operations
 */
export abstract class BaseService<TModel = any> {
  protected dao: UniversalDAO<any> | null = null;
  protected schemaKey: string;
  protected entityName: string;
  protected isOpened: boolean = false;
  public lastAccess: number = Date.now();

  constructor(schemaKey: string, entityName: string) {
    this.schemaKey = schemaKey;
    this.entityName = entityName;

    logger.debug("Creating BaseService instance", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
    });
  }

  // ==================== INITIALIZATION ====================

  public async initialize(retries: number = 3): Promise<void> {
    this.lastAccess = Date.now();

    logger.info("Initializing service with adapter sharing", {
      schemaKey: this.schemaKey,
      entityName: this.entityName,
      hasRegisteredAdapter: !!DatabaseManager.getAdapterInstance(
        this.schemaKey
      ),
    });

    if (this.dao && this.dao.getAdapter().isConnected()) {
      logger.debug("Service already initialized, skipping");
      return;
    }

    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
      try {
        this.dao = await DatabaseManager.getDAO(this.schemaKey);
        this.isOpened = true;
        logger.info("Service initialized successfully");
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn("Initialization attempt failed", { attempt: i + 1 });
        if (i < retries - 1) {
          await this.sleep(1000 * (i + 1));
        }
      }
    }

    throw new Error(
      `Failed to initialize service ${this.schemaKey}:${this.entityName} after ${retries} retries: ${lastError}`
    );
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.dao || !this.isOpened) {
      await this.initialize();
      return;
    }

    if (!this.dao.getAdapter().isConnected()) {
      logger.warn("Connection lost, reinitializing");
      await this.initialize();
    }
  }

  protected getDAO(): UniversalDAO<any> {
    if (!this.dao || !this.isOpened) {
      throw new Error(
        `Service not initialized for ${this.schemaKey}:${this.entityName}. Call initialize() first.`
      );
    }
    return this.dao;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== PUBLIC DAO ACCESS ====================

  public async getUniversalDAO(): Promise<UniversalDAO<any>> {
    await this.ensureInitialized();
    return this.getDAO();
  }

  public async executeRaw(
    query: string | any,
    params?: any[]
  ): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }

  public async getAdapter(): Promise<any> {
    await this.ensureInitialized();
    return this.getDAO().getAdapter();
  }

  public getSchema(): any {
    return this.getDAO().getSchema();
  }

  // ==================== BASIC CRUD OPERATIONS ====================

  public async find(
    query: QueryFilter = {},
    options?: QueryOptions
  ): Promise<TModel[]> {
    logger.trace("Finding records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().find<TModel>(this.entityName, query, options);
  }

  public async findOne(
    query: QueryFilter,
    options?: QueryOptions
  ): Promise<TModel | null> {
    logger.trace("Finding one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findOne<TModel>(this.entityName, query, options);
  }

  public async findById(id: any): Promise<TModel | null> {
    logger.trace("Finding record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().findById<TModel>(this.entityName, id);
  }

  public async create(data: Partial<TModel>): Promise<TModel> {
    logger.debug("Creating record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeCreate(data);
    const result = await this.getDAO().insert<TModel>(
      this.entityName,
      processedData
    );
    return this.afterCreate(result);
  }

  public async createMany(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating many records", {
      entityName: this.entityName,
      count: data.length,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const processedData = await Promise.all(
      data.map((item) => this.beforeCreate(item))
    );
    const results = await this.getDAO().insertMany<TModel>(
      this.entityName,
      processedData
    );
    return Promise.all(results.map((result) => this.afterCreate(result)));
  }

  public async update(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<number> {
    logger.debug("Updating records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    const count = await this.getDAO().update(
      this.entityName,
      filter,
      processedData
    );
    await this.afterUpdate(count);
    return count;
  }

  public async updateOne(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<boolean> {
    logger.trace("Updating one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate(filter, data);
    return this.getDAO().updateOne(this.entityName, filter, processedData);
  }

  public async updateById(id: any, data: Partial<TModel>): Promise<boolean> {
    logger.trace("Updating record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    const processedData = await this.beforeUpdate({ id }, data);
    return this.getDAO().updateById(this.entityName, id, processedData);
  }

  public async delete(filter: QueryFilter): Promise<number> {
    logger.debug("Deleting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    const count = await this.getDAO().delete(this.entityName, filter);
    await this.afterDelete(count);
    return count;
  }

  public async deleteOne(filter: QueryFilter): Promise<boolean> {
    logger.trace("Deleting one record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    await this.beforeDelete(filter);
    return this.getDAO().deleteOne(this.entityName, filter);
  }

  public async deleteById(id: any): Promise<boolean> {
    logger.trace("Deleting record by ID", { entityName: this.entityName, id });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().deleteById(this.entityName, id);
  }

  public async count(filter?: QueryFilter): Promise<number> {
    logger.trace("Counting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().count(this.entityName, filter);
  }

  // ==================== 🆕 MONGODB-STYLE QUERY METHODS ====================

  /**
   * findFirst - Tìm document đầu tiên thỏa mãn điều kiện (MongoDB style)
   * @example
   * const user = await userService.findFirst({ status: 'active' });
   * const userWithSort = await userService.findFirst({ role: 'admin' }, { sort: { createdAt: -1 } });
   */
  public async findFirst(
    filter: QueryFilter = {},
    options?: ExtendedQueryOptions
  ): Promise<TModel | null> {
    logger.trace("Finding first record (MongoDB style)", {
      entityName: this.entityName,
      filter,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const queryOptions: QueryOptions = {
      ...options,
      limit: 1,
    };

    const results = await this.getDAO().find<TModel>(
      this.entityName,
      filter,
      queryOptions
    );

    return results.length > 0 ? results[0] : null;
  }

  /**
   * findAll - Tìm tất cả documents (MongoDB style)
   * @example
   * const allUsers = await userService.findAll();
   * const activeUsers = await userService.findAll({ status: 'active' });
   * const sortedUsers = await userService.findAll({}, { sort: { name: 1 }, limit: 100 });
   */
  public async findAll(
    filter: QueryFilter = {},
    options?: ExtendedQueryOptions
  ): Promise<TModel[]> {
    logger.trace("Finding all records (MongoDB style)", {
      entityName: this.entityName,
      filter,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    return this.getDAO().find<TModel>(this.entityName, filter, options);
  }

  /**
   * findWithPagination - Tìm với phân trang (MongoDB style)
   * @example
   * const result = await userService.findWithPagination(
   *   { status: 'active' },
   *   { page: 1, limit: 20, sort: { createdAt: -1 } }
   * );
   * // Result: { data: [...], pagination: { total, page, limit, totalPages, hasNextPage, hasPrevPage } }
   */
  public async findWithPagination(
    filter: QueryFilter = {},
    options: FindWithPaginationOptions = {}
  ): Promise<PaginationResult<TModel>> {
    logger.trace("Finding records with pagination (MongoDB style)", {
      entityName: this.entityName,
      filter,
      options,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    // Build query options
    const queryOptions: QueryOptions = {
      ...options,
      limit,
      skip,
    };

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      this.getDAO().find<TModel>(this.entityName, filter, queryOptions),
      this.getDAO().count(this.entityName, filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * search - Tìm kiếm text trên nhiều fields với điều kiện lọc trước (MongoDB style)
   * @param searchTerm - Từ khóa tìm kiếm
   * @param searchFields - Các fields cần tìm kiếm
   * @param options - Tùy chọn tìm kiếm
   * @param preFilter - Điều kiện lọc trước khi search (VD: { status: 'active', deleted: false })
   *
   * @example
   * // Simple search
   * const results = await userService.search('john', ['name', 'email']);
   *
   * // Search with pre-filter (only active users)
   * const activeUsers = await userService.search(
   *   'john',
   *   ['name', 'email'],
   *   { caseSensitive: false, limit: 20 },
   *   { is_active: true, deleted: false }
   * );
   *
   * // Search with complex pre-filter
   * const results = await orderService.search(
   *   'premium',
   *   ['customer_name', 'notes'],
   *   { limit: 10, sort: { created_at: -1 } },
   *   {
   *     store_id: storeId,
   *     status: { $in: ['pending', 'confirmed'] },
   *     total: { $gte: 100000 }
   *   }
   * );
   */
  public async search(
    searchTerm: string,
    searchFields: string[],
    options: SearchOptions = {},
    preFilter?: QueryFilter
  ): Promise<TModel[]> {
    logger.trace("Searching records (MongoDB style)", {
      entityName: this.entityName,
      searchTerm,
      searchFields,
      preFilter,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    if (!searchTerm || searchFields.length === 0) {
      logger.warn("Search term or search fields empty, returning empty array");
      return [];
    }

    const caseSensitive = options.caseSensitive ?? false;
    const exactMatch = options.exactMatch ?? false;

    // Build search filter
    const searchFilter: QueryFilter = {
      $or: searchFields.map((field) => {
        if (exactMatch) {
          return { [field]: searchTerm };
        }

        // For partial match, use LIKE or regex depending on database
        const databaseType = this.getDAO().databaseType;

        if (["mongodb", "mongoose"].includes(databaseType)) {
          // MongoDB regex
          return {
            [field]: {
              $regex: searchTerm,
              $options: caseSensitive ? "" : "i",
            },
          };
        } else {
          // SQL LIKE
          const pattern = `%${searchTerm}%`;
          return {
            [field]: {
              $like: caseSensitive ? pattern : pattern.toLowerCase(),
            },
          };
        }
      }),
    };

    // ✅ Merge pre-filter with search filter
    let finalFilter: QueryFilter;

    if (preFilter && Object.keys(preFilter).length > 0) {
      // Combine preFilter AND searchFilter
      finalFilter = {
        $and: [preFilter, searchFilter],
      };

      logger.trace("Applied pre-filter to search", {
        entityName: this.entityName,
        preFilter,
        searchFilter,
      });
    } else {
      finalFilter = searchFilter;
    }

    // Build query options
    const queryOptions: QueryOptions = {
      limit: options.limit,
      skip: options.skip,
      sort: options.sort,
    };

    logger.debug("Executing search query", {
      entityName: this.entityName,
      finalFilter,
      queryOptions,
    });

    return this.getDAO().find<TModel>(
      this.entityName,
      finalFilter,
      queryOptions
    );
  }

  /**
   * findMany - Alias for findAll (MongoDB style)
   */
  public async findMany(
    filter: QueryFilter = {},
    options?: ExtendedQueryOptions
  ): Promise<TModel[]> {
    return this.findAll(filter, options);
  }

  /**
   * countDocuments - Alias for count (MongoDB style)
   */
  public async countDocuments(filter?: QueryFilter): Promise<number> {
    logger.trace("Counting documents (MongoDB style)", {
      entityName: this.entityName,
    });
    return this.count(filter);
  }

  /**
   * estimatedDocumentCount - Fast count without filter (MongoDB style)
   */
  public async estimatedDocumentCount(): Promise<number> {
    logger.trace("Estimated document count (MongoDB style)", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    // For databases with fast count, use it
    const databaseType = this.getDAO().databaseType;

    if (["mongodb", "mongoose"].includes(databaseType)) {
      // MongoDB can use estimatedDocumentCount
      try {
        return await this.getDAO().count(this.entityName);
      } catch {
        return this.count();
      }
    }

    // For SQL databases, use regular count
    return this.count();
  }

  /**
   * insertOne - Alias for create (MongoDB style)
   */
  public async insertOne(data: Partial<TModel>): Promise<TModel> {
    logger.debug("Inserting one document (MongoDB style)", {
      entityName: this.entityName,
    });
    return this.create(data);
  }

  /**
   * insertMany - Alias for createMany (MongoDB style)
   */
  public async insertMany(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Inserting many documents (MongoDB style)", {
      entityName: this.entityName,
      count: data.length,
    });
    return this.createMany(data);
  }

  /**
   * updateMany - Alias for update (MongoDB style)
   */
  public async updateMany(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<number> {
    logger.debug("Updating many documents (MongoDB style)", {
      entityName: this.entityName,
    });
    return this.update(filter, data);
  }

  /**
   * deleteMany - Alias for delete (MongoDB style)
   */
  public async deleteMany(filter: QueryFilter): Promise<number> {
    logger.debug("Deleting many documents (MongoDB style)", {
      entityName: this.entityName,
    });
    return this.delete(filter);
  }

  /**
   * replaceOne - Replace entire document (MongoDB style)
   */
  public async replaceOne(
    filter: QueryFilter,
    replacement: Partial<TModel>
  ): Promise<boolean> {
    logger.debug("Replacing one document (MongoDB style)", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    // Find the document first
    const existing = await this.findOne(filter);
    if (!existing) {
      return false;
    }

    // Replace with new data (keeping only id)
    const id = (existing as any).id || (existing as any)._id;
    const processedData = await this.beforeUpdate(filter, replacement);

    return this.getDAO().updateById(this.entityName, id, processedData);
  }

  // ==================== ADVANCED CRUD OPERATIONS ====================

  async upsert<T = any>(
    data: Partial<T>,
    uniqueFields?: string[]
  ): Promise<T | null> {
    logger.debug("Performing upsert", {
      entityName: this.entityName,
      uniqueFields,
    });

    await this.initialize();

    let filter: QueryFilter = {};

    if (uniqueFields && uniqueFields.length > 0) {
      for (const field of uniqueFields) {
        if (data[field as keyof T] !== undefined) {
          filter[field] = data[field as keyof T];
        }
      }

      if (Object.keys(filter).length === 0) {
        logger.warn("No values found for unique fields, upsert will insert", {
          entityName: this.entityName,
          uniqueFields,
        });
        filter = {};
      }
    }

    logger.trace("Built filter from unique fields", {
      entityName: this.entityName,
      uniqueFields,
      filter,
    });

    const result = await this.dao!.upsert(this.entityName, data, filter);

    logger.info("Upsert completed", {
      entityName: this.entityName,
    });

    return result as T;
  }

  public async exists(filter: QueryFilter): Promise<boolean> {
    logger.trace("Checking existence", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().exists(this.entityName, filter);
  }

  public async distinct<T = any>(
    field: string,
    filter?: QueryFilter
  ): Promise<T[]> {
    logger.trace("Getting distinct values", {
      entityName: this.entityName,
      field,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().distinct<T>(this.entityName, field, filter);
  }

  public async paginate(
    filter: QueryFilter = {},
    options: { page?: number; limit?: number; sort?: any } = {}
  ): Promise<{
    data: TModel[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    logger.trace("Paginating records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.getDAO().find<TModel>(this.entityName, filter, {
        limit,
        skip,
        sort: options.sort,
      }),
      this.getDAO().count(this.entityName, filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async findOrCreate(
    filter: QueryFilter,
    defaultData: Partial<TModel>
  ): Promise<{ record: TModel; created: boolean }> {
    logger.debug("Finding or creating record", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    const existing = await this.getDAO().findOne<TModel>(
      this.entityName,
      filter
    );
    if (existing) {
      return { record: existing, created: false };
    }

    const processedData = await this.beforeCreate({
      ...filter,
      ...defaultData,
    });
    const created = await this.getDAO().insert<TModel>(
      this.entityName,
      processedData
    );
    return { record: await this.afterCreate(created), created: true };
  }

  public async increment(
    filter: QueryFilter,
    field: keyof TModel,
    value: number = 1
  ): Promise<number> {
    logger.debug("Incrementing field", {
      entityName: this.entityName,
      field,
      value,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();

    if (
      ["postgresql", "mysql", "mariadb", "sqlite", "sqlserver"].includes(
        this.getDAO().databaseType
      )
    ) {
      const adapter = this.getDAO().getAdapter();
      const whereClause = Object.entries(filter)
        .map(([key, val]) => `${key} = ${adapter.sanitize(val)}`)
        .join(" AND ");

      const query = `UPDATE ${this.entityName} SET ${String(field)} = ${String(
        field
      )} + ${value} WHERE ${whereClause}`;
      const result = await this.getDAO().executeRaw(query);
      return result.rowsAffected || 0;
    }

    const records = await this.find(filter);
    let updated = 0;
    for (const record of records) {
      const currentValue = (record as any)[field] || 0;
      await this.update(
        { id: (record as any).id } as QueryFilter,
        {
          [field]: currentValue + value,
        } as any
      );
      updated++;
    }
    return updated;
  }

  public async decrement(
    filter: QueryFilter,
    field: keyof TModel,
    value: number = 1
  ): Promise<number> {
    return this.increment(filter, field, -value);
  }

  public async softDelete(filter: QueryFilter): Promise<number> {
    logger.debug("Soft deleting records", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.update(filter, {
      deleted: true,
      deletedAt: new Date(),
    } as any);
  }

  public async restore(filter: QueryFilter): Promise<number> {
    logger.debug("Restoring soft deleted records", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.update(filter, {
      deleted: false,
      deletedAt: null,
    } as any);
  }

  public async bulkWrite(operations: BulkOperation[]): Promise<IResult> {
    logger.debug("Performing bulk write", {
      entityName: this.entityName,
      count: operations.length,
    });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().bulkWrite(this.entityName, operations);
  }

  public async aggregate<T = any>(pipeline: any[]): Promise<T[]> {
    logger.debug("Performing aggregation", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().aggregate<T>(this.entityName, pipeline);
  }

  public async raw<T = any>(query: string | any, params?: any[]): Promise<T> {
    logger.trace("Executing raw query", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().raw<T>(query, params);
  }

  // ==================== BULK OPERATIONS ====================

  public async bulkUpsert(
    dataArray: Partial<TModel>[],
    searchFields: string[] = ["id"],
    useTransaction: boolean = true
  ): Promise<{
    created: TModel[];
    updated: TModel[];
    total: number;
    errors: Array<{ index: number; data: Partial<TModel>; error: string }>;
  }> {
    logger.info("Starting bulk upsert operation", {
      entityName: this.entityName,
      itemsCount: dataArray.length,
      searchFields,
      useTransaction,
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();

    try {
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        const errorMsg = "Data must be a non-empty array";
        logger.error(errorMsg, {
          entityName: this.entityName,
          dataType: typeof dataArray,
          dataLength: Array.isArray(dataArray) ? dataArray.length : "N/A",
        });
        throw new Error(errorMsg);
      }

      const result = {
        created: [] as TModel[],
        updated: [] as TModel[],
        total: dataArray.length,
        errors: [] as Array<{
          index: number;
          data: Partial<TModel>;
          error: string;
        }>,
      };

      logger.debug("Preparing bulk upsert", {
        entityName: this.entityName,
        searchFields,
        itemsCount: dataArray.length,
      });

      const processBulkUpsert = async () => {
        for (let i = 0; i < dataArray.length; i++) {
          const data = dataArray[i];

          try {
            if (i % 100 === 0) {
              logger.trace("Bulk upsert progress", {
                entityName: this.entityName,
                processed: i,
                total: dataArray.length,
                created: result.created.length,
                updated: result.updated.length,
                errors: result.errors.length,
              });
            }

            const conditions: QueryFilter = {};
            let hasAllRequiredFields = true;

            for (const field of searchFields) {
              const value = (data as any)[field];
              if (value !== undefined && value !== null) {
                conditions[field] = value;
              } else {
                hasAllRequiredFields = false;
                break;
              }
            }

            if (!hasAllRequiredFields) {
              logger.trace(
                "Missing required fields for item, performing insert",
                {
                  entityName: this.entityName,
                  index: i,
                  searchFields,
                }
              );

              const processedData = await this.beforeCreate(data);
              const created = await this.getDAO().insert<TModel>(
                this.entityName,
                processedData
              );
              result.created.push(await this.afterCreate(created));
              continue;
            }

            const existingRecord = await this.getDAO().findOne<TModel>(
              this.entityName,
              conditions
            );

            if (existingRecord) {
              logger.trace("Record exists, performing update", {
                entityName: this.entityName,
                index: i,
              });

              const processedData = await this.beforeUpdate(conditions, data);
              await this.getDAO().update(
                this.entityName,
                conditions,
                processedData
              );

              const updatedRecord = await this.getDAO().findOne<TModel>(
                this.entityName,
                conditions
              );
              if (updatedRecord) {
                result.updated.push(updatedRecord);
              }
            } else {
              logger.trace("Record does not exist, performing insert", {
                entityName: this.entityName,
                index: i,
              });

              const processedData = await this.beforeCreate(data);
              const created = await this.getDAO().insert<TModel>(
                this.entityName,
                processedData
              );
              result.created.push(await this.afterCreate(created));
            }
          } catch (error) {
            logger.warn("Error processing item in bulk upsert", {
              entityName: this.entityName,
              index: i,
              error: (error as Error).message,
            });

            result.errors.push({
              index: i,
              data,
              error: (error as Error).message,
            });
          }
        }
      };

      if (useTransaction) {
        logger.debug("Executing bulk upsert in transaction", {
          entityName: this.entityName,
          itemsCount: dataArray.length,
        });

        try {
          await this.withTransaction(async () => {
            await processBulkUpsert();
          });
        } catch (txError) {
          logger.error("Transaction failed during bulk upsert", {
            entityName: this.entityName,
            error: (txError as Error).message,
            stack: (txError as Error).stack,
          });
          throw txError;
        }
      } else {
        logger.debug("Executing bulk upsert without transaction", {
          entityName: this.entityName,
          itemsCount: dataArray.length,
        });

        await processBulkUpsert();
      }

      logger.info("Bulk upsert completed", {
        entityName: this.entityName,
        total: result.total,
        created: result.created.length,
        updated: result.updated.length,
        errors: result.errors.length,
        successRate: `${(
          ((result.created.length + result.updated.length) / result.total) *
          100
        ).toFixed(2)}%`,
      });

      return result;
    } catch (error) {
      logger.error("Error during bulk upsert operation", {
        entityName: this.entityName,
        itemsCount: dataArray.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async bulkInsert(
    items: Partial<TModel>[],
    batchSize: number = 1000,
    skipErrors: boolean = false
  ): Promise<{
    totalRows: number;
    successRows: number;
    errorRows: number;
    errors: Array<{ index: number; data: Partial<TModel>; error: string }>;
  }> {
    logger.info("Starting bulk insert", {
      entityName: this.entityName,
      itemsCount: items.length,
      batchSize,
      skipErrors,
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();

    try {
      if (!Array.isArray(items) || items.length === 0) {
        const errorMsg = "Items must be a non-empty array";
        logger.error(errorMsg, {
          entityName: this.entityName,
          itemsType: typeof items,
          itemsLength: Array.isArray(items) ? items.length : "N/A",
        });
        throw new Error(errorMsg);
      }

      const result = {
        totalRows: items.length,
        successRows: 0,
        errorRows: 0,
        errors: [] as Array<{
          index: number;
          data: Partial<TModel>;
          error: string;
        }>,
      };

      logger.debug("Executing bulk insert operation", {
        entityName: this.entityName,
        itemsCount: items.length,
        batchSize,
      });

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(items.length / batchSize);

        logger.trace("Processing batch", {
          entityName: this.entityName,
          batchNumber,
          totalBatches,
          batchSize: batch.length,
        });

        if (skipErrors) {
          for (let j = 0; j < batch.length; j++) {
            const index = i + j;
            try {
              const processedData = await this.beforeCreate(batch[j]);
              await this.getDAO().insert<TModel>(
                this.entityName,
                processedData
              );
              result.successRows++;
            } catch (error) {
              result.errorRows++;
              result.errors.push({
                index,
                data: batch[j],
                error: (error as Error).message,
              });
              logger.warn("Error inserting item in bulk insert", {
                entityName: this.entityName,
                index,
                error: (error as Error).message,
              });
            }
          }
        } else {
          try {
            const processedBatch = await Promise.all(
              batch.map((item) => this.beforeCreate(item))
            );
            await this.getDAO().insertMany<TModel>(
              this.entityName,
              processedBatch
            );
            result.successRows += batch.length;
          } catch (error) {
            result.errorRows += batch.length;
            logger.error("Error processing batch in bulk insert", {
              entityName: this.entityName,
              batchNumber,
              error: (error as Error).message,
            });
            throw error;
          }
        }
      }

      logger.info("Bulk insert completed", {
        entityName: this.entityName,
        totalRows: result.totalRows,
        successRows: result.successRows,
        errorRows: result.errorRows,
        successRate: `${((result.successRows / result.totalRows) * 100).toFixed(
          2
        )}%`,
      });

      return result;
    } catch (error) {
      logger.error("Error during bulk insert", {
        entityName: this.entityName,
        itemsCount: items.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async bulkCreate(dataArray: Partial<TModel>[]): Promise<TModel[]> {
    logger.info("Starting bulk create with transaction", {
      entityName: this.entityName,
      itemsCount: dataArray.length,
    });

    await this.ensureInitialized();
    this.lastAccess = Date.now();

    try {
      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        const errorMsg = "Data must be a non-empty array";
        logger.error(errorMsg, {
          entityName: this.entityName,
          dataType: typeof dataArray,
          dataLength: Array.isArray(dataArray) ? dataArray.length : "N/A",
        });
        throw new Error(errorMsg);
      }

      const results: TModel[] = [];

      logger.debug("Executing bulk create in transaction", {
        entityName: this.entityName,
        itemsCount: dataArray.length,
      });

      await this.withTransaction(async () => {
        for (let i = 0; i < dataArray.length; i++) {
          const data = dataArray[i];

          if (i % 100 === 0) {
            logger.trace("Bulk create progress", {
              entityName: this.entityName,
              processed: i,
              total: dataArray.length,
            });
          }

          const processedData = await this.beforeCreate(data);
          const created = await this.getDAO().insert<TModel>(
            this.entityName,
            processedData
          );
          results.push(await this.afterCreate(created));
        }
      });

      logger.info("Bulk create completed successfully", {
        entityName: this.entityName,
        recordsCreated: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Error during bulk create", {
        entityName: this.entityName,
        itemsCount: dataArray.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ==================== TRANSACTION SUPPORT ====================

  public async beginTransaction(): Promise<Transaction> {
    logger.info("Beginning transaction", { entityName: this.entityName });
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().beginTransaction();
  }

  public async withTransaction<T>(
    callback: (service: this) => Promise<T>
  ): Promise<T> {
    logger.debug("Starting transaction callback", {
      entityName: this.entityName,
    });
    await this.ensureInitialized();
    return this.getDAO().withTransaction(async () => callback(this));
  }

  public async createBatch(data: Partial<TModel>[]): Promise<TModel[]> {
    logger.debug("Creating batch with transaction", {
      entityName: this.entityName,
      count: data.length,
    });
    return this.withTransaction(async () => this.createMany(data));
  }

  public async updateBatch(
    updates: Array<{ filter: QueryFilter; data: Partial<TModel> }>
  ): Promise<number> {
    logger.debug("Updating batch with transaction", {
      entityName: this.entityName,
    });
    return this.withTransaction(async () => {
      let totalCount = 0;
      for (const { filter, data } of updates) {
        const count = await this.update(filter, data);
        totalCount += count;
      }
      return totalCount;
    });
  }

  public async deleteBatch(filters: QueryFilter[]): Promise<number> {
    logger.debug("Deleting batch with transaction", {
      entityName: this.entityName,
    });
    return this.withTransaction(async () => {
      let totalCount = 0;
      for (const filter of filters) {
        const count = await this.delete(filter);
        totalCount += count;
      }
      return totalCount;
    });
  }

  // ==================== SCHEMA MANAGEMENT ====================

  public async createTable(schema?: SchemaDefinition): Promise<void> {
    logger.info("Creating table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().createTable(this.entityName, schema);
  }

  public async dropTable(): Promise<void> {
    logger.info("Dropping table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().dropTable(this.entityName);
  }

  public async truncateTable(): Promise<void> {
    logger.info("Truncating table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().truncateTable(this.entityName);
  }

  public async alterTable(changes: SchemaDefinition): Promise<void> {
    logger.info("Altering table", { entityName: this.entityName });
    await this.ensureInitialized();
    await this.getDAO().alterTable(this.entityName, changes);
  }

  public async tableExists(): Promise<boolean> {
    await this.ensureInitialized();
    return this.getDAO().tableExists(this.entityName);
  }

  public async getTableInfo(): Promise<any> {
    await this.ensureInitialized();
    return this.getDAO().getTableInfo(this.entityName);
  }

  // ==================== INDEX MANAGEMENT ====================

  public async createIndex(indexDef: IndexDefinition): Promise<void> {
    logger.info("Creating index", {
      entityName: this.entityName,
      indexName: indexDef.name,
    });
    await this.ensureInitialized();
    await this.getDAO().createIndex(this.entityName, indexDef);
  }

  public async dropIndex(indexName: string): Promise<void> {
    logger.info("Dropping index", { entityName: this.entityName, indexName });
    await this.ensureInitialized();
    await this.getDAO().dropIndex(this.entityName, indexName);
  }

  // ==================== HOOKS ====================

  protected async beforeCreate(
    data: Partial<TModel>
  ): Promise<Partial<TModel>> {
    return data;
  }

  protected async afterCreate(result: TModel): Promise<TModel> {
    return result;
  }

  protected async beforeUpdate(
    filter: QueryFilter,
    data: Partial<TModel>
  ): Promise<Partial<TModel>> {
    return data;
  }

  protected async afterUpdate(count: number): Promise<void> {}

  protected async beforeDelete(filter: QueryFilter): Promise<void> {}

  protected async afterDelete(count: number): Promise<void> {}

  // ==================== STATUS & LIFECYCLE ====================

  public getStatus(): ServiceStatus {
    const daoStatus = this.dao?.getStatus(this.entityName) || {};
    return {
      schemaName: this.schemaKey,
      entityName: this.entityName,
      isOpened: this.isOpened,
      isInitialized: !!this.dao,
      hasDao: !!this.dao,
      lastAccess: new Date(this.lastAccess).toISOString(),
      connectionStatus: this.dao?.getAdapter().isConnected()
        ? "connected"
        : "disconnected",
      ...daoStatus,
    } as ServiceStatus;
  }

  public async close(): Promise<void> {
    logger.info("Closing service", { entityName: this.entityName });
    this.isOpened = false;
  }

  public destroy(): void {
    logger.info("Destroying service", { entityName: this.entityName });
    this.dao = null;
    this.isOpened = false;
  }

  public getEntityName(): string {
    return this.entityName;
  }

  public getSchemaKey(): string {
    return this.schemaKey;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.dao?.getAdapter().isConnected() || false;
    } catch (error) {
      return false;
    }
  }

  public async refresh(): Promise<void> {
    logger.info("Refreshing service connection", {
      entityName: this.entityName,
    });
    if (this.dao) {
      await this.dao.close();
    }
    this.isOpened = false;
    await this.initialize();
  }

  // ==================== UTILITY METHODS ====================

  public sanitize(value: any): any {
    return this.getDAO().sanitize(value);
  }

  public async execute(query: string | any, params?: any[]): Promise<IResult> {
    await this.ensureInitialized();
    this.lastAccess = Date.now();
    return this.getDAO().execute(query, params);
  }
}

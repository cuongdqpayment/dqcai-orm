// src/index.ts - Main Export File

// Core Types
export * from "./types";
// Adapters
export * from "./adapters";
// Factory Connection for layzy load (await import("") is ok)
export * from "./factories";
export { AdapterHelper } from "./helpers/adapter-helper";

// Core Classes
export { BaseAdapter } from "./core/base-adapter";
export { UniversalDAO } from "./core/universal-dao";
export { DatabaseFactory } from "./core/database-factory";
export { DatabaseManager } from "./core/database-manager";
export { BaseService } from "./core/base-service";
export { ServiceManager, serviceManager } from "./core/service-manager";

// Query & Model
export { QueryBuilder } from "./query/query-builder";
export { Model } from "./model";
export { ORM } from "./orm";

// Utilities
export { TypeMapper } from "./utils/type-mapper";
export { QueryHelper } from "./utils/query-helper";

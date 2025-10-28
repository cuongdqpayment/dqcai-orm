// ========================
// src/factories/mongodb-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";
import { MongoDBConfig } from "../types/database-config-types";
import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.MONGODB_CONNECTION_FACTORY);

export class MongoDBConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    logger.trace("Checking MongoDB support");

    try {
      require.resolve("mongodb");   // ✅ Chỉ check, không import
      logger.debug("MongoDB module is supported");

      return true;
    } catch {
      logger.debug("MongoDB module is not supported");

      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: MongoDBConfig): Promise<IConnection> {
    logger.debug("Connecting to MongoDB", {
      database: config.database,
      host: config.host || "localhost",
      port: config.port || 27017
    });

    try {
      // ✅ QUAN TRỌNG: Dynamic import - chỉ load khi gọi connect() nên có thể khai theo file index.ts bên ngoài gom chung được
      const { MongoClient, ObjectId } = await import("mongodb"); 
      const url =
        config.url || config.connectionString || "mongodb://localhost:27017";
      
      logger.trace("Creating MongoClient with URL", { url: url.replace(/\/\/.*@/, "//***REDACTED***@") }); // Redact credentials in logs

      const client = new MongoClient(url, config.options);
      
      logger.trace("Connecting MongoClient");
      await client.connect();
      
      const db = client.db(config.database);

      logger.trace("Creating IConnection object");

      const connection: IConnection = {
        rawConnection: client,
        isConnected: true,
        close: async () => {
          logger.trace("Closing MongoDB connection");
          await client.close();
        },
      };

      (adapter as any).client = client;
      (adapter as any).db = db;
      (adapter as any).ObjectId = ObjectId;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      logger.info("MongoDB connection established successfully", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 27017
      });

      return connection;
    } catch (error) {
      logger.error("MongoDB connection failed", {
        database: config.database,
        host: config.host || "localhost",
        port: config.port || 27017,
        error: (error as Error).message
      });

      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }
}
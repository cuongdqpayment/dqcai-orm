// ========================
// src/factories/mongodb-connection.factory.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { IConnection } from "../types/orm.types";
import { IConnectionFactory } from "./connection-factory.interface";

export class MongoDBConnectionFactory implements IConnectionFactory {
  isSupported(): boolean {
    try {
      require.resolve("mongodb");
      return true;
    } catch {
      return false;
    }
  }

  async connect(adapter: BaseAdapter, config: any): Promise<IConnection> {
    try {
      const { MongoClient, ObjectId } = await import("mongodb") ;
      const url = config.url || config.connectionString || "mongodb://localhost:27017";
      const client = new MongoClient(url, config.options);
      await client.connect();
      const db = client.db(config.database);

      const connection: IConnection = {
        rawConnection: client,
        isConnected: true,
        close: async () => {
          await client.close();
        },
      };

      (adapter as any).client = client;
      (adapter as any).db = db;
      (adapter as any).ObjectId = ObjectId;
      (adapter as any).connection = connection;
      (adapter as any).config = config;

      return connection;
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }
}

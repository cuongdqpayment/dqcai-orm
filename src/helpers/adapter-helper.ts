// ========================
// src/helpers/adapter-helper.ts
// ========================

import { MariaDBAdapter } from "../adapters/mariadb-adapter";
import { MongoDBAdapter } from "../adapters/mongodb-adapter";
import { MySQLAdapter } from "../adapters/mysql-adapter";
import { OracleAdapter } from "../adapters/oracle-adapter";
import { PostgreSQLAdapter } from "../adapters/postgresql-adapter";
import { SQLiteAdapter } from "../adapters/sqlite-adapter";
import { SQLServerAdapter } from "../adapters/sqlserver-adapter";
import { BaseAdapter } from "../core/base-adapter";
import { IConnectionFactory } from "../factories/connection-factory.interface";
import { DatabaseType, DbConfig } from "../types/orm.types";

export class AdapterHelper {
  static async createAdapter(
    type: DatabaseType,
    config: DbConfig,
    factory: IConnectionFactory
  ): Promise<BaseAdapter> {
    let adapter: BaseAdapter;

    switch (type) {
      case "postgresql":
        adapter = new PostgreSQLAdapter();
        break;
      case "mysql":
        adapter = new MySQLAdapter();
        break;
      case "mariadb":
        adapter = new MariaDBAdapter();
        break;
      case "mongodb":
        adapter = new MongoDBAdapter();
        break;
      case "sqlite":
        adapter = new SQLiteAdapter();
        break;
      case "oracle":
        adapter = new OracleAdapter();
        break;
      case "sqlserver":
        adapter = new SQLServerAdapter();
        break;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    if (!factory.isSupported()) {
      throw new Error(`Database driver for ${type} is not installed`);
    }

    await factory.connect(adapter, config);
    return adapter;
  }
}

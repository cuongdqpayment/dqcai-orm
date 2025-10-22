// ========================
// src/adapters/mariadb-adapter.ts
// ========================

import { DatabaseType } from "../types/orm.types";
import { MySQLAdapter } from "./mysql-adapter";

/**
 * MariaDB Adapter (extends MySQL adapter as they're compatible)
 * Requires: mariadb or mysql2 package
 */
export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";

  isSupported(): boolean {
    try {
      require.resolve("mariadb");
      return true;
    } catch {
      return super.isSupported();
    }
  }
}

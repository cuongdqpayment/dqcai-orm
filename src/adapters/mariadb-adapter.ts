// ========================
// src/adapters/mariadb-adapter.ts
// ========================

import { DatabaseType } from "../types/orm.types";
import { MySQLAdapter } from "./mysql-adapter";

export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = "mariadb";
  databaseType: DatabaseType = "mariadb";
}

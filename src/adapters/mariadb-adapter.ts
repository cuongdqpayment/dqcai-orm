
// ========================
// src/adapters/mariadb-adapter.ts
// ========================

import { MySQLAdapter, MySQLConfig } from './mysql-adapter';
import { DatabaseType } from '../types/orm.types';

/**
 * MariaDB Adapter (extends MySQL adapter as they're compatible)
 * Requires: mariadb or mysql2 package
 */
export class MariaDBAdapter extends MySQLAdapter {
  type: DatabaseType = 'mariadb';
  databaseType: DatabaseType = 'mariadb';

  isSupported(): boolean {
    try {
      require.resolve('mariadb');
      return true;
    } catch {
      return super.isSupported();
    }
  }
}

// Export all adapters
// export * from './postgresql-adapter';
// export * from './mysql-adapter';
// export * from './sqlite-adapter';
// export * from './mongodb-adapter';
// export * from './sqlserver-adapter';
// export * from './mariadb-adapter';
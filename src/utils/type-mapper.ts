
// ========================
// src/utils/type-mapper.ts
// ========================

import { FieldType, DatabaseType } from "../types";

/**
 * Type mapping utility
 */
export class TypeMapper {
  private static sqlTypeMap: Record<FieldType, Record<DatabaseType, string>> = {
    string: {
      postgresql: 'VARCHAR',
      mysql: 'VARCHAR',
      mariadb: 'VARCHAR',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR',
      mongodb: 'string'
    },
    text: {
      postgresql: 'TEXT',
      mysql: 'TEXT',
      mariadb: 'TEXT',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR(MAX)',
      mongodb: 'string'
    },
    integer: {
      postgresql: 'INTEGER',
      mysql: 'INT',
      mariadb: 'INT',
      sqlite: 'INTEGER',
      sqlserver: 'INT',
      mongodb: 'number'
    },
    bigint: {
      postgresql: 'BIGINT',
      mysql: 'BIGINT',
      mariadb: 'BIGINT',
      sqlite: 'INTEGER',
      sqlserver: 'BIGINT',
      mongodb: 'number'
    },
    float: {
      postgresql: 'REAL',
      mysql: 'FLOAT',
      mariadb: 'FLOAT',
      sqlite: 'REAL',
      sqlserver: 'FLOAT',
      mongodb: 'number'
    },
    double: {
      postgresql: 'DOUBLE PRECISION',
      mysql: 'DOUBLE',
      mariadb: 'DOUBLE',
      sqlite: 'REAL',
      sqlserver: 'FLOAT',
      mongodb: 'number'
    },
    decimal: {
      postgresql: 'DECIMAL',
      mysql: 'DECIMAL',
      mariadb: 'DECIMAL',
      sqlite: 'REAL',
      sqlserver: 'DECIMAL',
      mongodb: 'number'
    },
    boolean: {
      postgresql: 'BOOLEAN',
      mysql: 'TINYINT(1)',
      mariadb: 'TINYINT(1)',
      sqlite: 'INTEGER',
      sqlserver: 'BIT',
      mongodb: 'boolean'
    },
    date: {
      postgresql: 'DATE',
      mysql: 'DATE',
      mariadb: 'DATE',
      sqlite: 'TEXT',
      sqlserver: 'DATE',
      mongodb: 'date'
    },
    datetime: {
      postgresql: 'TIMESTAMP',
      mysql: 'DATETIME',
      mariadb: 'DATETIME',
      sqlite: 'TEXT',
      sqlserver: 'DATETIME2',
      mongodb: 'date'
    },
    timestamp: {
      postgresql: 'TIMESTAMP',
      mysql: 'TIMESTAMP',
      mariadb: 'TIMESTAMP',
      sqlite: 'TEXT',
      sqlserver: 'DATETIME2',
      mongodb: 'date'
    },
    json: {
      postgresql: 'JSONB',
      mysql: 'JSON',
      mariadb: 'JSON',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR(MAX)',
      mongodb: 'object'
    },
    jsonb: {
      postgresql: 'JSONB',
      mysql: 'JSON',
      mariadb: 'JSON',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR(MAX)',
      mongodb: 'object'
    },
    array: {
      postgresql: 'JSONB',
      mysql: 'JSON',
      mariadb: 'JSON',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR(MAX)',
      mongodb: 'array'
    },
    object: {
      postgresql: 'JSONB',
      mysql: 'JSON',
      mariadb: 'JSON',
      sqlite: 'TEXT',
      sqlserver: 'NVARCHAR(MAX)',
      mongodb: 'object'
    },
    uuid: {
      postgresql: 'UUID',
      mysql: 'CHAR(36)',
      mariadb: 'CHAR(36)',
      sqlite: 'TEXT',
      sqlserver: 'UNIQUEIDENTIFIER',
      mongodb: 'string'
    },
    binary: {
      postgresql: 'BYTEA',
      mysql: 'BLOB',
      mariadb: 'BLOB',
      sqlite: 'BLOB',
      sqlserver: 'VARBINARY(MAX)',
      mongodb: 'binData'
    },
    blob: {
      postgresql: 'BYTEA',
      mysql: 'BLOB',
      mariadb: 'BLOB',
      sqlite: 'BLOB',
      sqlserver: 'VARBINARY(MAX)',
      mongodb: 'binData'
    }
  } as any;

  static mapType(fieldType: FieldType, dbType: DatabaseType): string {
    const mapping = this.sqlTypeMap[fieldType];
    if (!mapping) {
      throw new Error(`Unknown field type: ${fieldType}`);
    }
    
    const sqlType = mapping[dbType];
    if (!sqlType) {
      throw new Error(`No mapping for type ${fieldType} to ${dbType}`);
    }
    
    return sqlType;
  }

  static normalizeFieldType(type: string): FieldType {
    const normalized = type.toLowerCase().trim();
    
    const typeMap: Record<string, FieldType> = {
      'varchar': 'string',
      'char': 'string',
      'text': 'text',
      'int': 'integer',
      'integer': 'integer',
      'bigint': 'bigint',
      'float': 'float',
      'double': 'double',
      'decimal': 'decimal',
      'numeric': 'decimal',
      'bool': 'boolean',
      'boolean': 'boolean',
      'date': 'date',
      'datetime': 'datetime',
      'timestamp': 'timestamp',
      'json': 'json',
      'jsonb': 'jsonb',
      'uuid': 'uuid',
      'blob': 'blob',
      'binary': 'binary'
    };
    
    return (typeMap[normalized] || 'string') as FieldType;
  }
}

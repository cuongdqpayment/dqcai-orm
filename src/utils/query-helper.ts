// ========================
// src/utils/query-helper.ts
// ========================

import { DatabaseType, QueryFilter, SortDirection } from "../types/orm.types";

/**
 * Query helper utilities
 */
export class QueryHelper {
  static buildWhereClause(
    filter: QueryFilter,
    dbType: DatabaseType,
    startIndex = 1
  ): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    const paramPlaceholder = (index: number) => {
      switch (dbType) {
        case "postgresql":
          return `$${index}`;
        case "mysql":
        case "mariadb":
          return "?";
        case "sqlite":
          return "?";
        case "sqlserver":
          return `@p${index}`;
        case "mongodb":
          return "";
        default:
          return "?";
      }
    };

    for (const [key, value] of Object.entries(filter)) {
      if (key === "$and") {
        const andClauses = (value as QueryFilter[])
          .map((f) => {
            const result = this.buildWhereClause(f, dbType, paramIndex);
            paramIndex += result.params.length;
            params.push(...result.params);
            return `(${result.clause})`;
          })
          .filter((c) => c !== "()");

        if (andClauses.length > 0) {
          conditions.push(andClauses.join(" AND "));
        }
        continue;
      }

      if (key === "$or") {
        const orClauses = (value as QueryFilter[])
          .map((f) => {
            const result = this.buildWhereClause(f, dbType, paramIndex);
            paramIndex += result.params.length;
            params.push(...result.params);
            return `(${result.clause})`;
          })
          .filter((c) => c !== "()");

        if (orClauses.length > 0) {
          conditions.push(`(${orClauses.join(" OR ")})`);
        }
        continue;
      }

      if (key === "$not") {
        const result = this.buildWhereClause(
          value as QueryFilter,
          dbType,
          paramIndex
        );
        paramIndex += result.params.length;
        params.push(...result.params);
        conditions.push(`NOT (${result.clause})`);
        continue;
      }

      const fieldName = this.quoteIdentifier(key, dbType);

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case "$eq":
              conditions.push(
                `${fieldName} = ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$ne":
              conditions.push(
                `${fieldName} != ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$gt":
              conditions.push(
                `${fieldName} > ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$gte":
              conditions.push(
                `${fieldName} >= ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$lt":
              conditions.push(
                `${fieldName} < ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$lte":
              conditions.push(
                `${fieldName} <= ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$in":
              if (dbType === "postgresql") {
                conditions.push(
                  `${fieldName} = ANY(${paramPlaceholder(paramIndex++)})`
                );
                params.push(opValue);
              } else {
                const placeholders = (opValue as any[])
                  .map(() => paramPlaceholder(paramIndex++))
                  .join(", ");
                conditions.push(`${fieldName} IN (${placeholders})`);
                params.push(...(opValue as any[]));
              }
              break;
            case "$nin":
              if (dbType === "postgresql") {
                conditions.push(
                  `${fieldName} != ALL(${paramPlaceholder(paramIndex++)})`
                );
                params.push(opValue);
              } else {
                const placeholders = (opValue as any[])
                  .map(() => paramPlaceholder(paramIndex++))
                  .join(", ");
                conditions.push(`${fieldName} NOT IN (${placeholders})`);
                params.push(...(opValue as any[]));
              }
              break;
            case "$like":
              conditions.push(
                `${fieldName} LIKE ${paramPlaceholder(paramIndex++)}`
              );
              params.push(opValue);
              break;
            case "$ilike":
              if (dbType === "postgresql") {
                conditions.push(
                  `${fieldName} ILIKE ${paramPlaceholder(paramIndex++)}`
                );
              } else {
                conditions.push(
                  `LOWER(${fieldName}) LIKE LOWER(${paramPlaceholder(
                    paramIndex++
                  )})`
                );
              }
              params.push(opValue);
              break;
            case "$between":
              conditions.push(
                `${fieldName} BETWEEN ${paramPlaceholder(
                  paramIndex++
                )} AND ${paramPlaceholder(paramIndex++)}`
              );
              params.push((opValue as any[])[0], (opValue as any[])[1]);
              break;
            case "$exists":
              if (opValue) {
                conditions.push(`${fieldName} IS NOT NULL`);
              } else {
                conditions.push(`${fieldName} IS NULL`);
              }
              break;
          }
        }
      } else {
        conditions.push(`${fieldName} = ${paramPlaceholder(paramIndex++)}`);
        params.push(value);
      }
    }

    return {
      clause: conditions.join(" AND ") || "1=1",
      params,
    };
  }

  static quoteIdentifier(name: string, dbType: DatabaseType): string {
    switch (dbType) {
      case "postgresql":
      case "sqlite":
        return `"${name}"`;
      case "mysql":
      case "mariadb":
        return `\`${name}\``;
      case "sqlserver":
        return `[${name}]`;
      case "mongodb":
        return name;
      default:
        return `"${name}"`;
    }
  }

  static buildOrderBy(
    sort: Record<string, SortDirection>,
    dbType: DatabaseType
  ): string {
    const clauses = Object.entries(sort).map(([field, direction]) => {
      const dir = direction === 1 || direction === "ASC" ? "ASC" : "DESC";
      return `${this.quoteIdentifier(field, dbType)} ${dir}`;
    });

    return clauses.join(", ");
  }

  static buildSelectFields(fields: string[], dbType: DatabaseType): string {
    if (!fields || fields.length === 0) {
      return "*";
    }

    return fields.map((f) => this.quoteIdentifier(f, dbType)).join(", ");
  }
}

// // Export all
// export * from './types/index';
// export * from './interfaces/adapter.interface';
// export * from './interfaces/dao.interface';
// export * from './types/service.types';
// export * from './utils/type-mapper';
// export * from './utils/query-helper';

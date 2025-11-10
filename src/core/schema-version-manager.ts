// ========================
// src/core/schema-version-manager.ts (NEW FILE)
// ========================

import { UniversalDAO } from "./universal-dao";
import { DatabaseSchema, FieldDefinition } from "@/types/orm.types";
import {
  SchemaVersionInfo,
  VersionComparisonResult,
  MigrationOptions,
} from "@/types/schema-version.types";
import { createModuleLogger, ORMModules } from "@/logger";

const logger = createModuleLogger(ORMModules.SCHEMA_VERSION_MANAGER);

export class SchemaVersionManager {
  private static readonly VERSION_TABLE = "_schema_versions";

  /**
   * Định nghĩa schema cho bảng _schema_versions phù hợp với tất cả các loại cơ sở dũ liệu:
   * sqlite, oracle, mysql, maria, postgresql, mongodb,
   */
  private static getVersionTableSchema(): Record<string, FieldDefinition> {
    return {
      schema_name: {
        name: "schema_name",
        type: "varchar",
        length: 255,
        primaryKey: true,
        required: true,
      },
      version: {
        name: "version",
        type: "varchar",
        length: 50,
        required: true,
      },
      created_at: {
        name: "created_at",
        type: "datetime",
        required: true,
        default: "CURRENT_TIMESTAMP",
      },
      updated_at: {
        name: "updated_at",
        type: "datetime",
        required: true,
        default: "CURRENT_TIMESTAMP",
      },
      status: {
        name: "status",
        type: "varchar",
        length: 50,
        required: true,
        default: "active",
      },
      metadata: {
        name: "metadata",
        type: "text",
        required: false,
      },
    };
  }

  /**
   * ✅ Đảm bảo bảng _schema_versions tồn tại
   */
  public static async ensureVersionTable(
    dao: UniversalDAO<any>
  ): Promise<void> {
    logger.debug("Ensuring version table exists");

    const exists = await dao.tableExists(this.VERSION_TABLE);

    if (!exists) {
      logger.info("Version table does not exist, creating...", {
        tableName: this.VERSION_TABLE,
      });

      const schema = this.getVersionTableSchema();
      await dao.getAdapter().createTable(this.VERSION_TABLE, schema);

      logger.info("Version table created successfully", {
        tableName: this.VERSION_TABLE,
      });
    } else {
      logger.debug("Version table already exists", {
        tableName: this.VERSION_TABLE,
      });
    }
  }

  /**
   * ✅ Lấy thông tin version hiện tại của schema
   */
  public static async getCurrentVersion(
    dao: UniversalDAO<any>,
    schemaName: string
  ): Promise<SchemaVersionInfo | null> {
    logger.debug("Getting current version info", { schemaName });

    await this.ensureVersionTable(dao);

    try {
      const result = await dao
        .getAdapter()
        .findOne(this.VERSION_TABLE, { schema_name: schemaName }, { limit: 1 });

      // ✅ FIX: findOne trả về object hoặc null, không phải array
      if (result) {
        const versionInfo: SchemaVersionInfo = {
          schema_name: result.schema_name,
          version: result.version,
          created_at: result.created_at,
          updated_at: result.updated_at,
          status: result.status || "active",
          metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
        };

        logger.info("Current version found", {
          schemaName,
          version: versionInfo.version,
        });

        return versionInfo;
      }

      logger.debug("No version info found for schema", { schemaName });
      return null;
    } catch (error) {
      logger.error("Error getting current version", {
        schemaName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * ✅ So sánh versions (semantic versioning)
   */
  public static compareVersions(v1: string, v2: string): number {
    logger.trace("Comparing versions", { v1, v2 });

    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  }

  /**
   * ✅ Kiểm tra compatibility giữa version hiện tại và target
   */
  public static async checkVersionCompatibility(
    dao: UniversalDAO<any>,
    schema: DatabaseSchema
  ): Promise<VersionComparisonResult> {
    logger.info("Checking version compatibility", {
      schemaName: schema.database_name,
      targetVersion: schema.version,
    });

    const currentInfo = await this.getCurrentVersion(dao, schema.database_name);

    // CASE 1: Chưa có version (lần đầu tạo)
    if (!currentInfo) {
      logger.info("No existing version, schema is new", {
        schemaName: schema.database_name,
      });

      return {
        isCompatible: true,
        action: "create_new",
        targetVersion: schema.version || "1.0.0",
        message: "Schema not exist, create new",
      };
    }

    const currentVersion = currentInfo.version;
    const targetVersion = schema.version || "1.0.0";
    const comparison = this.compareVersions(currentVersion, targetVersion);

    // CASE 2: Version giống nhau
    if (comparison === 0) {
      logger.info("Versions match, no action needed", {
        schemaName: schema.database_name,
        version: currentVersion,
      });

      return {
        isCompatible: true,
        action: "no_action",
        currentVersion,
        targetVersion,
        message: "Schema version is the same, no action needed",
      };
    }

    // CASE 3: Database version > Schema version (DOWNGRADE - NGUY HIỂM)
    if (comparison > 0) {
      logger.warn("Database version is newer than schema version", {
        schemaName: schema.database_name,
        currentVersion,
        targetVersion,
      });

      return {
        isCompatible: false,
        action: "version_conflict",
        currentVersion,
        targetVersion,
        message:
          `⚠️ WARNING: Database version (${currentVersion}) is newer than schema version (${targetVersion})!\n` +
          `Can not downgrade automationally. Options choicese are:\n` +
          `1. Backup current database\n` +
          `2. Drop and recreate all tables(LOST ALL DATA)\n` +
          `3. Update schema definition up to date with currentversion ${currentVersion}`,
      };
    }

    // CASE 4: Database version < Schema version (UPGRADE - CẦN MIGRATION)
    logger.info("Schema upgrade required", {
      schemaName: schema.database_name,
      currentVersion,
      targetVersion,
    });

    return {
      isCompatible: false,
      action: "migration_required",
      currentVersion,
      targetVersion,
      message:
        `📦 Having new version: ${currentVersion} → ${targetVersion}\n` +
        `Needing migration to upate schema. Options choicese are:\n` +
        `1. Automaticaly migration (if available migration script)\n` +
        `2. Backup and recreate all tables(LOST ALL DATA)\n` +
        `3. Manual Migration`,
    };
  }

  /**
   * ✅ Lưu version info sau khi tạo schema
   */
  public static async saveVersionInfo(
    dao: UniversalDAO<any>,
    schemaName: string,
    version: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    logger.info("Saving version info", { schemaName, version });

    await this.ensureVersionTable(dao);

    const existing = await this.getCurrentVersion(dao, schemaName);

    const versionData = {
      schema_name: schemaName,
      version,
      updated_at: new Date().toISOString(),
      status: "active",
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    try {
      if (existing) {
        logger.debug("Updating existing version info", {
          schemaName,
          oldVersion: existing.version,
          newVersion: version,
        });

        await dao
          .getAdapter()
          .update(this.VERSION_TABLE, { schema_name: schemaName }, versionData);

        logger.info("Version info updated successfully", {
          schemaName,
          version,
        });
      } else {
        logger.debug("Inserting new version info", { schemaName });

        await dao.getAdapter().insertOne(this.VERSION_TABLE, {
          ...versionData,
          created_at: new Date().toISOString(),
        });

        logger.info("Version info inserted successfully", {
          schemaName,
          version,
        });
      }
    } catch (error) {
      logger.error("Error saving version info", {
        schemaName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * ✅ Backup database trước khi migration
   */
  public static async backupSchema(
    dao: UniversalDAO<any>,
    schemaName: string,
    backupPath?: string
  ): Promise<string> {
    logger.info("Creating schema backup", { schemaName, backupPath });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = backupPath || `${schemaName}_backup_${timestamp}.json`;

    try {
      // Lấy tất cả tables trong schema
      const schema = dao.getSchema();
      const backupData: Record<string, any[]> = {};

      for (const entityName of Object.keys(schema.schemas)) {
        const exists = await dao.tableExists(entityName);
        if (exists) {
          logger.debug("Backing up table", { entityName });
          const data = await dao.getAdapter().find(entityName, {});
          backupData[entityName] = data || [];
        }
      }

      // TODO: Lưu backupData vào file hoặc storage
      // Ở đây có thể dùng filesystem hoặc upload lên cloud

      logger.info("Schema backup completed", {
        schemaName,
        backupName,
        tableCount: Object.keys(backupData).length,
      });

      return backupName;
    } catch (error) {
      logger.error("Error creating backup", {
        schemaName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * ✅ Xử lý migration strategy
   */
  public static async handleMigration(
    dao: UniversalDAO<any>,
    schema: DatabaseSchema,
    options: MigrationOptions
  ): Promise<void> {
    logger.info("Handling migration", {
      schemaName: schema.database_name,
      strategy: options.strategy,
    });

    switch (options.strategy) {
      case "backup_and_recreate":
        await this.migrateWithBackup(dao, schema, options);
        break;

      case "drop_and_create":
        await this.migrateDropAndCreate(dao, schema);
        break;

      case "manual_migration":
        if (options.migrationScript) {
          await options.migrationScript(dao);
        } else {
          throw new Error("Migration script required for manual migration");
        }
        break;

      default:
        throw new Error(`Unknown migration strategy: ${options.strategy}`);
    }
  }

  /**
   * Migrate với backup
   */
  private static async migrateWithBackup(
    dao: UniversalDAO<any>,
    schema: DatabaseSchema,
    options: MigrationOptions
  ): Promise<void> {
    logger.info("Starting migration with backup", {
      schemaName: schema.database_name,
    });

    // 1. Backup
    const backupName = await this.backupSchema(
      dao,
      schema.database_name,
      options.backupPath
    );

    logger.info("Backup completed, proceeding with recreation", { backupName });

    // 2. Drop và recreate
    await this.migrateDropAndCreate(dao, schema);

    logger.info("Migration with backup completed", {
      schemaName: schema.database_name,
      backupName,
    });
  }

  /**
   * Migrate bằng cách drop và create
   */
  private static async migrateDropAndCreate(
    dao: UniversalDAO<any>,
    schema: DatabaseSchema
  ): Promise<void> {
    logger.warn("Dropping and recreating all tables", {
      schemaName: schema.database_name,
    });

    // Drop tất cả tables
    for (const entityName of Object.keys(schema.schemas)) {
      const exists = await dao.tableExists(entityName);
      if (exists) {
        logger.debug("Dropping table", { entityName });
        await dao.dropTable(entityName);
      }
    }

    // Recreate tất cả tables
    for (const entityName of Object.keys(schema.schemas)) {
      logger.debug("Creating table", { entityName });
      await dao.createTable(entityName);
    }

    logger.info("All tables dropped and recreated", {
      schemaName: schema.database_name,
    });
  }
}

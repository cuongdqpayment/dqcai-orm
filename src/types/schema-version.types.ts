// ========================
// src/types/schema-version.types.ts (NEW FILE)
// ========================

import { UniversalDAO } from "@/core/universal-dao";

export interface SchemaVersionInfo {
  schema_name: string;
  version: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'migrating' | 'deprecated';
  metadata?: Record<string, any>;
}

export interface VersionComparisonResult {
  isCompatible: boolean;
  action: 'no_action' | 'create_new' | 'migration_required' | 'version_conflict';
  currentVersion?: string;
  targetVersion: string;
  message: string;
}

export interface MigrationOptions {
  strategy: 'backup_and_recreate' | 'drop_and_create' | 'manual_migration';
  backupPath?: string;
  confirmationRequired?: boolean;
  migrationScript?: (dao: UniversalDAO<any>) => Promise<void>;
}

export interface InitializeOptions {
  forceRecreate?: boolean;
  validateVersion?: boolean;
  migrationOptions?: MigrationOptions;
  onVersionConflict?: (result: VersionComparisonResult) => Promise<'abort' | 'continue' | 'migrate'>;
}
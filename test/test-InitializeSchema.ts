import { DatabaseManager } from "../src/core/database-manager";

const testCase = async () => {
  // ========================
  // Example Usage
  // ========================

  // 1. KHỞI TẠO LẦN ĐẦU (TỰ ĐỘNG TẠO TABLES)
  const dao1 = await DatabaseManager.initializeSchema("core", {
    validateVersion: true,
  });

  // 2. KHỞI TẠO VỚI XỬ LÝ VERSION CONFLICT
  const dao2 = await DatabaseManager.initializeSchema("core", {
    validateVersion: true,
    onVersionConflict: async (result: { message: any }) => {
      console.log(result.message);

      // Hiển thị UI cho user chọn
      const userChoice = await showVersionConflictDialog(result);
      return userChoice; // 'abort' | 'continue' | 'migrate'
    },
    migrationOptions: {
      strategy: "backup_and_recreate",
      backupPath: "./backups",
    },
  });

  // 3. FORCE RECREATE (MẤT DỮ LIỆU)
  const dao3 = await DatabaseManager.initializeSchema("core", {
    validateVersion: false, // Bỏ qua kiểm tra version
    forceRecreate: true,
  });

  // 4. KIỂM TRA VERSION TRƯỚC KHI INITIALIZE
  const versionCheck = await DatabaseManager.checkSchemaVersion("core");
  if (versionCheck.action === "migration_required") {
    console.log("Cần migration:", versionCheck.message);

    // Backup trước khi migrate
    const backupPath = await DatabaseManager.backupSchema("core");
    console.log("Backup saved to:", backupPath);
  }

  // 5. CUSTOM MIGRATION SCRIPT
  const dao4 = await DatabaseManager.initializeSchema("core", {
    validateVersion: true,
    migrationOptions: {
      strategy: "manual_migration",
      migrationScript: async (dao: {
        getAdapter: () => {
          (): any;
          new (): any;
          execute: { (arg0: string): any; new (): any };
        };
        select: (arg0: string, arg1: {}) => any;
        update: (
          arg0: string,
          arg1: { id: any },
          arg2: { email: string }
        ) => any;
      }) => {
        // Custom migration logic
        console.log("Running custom migration...");

        // Thêm column mới
        await dao.getAdapter().execute(`
        ALTER TABLE users ADD COLUMN email TEXT;
      `);

        // Migrate data
        const users = await dao.select("users", {});
        for (const user of users) {
          await dao.update(
            "users",
            { id: user.id },
            { email: `${user.username}@example.com` }
          );
        }

        console.log("Migration completed");
      },
    },
  });

  // 6. INITIALIZE ALL SCHEMAS
  await DatabaseManager.initializeAll({
    validateVersion: true,
    onVersionConflict: handleVersionConflict,
  });
};

const handleVersionConflict = (result: { message: any }) => {
  return Promise.resolve("abort"); // Or 'continue', 'migrate' based on logic
};

function showVersionConflictDialog(result: { message: any }) {
  throw new Error("Function not implemented.");
}

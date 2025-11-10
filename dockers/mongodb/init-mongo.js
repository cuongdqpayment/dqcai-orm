//  ./init-mongo.js
// Script này sẽ chạy tự động khi MongoDB container khởi động lần đầu

print("========================================");
print("Starting MongoDB initialization...");
print("========================================");

// ============================================
// 1. Kết nối tới admin database
// ============================================
db = db.getSiblingDB("admin");

// ============================================
// 2. Tạo Admin User với full quyền
// ============================================
try {
  db.createUser({
    user: "admin",
    pwd: "Admin$123",
    roles: [
      {
        role: "readWriteAnyDatabase",
        db: "admin",
      },
      {
        role: "dbAdminAnyDatabase",
        db: "admin",
      },
      {
        role: "userAdminAnyDatabase",
        db: "admin",
      },
      {
        role: "clusterAdmin",
        db: "admin",
      },
    ],
  });
  print('✅ User "admin" created with full database privileges');
} catch (error) {
  print('⚠️  User "admin" might already exist:', error.message);
}

// ============================================
// 3. Tạo Test User (restricted to 'test' db)
// ============================================
db = db.getSiblingDB("test");

try {
  db.createUser({
    user: "test",
    pwd: "Test@123",
    roles: [
      {
        role: "readWrite",
        db: "test",
      },
      {
        role: "dbAdmin",
        db: "test",
      },
    ],
  });
  print('✅ User "test" created with privileges on "test" database');
} catch (error) {
  print('⚠️  User "test" might already exist:', error.message);
}

// ✅ Initialize test database with a sample collection
db.createCollection("samples");
db.samples.insertOne({
  initialized: true,
  createdAt: new Date(),
  message: "Test database initialized successfully",
});
print("✅ Test database initialized with sample collection");

print("========================================");
print("MongoDB initialization completed!");
print("========================================");
print("");
print("📋 Available Users:");
print("┌─────────────┬──────────────┬────────────────────────────┐");
print("│ Username    │ Password     │ Access Level               │");
print("├─────────────┼──────────────┼────────────────────────────┤");
print("│ root        │ Root@123     │ Full admin (all databases) │");
print("│ admin       │ Admin@123    │ Can create any database    │");
print('│ test        │ Test@123     │ Only "test" database       │');
print("└─────────────┴──────────────┴────────────────────────────┘");
print("");
print("📋 Available Databases:");
print("  • test (with sample data)");
print("");
print("🌐 Mongo Express:");
print("  • URL: http://localhost:8081");
print("  • Username: webadmin");
print("  • Password: Web@123");
print("========================================");

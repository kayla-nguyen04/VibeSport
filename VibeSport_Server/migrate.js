require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

async function migrateData() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Đã kết nối MongoDB');

    // Xóa indexes cũ (nếu có) để tránh conflict
    try {
      await User.collection.dropIndexes();
      console.log('✓ Xóa indexes cũ');
    } catch (error) {
      // Bỏ qua nếu không có index
    }

    // Đọc dữ liệu từ db.json
    const dbPath = path.join(__dirname, 'db.json');
    const dbContent = fs.readFileSync(dbPath, 'utf-8');
    const { users } = JSON.parse(dbContent);

    console.log(`\n📥 Bắt đầu import ${users.length} users...`);

    // Import từng user
    let importedCount = 0;
    for (const user of users) {
      const existingUser = await User.findOne({ email: user.email });
      
      if (!existingUser) {
        await User.create({
          email: user.email,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        });
        importedCount++;
        console.log(`  ✓ Imported: ${user.email}`);
      } else {
        console.log(`  ⊘ Bỏ qua (đã tồn tại): ${user.email}`);
      }
    }

    console.log(`\n✅ Import hoàn tất! Đã thêm ${importedCount} users vào MongoDB`);
    
    // Hiển thị tổng số users
    const totalUsers = await User.countDocuments();
    console.log(`📊 Tổng số users trong MongoDB: ${totalUsers}`);

    // Có thể xóa db.json hoặc giữ lại backup
    console.log('\n💡 Lưu ý: Nếu muốn, bạn có thể xóa db.json hoặc đổi tên thành db.json.backup');
    
    await mongoose.disconnect();
    console.log('\n✓ Đã ngắt kết nối MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi trong quá trình migrate:', error.message);
    process.exit(1);
  }
}

migrateData();

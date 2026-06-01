require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

// Fix DNS querySrv ECONNREFUSED/ENOTFOUND on Windows when resolving MongoDB Atlas SRV records
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // Fallback if dns.setServers fails or is restricted
  }
}

const mongoose = require('mongoose');
const readline = require('readline');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

async function resetMongoDB() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Đã kết nối MongoDB');

    // Hỏi xác nhận
    rl.question(
      '\n⚠️  Bạn muốn xóa toàn bộ dữ liệu trong database "vibesport"? (yes/no): ',
      async (answer) => {
        if (answer.toLowerCase() !== 'yes') {
          console.log('\n❌ Huỷ bỏ.');
          await mongoose.disconnect();
          rl.close();
          process.exit(0);
          return;
        }

        try {
          // Xóa tất cả collections
          const db = mongoose.connection.db;
          const collections = await db.listCollections().toArray();

          console.log('\nĐang xóa...');
          for (const coll of collections) {
            await db.collection(coll.name).deleteMany({});
            console.log(`  ✓ Xóa ${coll.name}`);
          }

          console.log('\n✅ Reset hoàn tất! Database đã trống.');
          console.log('💡 Chạy "npm run migrate" để import lại dữ liệu từ db.json');

          await mongoose.disconnect();
          rl.close();
          process.exit(0);
        } catch (error) {
          console.error('\n❌ Lỗi:', error.message);
          await mongoose.disconnect();
          rl.close();
          process.exit(1);
        }
      }
    );
  } catch (error) {
    console.error('❌ Không thể kết nối MongoDB:', error.message);
    rl.close();
    process.exit(1);
  }
}

resetMongoDB();

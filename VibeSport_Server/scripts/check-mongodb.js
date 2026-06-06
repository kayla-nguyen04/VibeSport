require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

// Fix DNS querySrv ECONNREFUSED/ENOTFOUND on Windows when resolving MongoDB Atlas SRV records
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // Fallback if dns.setServers fails or is restricted
  }
}

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

async function checkMongoDB() {
  console.log('🔍 Đang kiểm tra MongoDB...\n');
  console.log(`📍 MongoDB URI: ${MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('\n✅ Kết nối MongoDB: THÀNH CÔNG');
    
    // Lấy thông tin database
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`\n📊 Database: ${mongoose.connection.name}`);
    console.log(`📦 Collections: ${collections.length}`);
    
    if (collections.length > 0) {
      console.log('\nDanh sách collections:');
      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`  • ${coll.name} (${count} documents)`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✓ Đã ngắt kết nối');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Lỗi kết nối:');
    console.error(`   ${error.message}`);
    console.error('\n💡 Gợi ý:');
    console.error('   • Kiểm tra MongoDB có chạy không');
    console.error('   • Kiểm tra .env có MONGODB_URI đúng không');
    console.error('   • Nếu dùng Windows, kiểm tra MongoDB Service chạy chưa');
    process.exit(1);
  }
}

checkMongoDB();

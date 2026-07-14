require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const Admin = require('../models/Admin');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashedPassword}`;
}

async function seedAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Super Admin';

  if (!email || !password) {
    console.error('Cách dùng: node scripts/seedAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  try {
await mongoose.connect(process.env.MONGODB_URI);
    console.log('Đã kết nối MongoDB.');

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await Admin.findOne({ email: normalizedEmail });

    if (existing) {
      console.log(`Admin với email "${normalizedEmail}" đã tồn tại. Không tạo mới.`);
      process.exit(0);
    }

    const admin = await Admin.create({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      name,
      role: 'superadmin',
    });

    console.log('Tạo admin thành công:');
    console.log({ id: admin._id.toString(), email: admin.email, name: admin.name, role: admin.role });
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi seed admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();
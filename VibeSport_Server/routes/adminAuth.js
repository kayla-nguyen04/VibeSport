const express = require('express');
const crypto = require('node:crypto');
const Admin = require('../models/Admin');
const AdminSession = require('../models/AdminSession');

const router = express.Router();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashedPassword}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, hashedPassword] = storedPassword.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hashedPassword, 'hex'));
}

router.post('/login', async (request, response) => {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    response.status(400).json({ message: 'Email và mật khẩu là bắt buộc.' });
    return;
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin) {
      response.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
      return;
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      response.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
      return;
    }

    admin.lastSeenAt = new Date();
    await admin.save();

    const token = crypto.randomUUID();
    await AdminSession.create({ adminId: admin._id, token });

    response.json({
      token,
      user: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Error in /admin/login:', error);
    response.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

module.exports = router;
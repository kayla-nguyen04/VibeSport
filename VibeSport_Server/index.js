require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

const cors = require('cors');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');

const User = require('./models/User');

const app = express();
const PORT = 4000;
const HOST = '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

app.use(cors());
app.use(express.json());

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

function createSessionPayload(user) {
  return {
    token: crypto.randomUUID(),
    user: {
      id: user._id,
      email: user.email,
      createdAt: user.createdAt,
      name: user.name ?? null,
      picture: user.picture ?? null,
      provider: user.provider ?? 'email',
    },
  };
}

app.get('/health', (_, response) => {
  response.json({
    ok: true,
    host: HOST,
    port: PORT,
  });
});

app.post('/auth/register', async (request, response) => {
  try {
    console.log('POST /auth/register', request.body);

    const { email, password, confirmPassword } = request.body ?? {};

    if (!email || !password || !confirmPassword) {
      response.status(400).json({ message: 'Email, mật khẩu và xác nhận mật khẩu là bắt buộc.' });
      return;
    }

    if (password !== confirmPassword) {
      response.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      response.status(409).json({ message: 'Email đã tồn tại.' });
      return;
    }

    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
    });

    response.status(201).json({
      message: 'Đăng ký thành công. Vui lòng đăng nhập.',
      user: {
        id: newUser._id,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in /auth/register:', error);
    if (error?.code === 11000) {
      const resp = { message: 'Tài khoản đã tồn tại.' };
      if (process.env.NODE_ENV !== 'production') {
        resp.detail = error.message;
      }
      response.status(409).json(resp);
      return;
    }

    const resp = { message: 'Lỗi máy chủ nội bộ.' };
    if (process.env.NODE_ENV !== 'production') {
      resp.detail = error.message;
    }
    response.status(500).json(resp);
  }
});

app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    response.status(400).json({ message: 'Email và mật khẩu là bắt buộc.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    response.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
    return;
  }

  if (!user.passwordHash) {
    response.status(400).json({ message: 'Tài khoản này đang dùng Google. Vui lòng đăng nhập bằng Google.' });
    return;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    response.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
    return;
  }

  response.json(createSessionPayload(user));
});

app.post('/auth/forgot-password', async (request, response) => {
  const { email, password, confirmPassword } = request.body ?? {};

  if (!email || !password || !confirmPassword) {
    response.status(400).json({ message: 'Email, mật khẩu mới và xác nhận mật khẩu là bắt buộc.' });
    return;
  }

  if (password !== confirmPassword) {
    response.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    { passwordHash: hashPassword(password) },
    { new: true }
  );

  if (!user) {
    response.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    return;
  }

  response.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
});

app.post('/auth/google', async (request, response) => {
  const { email, googleId, name, picture } = request.body ?? {};

  if (!email || !googleId) {
    response.status(400).json({ message: 'Thiếu thông tin tài khoản Google.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedGoogleId = String(googleId).trim();

  const user = await User.findOneAndUpdate(
    { $or: [{ googleId: normalizedGoogleId }, { email: normalizedEmail }] },
    {
      email: normalizedEmail,
      googleId: normalizedGoogleId,
      name: name ?? undefined,
      picture: picture ?? undefined,
      provider: 'google',
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  response.json(createSessionPayload(user));
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, HOST, () => {
      console.log(`Auth API listening at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });

const cors = require('cors');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');

const app = express();
const PORT = 4000;
const HOST = '0.0.0.0';
const DB_FILE = path.join(__dirname, '..', 'db.json');

app.use(cors());
app.use(express.json());

async function ensureDb() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

async function readUsers() {
  await ensureDb();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  const data = JSON.parse(raw);
  return data.users || [];
}

async function writeUsers(users) {
  await ensureDb();
  await fs.writeFile(DB_FILE, JSON.stringify({ users }, null, 2));
}

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
      id: user.id,
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
  const users = await readUsers();
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    response.status(409).json({ message: 'Email đã tồn tại.' });
    return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  response.status(201).json({
    message: 'Đăng ký thành công. Vui lòng đăng nhập.',
    user: {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt,
    },
  });
});

app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    response.status(400).json({ message: 'Email và mật khẩu là bắt buộc.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const users = await readUsers();
  const user = users.find((entry) => entry.email === normalizedEmail);

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
  const users = await readUsers();
  const userIndex = users.findIndex((entry) => entry.email === normalizedEmail);

  if (userIndex === -1) {
    response.status(404).json({ message: 'Không tìm thấy tài khoản với email này.' });
    return;
  }

  users[userIndex] = {
    ...users[userIndex],
    passwordHash: hashPassword(password),
  };

  await writeUsers(users);

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
  const users = await readUsers();
  const userIndex = users.findIndex(
    (entry) => entry.googleId === normalizedGoogleId || entry.email === normalizedEmail
  );

  let user;

  if (userIndex >= 0) {
    user = {
      ...users[userIndex],
      email: normalizedEmail,
      googleId: normalizedGoogleId,
      name: name ?? users[userIndex].name ?? null,
      picture: picture ?? users[userIndex].picture ?? null,
      provider: 'google',
    };
    users[userIndex] = user;
  } else {
    user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      googleId: normalizedGoogleId,
      name: name ?? null,
      picture: picture ?? null,
      provider: 'google',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
  }

  await writeUsers(users);

  response.json(createSessionPayload(user));
});

ensureDb()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Auth API listening at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start auth API', error);
    process.exit(1);
  });

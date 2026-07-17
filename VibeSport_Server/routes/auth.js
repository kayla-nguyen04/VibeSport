const express = require('express');
const crypto = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');

const router = express.Router();


// Helper functions for auth
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
      phone: user.phone ?? null,
      favoriteSport: user.favoriteSport ?? null,
      position: user.position ?? null,
      area: user.area ?? null,
      bio: user.bio ?? null,
      featuredPost: user.featuredPost ?? null,
      rating: user.rating ?? 0,
      profileCompleted: Boolean(user.profileCompleted),
    },
  };
}

// Routes
router.post('/register', async (request, response) => {
  try {
    console.log('POST /auth/register', request.body);

    const { email, password, confirmPassword, fullName, phone } = request.body ?? {};

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
      name: fullName,
      phone: phone,
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

router.post('/login', async (request, response) => {
  const { email, password } = request.body ?? {};

  if (!email || !password) {
    response.status(400).json({ message: 'Email và mật khẩu là bắt buộc.' });
    return;
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      response.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
      return;
    }

    if (user.isLocked) {
      response.status(403).json({ message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
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

    user.lastSeenAt = new Date();
    await user.save();

    const payload = createSessionPayload(user);
    await Session.create({ userId: user._id, token: payload.token });
    response.json(payload);
  } catch (error) {
    response.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.' });
  }
});

router.post('/forgot-password', async (request, response) => {
  const { email, password, confirmPassword } = request.body ?? {};

  if (!email || !password || !confirmPassword) {
    response.status(400).json({ message: 'Email, mật khẩu mới và xác nhận mật khẩu là bắt buộc.' });
    return;
  }

  if (password !== confirmPassword) {
    response.status(400).json({ message: 'Mật khẩu xác nhận không khớp.' });
    return;
  }

  try {
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
  } catch (error) {
    response.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu.' });
  }
});

router.post('/google', async (request, response) => {
  const { email, googleId, name, picture } = request.body ?? {};

  if (!email || !googleId) {
    response.status(400).json({ message: 'Thiếu thông tin tài khoản Google.' });
    return;
  }

  try {
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
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (user.isLocked) {
      response.status(403).json({ message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
      return;
    }

    const payload = createSessionPayload(user);
    await Session.create({ userId: user._id, token: payload.token });
    response.json(payload);
  } catch (error) {
    response.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập bằng Google.' });
  }
});

router.put('/update-profile', async (request, response) => {
  try {
    const { userId, name, phone, picture, favoriteSport, favoriteSports, position, area, bio, featuredPost, profileCompleted } = request.body ?? {};

    if (!userId) {
      response.status(400).json({ message: 'Thiếu thông tin ID người dùng (userId).' });
      return;
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (picture !== undefined) {
      if (picture && typeof picture === 'string' && picture.startsWith('data:image')) {
        const base64Part = picture.split(',')[1] || '';
        const approxBytes = Math.ceil((base64Part.length * 3) / 4);
        if (approxBytes > 5 * 1024 * 1024) {
          response.status(413).json({ message: 'Ảnh đại diện quá lớn. Vui lòng chọn ảnh nhỏ hơn 5MB.' });
          return;
        }
      }
      updateFields.picture = picture;
    }
    if (favoriteSport !== undefined) updateFields.favoriteSport = favoriteSport;
    if (favoriteSports !== undefined) {
      const normalizedFavoriteSports = Array.isArray(favoriteSports)
        ? favoriteSports.map((sport) => String(sport).trim()).filter(Boolean)
        : [];
      updateFields.favoriteSports = normalizedFavoriteSports;
    }
    if (position !== undefined) updateFields.position = position;
    if (area !== undefined) updateFields.area = area;
    if (bio !== undefined) updateFields.bio = bio;
    if (featuredPost !== undefined) updateFields.featuredPost = featuredPost;

    if (profileCompleted !== undefined) {
      updateFields.profileCompleted = Boolean(profileCompleted);
    } else if (favoriteSport || position || area) {
      updateFields.profileCompleted = Boolean(favoriteSport && position && area);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      response.status(404).json({ message: 'Không tìm thấy người dùng.' });
      return;
    }

    response.json({
      message: 'Cập nhật thông tin hồ sơ thành công.',
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt,
        name: user.name ?? null,
        picture: user.picture ?? null,
        provider: user.provider ?? 'email',
        phone: user.phone ?? null,
        favoriteSport: user.favoriteSport ?? null,
        favoriteSports: user.favoriteSports ?? [],
        position: user.position ?? null,
        area: user.area ?? null,
        bio: user.bio ?? null,
        featuredPost: user.featuredPost ?? null,
        rating: user.rating ?? 0,
        profileCompleted: Boolean(user.profileCompleted),
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    response.status(500).json({ message: 'Lỗi máy chủ khi cập nhật hồ sơ.' });
  }
});

module.exports = router;

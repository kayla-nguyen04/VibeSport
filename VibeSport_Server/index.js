require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });

// Fix DNS querySrv ECONNREFUSED/ENOTFOUND on Windows when resolving MongoDB Atlas SRV records
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // Fallback if dns.setServers fails or is restricted
  }
}

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');
const fs = require('node:fs');
const authRouter = require('./routes/auth');
const otpRoutes = require("./routes/otp");
const matchRoutes = require("./routes/matches");
const postsRouter = require('./routes/posts');
const savedPostsRouter = require('./routes/savedPosts');
const tagsRouter = require('./routes/tags');
const usersRouter = require('./routes/users');
const seedTags = require('./scripts/seedTags');

const app = express();
const PORT = 4000;
const HOST = '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

app.use(cors());
app.use(express.json());
app.use("/api/otp", otpRoutes);
app.use("/api/matches", matchRoutes);

// Đảm bảo thư mục uploads tồn tại trên startup
const uploadsDir = path.join(__dirname, 'uploads', 'posts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve file static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount posts routes
app.use('/api/posts', postsRouter);
app.use('/api/saved-posts', savedPostsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/users', usersRouter);

app.get('/health', (_, response) => {
  response.json({
    ok: true,
    host: HOST,
    port: PORT,
  });
});

// Mount authentication routes
app.use('/auth', authRouter);


mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedTags();
    console.log('Tag catalog ready');
    app.listen(PORT, HOST, () => {
      console.log(`Auth API listening at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });


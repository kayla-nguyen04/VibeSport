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
const http = require('node:http');
const { Server } = require('socket.io');

const authRouter = require('./routes/auth');
const otpRoutes = require("./routes/otp");
const matchRoutes = require("./routes/matches");
const postsRouter = require('./routes/posts');
const savedPostsRouter = require('./routes/savedPosts');
const tagsRouter = require('./routes/tags');
const usersRouter = require('./routes/users');
const notificationsRouter = require('./routes/notifications');
const chatRouter = require('./routes/chat');
const seedTags = require('./scripts/seedTags');
const { startMatchNotificationCron } = require('./utils/matchNotificationCron');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Setup Socket.IO global reference
global.io = io;

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);

  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`[SOCKET] User ${userId} joined room ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
  });
});

const PORT = 4000;
const HOST = '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

app.use(cors());
// Cho phép upload ảnh đại diện dạng base64 trong JSON (mặc định express chỉ ~100KB)
app.use(express.json({ limit: '10mb' }));
app.use("/api/otp", otpRoutes);
app.use("/api/matches", matchRoutes);

// Đảm bảo thư mục uploads tồn tại trên startup
const uploadsDir = path.join(__dirname, 'uploads', 'posts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve file static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/posts', postsRouter);
app.use('/api/saved-posts', savedPostsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/chat', chatRouter);

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
    startMatchNotificationCron();
    server.listen(PORT, HOST, () => {
      console.log(`Server listening at http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });


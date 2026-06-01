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
const authRouter = require('./routes/auth');

const app = express();
const PORT = 4000;
const HOST = '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

app.use(cors());
app.use(express.json());

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


const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';

async function run() {
  await mongoose.connect(MONGODB_URI);
  const users = await User.find({});
  console.log('--- USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`Email: ${u.email}, Provider: ${u.provider}, googleId: ${u.googleId || 'N/A'}, Created: ${u.createdAt}`);
  });
  await mongoose.disconnect();
}

run().catch(console.error);

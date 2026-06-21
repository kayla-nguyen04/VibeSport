require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete conversations where participantKey contains a dash '-'
    const result = await Conversation.deleteMany({ participantKey: { $regex: '-' } });
    console.log(`Deleted ${result.deletedCount} duplicate/temporary conversations.`);
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanup();

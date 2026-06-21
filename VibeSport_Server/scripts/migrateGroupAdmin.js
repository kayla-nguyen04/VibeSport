/**
 * Migration script: Set admin field for existing group conversations.
 * Run once: node scripts/migrateGroupAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const groups = await Conversation.find({ isGroup: true, admin: null });
    console.log(`Found ${groups.length} group conversations without admin`);

    let updated = 0;
    for (const group of groups) {
      if (group.participants.length > 0) {
        group.admin = group.participants[0];
        await group.save();
        updated++;
      }
    }

    console.log(`Updated ${updated} group conversations`);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();

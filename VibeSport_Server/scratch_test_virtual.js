require('dotenv').config();
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {}
}

const mongoose = require('mongoose');
const User = require('./models/User');
const VirtualUser = require('./models/VirtualUser');
const Conversation = require('./models/Conversation');
const Match = require('./models/Match');

const populateFields = [
  { path: "createdBy", select: "name email picture area favoriteSport position isVirtual" },
  { path: "contactAppUser", select: "name email picture area favoriteSport position isVirtual" },
  { path: "participants", select: "name email picture area favoriteSport isVirtual rating stats" },
  { path: "pendingJoinRequests", select: "name email picture area favoriteSport isVirtual" },
  { path: "invitedMembers", select: "name email picture area favoriteSport isVirtual" },
  { path: "chatGroupId", select: "name isGroup avatar groupAvatar participants" },
];

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');

    const match = await Match.findById('6a7859e8aac3dc138307a843').populate(populateFields);
    console.log('SUCCESS! Populated match title:', match.title);
    console.log('Populated participants count:', match.participants.length);
    console.log('Populated participants:', JSON.stringify(match.participants, null, 2));

    mongoose.disconnect();
  } catch (err) {
    console.error('EXACT STACK TRACE:\n', err.stack);
  }
}

test();

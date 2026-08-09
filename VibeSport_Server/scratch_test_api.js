require('dotenv').config();
if (process.env.MONGODB_URI && process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {}
}

const mongoose = require('mongoose');
const User = require('./models/User');
const VirtualUser = require('./models/VirtualUser');
const Match = require('./models/Match');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const match = await Match.findOne({ title: "Giao lưu" }).sort({ createdAt: -1 });
    console.log('Match ID:', match._id);

    // Filter real players count
    const populated = await Match.findById(match._id).populate([
      { path: "participants", select: "name email picture area favoriteSport isVirtual rating stats" }
    ]);

    const realPlayersCount = populated.participants.filter(p => !p.isVirtual && String(p._id) !== String(match.createdBy)).length;
    console.log('Real players count (excluding owner & virtuals):', realPlayersCount);
    console.log('Total participants in match (including virtuals & owner):', populated.participants.length);

    populated.participants.forEach(p => {
      console.log(`- User: ${p.name}, isVirtual: ${p.isVirtual}`);
    });

    mongoose.disconnect();
  } catch (err) {
    console.error('API test error:', err);
  }
}

test();

require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedCourtOwner() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vibesport';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const ownerEmail = 'chusan@vibesport.com';
    let owner = await User.findOne({ email: ownerEmail });

    if (!owner) {
      owner = await User.create({
        email: ownerEmail,
        name: 'Trần Văn Sân (Chủ Sân VibeSport)',
        phone: '0987654321',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        area: 'Hà Nội',
        favoriteSport: 'Bóng đá',
        role: 'court_owner',
      });
      console.log('Created Court Owner User:', owner);
    } else {
      console.log('Court Owner User already exists:', owner._id);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error seeding court owner:', err);
  }
}

seedCourtOwner();

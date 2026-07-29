require('dotenv').config({ path: require('node:path').join(__dirname, '../VibeSport_Server/.env') });
const mongoose = require('mongoose');

async function checkDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB URI:', mongoUri);

    const Court = require('../VibeSport_Server/models/Court');
    const CourtOwner = require('../VibeSport_Server/models/CourtOwner');

    const ownersCount = await CourtOwner.countDocuments();
    const courtsCount = await Court.countDocuments();

    console.log(`\n=== DATABASE VERIFICATION ===`);
    console.log(`Court Owners count: ${ownersCount}`);
    console.log(`Courts count: ${courtsCount}`);

    const footballCourts = await Court.find({ sportType: 'football' }).select('name district rating priceFrom priceTo');
    const badmintonCourts = await Court.find({ sportType: 'badminton' }).select('name district rating priceFrom priceTo');
    const pickleballCourts = await Court.find({ sportType: 'pickleball' }).select('name district rating priceFrom priceTo');

    console.log(`\n⚽ Bóng đá (${footballCourts.length}):`, footballCourts.map(c => c.name).join(', '));
    console.log(`🏸 Cầu lông (${badmintonCourts.length}):`, badmintonCourts.map(c => c.name).join(', '));
    console.log(`🏓 Pickleball (${pickleballCourts.length}):`, pickleballCourts.map(c => c.name).join(', '));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Database connection error:', err.message);
  }
}

checkDB();

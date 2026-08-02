require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Court = require('../models/Court');

const menuImageUrl = 'https://res.cloudinary.com/di1m4ukgn/image/upload/v1785662754/vibe_sport/courts/hycuhjnugo8vnkftsfh6.png';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const result = await Court.updateMany(
      {},
      { $set: { serviceMenuImages: [menuImageUrl] } }
    );

    const sample = await Court.findOne({ serviceMenuImages: { $exists: true } }).select('name serviceMenuImages');

    console.log(JSON.stringify({
      matched: result.matchedCount,
      modified: result.modifiedCount,
      url: menuImageUrl,
      sampleName: sample && sample.name,
      serviceMenuImages: sample && sample.serviceMenuImages,
    }, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }
})();

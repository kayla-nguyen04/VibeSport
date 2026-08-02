require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

if (process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
  require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
}

const mongoose = require('mongoose');
const User = require('../models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';
const shouldApply = process.argv.includes('--apply');

async function cleanupUnusedProfileData() {
  await mongoose.connect(mongoUri);

  const unusedFieldsFilter = {
    $or: [
      { favoriteSports: { $exists: true } },
      { featuredPost: { $exists: true } },
    ],
  };
  const staleProfileCount = await User.countDocuments(unusedFieldsFilter);

  let usersCleaned = 0;

  if (shouldApply) {
    const profileCleanupResult = await User.collection.updateMany(
      unusedFieldsFilter,
      { $unset: { favoriteSports: '', featuredPost: '' } }
    );
    usersCleaned = profileCleanupResult.modifiedCount;
  }

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    usersWithUnusedFields: staleProfileCount,
    usersCleaned,
  }));

  await mongoose.disconnect();
}

cleanupUnusedProfileData().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

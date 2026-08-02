const mongoose = require('mongoose');
const dns = require('node:dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const uri = process.env.MONGODB_URI || 'mongodb+srv://vibesport:longquadeptrai@cluster0.auxczve.mongodb.net/vibesport?appName=Cluster0';

const courtSchema = new mongoose.Schema({}, { strict: false });
const Court = mongoose.model('Court', courtSchema);

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const courts = await Court.find({});
  console.log(`Found ${courts.length} courts.`);

  let updatedCount = 0;
  for (const court of courts) {
    const doc = court.toObject();
    const updateOps = { $unset: { priceGuide: 1 } };
    
    // Ensure pitchOptions exists if missing
    if (!Array.isArray(doc.pitchOptions) || doc.pitchOptions.length === 0) {
      const pitchOptions = [];
      const priceTable = doc.priceTable || [];
      priceTable.forEach((row) => {
        const fieldType = row.fieldType || row.type || '';
        const price = Number(row.price || row.pricePerHour || 0);
        if (price > 0 && fieldType) {
          let pitchType = '5v5';
          if (fieldType.includes('7')) pitchType = '7v7';
          else if (fieldType.includes('11')) pitchType = '11v11';
          else if (fieldType.includes('1v1') || fieldType.includes('đơn')) pitchType = '1v1';
          else if (fieldType.includes('2v2') || fieldType.includes('đôi')) pitchType = '2v2';
          pitchOptions.push({
            pitchType,
            label: fieldType,
            pricePerHour: price,
          });
        }
      });
      if (pitchOptions.length > 0) {
        updateOps.$set = { pitchOptions };
      }
    }

    await Court.updateOne({ _id: court._id }, updateOps);
    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} courts. Removed priceGuide from MongoDB.`);
  await mongoose.disconnect();
}

run().catch(console.error);

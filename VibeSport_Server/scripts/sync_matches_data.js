const mongoose = require("mongoose");
const Match = require("../models/Match");

const atlasUri = process.env.MONGODB_URI || "mongodb+srv://vibesport:longquadeptrai@cluster0.auxczve.mongodb.net/vibesport?appName=Cluster0";
const localUri = "mongodb://127.0.0.1:27017/vibesport";

const calculateTotalHours = (startTimeStr, endTimeStr) => {
  if (!startTimeStr || !endTimeStr) return 1.5;
  const [startH, startM] = startTimeStr.split(":").map(Number);
  const [endH, endM] = endTimeStr.split(":").map(Number);
  
  let startMin = (startH || 0) * 60 + (startM || 0);
  let endMin = (endH || 0) * 60 + (endM || 0);

  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  const diffMin = endMin - startMin;
  const hours = diffMin / 60;
  return Math.max(hours, 0.5);
};

const mapSkillLevel = (oldLevel) => {
  if (!oldLevel || oldLevel === "Tự do" || oldLevel === "Mới chơi") return "Người mới";
  if (oldLevel === "Trung bình") return "Trung cấp";
  if (oldLevel === "Khá - Tốt") return "Chuyên nghiệp";
  return oldLevel;
};

async function syncTargetDB(uri, label) {
  console.log(`\n⏳ Connecting to ${label}...`);
  const conn = await mongoose.createConnection(uri).asPromise();
  console.log(`✅ Connected to ${label}!`);

  const MatchModel = conn.model("Match", Match.schema);
  const matches = await MatchModel.find({});

  console.log(`🔍 Found ${matches.length} matches in ${label}. Updating...`);

  let updatedCount = 0;

  for (const m of matches) {
    const startTime = m.startTime || "19:00";
    let endTime = m.endTime;

    if (!endTime) {
      const [h, min] = startTime.split(":").map(Number);
      const totalM = (h || 19) * 60 + (min || 0) + 90;
      const endH = String(Math.floor(totalM / 60) % 24).padStart(2, "0");
      const endM = String(totalM % 60).padStart(2, "0");
      endTime = `${endH}:${endM}`;
    }

    const time = m.time || `${startTime} - ${endTime}`;
    const totalHours = calculateTotalHours(startTime, endTime);
    const costPerPersonNum = m.costPerPerson || 300000;
    const totalCourtCost = m.totalCourtCost || Math.round(costPerPersonNum * totalHours);
    const maxPlayersNum = m.maxPlayers || 10;
    const costPerPlayer = m.costPerPlayer || Math.round(totalCourtCost / maxPlayersNum);
    const skillLevel = mapSkillLevel(m.skillLevel);
    const serviceCost = m.serviceCost && m.serviceCost > 0 ? m.serviceCost : 31250;

    await MatchModel.findByIdAndUpdate(m._id, {
      $set: {
        startTime,
        endTime,
        time,
        totalHours,
        totalCourtCost,
        costPerPlayer,
        skillLevel,
        serviceCost,
        costPerPerson: costPerPersonNum,
      },
    });

    updatedCount++;
  }

  console.log(`🎉 Successfully updated ${updatedCount} matches in ${label}!`);
  await conn.close();
}

async function runSync() {
  try {
    await syncTargetDB(atlasUri, "MongoDB Atlas Cloud");
  } catch (err) {
    console.error("Atlas Sync Error:", err.message);
  }

  try {
    await syncTargetDB(localUri, "MongoDB Local");
  } catch (err) {
    console.error("Local Sync Error:", err.message);
  }

  process.exit(0);
}

runSync();

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Court = require('../models/Court');

const normalizePitchTypeValue = (value = '') => {
  const raw = String(value || '').toLowerCase();
  if (!raw) return '';
  if (raw.includes('5v5') || raw.includes('5')) return '5v5';
  if (raw.includes('7v7') || raw.includes('7')) return '7v7';
  if (raw.includes('11v11') || raw.includes('11')) return '11v11';
  if (raw.includes('1v1') || raw.includes('đơn') || raw.includes('1')) return '1v1';
  if (raw.includes('2v2') || raw.includes('đôi') || raw.includes('2')) return '2v2';
  return raw;
};

const buildFootballPitchOptions = (court) => {
  const priceFrom = Number(court.priceFrom || 300000);
  const priceTo = Number(court.priceTo || 700000);

  return [
    {
      pitchType: '5v5',
      label: 'Sân 5v5',
      pricePerHour: Math.max(300000, Math.round(priceFrom || 300000)),
    },
    {
      pitchType: '7v7',
      label: 'Sân 7v7',
      pricePerHour: Math.max(500000, Math.round((priceFrom + priceTo) / 2 || 600000)),
    },
    {
      pitchType: '11v11',
      label: 'Sân 11v11',
      pricePerHour: Math.max(1000000, Math.round(priceTo || 1000000)),
    },
  ];
};

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';
  await mongoose.connect(uri);

  const courts = await Court.find({
    $or: [
      { sportType: 'football' },
      { sports: { $in: ['football'] } },
    ],
  });

  let updated = 0;
  for (const court of courts) {
    const pitchOptions = Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0
      ? court.pitchOptions.map((item) => ({
          pitchType: normalizePitchTypeValue(item?.pitchType || item?.label || item?.fieldType || ''),
          label: item?.label || item?.pitchType || item?.fieldType || '',
          pricePerHour: Number(item?.pricePerHour ?? item?.price ?? 0) || 0,
        })).filter((item) => item.pitchType && item.pricePerHour > 0)
      : [];

    const byType = new Map((pitchOptions || []).map((p) => [p.pitchType, p]));
    const finalOptions = [];
    const ordered = ['5v5', '7v7', '11v11'];

    ordered.forEach((pitchType) => {
      if (byType.has(pitchType)) {
        finalOptions.push(byType.get(pitchType));
      } else {
        const defaultValue = buildFootballPitchOptions(court).find((p) => p.pitchType === pitchType);
        if (defaultValue) finalOptions.push(defaultValue);
      }
    });

    if (finalOptions.length > 0) {
      court.pitchOptions = finalOptions;
      if (Array.isArray(court.priceGuide)) delete court.priceGuide;
      await court.save();
      updated += 1;
    }
  }

  console.log(`Đã cập nhật ${updated} sân bóng đá trong MongoDB với pitchOptions: 5v5, 7v7, 11v11.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Lỗi khi normalize sân bóng đá:', err.message);
  process.exit(1);
});

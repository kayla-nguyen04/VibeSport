require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Court = require('../models/Court');
const CourtRating = require('../models/CourtRating');
const CourtOwner = require('../models/CourtOwner');
const User = require('../models/User');

const RAW_COURTS = [
  {
    "name": "Sân Bóng Hà Trì",
    "sportType": "football",
    "address": "Hà Trì, Hà Đông, Hà Nội",
    "district": "Hà Đông",
    "rating": 4.3,
    "reviewCount": 574,
    "priceFrom": 300000,
    "priceTo": 700000,
    "phone": "0896860004",
    "openTime": "06:00",
    "closeTime": "23:00",
    "fieldTypes": ["5 người", "7 người"],
    "facilities": ["Bãi giữ xe", "Phòng thay đồ", "Đèn chiếu sáng"],
    "description": "Sân cỏ nhân tạo chất lượng, phù hợp giao hữu và giải phong trào."
  },
  {
    "name": "Sân Bóng Phúc Xá",
    "sportType": "football",
    "address": "Hồng Hà, Ba Đình, Hà Nội",
    "district": "Ba Đình",
    "rating": 4.1,
    "reviewCount": 277,
    "priceFrom": 350000,
    "priceTo": 800000,
    "phone": "02873075788",
    "openTime": "06:00",
    "closeTime": "23:00",
    "fieldTypes": ["5 người", "7 người"],
    "facilities": ["Wifi", "Bãi giữ xe", "Căng tin"],
    "description": "Sân rộng, ánh sáng tốt, thường tổ chức các giải phong trào."
  },
  {
    "name": "Sân Bóng Mỹ Đình",
    "sportType": "football",
    "address": "Mỹ Đình, Nam Từ Liêm, Hà Nội",
    "district": "Nam Từ Liêm",
    "rating": 4.6,
    "reviewCount": 812,
    "priceFrom": 400000,
    "priceTo": 1000000,
    "phone": "0988123456",
    "openTime": "05:30",
    "closeTime": "23:00",
    "fieldTypes": ["5 người", "7 người", "11 người"],
    "facilities": ["Bãi giữ xe", "Phòng thay đồ", "Căng tin"],
    "description": "Cụm sân lớn, mặt cỏ đẹp, phù hợp mọi đối tượng."
  },
  {
    "name": "Sân Bóng Đại học Sư phạm",
    "sportType": "football",
    "address": "136 Xuân Thủy, Cầu Giấy, Hà Nội",
    "district": "Cầu Giấy",
    "rating": 4.3,
    "reviewCount": 528,
    "priceFrom": 350000,
    "priceTo": 700000,
    "phone": "02473064588",
    "openTime": "06:00",
    "closeTime": "22:30",
    "fieldTypes": ["5 người", "7 người"],
    "facilities": ["Nhà vệ sinh", "Bãi giữ xe"],
    "description": "Vị trí trung tâm, thuận tiện cho sinh viên và dân văn phòng."
  },
  {
    "name": "Sân Bóng Green Arena",
    "sportType": "football",
    "address": "Hoàng Mai, Hà Nội",
    "district": "Hoàng Mai",
    "rating": 4.5,
    "reviewCount": 240,
    "priceFrom": 300000,
    "priceTo": 650000,
    "phone": "0977555666",
    "openTime": "06:00",
    "closeTime": "23:00",
    "fieldTypes": ["5 người", "7 người"],
    "facilities": ["Wifi", "Đèn LED", "Bãi giữ xe"],
    "description": "Sân mới, mặt cỏ đạt chuẩn, giá hợp lý."
  },
  {
    "name": "Sân Cầu Lông JQK Badminton",
    "sportType": "badminton",
    "address": "Thanh Trì, Hà Nội",
    "district": "Thanh Trì",
    "rating": 4.9,
    "reviewCount": 79,
    "priceFrom": 90000,
    "priceTo": 150000,
    "phone": "0339651117",
    "openTime": "06:00",
    "closeTime": "23:30",
    "courtCount": 8,
    "facilities": ["Điều hòa", "Wifi", "Bãi giữ xe"],
    "description": "Sân đạt chuẩn thi đấu, ánh sáng tốt."
  },
  {
    "name": "Sân Cầu Lông Vina Badminton",
    "sportType": "badminton",
    "address": "Thanh Liệt, Hà Nội",
    "district": "Thanh Trì",
    "rating": 4.9,
    "reviewCount": 253,
    "priceFrom": 100000,
    "priceTo": 160000,
    "phone": "0986907380",
    "openTime": "06:00",
    "closeTime": "00:00",
    "courtCount": 12,
    "facilities": ["Phòng tắm", "Wifi", "Bãi giữ xe"],
    "description": "Một trong những cụm sân cầu lông nổi tiếng tại Hà Nội."
  },
  {
    "name": "Sân Cầu Lông HH Lĩnh Nam",
    "sportType": "badminton",
    "address": "Lĩnh Nam, Hoàng Mai, Hà Nội",
    "district": "Hoàng Mai",
    "rating": 5.0,
    "reviewCount": 119,
    "priceFrom": 80000,
    "priceTo": 140000,
    "phone": "0385060607",
    "openTime": "05:30",
    "closeTime": "23:00",
    "courtCount": 6,
    "facilities": ["Wifi", "Bãi giữ xe"],
    "description": "Không gian thoáng, phù hợp luyện tập hằng ngày."
  },
  {
    "name": "Sân Cầu Lông Swin",
    "sportType": "badminton",
    "address": "Cầu Giấy, Hà Nội",
    "district": "Cầu Giấy",
    "rating": 4.3,
    "reviewCount": 26,
    "priceFrom": 100000,
    "priceTo": 150000,
    "phone": "0972914307",
    "openTime": "05:00",
    "closeTime": "23:30",
    "courtCount": 7,
    "facilities": ["Điều hòa", "Wifi"],
    "description": "Sân sạch đẹp, phù hợp người mới và bán chuyên."
  },
  {
    "name": "Sân Cầu Lông TP Badminton",
    "sportType": "badminton",
    "address": "Thanh Liệt, Hà Nội",
    "district": "Thanh Trì",
    "rating": 4.8,
    "reviewCount": 13,
    "priceFrom": 90000,
    "priceTo": 140000,
    "phone": "0356118885",
    "openTime": "06:00",
    "closeTime": "23:00",
    "courtCount": 5,
    "facilities": ["Wifi", "Nhà vệ sinh"],
    "description": "Sân mới, ánh sáng đạt chuẩn."
  },
  {
    "name": "Ocean Pickleball Mỹ Đình",
    "sportType": "pickleball",
    "address": "99 Lê Đức Thọ, Nam Từ Liêm, Hà Nội",
    "district": "Nam Từ Liêm",
    "rating": 4.9,
    "reviewCount": 41,
    "priceFrom": 180000,
    "priceTo": 300000,
    "phone": "0982351888",
    "openTime": "06:00",
    "closeTime": "22:00",
    "courtCount": 6,
    "facilities": ["Wifi", "Bãi giữ xe", "Thuê vợt"],
    "description": "Sân pickleball hiện đại, phù hợp luyện tập và thi đấu."
  },
  {
    "name": "SixtyNine Pickleball",
    "sportType": "pickleball",
    "address": "Tứ Liên, Tây Hồ, Hà Nội",
    "district": "Tây Hồ",
    "rating": 5.0,
    "reviewCount": 18,
    "priceFrom": 180000,
    "priceTo": 280000,
    "phone": "0384083333",
    "openTime": "05:00",
    "closeTime": "23:00",
    "courtCount": 4,
    "facilities": ["Wifi", "Quầy nước"],
    "description": "Sân mới, không gian rộng và thoáng."
  },
  {
    "name": "SS Pickleball Club",
    "sportType": "pickleball",
    "address": "Xuân Đỉnh, Bắc Từ Liêm, Hà Nội",
    "district": "Bắc Từ Liêm",
    "rating": 4.8,
    "reviewCount": 8,
    "priceFrom": 200000,
    "priceTo": 300000,
    "phone": "0886244666",
    "openTime": "05:00",
    "closeTime": "23:30",
    "courtCount": 5,
    "facilities": ["Wifi", "Bãi giữ xe"],
    "description": "Cụm sân pickleball mới, phù hợp chơi theo nhóm."
  },
  {
    "name": "Cove Pickleball",
    "sportType": "pickleball",
    "address": "117 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    "district": "Cầu Giấy",
    "rating": 4.4,
    "reviewCount": 9,
    "priceFrom": 180000,
    "priceTo": 280000,
    "phone": "0899912555",
    "openTime": "05:00",
    "closeTime": "22:00",
    "courtCount": 4,
    "facilities": ["Wifi", "Quầy nước"],
    "description": "Sân trong nhà, mặt sân chất lượng."
  },
  {
    "name": "Sóng Xanh Pickleball",
    "sportType": "pickleball",
    "address": "Đức Giang, Long Biên, Hà Nội",
    "district": "Long Biên",
    "rating": 4.9,
    "reviewCount": 35,
    "priceFrom": 180000,
    "priceTo": 320000,
    "phone": "0931653388",
    "openTime": "05:00",
    "closeTime": "23:00",
    "courtCount": 6,
    "facilities": ["Wifi", "Phòng thay đồ", "Bãi giữ xe"],
    "description": "Sân đạt chuẩn thi đấu, cộng đồng chơi đông."
  }
];

async function seedCourtsAndOwners() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vibesport';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Seed Court Owner user
    let defaultOwner = await CourtOwner.findOne({ name: 'Trần Văn Sân (Chủ Sân VibeSport)' });
    if (!defaultOwner) {
      defaultOwner = await CourtOwner.create({
        name: 'Trần Văn Sân (Chủ Sân VibeSport)',
        phone: '0987654321',
        email: 'chusan@vibesport.com',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        district: 'Hà Nội',
      });
      console.log('Created default Court Owner:', defaultOwner._id);
    }

    // Seed Courts
    await Court.deleteMany({});
    await CourtRating.deleteMany({});
    console.log('Cleared existing courts and court ratings.');

    for (const courtData of RAW_COURTS) {
      const court = await Court.create({
        ...courtData,
        owner: defaultOwner._id,
        images: [
          'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
          'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
        ],
        locationCoords: { lat: 21.0285, lng: 105.8542 },
      });

      const ratingDocs = [];
      for (let i = 0; i < 10; i += 1) {
        ratingDocs.push({
          courtId: court._id,
          userId: new mongoose.Types.ObjectId(),
          stars: 5,
          comment: 'Đánh giá 5 sao',
        });
      }
      await CourtRating.insertMany(ratingDocs);
      court.rating = 5.0;
      court.reviewCount = 10;
      await court.save();

      console.log(`Seeded Court: ${court.name} (${court.sportType}) with ${ratingDocs.length} five-star ratings`);
    }

    console.log('All 15 courts successfully seeded into MongoDB!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error seeding courts and owners:', err);
  }
}

seedCourtsAndOwners();

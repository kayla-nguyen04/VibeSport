require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Court = require('../models/Court');
const User = require('../models/User');

const RAW_COURTS = [
  {
    "name": "Sân Bóng Hà Trì",
    "sportType": "football",
    "address": "Số 68 Ngõ 12 Hà Trì 1, Phường Hà Cầu, Quận Hà Đông, Hà Nội",
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
    "address": "Số 154 Đường Hồng Hà, Phường Phúc Xá, Quận Ba Đình, Hà Nội",
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
    "address": "Số 2 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
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
    "address": "Số 136 Đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
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
    "address": "Số 88 Đường Tân Mai, Phường Tân Mai, Quận Hoàng Mai, Hà Nội",
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
    "address": "Số 42 Ngõ 198 Đường Ngọc Hồi, Xã Vĩnh Quỳnh, Huyện Thanh Trì, Hà Nội",
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
    "address": "Số 85 Đường Thanh Liệt, Xã Thanh Liệt, Huyện Thanh Trì, Hà Nội",
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
    "address": "Số 255 Đường Lĩnh Nam, Phường Vĩnh Hưng, Quận Hoàng Mai, Hà Nội",
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
    "address": "Số 36 Ngõ 28 Đường Xuân La, Phường Xuân La, Quận Tây Hồ, Hà Nội",
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
    "address": "Số 12 Ngõ 95 Đường Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Hà Nội",
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
    "address": "Số 99 Đường Lê Đức Thọ, Phường Mỹ Đình 2, Quận Nam Từ Liêm, Hà Nội",
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
    "address": "Số 69 Đường Tứ Liên, Phường Tứ Liên, Quận Tây Hồ, Hà Nội",
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
    "address": "Số 102 Đường Xuân Đỉnh, Phường Xuân Đỉnh, Quận Bắc Từ Liêm, Hà Nội",
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
    "address": "Số 117 Đường Trần Duy Hưng, Phường Trung Hòa, Quận Cầu Giấy, Hà Nội",
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
    "address": "Số 19 Đường Đức Giang, Phường Đức Giang, Quận Long Biên, Hà Nội",
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

async function seedTargetDB(uri, label) {
  console.log(`\n========================================`);
  console.log(`[SEEDING] Target: ${label}`);
  console.log(`[SEEDING] URI: ${uri}`);
  console.log(`========================================`);

  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log(`✓ Connected to ${label}`);

    const UserModel = conn.model('User', User.schema);
    const CourtModel = conn.model('Court', Court.schema);

    const fixedOwnerId = new mongoose.Types.ObjectId("6a6465f17b201152379c08cc");

    await UserModel.deleteOne({ _id: fixedOwnerId });
    await UserModel.deleteOne({ email: "longqh300@gmail.com" });

    const owner = await UserModel.create({
      _id: fixedOwnerId,
      email: "longqh300@gmail.com",
      passwordHash: "3d7cdbe00065712a0a118208cea1e7f0:c1c244e9019809d61be8f719a138283cece235e8fee3d9d97e69bb75850820201b1840ab31a0188368d831afce3df2e9fb87f801635f95e3e90012ec720957a6",
      name: "Longpham",
      phone: "+84327765806",
      picture: null,
      provider: "email",
      favoriteSport: "Bóng đá",
      position: "Tiền đạo, Hậu vệ, Tiền vệ, Thủ môn",
      area: "Đường Liên Xã, Xã Phú Lũng, Huyện Yên Minh, Tỉnh Hà Giang",
      bio: "Hào đồng vui tí tính",
      rating: 0,
      stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        mvp: 0
      },
      profileCompleted: true,
    });
    console.log(`✓ Seeded unified User document (Longpham) in ${label}: ID = ${owner._id}`);

    // Clear and insert Courts
    await CourtModel.deleteMany({});
    console.log(`✓ Cleared collection 'courts' in ${label}`);

    const createdCourts = [];
    for (const data of RAW_COURTS) {
      let pitchOptions = [];
      if (data.sportType === 'football') {
        if (data.fieldTypes && data.fieldTypes.includes("11 người")) {
          pitchOptions = [
            { pitchType: '5v5', label: 'Sân 5v5', pricePerHour: data.priceFrom || 300000 },
            { pitchType: '7v7', label: 'Sân 7v7', pricePerHour: Math.round(((data.priceFrom || 300000) + (data.priceTo || 700000)) / 2) },
            { pitchType: '11v11', label: 'Sân 11v11', pricePerHour: data.priceTo || 1000000 },
          ];
        } else {
          pitchOptions = [
            { pitchType: '5v5', label: 'Sân 5v5', pricePerHour: data.priceFrom || 300000 },
            { pitchType: '7v7', label: 'Sân 7v7', pricePerHour: data.priceTo || 600000 },
          ];
        }
      } else if (data.sportType === 'badminton') {
        pitchOptions = [
          { pitchType: '1v1', label: 'Sân 1v1', pricePerHour: data.priceFrom || 100000 },
          { pitchType: '2v2', label: 'Sân 2v2', pricePerHour: data.priceTo || 180000 },
        ];
      } else {
        pitchOptions = [
          { pitchType: '1v1', label: 'Sân 1v1', pricePerHour: data.priceFrom || 120000 },
          { pitchType: '2v2', label: 'Sân 2v2', pricePerHour: data.priceTo || 220000 },
        ];
      }

      const serviceMenuImages = [
        "https://images.unsplash.com/photo-1556742049-0a670fc8078a?w=800",
        "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800",
      ];

      const serviceDetails = {
        drinkService: {
          name: "Tiền nước uống",
          priceRange: "10.000đ - 25.000đ / chai",
          minPrice: 10000,
          maxPrice: 25000,
          avgPrice: 17500,
        },
        equipmentService: {
          name: "Tiền thuê dụng cụ",
          priceRange: "30.000đ - 60.000đ / trận",
          minPrice: 30000,
          maxPrice: 60000,
          avgPrice: 45000,
        },
        avgServiceCost: Math.round((17500 + 45000) / 2),
      };

      const c = await CourtModel.create({
        ...data,
        phone: owner.phone || "+84327765806",
        pitchOptions,
        serviceMenuImages,
        serviceDetails,
        serviceCost: serviceDetails.avgServiceCost,
        owner: owner._id,
        images: [
          'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
          'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
        ],
        locationCoords: { lat: 21.0285, lng: 105.8542 },
      });
      createdCourts.push(c);
      console.log(`  + Seeded Court [${c.sportType.toUpperCase()}]: ${c.name} (ID: ${c._id})`);
    }

    owner.courts = createdCourts.map((c) => c._id);
    await owner.save();
    console.log(`✓ Updated CourtOwner (${owner.name}) with ${owner.courts.length} owned court IDs!`);

    console.log(`✓ SUCCESS: ${createdCourts.length} Courts created in collection 'courts' on ${label}!`);
    await conn.close();
  } catch (err) {
    console.error(`❌ ERROR seeding ${label}:`, err.message);
  }
}

async function runAllSeeding() {
  const atlasUri = process.env.MONGODB_URI || 'mongodb+srv://vibesport:longquadeptrai@cluster0.auxczve.mongodb.net/vibesport?appName=Cluster0';
  const localUri = 'mongodb://127.0.0.1:27017/vibesport';

  await seedTargetDB(atlasUri, 'MongoDB Atlas (Cloud Cluster)');
  await seedTargetDB(localUri, 'MongoDB Local (localhost:27017/vibesport)');
  
  process.exit(0);
}

runAllSeeding();

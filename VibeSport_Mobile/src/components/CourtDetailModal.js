import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "./Screen";
import { primary } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ORANGE = primary.DEFAULT; // '#FF6B3D'

export const DEFAULT_COURT_OWNER = {
  _id: "6a6465f17b201152379c08cc",
  id: "6a6465f17b201152379c08cc",
  name: "Longpham",
  email: "longqh300@gmail.com",
  phone: "+84327765806",
  picture: null,
  area: "Đường Liên Xã, Xã Phú Lũng, Huyện Yên Minh, Tỉnh Hà Giang",
  favoriteSport: "Bóng đá",
  bio: "Hào đồng vui tí tính",
};

// Service menu items — single source of truth for all price displays
export const SERVICE_MENU = [
  {
    label: "Tiền nước uống (Nước khoáng, Pocari...)",
    unit: "chai",
    priceMin: 10000,
    priceMax: 25000,
  },
  {
    label: "Tiền thuê dụng cụ (Bóng, Vợt, Giày, Áo Bib...)",
    unit: "lượt",
    priceMin: 30000,
    priceMax: 60000,
  },
];

// Returns { min, max } across all service menu items
export const getServiceCostRange = () => {
  const allMins = SERVICE_MENU.map((s) => s.priceMin);
  const allMaxs = SERVICE_MENU.map((s) => s.priceMax);
  return {
    min: Math.min(...allMins),
    max: Math.max(...allMaxs),
  };
};

const isPitchSupportedByCourt = (court, pitchTypeLabel) => {
  if (!court) return true;

  // 1. If court has pitchOptions array from MongoDB
  if (Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0) {
    const digitMatch = pitchTypeLabel.match(/\d+/);
    const targetDigit = digitMatch ? digitMatch[0] : "";
    return court.pitchOptions.some((opt) => {
      if (!opt) return false;
      const optStr = typeof opt === "string" ? opt : (opt.pitchType || "");
      if (optStr.includes(pitchTypeLabel)) return true;
      if (targetDigit && optStr.includes(targetDigit)) return true;
      return false;
    });
  }

  // 2. If court has fieldTypes or pitchTypes array
  const types = court.fieldTypes || court.pitchTypes;
  if (Array.isArray(types) && types.length > 0) {
    const digitMatch = pitchTypeLabel.match(/\d+/);
    const targetDigit = digitMatch ? digitMatch[0] : "";
    return types.some((t) => {
      if (!t) return false;
      const tStr = String(t);
      if (tStr.includes(pitchTypeLabel)) return true;
      if (targetDigit && tStr.includes(targetDigit)) return true;
      return false;
    });
  }

  return true;
};

const getCourtPitchPriceDisplay = (court, pItem) => {
  if (!court) return pItem.price;
  if (Array.isArray(court.pitchOptions)) {
    const digitMatch = pItem.type.match(/\d+/);
    const targetDigit = digitMatch ? digitMatch[0] : "";
    const foundOpt = court.pitchOptions.find((opt) => {
      const optStr = typeof opt === "string" ? opt : (opt.pitchType || "");
      return optStr.includes(pItem.type) || (targetDigit && optStr.includes(targetDigit));
    });
    if (foundOpt) {
      if (foundOpt.priceRange) return foundOpt.priceRange;
      if (foundOpt.pricePerHour) return `${foundOpt.pricePerHour.toLocaleString('vi-VN')}đ / giờ`;
    }
  }
  return pItem.price;
};

export const COURT_DIRECTORY = [
  // ── FOOTBALL COURTS ──
  {
    id: "court_hatri",
    name: "Sân Bóng Hà Trì",
    sportType: "football",
    address: "Số 68 Ngõ 12 Hà Trì 1, Phường Hà Cầu, Quận Hà Đông, Hà Nội",
    district: "Hà Đông",
    rating: 4.3,
    reviewsCount: 574,
    priceFrom: 300000,
    priceTo: 700000,
    phone: "0896860004",
    zalo: "0896860004",
    openHours: "06:00 - 23:00",
    pitchTypes: ["Sân 5", "Sân 7", "Sân 11"],
    pricesByPitchType: {
      "Sân 5": 300000,
      "Sân 7": 500000,
      "Sân 11": 1000000,
    },
    priceGuide: [
      { type: "Sân 5", price: "300.000đ - 450.000đ" },
      { type: "Sân 7", price: "500.000đ - 700.000đ" },
      { type: "Sân 11", price: "1.000.000đ - 1.500.000đ" },
    ],
    facilities: ["Bãi giữ xe", "Phòng thay đồ", "Đèn chiếu sáng"],
    amenitiesText: "Bãi giữ xe • Phòng thay đồ • Đèn chiếu sáng",
    intro: "Sân cỏ nhân tạo chất lượng tiêu chuẩn tại khu vực Hà Trì, Hà Đông. Cụm sân sạch sẽ, mặt cỏ êm ái đàn hồi tốt. Dàn đèn LED chiếu sáng rực rỡ ban đêm, có căng tin nước uống giải khát, bãi gửi xe rộng thoáng và phòng thay đồ khép kín.",
    description: "Sân cỏ nhân tạo chất lượng tiêu chuẩn tại khu vực Hà Trì, Hà Đông. Cụm sân sạch sẽ, mặt cỏ êm ái đàn hồi tốt. Dàn đèn LED chiếu sáng rực rỡ ban đêm, có căng tin nước uống giải khát, bãi gửi xe rộng thoáng và phòng thay đồ khép kín.",
    hourlyRate: 300000,
    serviceCost: 50000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800",
    ],
    coords: { lat: 20.9632, lng: 105.7765 },
  },
  {
    id: "court_phucxa",
    name: "Sân Bóng Phúc Xá",
    sportType: "football",
    address: "Số 154 Đường Hồng Hà, Phường Phúc Xá, Quận Ba Đình, Hà Nội",
    district: "Ba Đình",
    rating: 4.1,
    reviewsCount: 277,
    priceFrom: 350000,
    priceTo: 800000,
    phone: "02873075788",
    zalo: "02873075788",
    openHours: "06:00 - 23:00",
    pitchTypes: ["Sân 5", "Sân 7", "Sân 11"],
    pricesByPitchType: {
      "Sân 5": 350000,
      "Sân 7": 600000,
      "Sân 11": 1100000,
    },
    priceGuide: [
      { type: "Sân 5", price: "350.000đ - 500.000đ" },
      { type: "Sân 7", price: "600.000đ - 800.000đ" },
      { type: "Sân 11", price: "1.100.000đ - 1.600.000đ" },
    ],
    facilities: ["Wifi", "Bãi giữ xe", "Căng tin"],
    amenitiesText: "Wifi • Bãi giữ xe • Căng tin",
    intro: "Sân rộng thoáng mát nằm tại khu vực Phúc Xá, Ba Đình. Hệ thống sân 5, 7 và 11 người mặt cỏ nhập khẩu đạt chuẩn thi đấu phong trào. Ánh sáng tốt, bảo vệ 24/7, bãi đỗ xe ô tô và xe máy rộng rãi.",
    description: "Sân rộng thoáng mát nằm tại khu vực Phúc Xá, Ba Đình. Hệ thống sân 5, 7 và 11 người mặt cỏ nhập khẩu đạt chuẩn thi đấu phong trào. Ánh sáng tốt, bảo vệ 24/7, bãi đỗ xe ô tô và xe máy rộng rãi.",
    hourlyRate: 350000,
    serviceCost: 50000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    ],
    coords: { lat: 21.0425, lng: 105.8512 },
  },
  {
    id: "court_mydinh_fb",
    name: "Sân Bóng Mỹ Đình",
    sportType: "football",
    address: "Số 2 Đường Lê Đức Thọ, Phường Mỹ Đình 1, Quận Nam Từ Liêm, Hà Nội",
    district: "Nam Từ Liêm",
    rating: 4.6,
    reviewsCount: 812,
    priceFrom: 400000,
    priceTo: 1000000,
    phone: "0988123456",
    zalo: "0988123456",
    openHours: "05:30 - 23:00",
    pitchTypes: ["Sân 5", "Sân 7", "Sân 11"],
    pricesByPitchType: {
      "Sân 5": 400000,
      "Sân 7": 650000,
      "Sân 11": 1000000,
    },
    priceGuide: [
      { type: "Sân 5", price: "400.000đ - 550.000đ" },
      { type: "Sân 7", price: "650.000đ - 850.000đ" },
      { type: "Sân 11", price: "1.000.000đ - 1.500.000đ" },
    ],
    facilities: ["Bãi giữ xe", "Phòng thay đồ", "Căng tin"],
    amenitiesText: "Bãi giữ xe • Phòng thay đồ • Căng tin",
    intro: "Cụm sân bóng đá cỏ nhân tạo quy mô lớn gần Sân vận động Quốc gia Mỹ Đình. Hệ thống mặt cỏ FIFA phong trào chất lượng cao, thoát nước cực tốt. Trang bị mái che khán đài, phòng tắm nóng lạnh, wifi và quầy giải khát chuyên nghiệp.",
    description: "Cụm sân bóng đá cỏ nhân tạo quy mô lớn gần Sân vận động Quốc gia Mỹ Đình. Hệ thống mặt cỏ FIFA phong trào chất lượng cao, thoát nước cực tốt. Trang bị mái che khán đài, phòng tắm nóng lạnh, wifi và quầy giải khát chuyên nghiệp.",
    hourlyRate: 400000,
    serviceCost: 60000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800",
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
    ],
    coords: { lat: 21.0205, lng: 105.7645 },
  },
  {
    id: "court_dhsp",
    name: "Sân Bóng Đại học Sư phạm",
    sportType: "football",
    address: "Số 136 Đường Xuân Thủy, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội",
    district: "Cầu Giấy",
    rating: 4.3,
    reviewsCount: 528,
    priceFrom: 350000,
    priceTo: 700000,
    phone: "02473064588",
    zalo: "02473064588",
    openHours: "06:00 - 22:30",
    pitchTypes: ["Sân 5", "Sân 7", "Sân 11"],
    pricesByPitchType: {
      "Sân 5": 350000,
      "Sân 7": 550000,
      "Sân 11": 1050000,
    },
    priceGuide: [
      { type: "Sân 5", price: "350.000đ - 450.000đ" },
      { type: "Sân 7", price: "550.000đ - 700.000đ" },
      { type: "Sân 11", price: "1.050.000đ - 1.500.000đ" },
    ],
    facilities: ["Nhà vệ sinh", "Bãi giữ xe"],
    amenitiesText: "Nhà vệ sinh • Bãi giữ xe",
    intro: "Nằm trong khuôn viên ĐH Sư Phạm Hà Nội, đường Xuân Thủy, Cầu Giấy. Không gian rợp bóng cây xanh, mặt cỏ mềm chân hạt cao su đều. Địa điểm quen thuộc của học sinh, sinh viên và dân văn phòng khu vực Cầu Giấy.",
    description: "Nằm trong khuôn viên ĐH Sư Phạm Hà Nội, đường Xuân Thủy, Cầu Giấy. Không gian rợp bóng cây xanh, mặt cỏ mềm chân hạt cao su đều. Địa điểm quen thuộc của học sinh, sinh viên và dân văn phòng khu vực Cầu Giấy.",
    hourlyRate: 350000,
    serviceCost: 40000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800",
    ],
    coords: { lat: 21.0368, lng: 105.7825 },
  },
  {
    id: "court_greenarena",
    name: "Sân Bóng Green Arena",
    sportType: "football",
    address: "Số 88 Đường Tân Mai, Phường Tân Mai, Quận Hoàng Mai, Hà Nội",
    district: "Hoàng Mai",
    rating: 4.5,
    reviewsCount: 240,
    priceFrom: 300000,
    priceTo: 650000,
    phone: "0977555666",
    zalo: "0977555666",
    openHours: "06:00 - 23:00",
    pitchTypes: ["Sân 5", "Sân 7", "Sân 11"],
    pricesByPitchType: {
      "Sân 5": 300000,
      "Sân 7": 500000,
      "Sân 11": 950000,
    },
    priceGuide: [
      { type: "Sân 5", price: "300.000đ - 450.000đ" },
      { type: "Sân 7", price: "500.000đ - 650.000đ" },
      { type: "Sân 11", price: "950.000đ - 1.400.000đ" },
    ],
    facilities: ["Wifi", "Đèn LED", "Bãi giữ xe"],
    amenitiesText: "Wifi • Đèn LED • Bãi giữ xe",
    intro: "Tổ hợp sân bóng đá cỏ nhân tạo hiện đại tại đường Tân Mai, Hoàng Mai. Sân bóng mới đầu tư hệ thống đèn LED chống chói mắt ban đêm, thảm cỏ êm chống chấn thương. Căng tin rộng rãi phục vụ đồ uống tươi ngon.",
    description: "Tổ hợp sân bóng đá cỏ nhân tạo hiện đại tại đường Tân Mai, Hoàng Mai. Sân bóng mới đầu tư hệ thống đèn LED chống chói mắt ban đêm, thảm cỏ êm chống chấn thương. Căng tin rộng rãi phục vụ đồ uống tươi ngon.",
    hourlyRate: 300000,
    serviceCost: 40000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    ],
    coords: { lat: 20.9785, lng: 105.8542 },
  },

  // ── BADMINTON COURTS ──
  {
    id: "court_jqk_badminton",
    name: "Sân Cầu Lông JQK Badminton",
    sportType: "badminton",
    address: "Số 42 Ngõ 198 Đường Ngọc Hồi, Xã Vĩnh Quỳnh, Huyện Thanh Trì, Hà Nội",
    district: "Thanh Trì",
    rating: 4.9,
    reviewsCount: 79,
    priceFrom: 90000,
    priceTo: 150000,
    phone: "0339651117",
    zalo: "0339651117",
    openHours: "06:00 - 23:30",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 90000,
      "Sân đôi": 130000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "90.000đ - 120.000đ" },
      { type: "Sân đôi", price: "120.000đ - 150.000đ" },
    ],
    facilities: ["Điều hòa", "Wifi", "Bãi giữ xe"],
    amenitiesText: "Điều hòa • Wifi • Bãi giữ xe",
    intro: "Sân cầu lông thảm PVC xanh lá vân cát tiêu chuẩn BWF quốc tế tại Thanh Trì. Trần cao 9m không vướng ván, đèn chiếu sáng 4 góc sân không chói mắt khi đập cầu. Trang bị quạt thông gió công suất lớn và ghế ngồi cổ vũ thoải mái.",
    description: "Sân cầu lông thảm PVC xanh lá vân cát tiêu chuẩn BWF quốc tế tại Thanh Trì. Trần cao 9m không vướng ván, đèn chiếu sáng 4 góc sân không chói mắt khi đập cầu. Trang bị quạt thông gió công suất lớn và ghế ngồi cổ vũ thoải mái.",
    hourlyRate: 90000,
    serviceCost: 30000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
      "https://images.unsplash.com/photo-1521537634581-0ddea2efe338?w=800",
    ],
    coords: { lat: 20.9525, lng: 105.8452 },
  },
  {
    id: "court_vina_badminton",
    name: "Sân Cầu Lông Vina Badminton",
    sportType: "badminton",
    address: "Số 85 Đường Thanh Liệt, Xã Thanh Liệt, Huyện Thanh Trì, Hà Nội",
    district: "Thanh Trì",
    rating: 4.9,
    reviewsCount: 253,
    priceFrom: 100000,
    priceTo: 160000,
    phone: "0986907380",
    zalo: "0986907380",
    openHours: "06:00 - 00:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 100000,
      "Sân đôi": 140000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "100.000đ - 130.000đ" },
      { type: "Sân đôi", price: "130.000đ - 160.000đ" },
    ],
    facilities: ["Phòng tắm", "Wifi", "Bãi giữ xe"],
    amenitiesText: "Phòng tắm • Wifi • Bãi giữ xe",
    intro: "Cụm 8 sân cầu lông thảm nhập khẩu chất lượng cao tại Thanh Xuân. Mặt sân độ bám tốt, êm ái giảm tải áp lực khớp gối. Có cửa hàng dụng cụ cầu lông, dịch vụ căng vợt lấy ngay và nước uống giải khát.",
    description: "Cụm 8 sân cầu lông thảm nhập khẩu chất lượng cao tại Thanh Xuân. Mặt sân độ bám tốt, êm ái giảm tải áp lực khớp gối. Có cửa hàng dụng cụ cầu lông, dịch vụ căng vợt lấy ngay và nước uống giải khát.",
    hourlyRate: 100000,
    serviceCost: 30000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=800",
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
    ],
    coords: { lat: 20.9678, lng: 105.8142 },
  },
  {
    id: "court_hh_linhnam",
    name: "Sân Cầu Lông HH Lĩnh Nam",
    sportType: "badminton",
    address: "Số 255 Đường Lĩnh Nam, Phường Vĩnh Hưng, Quận Hoàng Mai, Hà Nội",
    district: "Hoàng Mai",
    rating: 5.0,
    reviewsCount: 119,
    priceFrom: 80000,
    priceTo: 140000,
    phone: "0385060607",
    zalo: "0385060607",
    openHours: "05:30 - 23:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 80000,
      "Sân đôi": 120000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "80.000đ - 110.000đ" },
      { type: "Sân đôi", price: "110.000đ - 140.000đ" },
    ],
    facilities: ["Wifi", "Bãi giữ xe"],
    amenitiesText: "Wifi • Bãi giữ xe",
    intro: "Sân cầu lông đạt chuẩn thi đấu tại Hoàng Mai. Không gian thoáng, trần nhà cao, đèn chiếu sáng đều nét. Có khu vực thay đồ, chỗ để xe máy ô tô rộng rãi và bảo vệ coi xe 24/7.",
    description: "Sân cầu lông đạt chuẩn thi đấu tại Hoàng Mai. Không gian thoáng, trần nhà cao, đèn chiếu sáng đều nét. Có khu vực thay đồ, chỗ để xe máy ô tô rộng rãi và bảo vệ coi xe 24/7.",
    hourlyRate: 80000,
    serviceCost: 25000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1521537634581-0ddea2efe338?w=800",
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
    ],
    coords: { lat: 20.9852, lng: 105.8745 },
  },
  {
    id: "court_swin_badminton",
    name: "Sân Cầu Lông Swin",
    sportType: "badminton",
    address: "Số 36 Ngõ 28 Đường Xuân La, Phường Xuân La, Quận Tây Hồ, Hà Nội",
    district: "Cầu Giấy",
    rating: 4.3,
    reviewsCount: 26,
    priceFrom: 100000,
    priceTo: 150000,
    phone: "0972914307",
    zalo: "0972914307",
    openHours: "05:00 - 23:30",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 100000,
      "Sân đôi": 135000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "100.000đ - 125.000đ" },
      { type: "Sân đôi", price: "125.000đ - 150.000đ" },
    ],
    facilities: ["Điều hòa", "Wifi"],
    amenitiesText: "Điều hòa • Wifi",
    intro: "Sân cầu lông Swin Hà Đông trang bị thảm cao su đúc nguyên khối chống trượt. Hệ thống chiếu sáng dịu mắt, quạt làm mát dịu nhẹ cho cơ thủ. Đầy đủ tiện nghi căng tin, wifi miễn phí và phòng tắm nước nóng.",
    description: "Sân cầu lông Swin Hà Đông trang bị thảm cao su đúc nguyên khối chống trượt. Hệ thống chiếu sáng dịu mắt, quạt làm mát dịu nhẹ cho cơ thủ. Đầy đủ tiện nghi căng tin, wifi miễn phí và phòng tắm nước nóng.",
    hourlyRate: 100000,
    serviceCost: 30000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
      "https://images.unsplash.com/photo-1521537634581-0ddea2efe338?w=800",
    ],
    coords: { lat: 21.0345, lng: 105.7912 },
  },
  {
    id: "court_tp_badminton",
    name: "Sân Cầu Lông TP Badminton",
    sportType: "badminton",
    address: "Số 12 Ngõ 95 Đường Chùa Bộc, Phường Quang Trung, Quận Đống Đa, Hà Nội",
    district: "Thanh Trì",
    rating: 4.8,
    reviewsCount: 13,
    priceFrom: 90000,
    priceTo: 140000,
    phone: "0356118885",
    zalo: "0356118885",
    openHours: "06:00 - 23:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 90000,
      "Sân đôi": 125000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "90.000đ - 115.000đ" },
      { type: "Sân đôi", price: "115.000đ - 140.000đ" },
    ],
    facilities: ["Wifi", "Nhà vệ sinh"],
    amenitiesText: "Wifi • Nhà vệ sinh",
    intro: "Sân cầu lông tập luyện và thi đấu hiện đại tại Bắc Từ Liêm. Mặt sân thảm chuyên dụng bám giày, khoảng cách giữa các sân rộng thoáng an toàn. Hỗ trợ cho thuê vợt, cầu tập và dịch vụ căng dây vợt nhanh chóng.",
    description: "Sân cầu lông tập luyện và thi đấu hiện đại tại Bắc Từ Liêm. Mặt sân thảm chuyên dụng bám giày, khoảng cách giữa các sân rộng thoáng an toàn. Hỗ trợ cho thuê vợt, cầu tập và dịch vụ căng dây vợt nhanh chóng.",
    hourlyRate: 90000,
    serviceCost: 25000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=800",
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
    ],
    coords: { lat: 20.9695, lng: 105.8115 },
  },

  // ── PICKLEBALL COURTS ──
  {
    id: "court_ocean_pickleball",
    name: "Ocean Pickleball Mỹ Đình",
    sportType: "pickleball",
    address: "Số 99 Đường Lê Đức Thọ, Phường Mỹ Đình 2, Quận Nam Từ Liêm, Hà Nội",
    district: "Nam Từ Liêm",
    rating: 4.9,
    reviewsCount: 41,
    priceFrom: 180000,
    priceTo: 300000,
    phone: "0982351888",
    zalo: "0982351888",
    openHours: "06:00 - 22:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 180000,
      "Sân đôi": 250000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "180.000đ - 220.000đ" },
      { type: "Sân đôi", price: "220.000đ - 300.000đ" },
    ],
    facilities: ["Wifi", "Bãi giữ xe", "Thuê vợt"],
    amenitiesText: "Wifi • Bãi giữ xe • Thuê vợt",
    intro: "Cụm sân Pickleball ngoài trời hiện đại bậc nhất khu vực Mỹ Đình. Mặt sân phủ sơn Acrylic 5 lớp chuẩn USA với hai tông màu xanh dương & cam cực kỳ nổi bật. Khu vực Lounge giải khát đẳng cấp sang trọng.",
    description: "Cụm sân Pickleball ngoài trời hiện đại bậc nhất khu vực Mỹ Đình. Mặt sân phủ sơn Acrylic 5 lớp chuẩn USA với hai tông màu xanh dương & cam cực kỳ nổi bật. Khu vực Lounge giải khát đẳng cấp sang trọng.",
    hourlyRate: 180000,
    serviceCost: 40000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800",
      "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800",
    ],
    coords: { lat: 21.0255, lng: 105.7685 },
  },
  {
    id: "court_sixtynine_pickleball",
    name: "SixtyNine Pickleball",
    sportType: "pickleball",
    address: "Số 69 Đường Tứ Liên, Phường Tứ Liên, Quận Tây Hồ, Hà Nội",
    district: "Tây Hồ",
    rating: 5.0,
    reviewsCount: 18,
    priceFrom: 180000,
    priceTo: 280000,
    phone: "0384083333",
    zalo: "0384083333",
    openHours: "05:00 - 23:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 180000,
      "Sân đôi": 240000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "180.000đ - 220.000đ" },
      { type: "Sân đôi", price: "220.000đ - 280.000đ" },
    ],
    facilities: ["Wifi", "Quầy nước"],
    amenitiesText: "Wifi • Quầy nước",
    intro: "Cụm sân Pickleball trong nhà có mái che thoáng mát tại Tây Hồ. Mặt sân phẳng mịn đạt chuẩn thi đấu quốc tế, lưới di động điều chỉnh độ cao chuẩn xác. Cung cấp dịch vụ thuê vợt bóng xịn xò cho người chơi.",
    description: "Cụm sân Pickleball trong nhà có mái che thoáng mát tại Tây Hồ. Mặt sân phẳng mịn đạt chuẩn thi đấu quốc tế, lưới di động điều chỉnh độ cao chuẩn xác. Cung cấp dịch vụ thuê vợt bóng xịn xò cho người chơi.",
    hourlyRate: 180000,
    serviceCost: 35000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800",
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800",
    ],
    coords: { lat: 21.0612, lng: 105.8345 },
  },
  {
    id: "court_ss_pickleball",
    name: "SS Pickleball Club",
    sportType: "pickleball",
    address: "Số 102 Đường Xuân Đỉnh, Phường Xuân Đỉnh, Quận Bắc Từ Liêm, Hà Nội",
    district: "Bắc Từ Liêm",
    rating: 4.8,
    reviewsCount: 8,
    priceFrom: 200000,
    priceTo: 300000,
    phone: "0886244666",
    zalo: "0886244666",
    openHours: "05:00 - 23:30",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 200000,
      "Sân đôi": 260000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "200.000đ - 250.000đ" },
      { type: "Sân đôi", price: "250.000đ - 300.000đ" },
    ],
    facilities: ["Wifi", "Bãi giữ xe"],
    amenitiesText: "Wifi • Bãi giữ xe",
    intro: "Sân Pickleball chuẩn kích thước 6.1m x 13.4m với vạch kẻ Kitchen sắc nét tại Cầu Giấy. Đèn chiếu sáng cao cấp không gây bóng râm. Có HLV hướng dẫn luật chơi Pickleball cho người mới bắt đầu.",
    description: "Sân Pickleball chuẩn kích thước 6.1m x 13.4m với vạch kẻ Kitchen sắc nét tại Cầu Giấy. Đèn chiếu sáng cao cấp không gây bóng râm. Có HLV hướng dẫn luật chơi Pickleball cho người mới bắt đầu.",
    hourlyRate: 200000,
    serviceCost: 40000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800",
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800",
    ],
    coords: { lat: 21.0725, lng: 105.7895 },
  },
  {
    id: "court_cove_pickleball",
    name: "Cove Pickleball",
    sportType: "pickleball",
    address: "117 Trần Duy Hưng, Cầu Giấy, Hà Nội",
    district: "Cầu Giấy",
    rating: 4.4,
    reviewsCount: 9,
    priceFrom: 180000,
    priceTo: 280000,
    phone: "0899912555",
    zalo: "0899912555",
    openHours: "05:00 - 22:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 180000,
      "Sân đôi": 240000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "180.000đ - 220.000đ" },
      { type: "Sân đôi", price: "220.000đ - 280.000đ" },
    ],
    facilities: ["Wifi", "Quầy nước"],
    amenitiesText: "Wifi • Quầy nước",
    intro: "Sân Pickleball thiết kế phong cách resort xanh mát tại Long Biên. Không gian mở thoáng đãng, mặt sân bám giày cực tốt. Khu vực ghế ngồi xem trận chill chill và vô vàn góc chụp ảnh check-in sống ảo cực đẹp.",
    description: "Sân Pickleball thiết kế phong cách resort xanh mát tại Long Biên. Không gian mở thoáng đãng, mặt sân bám giày cực tốt. Khu vực ghế ngồi xem trận chill chill và vô vàn góc chụp ảnh check-in sống ảo cực đẹp.",
    hourlyRate: 180000,
    serviceCost: 35000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800",
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800",
    ],
    coords: { lat: 21.0095, lng: 105.7985 },
  },
  {
    id: "court_songxanh_pickleball",
    name: "Sóng Xanh Pickleball",
    sportType: "pickleball",
    address: "Đức Giang, Long Biên, Hà Nội",
    district: "Long Biên",
    rating: 4.9,
    reviewsCount: 35,
    priceFrom: 180000,
    priceTo: 320000,
    phone: "0931653388",
    zalo: "0931653388",
    openHours: "05:00 - 23:00",
    pitchTypes: ["Sân đơn", "Sân đôi"],
    pricesByPitchType: {
      "Sân đơn": 180000,
      "Sân đôi": 260000,
    },
    priceGuide: [
      { type: "Sân đơn", price: "180.000đ - 240.000đ" },
      { type: "Sân đôi", price: "240.000đ - 320.000đ" },
    ],
    facilities: ["Wifi", "Phòng thay đồ", "Bãi giữ xe"],
    amenitiesText: "Wifi • Phòng thay đồ • Bãi giữ xe",
    intro: "Sân đạt chuẩn thi đấu, cộng đồng chơi đông.",
    hourlyRate: 180000,
    serviceCost: 40000,
    ownerUser: DEFAULT_COURT_OWNER,
    images: [
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800",
    ],
    coords: { lat: 21.0542, lng: 105.8895 },
  },
];

export function CourtDetailModal({ visible, court, onClose, navigation }) {
  if (!court) return null;

  const images = court.images && court.images.length > 0
    ? court.images
    : ["https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800"];

  const handleOpenMap = () => {
    if (court?.mapUrl || court?.googleMapUrl) {
      Linking.openURL(court.mapUrl || court.googleMapUrl).catch(() => {});
      return;
    }

    const name = court?.name || "";
    const address = court?.address || court?.locationName || "";

    let combinedQuery = "";
    if (name && address) {
      if (address.toLowerCase().includes(name.toLowerCase())) {
        combinedQuery = address;
      } else {
        combinedQuery = `${name}, ${address}`;
      }
    } else {
      combinedQuery = name || address;
    }

    if (combinedQuery) {
      const encodedQuery = encodeURIComponent(combinedQuery);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
      Linking.openURL(url).catch((err) => console.log("Open map error:", err));
    } else if (court?.coords?.lat != null && court?.coords?.lng != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${court.coords.lat},${court.coords.lng}`;
      Linking.openURL(url).catch((err) => console.log("Open map error:", err));
    }
  };

  const handleCallPhone = () => {
    if (court.phone) {
      Linking.openURL(`tel:${court.phone.replace(/[^0-9]/g, "")}`);
    }
  };

  const handleGoToOwnerProfile = () => {
    onClose();
    const ownerId = court.ownerUser?._id || court.ownerUser?.id || court.owner?._id || court.owner?.id || "6699a1b2c3d4e5f678901234";
    if (navigation) {
      navigation.navigate("UserProfile", { userId: ownerId });
    }
  };

  const [activeAccordionSport, setActiveAccordionSport] = useState(court?.sportType || "football");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={{ fontSize: 22, color: "#333", fontWeight: "700", paddingHorizontal: 4 }}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {court.name || "Chi tiết sân bãi"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* 1. Carousel ảnh bìa sân */}
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {images.map((imgUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imgUrl }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>{images.length} ảnh sân</Text>
            </View>
          </View>

          <View style={styles.bodyContent}>
            {/* 2. Thông tin chính */}
            <View style={styles.mainInfoCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Text style={[styles.courtTitle, { flex: 1 }]}>{court.name}</Text>
                {(() => {
                  const tagMap = {
                    football: { label: "Bóng đá", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
                    badminton: { label: "Cầu lông", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
                    pickleball: { label: "Pickleball", bg: "#F3E8FF", color: "#7E22CE", border: "#E9D5FF" },
                  };
                  const tag = tagMap[court.sportType] || tagMap.football;
                  return (
                    <View style={{
                      backgroundColor: tag.bg,
                      borderColor: tag.border,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderRadius: 12,
                    }}>
                      <Text style={{ color: tag.color, fontSize: 11, fontWeight: "700" }}>
                        {tag.label}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>
                  Đánh giá: {court.rating || 4.5} ({court.reviewsCount || court.reviewCount || 100} lượt)
                </Text>
              </View>

              <View style={styles.infoLine}>
                <Text style={styles.infoLineText}>Địa chỉ: {court.address || court.district}</Text>
              </View>

              {court.phone ? (
                <TouchableOpacity style={styles.infoLine} onPress={handleCallPhone} activeOpacity={0.7}>
                  <Text style={[styles.infoLineText, { color: "#16A34A", fontWeight: "700" }]}>
                    SĐT liên hệ: {court.phone}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.infoLine}>
                <Text style={styles.infoLineText}>
                  Giờ mở cửa: {court.openHours || `${court.openTime || '06:00'} - ${court.closeTime || '23:00'}`}
                </Text>
              </View>

              {/* Owner Account Contact Box */}
              {(() => {
                const ownerObj = (typeof court.owner === "object" && court.owner !== null)
                  ? court.owner
                  : (court.ownerUser || {
                    name: court.ownerName || (court.name ? `Chủ sân ${court.name}` : "Chủ sân"),
                    picture: court.ownerPicture || null,
                  });
                return (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 10,
                    backgroundColor: "#FFF7ED",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#FFD8A8",
                    marginTop: 6,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      {ownerObj.picture ? (
                        <Image source={{ uri: ownerObj.picture }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{ownerObj.name ? ownerObj.name.charAt(0) : "C"}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#333" }} numberOfLines={1}>
                          {ownerObj.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#888" }}>Tài khoản chủ sân VibeSport</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: ORANGE,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                      }}
                      onPress={handleGoToOwnerProfile}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Nhắn tin</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>

            {/* 3. Giới thiệu */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Giới thiệu sân</Text>
              <Text style={styles.introText}>
                {court.intro || court.description || "Sân bóng cỏ nhân tạo đạt tiêu chuẩn, có hệ thống đèn LED, phòng thay đồ, bãi giữ xe rộng."}
              </Text>
            </View>

            {/* 4. Môn thể thao & Loại sân */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Môn thể thao & Loại sân</Text>
              
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#4B5563", marginBottom: 6 }}>
                Môn thể thao cho thuê:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {[
                  { key: "football", label: "⚽ Bóng đá", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
                  { key: "badminton", label: "🏸 Cầu lông", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
                  { key: "pickleball", label: "🏓 Pickleball", bg: "#F3E8FF", color: "#7E22CE", border: "#E9D5FF" },
                ].filter(s => !court.sportType || court.sportType === s.key || (court.sports && court.sports.includes(s.key))).map((sTag) => (
                  <View key={sTag.key} style={{
                    backgroundColor: sTag.bg,
                    borderColor: sTag.border,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                  }}>
                    <Text style={{ color: sTag.color, fontSize: 12, fontWeight: "700" }}>{sTag.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#4B5563", marginBottom: 6 }}>
                Các loại sân có sẵn:
              </Text>
              <View style={styles.typesRow}>
                {(court.pitchTypes || court.fieldTypes || ["5v5 (Sân 5)", "7v7 (Sân 7)"]).map((type) => (
                  <View key={type} style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      • {type.includes("5") ? "Sân 5 (5v5)" : type.includes("7") ? "Sân 7 (7v7)" : type.includes("11") ? "Sân 11 (11v11)" : type}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 5. Bảng giá thuê sân theo Môn thể thao & Loại sân */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Bảng giá thuê sân </Text>
    

              <View style={{ gap: 8, marginTop: 10 }}>
                {[
                  {
                    sportKey: "football",
                    title: "Bảng giá Môn Bóng đá",
                    bg: "#ECFDF5",
                    borderColor: "#A7F3D0",
                    prices: [
                      { type: "Sân 5 (5v5)", price: "300.000đ - 450.000đ / giờ" },
                      { type: "Sân 7 (7v7)", price: "600.000đ - 900.000đ / giờ" },
                      { type: "Sân 11 (11v11)", price: "1.000.000đ - 1.500.000đ / giờ" },
                    ],
                  },
                  {
                    sportKey: "badminton",
                    title: "Bảng giá Môn Cầu lông",
                    bg: "#EFF6FF",
                    borderColor: "#BFDBFE",
                    prices: [
                      { type: "Sân đơn (1v1)", price: "120.000đ - 180.000đ / giờ" },
                      { type: "Sân đôi (2v2)", price: "200.000đ - 280.000đ / giờ" },
                    ],
                  },
                  {
                    sportKey: "pickleball",
                    title: "Bảng giá Môn Pickleball",
                    bg: "#F3E8FF",
                    borderColor: "#E9D5FF",
                    prices: [
                      { type: "Sân đơn (1v1)", price: "150.000đ - 220.000đ / giờ" },
                      { type: "Sân đôi (2v2)", price: "250.000đ - 350.000đ / giờ" },
                    ],
                  },
                ].filter(s => !court.sportType || court.sportType === s.sportKey || (court.sports && court.sports.includes(s.sportKey))).map((sportMenu) => {
                  const isExpanded = activeAccordionSport === sportMenu.sportKey;
                  return (
                    <View key={sportMenu.sportKey} style={{ borderRadius: 12, overflow: "hidden" }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 12,
                          backgroundColor: sportMenu.bg,
                          borderWidth: 1,
                          borderColor: sportMenu.borderColor,
                          borderRadius: isExpanded ? 0 : 12,
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                        }}
                        onPress={() => setActiveAccordionSport(isExpanded ? null : sportMenu.sportKey)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#111827" }}>
                          {sportMenu.title}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151" }}>
                          {isExpanded ? "▲ Hide" : "▼ Show"}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={{
                          backgroundColor: "#fff",
                          borderWidth: 1,
                          borderTopWidth: 0,
                          borderColor: sportMenu.borderColor,
                          borderBottomLeftRadius: 12,
                          borderBottomRightRadius: 12,
                          padding: 12,
                          gap: 8,
                        }}>
                          {sportMenu.prices
                            .filter((p) => isPitchSupportedByCourt(court, p.type))
                            .map((p, idx) => (
                              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>• {p.type}:</Text>
                                <Text style={{ fontSize: 13, fontWeight: "700", color: ORANGE }}>
                                  {getCourtPitchPriceDisplay(court, p)}
                                </Text>
                              </View>
                            ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 6. Giá Dịch Vụ & Bảng giá menu đồ uống/dụng cụ */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Giá Dịch vụ & Menu Thuê dụng cụ</Text>

              <Text style={{ fontSize: 13, fontWeight: "700", color: "#1F2937", marginBottom: 8 }}>
                Danh mục Giá Dịch Vụ có sẵn:
              </Text>

              <View style={{ gap: 8 }}>
                {SERVICE_MENU.map((item, idx) => (
                  <View key={idx} style={{
                    padding: 10,
                    backgroundColor: "#F9FAFB",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    gap: 4,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
                      {idx + 1}. {item.label}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669", marginTop: 2 }}>
                      Giá thuê: {(item.priceMin / 1000).toFixed(0)}.000đ - {(item.priceMax / 1000).toFixed(0)}.000đ / {item.unit}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 14, marginBottom: 8 }}>
                Ảnh Bảng giá & Dịch vụ niêm yết tại sân:
              </Text>
              <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#111827" }}>
                <Image
                  source={require("../../assets/bang_gia_dich_vu.png")}
                  style={{ width: "100%", height: 230 }}
                  resizeMode="contain"
                />
              </View>
            </View>


            {/* 7. Vị trí */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Vị trí</Text>
              <Text style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
                {court.address}
              </Text>
              <TouchableOpacity style={styles.mapBtn} onPress={handleOpenMap} activeOpacity={0.8}>
                <Text style={styles.mapBtnText}>Xem trên bản đồ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F3F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  carouselContainer: {
    height: 220,
    width: SCREEN_WIDTH,
    position: "relative",
    backgroundColor: "#000",
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: 220,
  },
  imageBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  imageBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  bodyContent: {
    padding: 14,
    gap: 12,
  },
  mainInfoCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  courtTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLineText: {
    fontSize: 13,
    color: "#4B5563",
    flex: 1,
  },
  sectionCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 10,
  },
  introText: {
    fontSize: 13.5,
    color: "#4B5563",
    lineHeight: 20,
  },
  typesRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  noticeBoxText: {
    fontSize: 12,
    color: "#0369A1",
    flex: 1,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  priceType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  priceValue: {
    fontSize: 13,
    fontWeight: "700",
    color: ORANGE,
  },
  mapBtn: {
    backgroundColor: ORANGE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  mapBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

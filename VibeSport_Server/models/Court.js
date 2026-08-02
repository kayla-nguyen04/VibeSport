const { Schema, model } = require('mongoose');

const courtSchema = new Schema(
  {
    name: { type: String, required: true },
    sportType: {
      type: String,
      enum: ['football', 'badminton', 'pickleball'],
      default: 'football',
    },
    sports: [{ type: String }],
    address: { type: String, required: true },
    district: { type: String, default: '' },
    rating: { type: Number, default: 4.5 },
    reviewCount: { type: Number, default: 100 },
    priceFrom: { type: Number, default: 0 },
    priceTo: { type: Number, default: 0 },
    phone: { type: String, default: '' },
    openTime: { type: String, default: '06:00' },
    closeTime: { type: String, default: '23:00' },
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
    },
    fieldTypes: [{ type: String }],
    pitchOptions: [
      {
        pitchType: { type: String }, // '5v5' | '7v7' | '11v11' | '1v1' | '2v2'
        label: { type: String },     // 'Sân 5v5' | 'Sân 7v7' | 'Sân 11v11' | 'Sân 1v1' | 'Sân 2v2'
        pricePerHour: { type: Number },
      },
    ],
    priceTable: [
      {
        sportKey: { type: String }, // 'football' | 'badminton' | 'pickleball'
        fieldType: { type: String }, // 'Sân 5 (5v5)' | 'Sân 7 (7v7)' | 'Sân 11 (11v11)' | 'Sân đơn (1v1)' | 'Sân đôi (2v2)'
        timeSlot: { type: String },
        price: { type: Number },
      },
    ],
    serviceMenuImages: [{ type: String }],
    serviceDetails: {
      drinkService: {
        name: { type: String, default: "Tiền nước uống" },
        priceRange: { type: String, default: "10.000đ - 25.000đ" },
        minPrice: { type: Number, default: 10000 },
        maxPrice: { type: Number, default: 25000 },
        avgPrice: { type: Number, default: 17500 },
      },
      equipmentService: {
        name: { type: String, default: "Tiền thuê dụng cụ" },
        priceRange: { type: String, default: "30.000đ - 60.000đ" },
        minPrice: { type: Number, default: 30000 },
        maxPrice: { type: Number, default: 60000 },
        avgPrice: { type: Number, default: 45000 },
      },
      avgServiceCost: { type: Number, default: 31250 },
    },
    courtCount: { type: Number, default: 0 },
    facilities: [{ type: String }],
    description: { type: String, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    images: [{ type: String }],
    locationCoords: {
      lat: { type: Number, default: 21.0285 },
      lng: { type: Number, default: 105.8542 },
    },
  },
  { timestamps: true }
);

module.exports = model('Court', courtSchema);

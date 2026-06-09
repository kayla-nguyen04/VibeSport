const { Schema, model } = require('mongoose');

const tagSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['sport', 'topic'],
      default: 'sport',
    },
    icon: {
      type: String,
      default: '',
    },
    iconFamily: {
      type: String,
      default: 'Ionicons',
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

tagSchema.index({ category: 1, usageCount: -1 });
tagSchema.index({ name: 'text' });

module.exports = model('Tag', tagSchema);

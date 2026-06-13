const Tag = require('../models/Tag');
const DEFAULT_TAGS = require('../data/defaultTags');

async function seedTags() {
  // Xoá hết tags cũ không nằm trong danh sách cho phép
  const allowedSlugs = DEFAULT_TAGS.map((t) => t.slug);
  await Tag.deleteMany({ slug: { $nin: allowedSlugs } });

  // Upsert các tags được phép
  for (const tag of DEFAULT_TAGS) {
    await Tag.updateOne({ slug: tag.slug }, { $set: tag }, { upsert: true });
  }
}

module.exports = seedTags;

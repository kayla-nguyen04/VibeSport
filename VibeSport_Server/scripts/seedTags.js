const Tag = require('../models/Tag');
const DEFAULT_TAGS = require('../data/defaultTags');

async function seedTags() {
  const allowedSlugs = DEFAULT_TAGS.map((t) => t.slug);
  await Tag.deleteMany({ slug: { $nin: allowedSlugs } });

  for (const tag of DEFAULT_TAGS) {
    await Tag.updateOne({ slug: tag.slug }, { $set: tag }, { upsert: true });
  }
}

module.exports = seedTags;

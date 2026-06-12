const Tag = require('../models/Tag');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseTagsInput(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag).trim()).filter(Boolean);
      }
    } catch {
      return trimmed
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function extractHashtags(content = '') {
  const matches = String(content).match(/#([\p{L}\p{N}_]+)/gu) || [];
  return [...new Set(matches.map((tag) => tag.trim()).filter(Boolean))];
}

function enrichPostTags(post) {
  const obj = typeof post.toObject === 'function' ? post.toObject() : { ...post };

  if (!obj.tags || obj.tags.length === 0) {
    obj.tags = obj.sportType ? [obj.sportType] : [];
  }

  return obj;
}

async function resolveCatalogTags(tagNames) {
  const uniqueNames = [...new Set(tagNames.map((name) => String(name).trim()).filter(Boolean))];

  if (uniqueNames.length === 0) {
    return [];
  }

  const catalogTags = await Tag.find({ name: { $in: uniqueNames } });
  const catalogMap = new Map(catalogTags.map((tag) => [tag.name, tag]));

  return uniqueNames.filter((name) => catalogMap.has(name));
}

async function updateTagUsageCounts(oldTags = [], newTags = []) {
  const oldSet = new Set(oldTags);
  const newSet = new Set(newTags);

  const increment = [...newSet].filter((tag) => !oldSet.has(tag));
  const decrement = [...oldSet].filter((tag) => !newSet.has(tag));

  await Promise.all([
    ...increment.map((name) =>
      Tag.updateOne({ name }, { $inc: { usageCount: 1 } })
    ),
    ...decrement.map((name) =>
      Tag.updateOne({ name, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } })
    ),
  ]);
}

module.exports = {
  slugify,
  parseTagsInput,
  extractHashtags,
  enrichPostTags,
  resolveCatalogTags,
  updateTagUsageCounts,
};

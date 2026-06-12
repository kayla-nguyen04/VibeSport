const Tag = require('../models/Tag');
const { extractHashtags } = require('../utils/tagHelpers');

exports.getTags = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    const tags = await Tag.find(filter).sort({ usageCount: -1, name: 1 });

    res.status(200).json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh mục tag' });
  }
};

exports.suggestTags = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const content = String(req.query.content || '');
    const sportType = String(req.query.sportType || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const hashtagNames = extractHashtags(content);
    const suggestions = new Map();

    const addTag = (tag, score) => {
      const current = suggestions.get(tag.name);
      if (!current || score > current.score) {
        suggestions.set(tag.name, { ...tag.toObject(), score });
      }
    };

    if (sportType) {
      const sportTag = await Tag.findOne({ name: sportType });
      if (sportTag) {
        addTag(sportTag, 100);
      }
    }

    if (hashtagNames.length > 0) {
      const hashtagTags = await Tag.find({ name: { $in: hashtagNames } });
      hashtagTags.forEach((tag) => addTag(tag, 80));
    }

    let query = {};
    if (q) {
      query = {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { slug: { $regex: slugifyQuery(q), $options: 'i' } },
        ],
      };
    }

    const matchedTags = await Tag.find(query)
      .sort({ usageCount: -1, name: 1 })
      .limit(limit);

    matchedTags.forEach((tag, index) => {
      const prefixBoost = q && tag.name.toLowerCase().startsWith(q.toLowerCase()) ? 40 : 0;
      addTag(tag, 50 - index + prefixBoost + tag.usageCount);
    });

    if (suggestions.size === 0 && !q) {
      const popularTags = await Tag.find().sort({ usageCount: -1, name: 1 }).limit(limit);
      popularTags.forEach((tag, index) => addTag(tag, 30 - index));
    }

    const data = [...suggestions.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...tag }) => tag);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Suggest tags error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi gợi ý tag' });
  }
};

function slugifyQuery(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-');
}

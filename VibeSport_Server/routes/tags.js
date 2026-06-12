const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getTags, suggestTags } = require('../controllers/tagController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTags);
router.get('/suggest', suggestTags);

module.exports = router;

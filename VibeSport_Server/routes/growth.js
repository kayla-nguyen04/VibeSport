const express = require('express');
const requireAdmin = require('../middleware/adminAuth');
const User = require('../models/User');
const Post = require('../models/Post');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Message = require('../models/Message');

const router = express.Router();

router.use(requireAdmin);

const formatDateKey = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

function parseDateInput(value) {
  if (!value) return null;
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
}

function getDateRange(fromDate, toDate, defaultDays = 7) {
  let start = parseDateInput(fromDate) || new Date();
  let end = parseDateInput(toDate) || new Date();

  if (!fromDate && !toDate) {
    start.setDate(start.getDate() - (defaultDays - 1));
  }

  if (fromDate && !toDate) {
    end = new Date(start);
  }

  if (!fromDate && toDate) {
    start = new Date(end);
    start.setDate(start.getDate() - (defaultDays - 1));
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return { start, end, dates };
}

// Helper function to get the last 7 dates formatted as DD/MM
function getLast7Days() {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push({
      dateStr: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      rawDate: d,
    });
  }
  return dates;
}

router.get('/', async (request, response) => {
  try {
    const { fromDate, toDate } = request.query;
    if ((fromDate && !parseDateInput(fromDate)) || (toDate && !parseDateInput(toDate))) {
      return response.status(400).json({ success: false, message: 'Ngày lọc không hợp lệ.' });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return response.status(400).json({ success: false, message: 'Từ ngày không được lớn hơn Đến ngày.' });
    }
    const dateRange = getDateRange(fromDate, toDate, 7);

    // 1. Fetch Totals
    const totalUsers = await User.countDocuments({ createdAt: { $gte: dateRange.start, $lte: dateRange.end } });
    const totalPosts = await Post.countDocuments({ createdAt: { $gte: dateRange.start, $lte: dateRange.end } });
    const totalTeams = await Team.countDocuments({ createdAt: { $gte: dateRange.start, $lte: dateRange.end } });
    const totalMatches = await Match.countDocuments({ createdAt: { $gte: dateRange.start, $lte: dateRange.end } });

    // 2. Fetch User distributions
    // Role distribution
    const rolesAggregate = await User.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const rolesDistribution = {};
    rolesAggregate.forEach(item => {
      const roleName = item._id || 'Developer';
      rolesDistribution[roleName] = item.count;
    });

    // Provider distribution
    const providersAggregate = await User.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      { $group: { _id: '$provider', count: { $sum: 1 } } }
    ]);
    const providersDistribution = {};
    providersAggregate.forEach(item => {
      const providerName = item._id || 'email';
      providersDistribution[providerName] = item.count;
    });

    // 3. Aggregate 7-day stats
    const last7Days = dateRange.dates.map((day) => ({
      dateStr: formatDateKey(day),
      rawDate: day,
    }));
    const startDate = new Date(dateRange.start);

    // Fetch daily registrations
    const userRegs = await User.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d/%m', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fetch daily posts
    const postRegs = await Post.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d/%m', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fetch daily messages
    const messageRegs = await Message.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d/%m', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fetch daily matches
    const matchRegs = await Match.aggregate([
      { $match: { createdAt: { $gte: dateRange.start, $lte: dateRange.end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%d/%m', date: '$createdAt', timezone: '+07:00' } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Map aggregates to last 7 days list
    const userRegMap = new Map(userRegs.map(i => [i._id, i.count]));
    const postRegMap = new Map(postRegs.map(i => [i._id, i.count]));
    const messageRegMap = new Map(messageRegs.map(i => [i._id, i.count]));
    const matchRegMap = new Map(matchRegs.map(i => [i._id, i.count]));

    // Construct the timeline array. Add simulation offsets so charts are never empty.
    const timeline = last7Days.map((day, idx) => {
      const dateKey = day.dateStr;

      // Base DB values
      let newUsers = userRegMap.get(dateKey) || 0;
      let newPosts = postRegMap.get(dateKey) || 0;
      let newMessages = messageRegMap.get(dateKey) || 0;
      const newMatches = matchRegMap.get(dateKey) || 0;

      return {
        date: dateKey,
        newUsers,
        newPosts,
        newMessages,
        newMatches,
      };
    });

    // Provide default totals if database is empty/sparse for visualization
    const finalTotalUsers = totalUsers;
    const finalTotalPosts = totalPosts;
    const finalTotalTeams = totalTeams;
    const finalTotalMatches = totalMatches;

    response.json({
      success: true,
      totals: {
        users: finalTotalUsers,
        posts: finalTotalPosts,
        teams: finalTotalTeams,
        matches: finalTotalMatches,
      },
      rolesDistribution,
      providersDistribution,
      timeline,
    });
  } catch (error) {
    console.error('Error calculating growth statistics:', error);
    response.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thống kê tăng trưởng.' });
  }
});

module.exports = router;

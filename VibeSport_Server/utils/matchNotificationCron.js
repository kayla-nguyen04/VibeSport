const cron = require('node-cron');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const User = require('../models/User');

const CRON_SCHEDULE = '* * * * *'; // Run every 1 minute

const parseMatchDateTime = (match, timeStr) => {
  if (!match?.date || !timeStr) return null;
  const time = String(timeStr).trim();
  const dateStr = String(match.date).trim();

  let year, month, day;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    day = parts[0].padStart(2, '0');
    month = parts[1].padStart(2, '0');
    year = parts[2];
  } else if (dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    year = parts[0];
    month = parts[1].padStart(2, '0');
    day = parts[2].padStart(2, '0');
  } else {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    year = d.getFullYear();
    month = String(d.getMonth() + 1).padStart(2, '0');
    day = String(d.getDate()).padStart(2, '0');
  }

  const [h, m] = time.split(':');
  const hours = String(h || '00').padStart(2, '0');
  const mins = String(m || '00').padStart(2, '0');

  const iso = `${year}-${month}-${day}T${hours}:${mins}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

async function processMatchSchedules() {
  const now = new Date();

  try {
    const matches = await Match.find({
      status: { $ne: 'cancelled' },
      teamStatus: { $ne: 'ended' },
    });

    for (const match of matches) {
      const matchStart = parseMatchDateTime(match, match.startTime);
      const matchEnd = parseMatchDateTime(match, match.endTime || '20:30');

      if (!matchStart || !matchEnd) continue;

      const participants = (match.participants || []).map((p) => String(p._id || p));

      // 1. GỬI THÔNG BÁO TRƯỚC 30 PHÚT KHI TRẬN BẮT ĐẦU
      const timeToStartMs = matchStart.getTime() - now.getTime();
      const isWithin30Min = timeToStartMs > 0 && timeToStartMs <= 30 * 60 * 1000;

      if (isWithin30Min && !match.notifiedStart30Min) {
        match.notifiedStart30Min = true;
        await match.save();

        if (participants.length > 0) {
          const creator = match.createdBy
            ? await User.findById(match.createdBy).select('name').lean()
            : null;

          for (const uId of participants) {
            try {
              await Notification.create({
                userId: uId,
                type: 'match_reminder',
                matchId: match._id,
                fromUserId: creator?._id || null,
                message: `⏰ Trận đấu "${match.title}" sẽ bắt đầu sau 30 phút nữa (${match.startTime}). Vui lòng chuẩn bị có mặt đúng giờ!`,
              });

              if (global.io) {
                global.io.to(String(uId)).emit('new_notification', {
                  title: '⏰ Trận đấu sắp bắt đầu',
                  message: `Trận "${match.title}" sẽ bắt đầu lúc ${match.startTime}. Vui lòng chuẩn bị có mặt đúng giờ!`,
                  matchId: match._id,
                });
              }
            } catch (err) {
              console.error('[MatchCron] Notif error:', err.message);
            }
          }
        }
      }

      // 2. TỰ ĐỘNG BẮT ĐẦU TRẬN ĐẤU (teamStatus = "ongoing")
      if (match.teamStatus === 'not_started' && now >= matchStart) {
        match.teamStatus = 'ongoing';
        await match.save();

        if (global.io) {
          global.io.emit('match_updated', { matchId: String(match._id) });
        }
      }

      // 3. TỰ ĐỘNG KẾT THÚC TRẬN ĐẤU SAU 30 PHÚT KHI HẾT GIỜ BÀI VIẾT
      const autoEndThreshold = new Date(matchEnd.getTime() + 30 * 60 * 1000);
      if (now >= autoEndThreshold) {
        match.teamStatus = 'ended';
        match.status = 'completed';
        await match.save();

        if (participants.length > 0) {
          for (const uId of participants) {
            try {
              await Notification.create({
                userId: uId,
                type: 'match_ended',
                matchId: match._id,
                message: `🏆 Trận đấu "${match.title}" đã kết thúc. Hãy dành ít phút để đánh giá thái độ thi đấu của các bạn chơi nhé!`,
              });

              if (global.io) {
                global.io.to(String(uId)).emit('new_notification', {
                  title: '🏆 Trận đấu đã kết thúc',
                  message: `Trận "${match.title}" đã kết thúc. Hãy dành ít phút đánh giá các bạn chơi nhé!`,
                  matchId: match._id,
                });
              }
            } catch (err) {
              console.error('[MatchCron] End Notif error:', err.message);
            }
          }
        }

        if (global.io) {
          global.io.emit('match_updated', { matchId: String(match._id) });
        }
      }
    }
  } catch (err) {
    console.error('[MatchCron] Schedule error:', err);
  }
}

function startMatchNotificationCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await processMatchSchedules();
    } catch (error) {
      console.error('[MatchCron] Run error:', error);
    }
  });

  console.log(`[MatchCron] Scheduled auto start/end & 30-min reminder (${CRON_SCHEDULE})`);
}

module.exports = { startMatchNotificationCron, processMatchSchedules };

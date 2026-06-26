const cron = require('node-cron');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const User = require('../models/User');

const MATCH_NOTIFICATION_WINDOW_MS = 60 * 60 * 1000; 
const CRON_SCHEDULE = '* * * * *';

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseMatchDateTime = (match) => {
  if (!match?.date || !match?.startTime) return null;
  const [day, month, year] = match.date.split('/');
  return new Date(`${year}-${month}-${day}T${match.startTime}:00`);
};

async function sendMatchStartNotifications() {
  console.log('[MatchCron] Running match notification cron job...');
  const now = new Date();
  const windowEnd = new Date(now.getTime() + MATCH_NOTIFICATION_WINDOW_MS);

  const upcomingMatches = await Match.find({
    status: { $in: ['open', 'full'] },
  }).lean();
 
  let notifiedCount = 0;

  for (const match of upcomingMatches) {
    const matchDateTime = parseMatchDateTime(match);
    if (!matchDateTime || isNaN(matchDateTime.getTime())) {
      continue;
    }

    if (matchDateTime > now && matchDateTime <= windowEnd) {
      const alreadyNotified = await Notification.exists({
        type: 'match',
        matchId: match._id,
      });

      if (alreadyNotified) {
        continue;
      }

      const participants = match.participants || [];
      if (participants.length === 0) {
        continue;
      }

      const creator = match.createdBy
        ? await User.findById(match.createdBy).select('name').lean()
        : null;

      const notificationPromises = participants.map((userId) =>
        Notification.create({
          userId,
          type: 'match',
          matchId: match._id,
          fromUserId: creator?._id || null,
          message: `Trận "${match.title}" sẽ bắt đầu lúc ${match.startTime || '--:--'} ngày ${match.date}. Hãy chuẩn bị sẵn sàng!`,
        }).catch((error) => {
          console.error('Create match notification error:', error);
        })
      );

      await Promise.all(notificationPromises);
      notifiedCount += participants.length;

      if (global.io) {
        participants.forEach((userId) => {
          global.io.to(String(userId)).emit('new_notification', {
            type: 'match',
            matchId: match._id,
            message: `Trận "${match.title}" sẽ bắt đầu lúc ${match.startTime || '--:--'} ngày ${match.date}. Hãy chuẩn bị sẵn sàng!`,
          });
        });
      }
    }
  }

  if (notifiedCount > 0) {
    console.log(`[MatchCron] Sent ${notifiedCount} match notification(s) at ${now.toISOString()}`);
  }
}

function startMatchNotificationCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await sendMatchStartNotifications();
    } catch (error) {
      console.error('[MatchCron] Run error:', error);
    }
  });

  console.log(`[MatchCron] Scheduled (${CRON_SCHEDULE})`);
}

module.exports = { startMatchNotificationCron, sendMatchStartNotifications };

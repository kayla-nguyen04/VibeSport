const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function getPresenceFromLastSeen(lastSeenAt) {
  if (!lastSeenAt) {
    return { isOnline: false, lastSeenAt: null };
  }

  const seen = new Date(lastSeenAt);
  const diffMs = Date.now() - seen.getTime();
  const isOnline = diffMs < ONLINE_THRESHOLD_MS;

  return { isOnline, lastSeenAt: seen };
}

module.exports = {
  ONLINE_THRESHOLD_MS,
  getPresenceFromLastSeen,
};

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function isUserOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function formatPresenceLabel(lastSeenAt) {
  if (!lastSeenAt) return '';

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (isNaN(diffMs)) return '';

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  if (diffMs > FORTY_EIGHT_HOURS_MS) return '';

  if (diffMs < ONLINE_THRESHOLD_MS) return 'Đang hoạt động';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;

  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 2) return `Hoạt động ${diffDays} ngày trước`;

  return '';
}

export function getPresenceDisplay(lastSeenAt) {
  const online = isUserOnline(lastSeenAt);
  return {
    isOnline: online,
    label: formatPresenceLabel(lastSeenAt),
  };
}

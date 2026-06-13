import { API_BASE_URL } from '../components/constants/api.example';

async function request(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json?.message || 'Yêu cầu thất bại');
  }

  return json;
}

export const getUserProfileRequest = (userId, token) =>
  request(`/api/users/${userId}`, {}, token);

export const toggleFollowRequest = (userId, token) =>
  request(`/api/users/${userId}/follow`, { method: 'POST' }, token);

export const getUserTeamsRequest = (userId, token) =>
  request(`/api/users/${userId}/teams`, {}, token);

export const getNotificationsRequest = (token) =>
  request('/api/users/notifications', {}, token);

export const updatePresenceRequest = (token) =>
  request('/api/users/presence', { method: 'POST' }, token);

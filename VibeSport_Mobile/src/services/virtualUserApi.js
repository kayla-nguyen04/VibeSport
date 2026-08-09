import { API_BASE_URL } from '../components/constants/api';

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

export const createVirtualUserRequest = (name, picture, token) =>
  request(
    '/api/virtual-users',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, picture }),
    },
    token
  );

export const getVirtualUsersRequest = (token) =>
  request('/api/virtual-users', {}, token);

export const addVirtualUserToMatchRequest = (matchId, virtualUserId, token) =>
  request(
    `/api/virtual-users/add-to-match/${matchId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ virtualUserId }),
    },
    token
  );

export const deleteVirtualUserRequest = (virtualUserId, token) =>
  request(`/api/virtual-users/${virtualUserId}`, { method: 'DELETE' }, token);

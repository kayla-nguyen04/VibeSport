import { API_BASE_URL } from '../components/constants/api';

async function request(path, options = {}, token = null) {
  const headers = {
    ...(options.headers ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error('Không thể kết nối đến máy chủ. Kiểm tra lại kết nối mạng.');
  }

  const text = await response.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`Lỗi máy chủ (${response.status}): Phản hồi không hợp lệ`);
  }

  if (!response.ok) {
    throw new Error(json?.message || `Lỗi ${response.status}: ${response.statusText}`);
  }
  return json;
}

export const getNotificationsRequest = async (token, page = 1, limit = 20) => {
  return request(`/api/notifications?page=${page}&limit=${limit}`, {}, token);
};

export const getUnreadCountRequest = async (token) => {
  return request('/api/notifications/unread-count', {}, token);
};

export const markAllReadRequest = async (token) => {
  return request('/api/notifications/read-all', { method: 'PUT' }, token);
};

export const markOneReadRequest = async (token, notificationId) => {
  return request(`/api/notifications/${notificationId}/read`, { method: 'PUT' }, token);
};

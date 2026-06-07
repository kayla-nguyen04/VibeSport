import { API_BASE_URL } from '../components/constants/api';

/**
 * Common request helper with Authorization token
 */
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

  // Đọc body dưới dạng text trước, sau đó mới parse JSON
  // Tránh crash khi server trả về HTML thay vì JSON
  const text = await response.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    // Server trả về HTML (trang lỗi) thay vì JSON
    throw new Error(`Lỗi máy chủ (${response.status}): Phản hồi không hợp lệ`);
  }

  if (!response.ok) {
    throw new Error(json?.message || `Lỗi ${response.status}: ${response.statusText}`);
  }
  return json;
}

// ─── POST API ENDPOINTS ───────────────────────────────────────

export const getPostsRequest = async (page = 1, limit = 10, token = null) => {
  return request(`/api/posts?page=${page}&limit=${limit}`, {}, token);
};

export const createPostRequest = async (formData, token = null) => {
  return request('/api/posts', {
    method: 'POST',
    body: formData,
    // Note: Do not set Content-Type header manually when sending FormData,
    // the browser/react-native fetch will automatically set it with boundary.
  }, token);
};

export const likePostRequest = async (id, token = null) => {
  return request(`/api/posts/${id}/like`, { method: 'POST' }, token);
};

export const commentPostRequest = async (id, content, token = null) => {
  return request(`/api/posts/${id}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  }, token);
};

export const deletePostRequest = async (id, token = null) => {
  return request(`/api/posts/${id}`, { method: 'DELETE' }, token);
};

export const updatePostRequest = async (id, formData, token = null) => {
  return request(`/api/posts/${id}`, {
    method: 'PUT',
    body: formData,
  }, token);
};

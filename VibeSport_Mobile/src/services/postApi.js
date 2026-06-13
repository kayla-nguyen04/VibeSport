import { API_BASE_URL } from '../components/constants/api.example';

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

export const getPostsRequest = async (page = 1, limit = 10, token = null, tag = null, userId = null) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (tag) params.append('tag', tag);
  if (userId) params.append('userId', userId);

  return request(`/api/posts?${params.toString()}`, {}, token);
};

export const createPostRequest = async (formData, token = null) => {
  return request('/api/posts', {
    method: 'POST',
    body: formData,
    // Note: Do not set Content-Type header manually when sending FormData,
    // the browser/react-native fetch will automatically set it with boundary.
  }, token);
};

export const likePostRequest = async (id, token = null, reactionType = 'like') => {
  return request(`/api/posts/${id}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reactionType }),
  }, token);
};

export const unlikePostRequest = async (id, token = null) => {
  return request(`/api/posts/${id}/like`, { method: 'DELETE' }, token);
};

export const getPostLikesRequest = async (id, token = null) => {
  return request(`/api/posts/${id}/likes`, {}, token);
};

export const savePostRequest = async (postId, token = null) => {
  return request(`/api/saved-posts/${postId}`, { method: 'POST' }, token);
};

export const unsavePostRequest = async (postId, token = null) => {
  return request(`/api/saved-posts/${postId}`, { method: 'DELETE' }, token);
};

export const getSavedPostsRequest = async (token = null) => {
  return request('/api/saved-posts', {}, token);
};

export const commentPostRequest = async (id, payload, token = null) => {
  if (payload instanceof FormData) {
    return request(`/api/posts/${id}/comment`, {
      method: 'POST',
      body: payload,
    }, token);
  } else {
    const bodyObj = typeof payload === 'string' ? { content: payload } : payload;
    return request(`/api/posts/${id}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyObj),
    }, token);
  }
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

export const getPostByIdRequest = async (id, token = null) => {
  return request(`/api/posts/${id}`, {}, token);
};

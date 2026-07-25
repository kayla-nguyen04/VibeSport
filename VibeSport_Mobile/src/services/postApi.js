import { API_BASE_URL } from '../components/constants/api';

/**
 * Common request helper with Authorization token
 */
// Timeout mặc định: 30s cho request thường, 60s cho upload file
const DEFAULT_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 60000;
const API_BASE_URL_CANDIDATES = Array.from(new Set([
  API_BASE_URL,
  'http://10.0.2.2:4000',
  'http://localhost:4000',
].filter(Boolean)));

async function request(path, options = {}, token = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let lastError = null;

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    const headers = {
      ...(options.headers ?? {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const text = await response.text().catch(() => '');
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        throw Object.assign(new Error(`Lỗi máy chủ (${response.status}): Phản hồi không hợp lệ`), { _isHttpError: true });
      }

      if (!response.ok) {
        throw Object.assign(new Error(json?.message || `Lỗi ${response.status}: ${response.statusText}`), { _isHttpError: true });
      }

      return json;
    } catch (err) {
      if (err.isHttpError) {
        throw err;
      }
      lastError = err;
      // Chỉ thử IP khác nếu là lỗi mạng thật sự (không có response từ server).
      // HTTP error (400, 409, 401...) có response → throw ngay, không loop tiếp.
      if (err._isHttpError) {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error('Yêu cầu bị hết thời gian. Vui lòng thử lại.');
  }

  throw new Error(`Không thể kết nối đến máy chủ. Đã thử: ${API_BASE_URL_CANDIDATES.join(', ')}.`);
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

export const searchPostsRequest = async (keyword = '', tag = null, page = 1, limit = 10, token = null) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (keyword) params.append('keyword', keyword);
  if (tag) params.append('tag', tag);

  return request(`/api/posts?${params.toString()}`, {}, token);
};

export const createPostRequest = async (formData, token = null) => {
  // Dùng timeout dài hơn cho upload file
  return request('/api/posts', {
    method: 'POST',
    body: formData,
    // Note: Do not set Content-Type header manually when sending FormData,
    // the browser/react-native fetch will automatically set it with boundary.
  }, token, UPLOAD_TIMEOUT_MS);
};

export const likePostRequest = async (id, token = null, reactionType = 'vibe') => {
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

export const likeCommentRequest = async (postId, commentId, token = null) => {
  return request(`/api/posts/${postId}/comments/${commentId}/like`, { method: 'POST' }, token);
};

export const deletePostRequest = async (id, token = null) => {
  return request(`/api/posts/${id}`, { method: 'DELETE' }, token);
};

export const updatePostRequest = async (id, formData, token = null) => {
  // Dùng timeout dài hơn cho upload file
  return request(`/api/posts/${id}`, {
    method: 'PUT',
    body: formData,
  }, token, UPLOAD_TIMEOUT_MS);
};

export const getPostByIdRequest = async (id, token = null) => {
  return request(`/api/posts/${id}`, {}, token);
};

export const reportPostRequest = async (postId, reason, token = null) => {
  return request(`/api/posts/${postId}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  }, token);
};

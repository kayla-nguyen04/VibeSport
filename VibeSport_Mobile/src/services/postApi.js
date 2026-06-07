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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || `API request failed with status ${response.status}`);
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

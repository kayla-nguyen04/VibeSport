import { API_BASE_URL } from '../components/constants/api.example';

async function request(path, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.message || 'Yêu cầu thất bại');
  }

  return json;
}

export const getTagsRequest = (token, category) => {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return request(`/api/tags${query}`, token);
};

export const suggestTagsRequest = (token, { q = '', content = '', sportType = '', limit = 8 } = {}) => {
  const params = new URLSearchParams();
  if (q) params.append('q', q);
  if (content) params.append('content', content);
  if (sportType) params.append('sportType', sportType);
  params.append('limit', String(limit));
  return request(`/api/tags/suggest?${params.toString()}`, token);
};

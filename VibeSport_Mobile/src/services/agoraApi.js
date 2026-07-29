import { API_BASE_URL } from '../components/constants/api';

const REQUEST_TIMEOUT_MS = 15000;

async function request(path, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
      signal: controller.signal,
    });

    const text = await response.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      const serverMessage = data?.message || text || response.statusText || 'Yêu cầu thất bại.';
      throw new Error(`${response.status} ${response.statusText}: ${serverMessage}`);
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Gọi API server để tạo Agora RTC token.
 *
 * @param {string} jwtToken - JWT auth token của user hiện tại (từ Redux state.auth.token)
 * @param {object} payload  - { channelName: string, uid: string (MongoDB ObjectId) }
 * @returns {Promise<{ success: boolean, token: string, appId: string, channelName: string, uid: number }>}
 */
export function generateAgoraTokenRequest(jwtToken, payload) {
  return request('/api/agora/token', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json', 
      Authorization: `Bearer ${jwtToken}`,
    },
  });
}

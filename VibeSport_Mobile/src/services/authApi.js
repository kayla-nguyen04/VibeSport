import { API_BASE_URL } from '../components/constants/api';

const REQUEST_TIMEOUT_MS = 15000;

async function request(path, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error(
        `Hết thời gian chờ kết nối (${API_BASE_URL}). Kiểm tra server đang chạy và IP đúng trong api.js.`
      );
    }
    const msg = err?.message || '';
    const isNetworkError =
      msg.includes('Network request failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Network Error') ||
      err?.name === 'TypeError';

    if (isNetworkError) {
      throw new Error(
        `Không kết nối được máy chủ (${API_BASE_URL}). ` +
          'Kiểm tra: server đang chạy, điện thoại cùng Wi‑Fi, IP đúng trong api.js, tường lửa mở cổng 4000.'
      );
    }
    throw new Error(msg || 'Network request failed.');
  } finally {
    clearTimeout(timeoutId);
  }

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
}

export function registerRequest(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginRequest(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function forgotPasswordRequest(payload) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function googleLoginRequest(payload) {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProfileRequest(payload) {
  return request('/auth/update-profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

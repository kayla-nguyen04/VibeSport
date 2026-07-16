import { API_BASE_URL } from '../components/constants/api';

const REQUEST_TIMEOUT_MS = 15000;
const PROFILE_UPDATE_TIMEOUT_MS = 60000;
const API_BASE_URL_CANDIDATES = Array.from(new Set([
  API_BASE_URL,
  'http://10.0.2.2:4000',
  'http://localhost:4000',
  'http://192.168.1.5:4000',
].filter(Boolean)));

async function request(path, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  let lastError = null;

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
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
        const httpError = new Error(`${serverMessage}`);
        httpError.isHttpError = true;
        throw httpError;
      }

      return data;
    } catch (err) {
      if (err.isHttpError) {
        throw err; // Stop trying other URLs if we actually reached the server
      }
      lastError = err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error(
      `Hết thời gian chờ kết nối (${API_BASE_URL_CANDIDATES.join(' | ')}). Kiểm tra server đang chạy và IP đúng trong api.example.js.`
    );
  }

  const msg = lastError?.message || 'Network request failed.';
  const isNetworkError =
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Network Error') ||
    msg.includes('Không thể kết nối');

  if (isNetworkError) {
    throw new Error(
      `Không kết nối được máy chủ. Đã thử: ${API_BASE_URL_CANDIDATES.join(', ')}. Kiểm tra server đang chạy, điện thoại cùng Wi‑Fi, hoặc IP đúng trong api.example.js.`
    );
  }

  throw new Error(msg || 'Network request failed.');
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
  const hasPicture = payload?.picture != null;
  return request(
    '/auth/update-profile',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    hasPicture ? PROFILE_UPDATE_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  );
}

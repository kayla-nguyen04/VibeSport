import { API_BASE_URL } from '../components/constants/api';

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });
  } catch (err) {
    throw new Error(err.message || 'Network request failed.');
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

import { API_BASE_URL } from '../components/constants/api';

async function request(path, options = {}, token) {
  const headers = {
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json?.message || 'Yêu cầu thất bại');
  }

  return json;
}

export const getConversationsRequest = (token) =>
  request('/api/chat/conversations', {}, token);

export const getChatUnreadCountRequest = (token) =>
  request('/api/chat/unread-count', {}, token);

export const createOrGetConversationRequest = (params, token) => {
  const body = typeof params === 'string' ? { recipientId: params } : params;
  return request('/api/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
};

export const getMessagesRequest = (conversationId, token, page = 1, limit = 30) =>
  request(`/api/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, {}, token);

export const sendMessageRequest = (conversationId, content, token) =>
  request(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }, token);

export const markConversationReadRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
  }, token);

export const acceptConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/accept`, {
    method: 'PUT',
  }, token);

export const blockConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/block`, {
    method: 'PUT',
  }, token);

export const unblockConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/unblock`, {
    method: 'PUT',
  }, token);

export const deleteConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}`, {
    method: 'DELETE',
  }, token);

export const muteConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/mute`, {
    method: 'PUT',
  }, token);

export const unmuteConversationRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/unmute`, {
    method: 'PUT',
  }, token);

export const deletePendingMessagesRequest = (conversationId, token) =>
  request(`/api/chat/conversations/${conversationId}/delete-pending`, {
    method: 'PUT',
  }, token);

export const updateGroupInfoRequest = (conversationId, formData, token) =>
  request(`/api/chat/conversations/${conversationId}/group-info`, {
    method: 'PUT',
    body: formData,
  }, token);

export const addParticipantsRequest = (conversationId, userIds, token) =>
  request(`/api/chat/conversations/${conversationId}/participants`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  }, token);

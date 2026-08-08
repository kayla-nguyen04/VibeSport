import { API_BASE_URL } from '../components/constants/api';

const AI_CHAT_URL = `${API_BASE_URL}/api/ai/chat`;

export async function sendAiChatRequest(prompt, token) {
  try {
    const response = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || `Lỗi từ Server (${response.status})`);
    }

    return result.data; // { replyText, suggestedMatches }
  } catch (error) {
    console.error('sendAiChatRequest error:', error.message || error);
    throw error;
  }
}
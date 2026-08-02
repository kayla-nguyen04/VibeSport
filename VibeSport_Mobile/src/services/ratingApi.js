import { API_BASE_URL } from '../components/constants/api';

const RATINGS_URL = `${API_BASE_URL}/api/ratings`;

export async function submitMatchRatings(matchId, ratings, token) {
  try {
    const response = await fetch(RATINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ matchId, ratings }),
    });

    const text = await response.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Lỗi máy chủ Backend (${response.status}). Kiểm tra xem đã app.use('/api/ratings') chưa.`);
    }

    if (!response.ok) {
      throw new Error(result.message || 'Đánh giá thất bại.');
    }
    return result;
  } catch (error) {
    throw new Error(error.message || 'Không thể kết nối máy chủ đánh giá.');
  }
}

export async function getUserRatingsRequest(userId, token) {
  try {
    const response = await fetch(`${RATINGS_URL}/user/${userId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Lỗi máy chủ khi tải danh sách đánh giá.');
    }

    if (!response.ok) {
      throw new Error(result.message || 'Không thể lấy danh sách đánh giá.');
    }
    return result.data;
  } catch (error) {
    throw new Error(error.message || 'Lỗi mạng khi tải đánh giá.');
  }
}
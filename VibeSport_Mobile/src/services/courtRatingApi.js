import { API_BASE_URL } from '../components/constants/api';

const COURT_RATINGS_URL = `${API_BASE_URL}/api/court-ratings`;

export async function submitCourtRating(courtId, stars, comment, token) {
  try {
    const response = await fetch(COURT_RATINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courtId, stars, comment }),
    });

    const text = await response.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Lỗi máy chủ Backend (${response.status}). Kiểm tra xem đã app.use('/api/court-ratings') chưa.`);
    }

    if (!response.ok) {
      throw new Error(result.message || 'Đánh giá sân thất bại.');
    }
    return result;
  } catch (error) {
    throw new Error(error.message || 'Không thể kết nối máy chủ đánh giá sân.');
  }
}

export async function getCourtRatingsRequest(courtId, token) {
  try {
    const response = await fetch(`${COURT_RATINGS_URL}/court/${courtId}`, {
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
      throw new Error('Lỗi máy chủ khi tải danh sách đánh giá sân.');
    }

    if (!response.ok) {
      throw new Error(result.message || 'Không thể lấy danh sách đánh giá sân.');
    }
    return result.data;
  } catch (error) {
    throw new Error(error.message || 'Lỗi mạng khi tải đánh giá sân.');
  }
}

export async function getMyCourtRating(courtId, token) {
  try {
    const response = await fetch(`${COURT_RATINGS_URL}/court/${courtId}/my`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await response.text();
    let result = null;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      if (response.ok) {
        console.warn('[courtRatingApi] getMyCourtRating: non-JSON response, returning null');
        return null;
      }
      throw new Error(`Lỗi máy chủ (${response.status})`);
    }

    if (!response.ok) throw new Error(result.message || 'Không thể kiểm tra đánh giá sân.');
    return result.data || null;
  } catch (error) {
    throw new Error(error.message || 'Lỗi mạng khi kiểm tra đánh giá sân.');
  }
}

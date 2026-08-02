import { API_BASE_URL } from "../components/constants/api";
import { COURT_DIRECTORY } from "../components/CourtDetailModal";

/**
 * Fetch courts from MongoDB backend API (Chỉ lấy các sân đang active, ẩn/xóa sẽ không xuất hiện khi tạo trận)
 * @param {string} sportType 'football' | 'badminton' | 'pickleball'
 */
export async function getCourtsRequest(sportType) {
  try {
    const params = new URLSearchParams();
    if (sportType) params.append("sportType", sportType);
    params.append("status", "active"); // Chỉ hiển thị sân đang hoạt động

    const url = `${API_BASE_URL}/api/courts?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        const activeCourts = data.data.filter((c) => c.status !== "hidden");
        if (activeCourts.length > 0) {
          return activeCourts;
        }
      }
    }
  } catch (err) {
    console.log("[courtService] API fetch error, fallback to static directory:", err?.message);
  }
  // Fallback to static COURT_DIRECTORY
  return COURT_DIRECTORY.filter((c) => {
    if (c.status === "hidden") return false;
    if (!sportType) return true;
    return c.sportType === sportType || (Array.isArray(c.sports) && c.sports.includes(sportType));
  });
}

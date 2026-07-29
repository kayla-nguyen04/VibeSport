import { API_BASE_URL } from "../components/constants/api";
import { COURT_DIRECTORY } from "../components/CourtDetailModal";

/**
 * Fetch courts from MongoDB backend API
 * @param {string} sportType 'football' | 'badminton' | 'pickleball'
 */
export async function getCourtsRequest(sportType) {
  try {
    const url = `${API_BASE_URL}/api/courts${sportType ? `?sportType=${sportType}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
    }
  } catch (err) {
    console.log("[courtService] API fetch error, fallback to static directory:", err?.message);
  }
  // Fallback to static COURT_DIRECTORY
  return COURT_DIRECTORY.filter((c) => !sportType || c.sportType === sportType);
}

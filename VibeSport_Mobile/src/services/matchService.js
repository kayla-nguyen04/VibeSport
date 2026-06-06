const API_URL = "http://10.0.2.2:4000/api";

export async function createMatch(matchData) {
  const response = await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(matchData),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Tạo trận đấu thất bại");
  }

  return result.data;
}

export async function getMatches(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sport) params.append("sport", filters.sport);
  if (filters.q) params.append("q", filters.q);
  if (filters.area) params.append("area", filters.area);
  if (filters.startTime) params.append("startTime", filters.startTime);
  if (filters.createdBy) params.append("createdBy", filters.createdBy);

  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`${API_URL}/matches${query}`);

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Không lấy được danh sách trận đấu");
  }

  return result.data;
}

export async function joinMatch(matchId, userId) {
  const response = await fetch(`${API_URL}/matches/${matchId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Tham gia trận đấu thất bại");
  }

  return result.data;
}

export async function leaveMatch(matchId, userId) {
  const response = await fetch(`${API_URL}/matches/${matchId}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Rút khỏi trận đấu thất bại");
  }

  return result.data;
}

export async function deleteMatch(matchId) {
  const response = await fetch(`${API_URL}/matches/${matchId}`, {
    method: "DELETE",
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Xóa trận đấu thất bại");
  }

  return result.data;
}
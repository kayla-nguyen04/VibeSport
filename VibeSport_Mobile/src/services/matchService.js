import { API_BASE_URL } from '../components/constants/api';

const MATCHES_URL = `${API_BASE_URL}/api/matches`;

async function matchRequest(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(
      `Không kết nối được máy chủ (${API_BASE_URL}). Kiểm tra server đang chạy và IP trong api.example.js.`
    );
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Yêu cầu thất bại");
  }

  return result.data;
}

export async function createMatch(matchData) {
  return matchRequest(MATCHES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(matchData),
  });
}

export async function getMatches(filters = {}) {
  const params = new URLSearchParams();
  if (filters.sport) params.append("sport", filters.sport);
  if (filters.q) params.append("q", filters.q);
  if (filters.area) params.append("area", filters.area);
  if (filters.startTime) params.append("startTime", filters.startTime);
  if (filters.createdBy) params.append("createdBy", filters.createdBy);

  const query = params.toString() ? `?${params.toString()}` : "";

  return matchRequest(`${MATCHES_URL}${query}`);
}

export async function requestJoinMatch(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/request-join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function cancelJoinRequest(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/cancel-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function acceptJoinMatch(matchId, ownerId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/accept-join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId }),
  });
}

export async function rejectJoinMatch(matchId, ownerId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/reject-join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId }),
  });
}

export async function joinMatch(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function leaveMatch(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/leave`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function getMatchById(matchId) {
  return matchRequest(`${MATCHES_URL}/${matchId}`);
}

export async function updateMatch(matchId, matchData) {
  return matchRequest(`${MATCHES_URL}/${matchId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(matchData),
  });
}

export async function deleteMatch(matchId) {
  return matchRequest(`${MATCHES_URL}/${matchId}`, {
    method: "DELETE",
  });
}

export async function updateTeamStatus(matchId, status) {
  return matchRequest(`${MATCHES_URL}/${matchId}/team-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

export async function kickTeamMember(matchId, userId, reason) {
  return matchRequest(`${MATCHES_URL}/${matchId}/kick-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, reason }),
  });
}

export async function inviteTeamMember(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/invite-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function updateMemberRole(matchId, userId, role) {
  return matchRequest(`${MATCHES_URL}/${matchId}/update-member-role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, role }),
  });
}

export async function updateMemberPosition(matchId, userId, positionId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/update-member-position`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, positionId }),
  });
}
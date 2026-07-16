import { API_BASE_URL } from '../components/constants/api';

const MATCHES_URL = `${API_BASE_URL}/api/matches`;

async function matchRequest(url, options = {}, token = null) {
  let response;
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
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

export async function createMatch(matchData, token = null) {
  return matchRequest(
    MATCHES_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(matchData),
    },
    token
  );
}

// ĐÃ CẢI THIỆN: Bổ sung tham số phân tách participantId để quét toàn bộ trận đấu tham gia
export async function getMatches(filters = {}, token = null) {
  const params = new URLSearchParams();
  if (filters.sport) params.append("sport", filters.sport);
  if (filters.q) params.append("q", filters.q);
  if (filters.area) params.append("area", filters.area);
  if (filters.startTime) params.append("startTime", filters.startTime);
  if (filters.createdBy) params.append("createdBy", filters.createdBy);
  if (filters.participantId) params.append("participantId", filters.participantId); // Thêm tham số lọc người tham gia

  const query = params.toString() ? `?${params.toString()}` : "";

  return matchRequest(`${MATCHES_URL}${query}`, {}, token);
}

export async function requestJoinMatch(matchId, userId, selectedPositionIds = [], token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/request-join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, selectedPositionIds }),
    },
    token
  );
}

export async function cancelJoinRequest(matchId, userId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/cancel-request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
    token
  );
}

export async function acceptJoinMatch(matchId, ownerId, userId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/accept-join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ownerId, userId }),
    },
    token
  );
}

export async function rejectJoinMatch(matchId, ownerId, userId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/reject-join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ownerId, userId }),
    },
    token
  );
}

export async function joinMatch(matchId, userId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
    token
  );
}

export async function leaveMatch(matchId, userId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}/leave`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
    token
  );
}

export async function getMatchById(matchId, token = null) {
  return matchRequest(`${MATCHES_URL}/${matchId}`, {}, token);
}

export async function updateMatch(matchId, matchData, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(matchData),
    },
    token
  );
}

export async function deleteMatch(matchId, token = null) {
  return matchRequest(
    `${MATCHES_URL}/${matchId}`,
    {
      method: "DELETE",
    },
    token
  );
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

export async function kickTeamMember(matchId, ownerId, userId, reason) {
  return matchRequest(`${MATCHES_URL}/${matchId}/kick-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId, reason }),
  });
}

export async function inviteTeamMember(matchId, inviterId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/invite-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId: inviterId, inviterId, userId }),
  });
}

export async function acceptInvite(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/accept-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function approveInvite(matchId, ownerId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/approve-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId }),
  });
}

export async function addTeamMember(matchId, ownerId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/add-member`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId }),
  });
}

export async function updateMemberRole(matchId, ownerId, userId, role) {
  return matchRequest(`${MATCHES_URL}/${matchId}/update-member-role`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId, role }),
  });
}

export async function updateMemberPosition(matchId, ownerId, userId, positionId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/update-member-position`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerId, userId, positionId }),
  });
}

export async function acceptTeamInvite(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/accept-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function rejectTeamInvite(matchId, userId) {
  return matchRequest(`${MATCHES_URL}/${matchId}/reject-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}
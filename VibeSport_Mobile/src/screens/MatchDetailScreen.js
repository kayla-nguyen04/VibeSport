import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { submitMatchRatings, getMyMatchRatings } from "../services/ratingApi";
import {
  getMatchById,
  deleteMatch,
  acceptDeleteMatch,
  rejectDeleteMatch,
  requestJoinMatch,
  joinMatch,
  cancelJoinRequest,
  acceptJoinMatch,
  rejectJoinMatch,
  leaveMatch,
  kickTeamMember,
  inviteTeamMember,
  acceptInvite,
  approveInvite,
  acceptTeamInvite,
  rejectTeamInvite,
  updateTeamStatus,
  updateMemberPosition,
} from "../services/matchService";
import { getFollowingListRequest } from "../services/userApi";
import { getSocket } from "../hooks/useSocket";
import { CourtDetailModal, COURT_DIRECTORY } from "../components/CourtDetailModal";
import { VirtualAccountModal } from "../components/VirtualAccountModal";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { BackButton } from "../components/BackButton";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TagIcon } from "../components/TagIcon";
import { primary } from "../theme";
import { getRequiredPlayersBySport, getMatchCostValue } from "../utils/matchRules";

const ORANGE = primary.DEFAULT; // '#FF6B3D'
const SPORT_TAG_MAP = { football: "Bóng đá", badminton: "Cầu lông", pickleball: "Pickleball" };
const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

// ─── Football position definitions ────────
const TEAM1_POSITIONS = [
  { id: "t1_gk",  label: "Thủ môn", role: "goalkeeper" },
  { id: "t1_lb",  label: "Hậu vệ",  role: "defender" },
  { id: "t1_cb1", label: "Hậu vệ",  role: "defender" },
  { id: "t1_cb2", label: "Hậu vệ",  role: "defender" },
  { id: "t1_rb",  label: "Hậu vệ",  role: "defender" },
  { id: "t1_dm1", label: "Tiền vệ",  role: "midfielder" },
  { id: "t1_dm2", label: "Tiền vệ",  role: "midfielder" },
  { id: "t1_lm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t1_am",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t1_rm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t1_st",  label: "Tiền đạo", role: "striker" },
];

const TEAM2_POSITIONS = [
  { id: "t2_st",  label: "Tiền đạo", role: "striker" },
  { id: "t2_lm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_am",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_rm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_dm1", label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_dm2", label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_lb",  label: "Hậu vệ",  role: "defender" },
  { id: "t2_cb1", label: "Hậu vệ",  role: "defender" },
  { id: "t2_cb2", label: "Hậu vệ",  role: "defender" },
  { id: "t2_rb",  label: "Hậu vệ",  role: "defender" },
  { id: "t2_gk",  label: "Thủ môn", role: "goalkeeper" },
];

const ALL_POSITIONS = [...TEAM1_POSITIONS, ...TEAM2_POSITIONS];

const getSinglePositionLabel = (posId) => {
  if (!posId) return "";
  const pos = ALL_POSITIONS.find((item) => item.id === posId);
  if (pos) {
    const teamNumber = pos.id.startsWith("t1_") ? 1 : 2;
    return `${pos.label} Đội ${teamNumber}`;
  }
  if (typeof posId === "string" && posId.includes("bench")) {
    const teamNumber = posId.startsWith("t1_") ? 1 : 2;
    return `Dự bị Đội ${teamNumber}`;
  }
  return posId;
};

const getPositionDisplayLabel = (posId) => {
  if (!posId) return "";
  if (typeof posId === "string" && posId.includes(",")) {
    const labels = posId
      .split(",")
      .map((id) => getSinglePositionLabel(id.trim()))
      .filter(Boolean);
    return Array.from(new Set(labels)).join(", ");
  }
  return getSinglePositionLabel(posId);
};

const FOOTBALL_FORMATS = {
  10: { label: "5 vs 5", playerCountPerTeam: 5 },
  14: { label: "7 vs 7", playerCountPerTeam: 7 },
  22: { label: "11 vs 11", playerCountPerTeam: 11 },
};

const RACKET_FORMATS = {
  2: { label: "1 vs 1", playerCountPerSide: 1 },
  4: { label: "2 vs 2", playerCountPerSide: 2 },
};

const getFormatLabel = (sport, maxPlayers) => {
  if (!maxPlayers) return "";
  if (sport === "football") {
    return FOOTBALL_FORMATS[maxPlayers]?.label || "";
  }
  return RACKET_FORMATS[maxPlayers]?.label || "";
};

const ROLE_LABELS = {
  goalkeeper: "Thủ môn",
  defender: "Hậu vệ",
  midfielder: "Tiền vệ",
  striker: "Tiền đạo",
  bench: "Dự bị",
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const formatCost = (c) => {
  if (!c || c === 0) return "Miễn phí";
  const formatted = c.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted} vnd/ người`;
};

const formatNumberWithDots = (val) => {
  if (val == null || val === "") return "";
  const cleaned = String(val).replace(/\D/g, "");
  if (!cleaned) return String(val);
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const formatServiceCostDisplay = (cost) => {
  if (cost == null || cost === "" || cost === 0 || cost === "0") return "10.000 – 50.000 VND";
  const costStr = String(cost).trim();
  if (costStr.includes("-")) {
    const parts = costStr.split("-");
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) {
      return `${p1.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} – ${p2.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND`;
    }
  }
  const num = parseInt(costStr, 10);
  if (!isNaN(num) && num > 0) {
    return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND`;
  }
  return costStr;
};

const getRelativeTime = (dateStr) => {
  try {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  } catch (e) {
    return "Mới đăng";
  }
};

const formatTimeLabel = (timeStr, matchObj) => {
  if (matchObj && matchObj.time && matchObj.time.includes("-")) return matchObj.time;
  const start = (matchObj && matchObj.startTime) || timeStr || "19:00";
  let end = matchObj && matchObj.endTime;
  if (!end) {
    const [h, m] = start.split(":").map(Number);
    const totalM = (h || 19) * 60 + (m || 0) + 90;
    const endH = String(Math.floor(totalM / 60) % 24).padStart(2, "0");
    const endM = String(totalM % 60).padStart(2, "0");
    end = `${endH}:${endM}`;
  }
  return `${start} - ${end}`;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
};

const getDayLabel = (dateStr) => {
  const d = parseDate(dateStr);
  if (!d) return dateStr || "";
  const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const dayName = days[d.getDay()];
  return isToday ? `${dayName} hôm nay` : dayName;
};

const isMatchStartingWithinOneHour = (matchObj) => {
  if (!matchObj || !matchObj.date) return false;
  try {
    let year, month, day;
    if (matchObj.date.includes("/")) {
      const parts = matchObj.date.split("/").map(Number);
      day = parts[0];
      month = parts[1];
      year = parts[2];
    } else if (matchObj.date.includes("-")) {
      const parts = matchObj.date.split("-");
      if (parts[0].length === 4) {
        year = Number(parts[0]);
        month = Number(parts[1]);
        day = Number(parts[2]);
      } else {
        day = Number(parts[0]);
        month = Number(parts[1]);
        year = Number(parts[2]);
      }
    } else {
      return false;
    }

    const startStr = matchObj.startTime || "19:00";
    const [h, m] = startStr.split(":").map(Number);

    const matchStart = new Date(year, month - 1, day, h || 0, m || 0, 0);
    const now = new Date();

    const diffMs = matchStart.getTime() - now.getTime();
    return diffMs <= 3 * 60 * 60 * 1000;
  } catch (e) {
    return false;
  }
};

const normalizeId = (id) => (id == null ? "" : String(id));
const getUserId = (user) => {
  if (!user) return "";
  if (typeof user === "object") {
    return normalizeId(user._id || user.id);
  }
  return normalizeId(user);
};

const isVirtualUser = (p) => {
  if (!p) return false;
  if (typeof p === 'boolean') return p;
  if (typeof p !== 'object') return false;
  if (p.isVirtual === true || p.isVirtual === 'true') return true;
  if (p.createdByUser != null) return true;
  if (typeof p.email === 'string' && (p.email.startsWith('virtual_') || p.email.includes('@virtual.vibesport.com'))) return true;
  if (typeof p.name === 'string' && (p.name.includes('(Ảo)') || p.name.includes('[Ảo]'))) return true;
  return false;
};

function UserRow({ user, label, badge, onPress, rightAction, isMe, showTeammatesIcon }) {
  if (!user || typeof user !== "object") return null;
  const name = user.name || "Người dùng";
  const isVirtual = isVirtualUser(user);

  return (
    <View style={styles.userRowCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
          <View style={[styles.userAvatar, { backgroundColor: isVirtual ? '#8E24AA' : '#ef4444' }]}>
            <Text style={styles.userInitials}>{getInitials(name)}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>{name}</Text>
              {isVirtual && (
                <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: '#7E22CE', fontSize: 10, fontWeight: '700' }}>Ảo</Text>
                </View>
              )}
              {isMe && <Text style={{ fontSize: 13, color: '#888' }}>• bạn</Text>}
              {showTeammatesIcon && !isVirtual && (
                <Ionicons name="people-outline" size={14} color={ORANGE} style={{ marginLeft: 2 }} />
              )}
            </View>
            {label ? <Text style={styles.userSub}>{label}</Text> : null}
          </View>
        </TouchableOpacity>
        
        {badge ? (
          <View style={styles.figmaBadge}>
            <Text style={styles.figmaBadgeText}>{badge}</Text>
          </View>
        ) : null}
        
        {rightAction ? <View style={styles.userRowRightAction}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

const getMatchStatusInfo = (m) => {
  if (!m) return { label: "Chưa bắt đầu", icon: "time-outline", bg: "#FFF7ED", color: "#C2410C", borderColor: "#FFD8A8" };
  const isEnded = m.teamStatus === "ended" || m.status === "completed";
  const isOngoing = m.teamStatus === "ongoing";
  const isCancelled = m.status === "cancelled";

  if (isCancelled) {
    return {
      label: "Đã hủy",
      icon: "close-circle-outline",
      bg: "#FEE2E2",
      color: "#B91C1C",
      borderColor: "#FCA5A5",
    };
  }
  if (isEnded) {
    return {
      label: "Đã kết thúc",
      icon: "flag-outline",
      bg: "#F3F4F6",
      color: "#4B5563",
      borderColor: "#E5E7EB",
    };
  }
  if (isOngoing) {
    return {
      label: "Đang diễn ra",
      icon: "radio-button-on-outline",
      bg: "#DCFCE7",
      color: "#15803D",
      borderColor: "#86EFAC",
    };
  }
  return {
    label: "Chưa bắt đầu",
    icon: "time-outline",
    bg: "#FFF7ED",
    color: "#C2410C",
    borderColor: "#FFD8A8",
  };
};

export default function MatchDetailScreen({ navigation, route }) {
  const { matchId: routeMatchId } = route?.params || {};
  const insets = useSafeAreaInsets();
  const chatUnreadCount = useSelector((state) => state.chat?.unreadCount || 0);
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const matchId = routeMatchId || route?.params?.matchId;
  const initialMatch = route?.params?.match;
  const socket = getSocket();
  const [match, setMatch] = useState(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [joinSelectedPositions, setJoinSelectedPositions] = useState([]);

  // State đánh giá cá nhân từng người
  const [singleRatingTarget, setSingleRatingTarget] = useState(null); // { id, name }
  const [singleStars, setSingleStars] = useState(5);
  const [singleComment, setSingleComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [myRatedUserIds, setMyRatedUserIds] = useState([]);

  // Invite & Kick modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showKickModal, setShowKickModal] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(true);
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [virtualPositionTarget, setVirtualPositionTarget] = useState(null);
  const [selectedVirtualPosId, setSelectedVirtualPosId] = useState("");
  const [kickTarget, setKickTarget] = useState(null);
  const [kickReason, setKickReason] = useState("");
  const [showCourtDetailModal, setShowCourtDetailModal] = useState(false);
  const [costItems, setCostItems] = useState([
    { id: "1", name: "Tiền thuê sân", quantity: 1, price: 0, selected: true },
    { id: "2", name: "Nước uống", quantity: 1, price: 0, selected: false }
  ]);
  const [isCostCalcExpanded, setIsCostCalcExpanded] = useState(true);
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);
  const [hasInitializedCost, setHasInitializedCost] = useState(false);
  const [participantCountOverride, setParticipantCountOverride] = useState(0);

  const userId = normalizeId(user?.id || user?._id);
  const creator = typeof match?.createdBy === "object" ? match.createdBy : null;
  const creatorId = getUserId(creator || match?.createdBy);
  const ownerRoleEntry = Array.isArray(match?.memberRoles)
    ? match.memberRoles.find((entry) => entry?.role === "owner")
    : null;
  const ownerId = getUserId(ownerRoleEntry?.userId || creator || match?.createdBy);

  const participants = match?.participants || [];
  const allParticipants = useMemo(() => {
    if (!creator) return participants;
    const creatorInList = participants.some((p) => getUserId(p) === creatorId);
    if (creatorInList) return participants;
    return [creator, ...participants];
  }, [creator, creatorId, participants]);

  useEffect(() => {
    if (match && !hasInitializedCost) {
      setCostItems([
        { id: "1", name: "Tiền thuê sân", quantity: 1, price: match.totalCourtCost || 0, selected: true },
        { id: "2", name: "Nước uống", quantity: 1, price: 0, selected: false }
      ]);
      setHasInitializedCost(true);
    }
    if (match) {
      const nextCount = Math.max(1, (match.participants || []).length || allParticipants.length || 1);
      setParticipantCountOverride((prev) => (prev && prev !== 0 ? prev : nextCount));
    }
  }, [match, hasInitializedCost, allParticipants.length]);

  const isUserParticipant = (matchObj) => {
    const pList = matchObj?.participants || [];
    return pList.some((p) => {
      const pid = typeof p === 'object' ? p._id || p.id : p;
      return normalizeId(pid) === userId;
    });
  };

  const selectedPositionIds = Array.isArray(match?.selectedPositionIds) ? match.selectedPositionIds : [];
  const benchTeam1 = match?.benchMembersTeam1 || 0;
  const benchTeam2 = match?.benchMembersTeam2 || 0;
  const requiredPlayersForMatch = getRequiredPlayersBySport(match?.sport, match, Number(match?.maxPlayers || 2));

  const teamBreakdown = useMemo(() => {
    const team1Ids = selectedPositionIds.filter((id) => id.startsWith("t1_"));
    const team2Ids = selectedPositionIds.filter((id) => id.startsWith("t2_"));

    const buildRoleCounts = (ids, positions) => {
      const counts = {};
      ids.forEach((id) => {
        const pos = positions.find((p) => p.id === id);
        if (pos) counts[pos.role] = (counts[pos.role] || 0) + 1;
      });
      return counts;
    };

    return {
      teamA: { roles: buildRoleCounts(team1Ids, TEAM1_POSITIONS), count: team1Ids.length, bench: benchTeam1 },
      teamB: { roles: buildRoleCounts(team2Ids, TEAM2_POSITIONS), count: team2Ids.length, bench: benchTeam2 },
    };
  }, [selectedPositionIds, benchTeam1, benchTeam2]);

  const totalNeeded = requiredPlayersForMatch;

  const neededRolesList = useMemo(() => {
    if (match?.sport !== "football") return [];
    const counts = {};
    const processTeam = (teamRoles) => {
      Object.entries(teamRoles).forEach(([role, qty]) => {
        counts[role] = (counts[role] || 0) + qty;
      });
    };
    processTeam(teamBreakdown.teamA.roles);
    processTeam(teamBreakdown.teamB.roles);
    const benchTotal = Number(match?.benchMembersTeam1 || 0) + Number(match?.benchMembersTeam2 || 0);
    if (benchTotal > 0) {
      counts.bench = (counts.bench || 0) + benchTotal;
    }
    return Object.entries(counts).map(([role, qty]) => ({ role, qty }));
  }, [match?.sport, teamBreakdown, match?.benchMembersTeam1, match?.benchMembersTeam2]);

  const reloadMatch = async () => {
    if (!matchId) return;
    const data = await getMatchById(matchId);
    setMatch(data);
    // load which users current user already rated for this match
    if (token) {
      try {
        const ids = await getMyMatchRatings(matchId, token);
        setMyRatedUserIds(ids.map((i) => String(i)));
      } catch (e) {
        console.warn('Không thể tải danh sách đánh giá của bạn cho trận:', e.message);
      }
    }
  };

  const handleToggleTeamStatus = async (newStatus, settlementData = null) => {
    try {
      setActionLoading(true);
      await updateTeamStatus(matchId, newStatus, settlementData || {}, token);
      await reloadMatch();

      if (newStatus === "ended") {
        Alert.alert(
          "Trận đấu đã kết thúc",
          "Bảng tổng kết chi phí trận đấu hiện đã được khóa và không thể chỉnh sửa nữa.\n\nHãy dành ít phút để đánh giá thái độ thi đấu của các bạn chơi trong trận đấu này nhé!",
          [
            {
              text: "Đánh giá ngay",
              onPress: () => {
                const otherParticipants = (match?.participants || []).filter(
                  (p) => getUserId(p) !== userId
                );
                if (otherParticipants.length > 0) {
                  handleOpenSingleRating(otherParticipants[0]);
                } else {
                  Alert.alert("Thông báo", "Trận đấu không có thành viên nào khác để đánh giá.");
                }
              },
            },
            { text: "Để sau", style: "cancel" },
          ]
        );
      } else {
        Alert.alert("Thành công", "Trận đấu đã bắt đầu!");
      }
    } catch (err) {
      Alert.alert("Thông báo", err.message || "Không thể cập nhật trạng thái trận đấu");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = () => {
    if (match?.deletionVote?.active) {
      Alert.alert("Thông báo", "Trận đấu đang trong quá trình biểu quyết xóa, không thể Bắt đầu!");
      return;
    }
    const joinedCount = (match?.participants || []).length;
    const requiredCount = totalNeeded > 0 ? totalNeeded : (match?.maxPlayers || 10);
    const isNotEnough = joinedCount < requiredCount;

    if (isNotEnough) {
      Alert.alert(
        "⚠️ CẢNH BÁO CHƯA ĐỦ NGƯỜI",
        `Trận đấu hiện tại chưa đủ số lượng người chơi đã tìm (Hiện tại: ${joinedCount}/${requiredCount} người).\n\nBạn có chắc chắn vẫn muốn BẮT ĐẦU trận đấu không?`,
        [
          { text: "Hủy", style: "cancel" },
          { text: "Vẫn bắt đầu", onPress: () => handleToggleTeamStatus("ongoing") },
        ]
      );
    } else {
      Alert.alert(
        "Xác nhận bắt đầu",
        "Bạn có chắc chắn muốn BẮT ĐẦU trận đấu này ngay bây giờ?",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Bắt đầu", onPress: () => handleToggleTeamStatus("ongoing") },
        ]
      );
    }
  };

  const handleEndMatch = () => {
    Alert.alert(
      "Xác nhận kết thúc",
      "Bạn có chắc chắn muốn KẾT THÚC trận đấu này?\n\n⚠️ Thao tác này sẽ KHÓA toàn bộ bảng tổng kết chi phí và lưu lại khoản chi phí cuối cùng trong lịch sử trận đấu.",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Kết thúc", style: "destructive", onPress: () => handleToggleTeamStatus("ended", buildSettlementPayload()) },
      ]
    );
  };

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        setLoading(true);
        await reloadMatch();
        if (route?.params?.autoOpenPositionModal) {
          setShowPositionModal(true);
          navigation.setParams({ autoOpenPositionModal: false });
        }
      } catch (err) {
        Alert.alert("Lỗi", err.message);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, navigation, route?.params?.autoOpenPositionModal]);

  useEffect(() => {
    if (route?.params?.autoOpenRating && !loading && match) {
      setShowDetailsCollapsed(true);
      const isMatchEnded = match?.teamStatus === "ended" || match?.status === "completed";
      const otherParticipants = (match?.participants || []).filter(
        (p) => getUserId(p) !== String(userId)
      );
      const unratedUser = otherParticipants.find(
        (p) => !myRatedUserIds.includes(getUserId(p))
      );

      if (isMatchEnded && unratedUser) {
        const targetId = getUserId(unratedUser);
        const targetName = (typeof unratedUser === "object" ? unratedUser.name : "Người chơi") || "Người chơi";
        setSingleRatingTarget({ id: targetId, name: targetName });
        setSingleStars(5);
        setSingleComment("");
      }
      navigation.setParams({ autoOpenRating: false });
    }
  }, [route?.params?.autoOpenRating, loading, match, userId, myRatedUserIds, navigation]);

  useEffect(() => {
    if (!socket || !matchId) return;

    const handleMatchUpdated = (data) => {
      if (data && String(data.matchId) === String(matchId)) {
        if (data.isDeleted) {
          Alert.alert("Thông báo", "Trận đấu này đã bị hủy hoặc xóa.");
          navigation.goBack();
        } else {
          reloadMatch();
        }
      }
    };

    socket.on('match_updated', handleMatchUpdated);
    return () => {
      socket.off('match_updated', handleMatchUpdated);
    };
  }, [matchId, socket]);

  // Mở Popup Đánh giá cho 1 cá nhân
  const handleOpenSingleRating = (targetUser) => {
    const isMatchEnded = match?.teamStatus === "ended" || match?.status === "completed";
    if (!isMatchEnded) {
      Alert.alert("Thông báo", "Bạn chỉ có thể đánh giá thành viên sau khi trận đấu đã KẾT THÚC!");
      return;
    }

    const targetId = getUserId(targetUser);
    const isTargetParticipant = (match?.participants || []).some(
      (p) => getUserId(p) === targetId
    );

    if (!isTargetParticipant) {
      Alert.alert("Thông báo", "Chỉ được đánh giá những người dùng từng thi đấu chung trong trận này.");
      return;
    }

    if (myRatedUserIds.includes(String(targetId))) {
      Alert.alert('Thông báo', 'Bạn đã đánh giá người này cho trận này rồi.');
      return;
    }

    const targetName = targetUser?.name || "Người chơi";
    setSingleRatingTarget({ id: targetId, name: targetName });
    setSingleStars(5);
    setSingleComment("");
  };

  const isOwner = !!ownerId && String(ownerId) === String(userId);
  const maxCount = match?.maxPlayers || 10;
  const coords = match?.location;
  const currentCount = participants.filter((participant) => {
    const participantId = getUserId(participant);
    return Boolean(participantId) && participantId !== ownerId && !isVirtualUser(participant);
  }).length;
  const pendingRequests = match?.pendingJoinRequests || [];

  const getParticipantPositionLabel = (pid, participantObj) => {
    const pStr = String(pid);
    if (pStr === String(creatorId) || pStr === String(ownerId)) {
      return "Người tạo trận";
    }

    const memberPosEntry = (match?.memberPositions || []).find(
      (m) => getUserId(m.userId) === pStr
    );
    if (memberPosEntry && memberPosEntry.positionId && memberPosEntry.positionId.trim() !== "") {
      const label = getPositionDisplayLabel(memberPosEntry.positionId);
      if (label) return label;
    }

    const isVirtual = isVirtualUser(participantObj) || (match?.participants || []).some((p) => getUserId(p) === pStr && isVirtualUser(p));
    if (isVirtual) {
      return "Chưa xếp vị trí";
    }

    const pendingPosEntry = (match?.pendingJoinRequestPositions || []).find(
      (entry) => getUserId(entry.userId) === pStr
    );
    if (pendingPosEntry && Array.isArray(pendingPosEntry.positionIds) && pendingPosEntry.positionIds.length > 0) {
      const labels = pendingPosEntry.positionIds
        .map((posId) => getPositionDisplayLabel(posId))
        .filter(Boolean);
      if (labels.length > 0) {
        return Array.from(new Set(labels)).join(", ");
      }
    }

    if (match?.sport === "football" || !match?.sport) {
      const nonOwnerParticipants = (match?.participants || []).filter((p) => {
        const id = getUserId(p);
        return id && id !== creatorId && id !== ownerId;
      });

      const participantIndex = nonOwnerParticipants.findIndex((p) => getUserId(p) === pStr);
      const posIds = match?.selectedPositionIds && match.selectedPositionIds.length > 0
        ? match.selectedPositionIds
        : ["t1_st", "t1_lb", "t1_dm1", "t2_st", "t2_lb", "t2_dm1"];

      const validIndex = participantIndex >= 0 ? participantIndex : 0;
      if (validIndex < posIds.length) {
        return getPositionDisplayLabel(posIds[validIndex]);
      }

      const teamNo = (validIndex % 2 === 0) ? 1 : 2;
      return `Tiền đạo Đội ${teamNo}`;
    }

    if (match?.sport === "badminton") return "VĐV Cầu lông";
    if (match?.sport === "pickleball") return "VĐV Pickleball";
    return "Thành viên";
  };

  const pendingRequestPositions = match?.pendingJoinRequestPositions || [];
  const invitedMembers = match?.invitedMembers || [];

  const positionOptions = useMemo(() => {
    if (match?.sport !== "football") return [];

    const takenPositionIds = new Set();

    // 1. Positions already occupied by active participants in match.memberPositions
    (match?.memberPositions || []).forEach((mp) => {
      if (!mp || !mp.positionId) return;
      const mpUserId = String(typeof mp.userId === "object" ? (mp.userId._id || mp.userId.id) : mp.userId);
      const isPart = (match?.participants || []).some((p) => String(typeof p === "object" ? (p._id || p.id) : p) === mpUserId);
      if (isPart) {
        const posIds = Array.isArray(mp.positionId) ? mp.positionId : String(mp.positionId).split(",");
        posIds.forEach((pId) => takenPositionIds.add(String(pId).trim()));
      }
    });

    // 2. Positions taken by pending join requests
    (pendingRequestPositions || []).forEach((entry) => {
      if (!entry || !Array.isArray(entry.positionIds)) return;
      entry.positionIds.forEach((posId) => {
        if (String(entry.userId) !== String(userId)) {
          takenPositionIds.add(String(posId));
        }
      });
    });

    const options = [];
    const addOption = (id, label, role, teamNumber, isBench = false, disabled = false) => {
      options.push({ id, label, role, teamNumber, isBench, disabled });
    };

    (match?.selectedPositionIds || []).forEach((posId) => {
      const pos = ALL_POSITIONS.find((item) => item.id === posId);
      if (!pos) return;
      const teamNumber = posId.startsWith("t1_") ? 1 : 2;
      addOption(pos.id, pos.label, pos.role, teamNumber, false, takenPositionIds.has(String(pos.id)));
    });

    if ((match?.benchMembersTeam1 || 0) > 0) {
      for (let index = 0; index < match.benchMembersTeam1; index += 1) {
        const benchId = `t1_bench_${index + 1}`;
        addOption(benchId, "Dự bị", "bench", 1, true, takenPositionIds.has(benchId));
      }
    }

    if ((match?.benchMembersTeam2 || 0) > 0) {
      for (let index = 0; index < match.benchMembersTeam2; index += 1) {
        const benchId = `t2_bench_${index + 1}`;
        addOption(benchId, "Dự bị", "bench", 2, true, takenPositionIds.has(benchId));
      }
    }

    return options;
  }, [match?.sport, match?.selectedPositionIds, match?.memberPositions, match?.participants, match?.benchMembersTeam1, match?.benchMembersTeam2, pendingRequestPositions, userId]);

  const virtualPositionOptions = useMemo(() => {
    if (match?.sport !== "football") return [];

    const neededPositionIds = new Set(match?.selectedPositionIds || []);

    const takenPositionIds = new Set();
    (match?.memberPositions || []).forEach((mp) => {
      if (!mp || !mp.positionId) return;
      const mpUserId = getUserId(mp.userId);
      const targetUserId = getUserId(virtualPositionTarget);
      if (mpUserId === targetUserId) return;

      const isPart = (match?.participants || []).some((p) => getUserId(p) === mpUserId);
      if (isPart) {
        const posIds = Array.isArray(mp.positionId) ? mp.positionId : String(mp.positionId).split(",");
        posIds.forEach((pId) => takenPositionIds.add(String(pId).trim()));
      }
    });

    // All available football field position IDs for Team 1 and Team 2
    const allowedIds = [
      ...TEAM1_POSITIONS.map((p) => p.id),
      ...TEAM2_POSITIONS.map((p) => p.id),
    ];

    const b1 = Number(match?.benchMembersTeam1 || 0);
    const b2 = Number(match?.benchMembersTeam2 || 0);
    for (let i = 1; i <= b1; i += 1) allowedIds.push(`t1_bench_${i}`);
    for (let i = 1; i <= b2; i += 1) allowedIds.push(`t2_bench_${i}`);

    const options = [
      {
        id: "",
        label: "Chưa xếp vị trí",
        role: "none",
        teamNumber: 0,
        isBench: false,
        isDisabled: false,
        disabledReason: "",
      },
    ];

    allowedIds.forEach((posId) => {
      const pos = ALL_POSITIONS.find((item) => item.id === posId);
      const teamNumber = posId.startsWith("t1_") ? 1 : 2;
      const isBench = posId.includes("bench");
      let label = "";
      let role = "bench";

      if (pos) {
        label = `${pos.label} (${pos.id.replace(/^t[12]_/, "").toUpperCase()})`;
        role = pos.role;
      } else if (isBench) {
        label = `Dự bị (Đội ${teamNumber})`;
        role = "bench";
      } else {
        label = posId;
      }

      const isNeededByMatch = neededPositionIds.has(posId);
      const isTaken = takenPositionIds.has(posId);
      const isDisabled = isNeededByMatch || isTaken;

      let disabledReason = "";
      if (isNeededByMatch) {
        disabledReason = "Vị trí cần tìm của trận";
      } else if (isTaken) {
        disabledReason = "Đã có người";
      }

      options.push({
        id: posId,
        label,
        role,
        teamNumber,
        isBench,
        isDisabled,
        disabledReason,
      });
    });

    return options;
  }, [match, virtualPositionTarget]);

  const isParticipant = participants.some((p) => getUserId(p) === userId);
  const hasPendingRequest = pendingRequests.some((p) => getUserId(p) === userId);
  const isInvited = invitedMembers.some((p) => getUserId(p) === userId);
  const displayTotalNeeded = totalNeeded > 0 ? totalNeeded : maxCount;
  const isFull = match?.status === "full" || currentCount >= displayTotalNeeded;
  const isEnded = match?.status === "completed" || match?.status === "cancelled" || match?.teamStatus === "ended";
  const isMatchStarted = match?.teamStatus === "ongoing" || isEnded;
  const isViaInviteLink = Boolean(route?.params?.invite || route?.params?.viaInvite || route?.params?.fromLink);
  const isCostEditable = isOwner && !isEnded;
  const contactZaloValue = typeof match?.contactZalo === "string" ? match.contactZalo.trim() : "";
  const contactFacebookValue = typeof match?.contactFacebook === "string" ? match.contactFacebook.trim() : "";
  const hasContactInfo = Boolean(match?.contactPhone || contactZaloValue || contactFacebookValue || match?.contactAppUser);

  const canJoinMatch = !isOwner && !isParticipant && !hasPendingRequest && !isEnded && !isFull && !isMatchStarted;

  const getRequestPositions = (requestUserId) => {
    const entry = pendingRequestPositions.find((item) => String(item.userId) === String(requestUserId));
    return Array.isArray(entry?.positionIds) ? entry.positionIds : [];
  };

  useEffect(() => {
    if (isOwner && pendingRequests.length > 0) {
      setShowJoinRequests(true);
    }
  }, [isOwner, pendingRequests.length]);

  const openProfile = (profileUser) => {
    const profileUserId = getUserId(profileUser);
    if (!profileUserId || profileUserId === userId) {
      navigation.navigate("Home", { screen: "ProfileTab" });
      return;
    }
    navigation.navigate("UserProfile", {
      userId: profileUserId,
      initialProfile: typeof profileUser === "object" ? profileUser : undefined,
    });
  };

  const handleOpenMap = () => {
    if (match?.mapUrl || match?.googleMapUrl) {
      Linking.openURL(match.mapUrl || match.googleMapUrl).catch(() => {});
      return;
    }

    const name = match.locationName || match.title || "";
    const address = match.specificAddress || match.location?.address || "";

    let combinedQuery = "";
    if (name && address) {
      if (address.toLowerCase().includes(name.toLowerCase())) {
        combinedQuery = address;
      } else {
        combinedQuery = `${name}, ${address}`;
      }
    } else {
      combinedQuery = name || address;
    }

    if (combinedQuery) {
      const encodedQuery = encodeURIComponent(combinedQuery);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
      Linking.openURL(url).catch((err) => console.log("Open map error:", err));
    } else if (coords?.lat != null && coords?.lng != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
      Linking.openURL(url).catch((err) => console.log("Open map error:", err));
    } else {
      Alert.alert("Thông báo", "Trận đấu này chưa có thông tin vị trí chi tiết.");
    }
  };

  const handleAddCostItem = () => {
    setCostItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: "",
        quantity: 1,
        price: 0,
        selected: true,
      },
    ]);
  };

  const handleDeleteItem = (itemId) => {
    setCostItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleToggleSelectItem = (itemId) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdateItem = (itemId, field, val) => {
    setCostItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: val } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = costItems.every((x) => x.selected);
    setCostItems((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  const totalSelectedCost = costItems
    .filter((x) => x.selected)
    .reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);

  const settlementParticipantCount = Math.max(
    1,
    Number(participantCountOverride || allParticipants.length || 1)
  );

  const buildSettlementPayload = useCallback(() => {
    const selectedItems = costItems
      .filter((item) => item.selected)
      .map((item) => ({
        id: item.id,
        name: item.name || "Chi phí",
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        selected: true,
      }));

    const participantsCount = Math.max(1, Number(settlementParticipantCount || allParticipants.length || 1));
    const perPerson = Math.round(totalSelectedCost / participantsCount);
    const memberAdjustments = allParticipants.map((participant) => {
      const id = getUserId(participant);
      return {
        userId: id || null,
        amount: perPerson,
        note: "Chia đều theo tổng chi phí trận đấu",
        name: participant?.name || "Người chơi",
      };
    });

    const extraSlots = Math.max(0, participantsCount - allParticipants.length);
    for (let index = 1; index <= extraSlots; index += 1) {
      memberAdjustments.push({
        userId: null,
        amount: perPerson,
        note: "Điều chỉnh theo số người chơi đã nhập",
        name: `Người chơi ${index}`,
      });
    }

    return {
      finalSettlement: {
        totalExpense: totalSelectedCost,
        perPerson,
        participantsCount,
        note: "Tổng kết chi phí trận đấu",
      },
      expenseBreakdown: selectedItems,
      memberAdjustments,
    };
  }, [costItems, totalSelectedCost, allParticipants, settlementParticipantCount]);

  const handleRequestJoin = () => {
    if (match?.deletionVote?.active) {
      Alert.alert("Thông báo", "Trận đấu đang trong quá trình biểu quyết xóa, không thể xin tham gia!");
      return;
    }
    if (isMatchStarted) {
      Alert.alert("Thông báo", "Trận đấu đã bắt đầu hoặc đã kết thúc, không thể tham gia nữa.");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể xin tham gia!");
      return;
    }
    if (match?.sport === "football" && positionOptions.length > 0) {
      setSelectedPositions([]);
      setShowPositionModal(true);
      return;
    }

    // Normal flow: ask about equipment and send join request to owner
    Alert.alert(
      "Xác nhận gửi yêu cầu",
      "Môn thể thao này cần có dụng cụ thi đấu. Bạn có muốn gửi yêu cầu tham gia đến chủ trận duyệt không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Gửi yêu cầu",
          onPress: () => handleConfirmJoin(false),
        },
      ]
    );
  };

  const handleCancelRequest = async () => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn hủy yêu cầu tham gia này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await cancelJoinRequest(match._id, userId, token);
            setMatch(data);
            Alert.alert("Thành công", "Đã hủy yêu cầu tham gia");
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleConfirmJoin = async (forceDirectJoin = false) => {
    const shouldJoinDirectly = forceDirectJoin === true;
    try {
      setActionLoading(true);
      if (isFull) {
        Alert.alert("Lỗi", "Trận đấu đã đầy người");
        return;
      }

      let data;
      if (shouldJoinDirectly) {
        data = await joinMatch(match._id, userId, [], token);
        Alert.alert("Thành công 🎉", "Bạn đã tham gia trận đấu thành công qua Link Mời!");
      } else {
        data = await requestJoinMatch(match._id, userId, [], token);
        Alert.alert("Thành công 🎉", "Đã gửi yêu cầu tham gia đến chủ trận. Vui lòng chờ chủ trận duyệt!");
      }
      setMatch(data?.data || data);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tham gia");
    } finally {
      setActionLoading(false);
      setShowPositionModal(false);
      setSelectedPositions([]);
    }
  };

  const handleConfirmJoinWithPositions = async (forceDirectJoin = false) => {
    if (match?.deletionVote?.active) {
      Alert.alert("Thông báo", "Trận đấu đang trong quá trình biểu quyết xóa, không thể tham gia!");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể tham gia!");
      return;
    }
    if (selectedPositions.length !== 1) {
      Alert.alert("Thông báo", "Vui lòng chọn đúng 1 vị trí để tham gia");
      return;
    }

    const isInvitedMember = (match?.invitedMembers || []).some(
      (p) => getUserId(p) === String(userId)
    );
    const pendingInviteEntry = (match?.pendingInviteRequests || []).find(
      (entry) => getUserId(entry?.userId) === String(userId)
    );
    const hasDirectInvite = isInvitedMember || (pendingInviteEntry && !pendingInviteEntry.requiresOwnerApproval);

    const shouldJoinDirectly = forceDirectJoin === true || hasDirectInvite;
    try {
      setActionLoading(true);
      setShowPositionModal(false);
      let data;
      if (shouldJoinDirectly) {
        data = await joinMatch(match._id, userId, selectedPositions, token);
        Alert.alert("Thành công 🎉", "Bạn đã tham gia vị trí thành công!");
      } else {
        data = await requestJoinMatch(match._id, userId, selectedPositions, token);
        Alert.alert("Thành công 🎉", "Đã gửi yêu cầu tham gia vị trí đã chọn đến chủ trận. Vui lòng chờ chủ trận duyệt!");
      }
      setMatch(data?.data || data);
      setSelectedPositions([]);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tham gia");
    } finally {
      setActionLoading(false);
    }
  };


  const togglePositionSelection = (option) => {
    if (option.disabled) return;

    const isAlreadySelected = selectedPositions.includes(option.id);
    if (isAlreadySelected) {
      setSelectedPositions([]);
      return;
    }

    if (selectedPositions.length >= 1) {
      return;
    }

    setSelectedPositions([option.id]);
  };

  const handleChangePositionRequest = () => {
    Alert.alert("Thay đổi vị trí", "Bạn có chắc muốn hủy yêu cầu cũ và tạo yêu cầu mới?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
            onPress: async () => {
            try {
              setActionLoading(true);
              const data = await cancelJoinRequest(match._id, userId, token);
              setMatch(data);
              setSelectedPositions([]);
              setShowPositionModal(true);
            } catch (err) {
              Alert.alert("Thông báo", err.message || "Không thể đổi vị trí");
            } finally {
              setActionLoading(false);
            }
          },
      },
    ]);
  };

  const handleAcceptRequest = async (requestUserId) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn đồng ý yêu cầu này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await acceptJoinMatch(match._id, userId, requestUserId, token);
            setMatch(data);
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleRejectRequest = async (requestUserId) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn từ chối yêu cầu này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await rejectJoinMatch(match._id, userId, requestUserId, token);
            setMatch(data);
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    if (match?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể rút khỏi trận.");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể rút khỏi trận!");
      return;
    }
    Alert.alert("Rút khỏi trận", "Bạn có chắc muốn rút khỏi trận này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rút khỏi",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await leaveMatch(match._id, userId);
            setMatch(data);
            Alert.alert("Thành công", "Đã rút khỏi trận đấu");
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    if (match?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể Sửa.");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể Sửa!");
      return;
    }
    Alert.alert(
      "Xác nhận chỉnh sửa",
      "Bạn có chắc chắn muốn chỉnh sửa thông tin trận đấu này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chỉnh sửa",
          onPress: () => {
            navigation.navigate("CreateMatch", { editMatch: match });
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (match?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể Xóa.");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể Hủy / Xóa!");
      return;
    }
    Alert.alert(
      "Xác nhận xóa trận đấu",
      "Bạn có chắc chắn muốn xóa trận đấu này không? Thao tác này sẽ hủy trận và không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa trận đấu",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const res = await deleteMatch(match._id, token);
              if (res?.isDeleted) {
                Alert.alert("Thành công", res?.message || "Đã xóa trận đấu thành công.");
                navigation.navigate("Home", { screen: "MatchesTab" });
              } else if (res?.pendingVote) {
                Alert.alert("Thông báo biểu quyết", res?.message || "Đã gửi yêu cầu biểu quyết xóa.");
                reloadMatch();
              } else {
                Alert.alert("Thông báo", res?.message || "Đã xử lý yêu cầu.");
                reloadMatch();
              }
            } catch (err) {
              Alert.alert("Lỗi", err?.message || String(err) || "Không thể thực hiện thao tác xóa.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptDeleteVote = async () => {
    try {
      setActionLoading(true);
      const res = await acceptDeleteMatch(match._id, token);
      if (res?.isDeleted) {
        Alert.alert("Thành công", res?.message || "Trận đấu đã được xóa.");
        navigation.navigate("Home", { screen: "MatchesTab" });
      } else {
        Alert.alert("Đã xác nhận", res?.message || "Đã ghi nhận biểu quyết của bạn.");
        reloadMatch();
      }
    } catch (err) {
      Alert.alert("Lỗi", err?.message || String(err) || "Không thể xác nhận biểu quyết");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeleteVote = async () => {
    try {
      setActionLoading(true);
      const res = await rejectDeleteMatch(match._id, token);
      if (res?.isCanceled) {
        Alert.alert("Đã hủy yêu cầu xóa", res?.message || "Yêu cầu xóa trận đấu đã bị hủy.");
      } else {
        Alert.alert("Đã từ chối", res?.message || "Đã ghi nhận ý kiến từ chối của bạn.");
      }
      reloadMatch();
    } catch (err) {
      Alert.alert("Lỗi", err?.message || String(err) || "Không thể thực hiện từ chối xóa.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Owner: Invite from following list ───────────────────────
  const handleOpenInvite = async () => {
    if (match?.deletionVote?.active) {
      Alert.alert("Thông báo", "Trận đấu đang trong quá trình biểu quyết xóa, không thể mời thêm người!");
      return;
    }
    if (isMatchStarted) {
      Alert.alert("Thông báo", "Trận đấu đã bắt đầu hoặc đã kết thúc, không thể gửi lời mời tham gia nữa!");
      return;
    }
    if (isMatchStartingWithinOneHour(match)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể mời thêm thành viên!");
      return;
    }
    try {
      setInviteLoading(true);
      setShowInviteModal(true);
      const res = await getFollowingListRequest(token);
      const list = res?.data || [];
      const participantIds = participants.map((p) => getUserId(p));
      const pendingIds = pendingRequests.map((p) => getUserId(p));
      const invitedIds = (match.invitedMembers || []).map((p) => getUserId(p));
      const filtered = list.filter((u) => {
        const uid = String(u._id || u.id);
        return !participantIds.includes(uid) && !pendingIds.includes(uid) && !invitedIds.includes(uid) && uid !== ownerId;
      });
      setFollowingUsers(filtered);
    } catch (err) {
      Alert.alert("Thông báo", err.message || "Không thể tải danh sách");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteUser = async (targetUserId) => {
    Alert.alert("Xác nhận mời", "Bạn có chắc muốn mời người này vào trận này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await inviteTeamMember(match._id, userId, targetUserId);
            setMatch(data);
            const message = String(ownerId) === String(userId)
              ? "Đã mời"
              : "Đã mười, nhưng cần Chủ trận xác nhận trước khi người này có thể tham gia.";
            Alert.alert("Đã gửi lời mời", message);
            setFollowingUsers((prev) =>
              prev.map((user) => {
                const userIdValue = String(user._id || user.id);
                if (userIdValue === String(targetUserId)) {
                  return { ...user, isInvited: true };
                }
                return user;
              })
            );
          } catch (err) {
            Alert.alert("Thông báo", err.message || "Không thể mời");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleOpenKick = (participant) => {
    setKickTarget(participant);
    setKickReason("");
    setShowKickModal(true);
  };

  const handleKickUser = async () => {
    if (!kickTarget) return;
    Alert.alert("Xác nhận", "Bạn có chắc muốn kích thành viên này khỏi trận?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const targetId = getUserId(kickTarget);
            const data = await kickTeamMember(match._id, ownerId, targetId, kickReason);
            setMatch(data);
            Alert.alert("Thành công", "Đã kích thành viên ra khỏi trận");
            setShowKickModal(false);
            setKickTarget(null);
            setKickReason("");
          } catch (err) {
            Alert.alert("Thông báo", err.message || "Không thể kích");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };


  // Gửi Đánh giá cho 1 cá nhân
  const handleSubmitSingleRating = async () => {
    if (!singleRatingTarget) return;
    try {
      setSubmittingRating(true);
      const ratingsArray = [
        {
          toUserId: singleRatingTarget.id,
          stars: singleStars,
          comment: singleComment.trim(),
        },
      ];

      await submitMatchRatings(match._id, ratingsArray, token);
      Alert.alert("Thành công", `Đã gửi đánh giá cho ${singleRatingTarget.name}!`);
      setSingleRatingTarget(null);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể gửi đánh giá.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const content = loading || !match ? (
    <Screen style={styles.safeArea}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    </Screen>
  ) : (
    <Screen style={styles.safeArea}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text style={styles.headerTitle}>Chi tiết trận đấu</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isOwner && match.status !== "completed" && (
            <TouchableOpacity
              style={[styles.joinHeaderBtn, { width: 90 }]}
              onPress={() => setShowRequestModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.joinHeaderBtnText}>Yêu cầu</Text>
              {pendingRequests.length > 0 && <View style={styles.redDot} />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Status bar */}
          {(() => {
            const statusInfo = getMatchStatusInfo(match);
            return (
              <View style={[styles.statusBarContainer, { backgroundColor: statusInfo.bg, borderColor: statusInfo.borderColor }]}>
                <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} style={{ marginRight: 6 }} />
                <Text style={[styles.statusBarText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              </View>
            );
          })()}

          {/* Deletion Vote Banner */}
          {match.deletionVote && match.deletionVote.active && (
            <View style={{
              backgroundColor: "#FEF2F2",
              borderColor: "#FCA5A5",
              borderWidth: 1,
              padding: 12,
              borderRadius: 12,
              marginTop: 10,
              marginBottom: 4,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="warning" size={18} color="#DC2626" />
                <Text style={{ fontWeight: "700", color: "#991B1B", fontSize: 13.5, flex: 1 }}>
                  Yêu cầu biểu quyết XÓA trận đấu
                </Text>
              </View>
              {(() => {
                const totalP = Math.max(1, (match.participants || []).length);
                const acceptedUsersArr = (match.deletionVote.acceptedUsers || []).map((u) => String(typeof u === "object" ? (u._id || u.id) : u));
                const rejectedUsersArr = (match.deletionVote.rejectedUsers || []).map((u) => String(typeof u === "object" ? (u._id || u.id) : u));
                const acceptedCount = acceptedUsersArr.length;
                const rejectedCount = rejectedUsersArr.length;
                const percentage = Math.round((acceptedCount / totalP) * 100);
                const hasAccepted = acceptedUsersArr.includes(String(userId));
                const hasRejected = rejectedUsersArr.includes(String(userId));

                return (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ color: "#7F1D1D", fontSize: 12.5, lineHeight: 18 }}>
                      Đồng ý xóa: <Text style={{ fontWeight: "700" }}>{acceptedCount}/{totalP} ({percentage}%)</Text> · Từ chối: <Text style={{ fontWeight: "700" }}>{rejectedCount}/{totalP}</Text> — Cần trên 50% đồng ý để xóa.
                    </Text>

                    {isParticipant && (
                      <View style={{ marginTop: 10 }}>
                        {!hasAccepted && !hasRejected && (
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: "#DC2626",
                                paddingVertical: 9,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                alignItems: "center",
                              }}
                              onPress={handleAcceptDeleteVote}
                              disabled={actionLoading}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                                ✓ Đồng ý xóa
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: "#4B5563",
                                paddingVertical: 9,
                                paddingHorizontal: 12,
                                borderRadius: 8,
                                alignItems: "center",
                              }}
                              onPress={handleRejectDeleteVote}
                              disabled={actionLoading}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                                ✕ Từ chối
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {hasAccepted && (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#059669", fontSize: 12, fontWeight: "700" }}>
                              ✓ Bạn đã ĐỒNG Ý xóa trận đấu.
                            </Text>
                            <TouchableOpacity
                              style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                              onPress={handleRejectDeleteVote}
                              disabled={actionLoading}
                            >
                              <Text style={{ color: "#4B5563", fontSize: 11, fontWeight: "600" }}>Đổi sang Từ chối</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {hasRejected && (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "700" }}>
                              ✕ Bạn đã TỪ CHỐI xóa trận đấu.
                            </Text>
                            <TouchableOpacity
                              style={{ backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                              onPress={handleAcceptDeleteVote}
                              disabled={actionLoading}
                            >
                              <Text style={{ color: "#059669", fontSize: 11, fontWeight: "600" }}>Đổi sang Đồng ý</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          <View style={styles.cardHeader}>
            <View style={styles.sportSquare}>
              <TagIcon tagName={SPORT_TAG_MAP[match.sport] || "Bóng đá"} size={28} color="#fff" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{match.title}</Text>
              <Text style={styles.timeAgoText}>{match.createdAt ? getRelativeTime(match.createdAt) : "Mới đăng"}</Text>
            </View>
            <TouchableOpacity
              style={styles.collapseBtn}
              activeOpacity={0.7}
              onPress={() => setShowDetailsCollapsed((prev) => !prev)}
            >
              <Ionicons name={showDetailsCollapsed ? "chevron-down" : "chevron-up"} size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {!showDetailsCollapsed && (
            <>
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="time-outline" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>{formatTimeLabel(match.startTime, match)} - {getDayLabel(match.date)} - {match.date}</Text>
                </View>

                {match.note ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}><MaterialCommunityIcons name="square-edit-outline" size={16} color="#333" /></View>
                    <Text style={styles.infoText}>{match.note}</Text>
                  </View>
                ) : null}

                <View style={[styles.infoRow, { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }]}> 
                  <View style={styles.infoIcon}><MaterialCommunityIcons name="soccer-field" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>Loại sân: {match.customPitchType ? match.customPitchType : (getFormatLabel(match.sport, match.maxPlayers) || `${Math.floor(maxCount / 2)} vs ${Math.floor(maxCount / 2)}`)}</Text>
                </View>

                {/* Pitch Status & Deposit */}
                <View style={[styles.infoRow, { paddingTop: 10, paddingBottom: 5 }]}>
                  <View style={styles.infoIcon}><Ionicons name="card-outline" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>Trạng thái sân: <Text style={{ fontWeight: "700", color: match.pitchStatus === "Đã cọc" ? ORANGE : "#4B5563" }}>{match.pitchStatus || "Chưa cọc"}</Text></Text>
                </View>
                {match.pitchStatus === "Đã cọc" && match.depositAmount ? (
                  <View style={[styles.infoRow, { paddingBottom: 10 }]}>
                    <View style={styles.infoIcon}><Ionicons name="cash-outline" size={16} color="#333" /></View>
                    <Text style={styles.infoText}>Tiền đã cọc: <Text style={{ fontWeight: "700", color: "#059669" }}>{formatNumberWithDots(match.depositAmount)} VND</Text></Text>
                  </View>
                ) : null}

                {/* Skill Level */}
                <View style={[styles.infoRow, { paddingTop: 5, paddingBottom: 5 }]}>
                  <View style={styles.infoIcon}><Ionicons name="ribbon-outline" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>Trình độ: <Text style={{ fontWeight: "700", color: ORANGE }}>{match.skillLevel || "Người mới"}</Text></Text>
                </View>

                {/* Specific Address */}
                {match.specificAddress ? (
                  <View style={[styles.infoRow, { paddingBottom: 10 }]}>
                    <View style={styles.infoIcon}><Ionicons name="map-outline" size={16} color="#333" /></View>
                    <Text style={styles.infoText} numberOfLines={3}>Địa chỉ chi tiết: {match.specificAddress}</Text>
                  </View>
                ) : null}
              </View>

              {/* Flexible Centered Badges */}
              {(() => {
                const mainPlayersCount = match.sport === "football" && Array.isArray(match.selectedPositionIds) && match.selectedPositionIds.length > 0
                  ? match.selectedPositionIds.length
                  : Math.max(1, (match.maxPlayers || 10) - (match.benchMembers || 0));
                const totalHoursVal = match.totalHours || 1;
                const totalCostVal = match.totalCourtCost || (match.costPerPerson * totalHoursVal);
                const costPerPlayerVal = match.costPerPlayer || (totalCostVal ? Math.round(totalCostVal / mainPlayersCount) : match.costPerPerson);

                return (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, marginVertical: 12 }}>
                    <View style={{ backgroundColor: "#ECFDF5", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#A7F3D0", flexDirection: "row", alignItems: "center", marginRight: 5 }}>
                      <Ionicons name="cash-outline" size={14} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 14, color: "#059669", fontWeight: "700" }}>{formatCost(costPerPlayerVal)}</Text>
                    </View>

                    <View style={{ backgroundColor: "#FFF7ED", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#FFD8A8", flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="people-outline" size={14} color={ORANGE} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 14, color: "#C2410C", fontWeight: "700" }}>Đã tìm: {currentCount}/{displayTotalNeeded}</Text>
                    </View>

                    <View style={{ backgroundColor: "#FFFFFF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", marginRight: 15 }}>
                      <Ionicons name="basket-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 14, color: "#374151", fontWeight: "600" }}>Giá DV: {formatServiceCostDisplay(match.serviceCost)}</Text>
                    </View>
                  </View>
                );
              })()}

              {neededRolesList.length > 0 && (
                <View style={{ marginBottom: 3 }}>
                  <Text style={styles.gridLabel}>Vị trí cần tìm.</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {neededRolesList.map(({ role, qty }) => (
                      <View key={`needed_${role}`} style={styles.outlineRoleTag}>
                        <Text style={styles.outlineRoleTagText}>{ROLE_LABELS[role] || role} x{qty}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.locationRowContainer}>
                <View style={styles.locationInfoCol}>
                  <Ionicons name="location-outline" size={16} color="#333" style={{ marginRight: 8 }} />
                  <Text style={styles.locationInfoText} numberOfLines={2}>{match.locationName}</Text>
                </View>
                <TouchableOpacity style={styles.viewLocationBtn} onPress={handleOpenMap} activeOpacity={0.7}>
                  <Text style={styles.viewLocationBtnText}>Xem vị trí</Text>
                </TouchableOpacity>
              </View>

              {/* Court Details Button */}
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#EFF6FF",
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                  padding: 10,
                  borderRadius: 10,
                  gap: 6,
                }}
                onPress={() => setShowCourtDetailModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="information-circle" size={18} color="#2563EB" />
                <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 13 }}>Chi tiết sân</Text>
              </TouchableOpacity>

              {/* Contact organizer block */}
              {hasContactInfo ? (
                <View style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "#FFF7ED",
                  borderWidth: 1,
                  borderColor: "#FFD8A8",
                }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#C2410C", marginBottom: 6 }}>
                     LIÊN HỆ CHỦ SÂN
                  </Text>
                  {match.contactAppUser ? (
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}
                      onPress={() => openProfile(match.contactAppUser)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#4B5563" }}>
                        Tài khoản:
                      </Text>
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: ORANGE, textDecorationLine: "underline" }}>
                        {typeof match.contactAppUser === "object" ? (match.contactAppUser.name || "Tài khoản chủ sân") : "Tài khoản chủ sân"}
                      </Text>
                      <Ionicons name="open-outline" size={13} color={ORANGE} />
                    </TouchableOpacity>
                  ) : null}
                  {match.contactPhone ? (
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#4B5563", marginBottom: 8 }}>
                      Số điện thoại: {match.contactPhone}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    {match.contactAppUser ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          minWidth: 100,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ORANGE,
                          paddingVertical: 8,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          gap: 6
                        }}
                        onPress={() => openProfile(match.contactAppUser)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="person-circle" size={16} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                          {match.contactAppUser.name || "Tài khoản App"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {match.contactPhone ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          minWidth: 80,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#16A34A",
                          paddingVertical: 8,
                          borderRadius: 8,
                          gap: 6
                        }}
                        onPress={() => Linking.openURL(`tel:${match.contactPhone}`)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call" size={15} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Gọi điện</Text>
                      </TouchableOpacity>
                    ) : null}
                    
                    {contactZaloValue ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          minWidth: 70,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#0068FF",
                          paddingVertical: 8,
                          borderRadius: 8,
                          gap: 6
                        }}
                        onPress={() => {
                          const cleanZalo = contactZaloValue.replace(/[^0-9]/g, "");
                          const zaloUrl = contactZaloValue.startsWith("http")
                            ? contactZaloValue
                            : `https://zalo.me/${cleanZalo || contactZaloValue}`;
                          Linking.openURL(zaloUrl);
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="chat-processing" size={15} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Zalo</Text>
                      </TouchableOpacity>
                    ) : null}

                    {contactFacebookValue ? (
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          minWidth: 90,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#1877F2",
                          paddingVertical: 8,
                          borderRadius: 8,
                          gap: 6
                        }}
                        onPress={() => {
                          const fbUrl = contactFacebookValue.startsWith("http")
                            ? contactFacebookValue
                            : `https://facebook.com/${contactFacebookValue}`;
                          Linking.openURL(fbUrl);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-facebook" size={15} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Facebook</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* TỔNG KẾT TIỀN TRONG TRẬN (Match Cost Summary Calculator) */}
        {isMatchStarted && (
          <View style={[styles.card, { marginTop: 12, paddingVertical: 14 }]}>
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 4,
              }}
              onPress={() => setIsCostCalcExpanded(!isCostCalcExpanded)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calculator" size={20} color={ORANGE} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#1F2937" }}>
                  Tổng kết chi phí trận đấu
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600" }}>
                  {isCostCalcExpanded ? "Thu gọn" : "Mở rộng"}
                </Text>
                <Ionicons
                  name={isCostCalcExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#6B7280"
                />
              </View>
            </TouchableOpacity>

            {isCostCalcExpanded && (
              <View style={{ marginTop: 12, marginHorizontal: -8 }}>
                {/* Toolbar - only show for owner and not ended */}
                {isCostEditable && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      gap: 8,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#F3F4F6",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                      }}
                      onPress={toggleSelectAll}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#4B5563" }}>
                        {costItems.every((x) => x.selected) ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        backgroundColor: "#FFF7ED",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        borderWidth: 1,
                        borderColor: "#FFD8A8",
                      }}
                      onPress={handleAddCostItem}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={14} color={ORANGE} />
                      <Text style={{ fontSize: 13, fontWeight: "700", color: ORANGE }}>
                        Thêm khoản chi
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Table Headers */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                    marginBottom: 10,
                  }}
                >
                  <View style={{ width: 28 }} />
                  <Text style={{ flex: 3.2, fontSize: 13, fontWeight: "700", color: "#6B7280" }}>
                    Tên chi phí
                  </Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#6B7280", textAlign: "center" }}>
                    SL
                  </Text>
                  <Text style={{ flex: 2, fontSize: 13, fontWeight: "700", color: "#6B7280", textAlign: "right", marginRight: isCostEditable ? 26 : 0 }}>
                    Đơn giá (VND)
                  </Text>
                </View>

                {/* Table Rows */}
                {costItems.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 10,
                      gap: 8,
                    }}
                  >
                    {/* Checkbox */}
                    <TouchableOpacity
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: ORANGE,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: item.selected ? ORANGE : "transparent",
                        opacity: isCostEditable ? 1 : 0.7,
                      }}
                      onPress={() => handleToggleSelectItem(item.id)}
                      disabled={!isCostEditable}
                      activeOpacity={0.7}
                    >
                      {item.selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>

                    {/* Name Input */}
                    <TextInput
                      style={{
                        flex: 3.2,
                        borderWidth: 1,
                        borderColor: "#D1D5DB",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 0,
                        height: 42,
                        fontSize: 15,
                        color: "#374151",
                        backgroundColor: isCostEditable ? "#FFF" : "#F3F4F6",
                      }}
                      placeholder="Tên chi phí"
                      value={item.name}
                      editable={isCostEditable}
                      onChangeText={(val) => handleUpdateItem(item.id, "name", val)}
                    />

                    {/* Quantity Input */}
                    <TextInput
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "#D1D5DB",
                        borderRadius: 8,
                        paddingVertical: 0,
                        height: 42,
                        fontSize: 15,
                        color: "#374151",
                        textAlign: "center",
                        backgroundColor: isCostEditable ? "#FFF" : "#F3F4F6",
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      value={String(item.quantity || "")}
                      editable={isCostEditable}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9]/g, "");
                        handleUpdateItem(item.id, "quantity", cleaned ? Number(cleaned) : 0);
                      }}
                    />

                    {/* Price Input */}
                    <TextInput
                      style={{
                        flex: 2,
                        borderWidth: 1,
                        borderColor: "#D1D5DB",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 0,
                        height: 42,
                        fontSize: 15,
                        color: "#374151",
                        textAlign: "right",
                        backgroundColor: isCostEditable ? "#FFF" : "#F3F4F6",
                      }}
                      keyboardType="numeric"
                      placeholder="0"
                      value={formatNumberWithDots(item.price || "")}
                      editable={isCostEditable}
                      onChangeText={(val) => {
                        const raw = val.replace(/[^0-9]/g, "");
                        handleUpdateItem(item.id, "price", raw ? Number(raw) : 0);
                      }}
                    />

                    {/* Delete Button - only for owner */}
                    {isCostEditable && (
                      <TouchableOpacity
                        onPress={() => handleDeleteItem(item.id)}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* Summary Calculator Results */}
                <View
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: "#E5E7EB",
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#4B5563" }}>
                      Tổng chi phí được chọn:
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: "#10B981" }}>
                      {formatNumberWithDots(totalSelectedCost)} VND
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#F3F4F6",
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="people-outline" size={18} color="#6B7280" />
                      <Text style={{ fontSize: 14, color: "#6B7280", fontWeight: "600" }}>
                        Số người chơi:
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TouchableOpacity
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                        onPress={() => setParticipantCountOverride((prev) => Math.max(1, Number(prev || 1) - 1))}
                        disabled={!isCostEditable}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#374151" }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: ORANGE, minWidth: 26, textAlign: "center" }}>
                        {settlementParticipantCount}
                      </Text>
                      <TouchableOpacity
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                        onPress={() => setParticipantCountOverride((prev) => Number(prev || 1) + 1)}
                        disabled={!isCostEditable}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#374151" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      backgroundColor: "#FFF7ED",
                      padding: 10,
                      borderRadius: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="calculator-outline" size={18} color={ORANGE} />
                      <Text style={{ fontSize: 14, color: "#6B7280", fontWeight: "600" }}>
                        Chia đều ({settlementParticipantCount} người):
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: ORANGE }}>
                      {formatNumberWithDots(Math.round(totalSelectedCost / Math.max(1, settlementParticipantCount)))} VND / người
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Danh sách tham gia & Nút Đánh giá ⭐ nằm ngang hàng ở bên phải cho từng người chơi */}
        <View style={styles.participantSectionContainer}>
          <TouchableOpacity
            style={[styles.sectionTitleRow, { alignItems: 'center' }]}
            onPress={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Danh sách tham gia</Text>
              <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>
                ({allParticipants.length})
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {isOwner && !isEnded && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#F3E8FF',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 16,
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowVirtualModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-add-outline" size={14} color="#7E22CE" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#7E22CE' }}>
                    + Tài khoản ảo
                  </Text>
                </TouchableOpacity>
              )}
              <Ionicons
                name={isParticipantsExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color="#6B7280"
              />
            </View>
          </TouchableOpacity>

          {isParticipantsExpanded && (
            <>
              {allParticipants.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có ai tham gia</Text>
              ) : (
                allParticipants.map((p, idx) => {
                  const pid = getUserId(p);
                  const isCreatorParticipant = pid === creatorId;
                  const isMe = String(pid) === String(userId);

                  return (
                    <UserRow
                      key={pid ? `p_${pid}_${idx}` : `p_idx_${idx}`}
                      user={typeof p === "object" ? p : { name: "Người chơi" }}
                      label={getParticipantPositionLabel(pid, p)}
                      badge={null}
                      isMe={isMe}
                      showTeammatesIcon={!isCreatorParticipant}
                      onPress={() => openProfile(p)}
                      rightAction={
                        // CHUẨN THIẾT KẾ: Nút Đánh giá ⭐ nằm ngang hàng ở góc phải khi trận đấu đã kết thúc & viewer là người tham gia trận
                        isEnded && !isMe && isUserParticipant(match) ? (
                          <TouchableOpacity
                            style={{
                              backgroundColor: "#FFF7ED",
                              borderWidth: 1,
                              borderColor: "#FFD8A8",
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 20,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                            onPress={() => handleOpenSingleRating(p)}
                            disabled={myRatedUserIds.includes(String(pid))}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="star" size={14} color={myRatedUserIds.includes(String(pid)) ? "#D1D5DB" : "#F59E0B"} />
                            <Text style={{ fontSize: 12, fontWeight: "700", color: myRatedUserIds.includes(String(pid)) ? "#9CA3AF" : "#C2410C" }}>
                              {myRatedUserIds.includes(String(pid)) ? 'Đã đánh giá' : 'Đánh giá'}
                            </Text>
                          </TouchableOpacity>
                        ) : isOwner && !isCreatorParticipant && !isEnded ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {Boolean(p.isVirtual) && (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: '#F3E8FF',
                                  borderWidth: 1,
                                  borderColor: '#E9D5FF',
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  borderRadius: 14,
                                }}
                                onPress={() => {
                                  setVirtualPositionTarget(p);
                                  const currentPosEntry = (match?.memberPositions || []).find((m) => getUserId(m.userId) === pid);
                                  setSelectedVirtualPosId(currentPosEntry?.positionId || "");
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#7E22CE' }}>
                                  Vị trí
                                </Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={styles.kickSmallBtn}
                              onPress={() => handleOpenKick(p)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.kickSmallBtnText}>Kích</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null
                      }
                    />
                  );
                })
              )}

              {/* Nút Mời thêm bạn bè */}
              {isOwner && (
                isEnded ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#F3F4F6",
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginTop: 10,
                      marginBottom: 8,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="ban-outline" size={18} color="#9CA3AF" />
                    <Text style={{ color: "#6B7280", fontWeight: "700", fontSize: 13.5 }}>
                      Trận đấu đã kết thúc (Không thể mời)
                    </Text>
                  </View>
                ) : match?.teamStatus === "ongoing" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#F3F4F6",
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginTop: 10,
                      marginBottom: 8,
                      gap: 6,
                    }}
                  >
                    <Ionicons name="ban-outline" size={18} color="#9CA3AF" />
                    <Text style={{ color: "#6B7280", fontWeight: "700", fontSize: 13.5 }}>
                      Trận đấu đang diễn ra (Không thể mời)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#FFF7ED",
                      borderWidth: 1.5,
                      borderColor: "#FFD8A8",
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      marginTop: 10,
                      marginBottom: 8,
                      gap: 6,
                    }}
                    onPress={handleOpenInvite}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add" size={18} color={ORANGE} />
                    <Text style={{ color: ORANGE, fontWeight: "700", fontSize: 13.5 }}>
                      + Mời thêm bạn bè tham gia
                    </Text>
                  </TouchableOpacity>
                )
              )}

              {/* NÚT THAM GIA HOẶC HỦY YÊU CẦU CHO NGƯỜI CHƠI KHÁC */}
              {canJoinMatch && (
                <TouchableOpacity
                  style={styles.joinBottomBtn}
                  onPress={handleRequestJoin}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.joinBottomBtnText}>Tham gia trận đấu</Text>
                </TouchableOpacity>
              )}

              {hasPendingRequest && !isOwner && (
                <View style={styles.actionStack}>
                  <TouchableOpacity
                    style={styles.joinBottomBtn}
                    onPress={handleChangePositionRequest}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.joinBottomBtnText}>Thay đổi vị trí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.joinBottomBtn, styles.joinBottomBtnSecondary]}
                    onPress={handleCancelRequest}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.joinBottomBtnText}>Hủy yêu cầu</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Nhóm chat gắn với trận đấu */}
        {match?.chatGroupId && isUserParticipant(match) ? (() => {
          const chatGroupData = match.chatGroupId;
          const chatGroupName = typeof chatGroupData === "object" && chatGroupData
            ? (chatGroupData.name || "Nhóm chat trận đấu")
            : "Nhóm chat trận đấu";
          const convId = typeof chatGroupData === "object" && chatGroupData
            ? (chatGroupData._id || chatGroupData.id)
            : chatGroupData;

          return (
            <View style={{
              marginTop: 12,
              marginBottom: 8,
              padding: 14,
              backgroundColor: "#EFF6FF",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#BFDBFE",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="chatbubbles" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#1E3A8A" }} numberOfLines={1}>
                    {chatGroupName}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#3B82F6", marginTop: 2 }}>
                    {isUserParticipant(match) ? "Tự động thêm khi tham gia trận" : "Chỉ thành viên trận mới có thể vào nhóm"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: "#2563EB", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
                onPress={() => {
                  if (!convId) return;
                  navigation.navigate("ChatDetail", {
                    conversationId: convId,
                    isGroup: true,
                    peer: { name: chatGroupName },
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12.5 }}>Vào nhóm</Text>
              </TouchableOpacity>
            </View>
          );
        })() : null}

        {/* BẮT ĐẦU / KẾT THÚC TRẬN CỦA CHỦ TRẬN */}
        {isOwner && (
          <View style={styles.ownerMatchStatusContainer}>
            {match.teamStatus === "ongoing" ? (
              <TouchableOpacity
                style={[styles.statusControlBtn, styles.statusControlEndBtn]}
                onPress={handleEndMatch}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="stop-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.statusControlBtnText}>Kết thúc trận đấu</Text>
              </TouchableOpacity>
            ) : match.teamStatus === "ended" || match.status === "completed" ? (
              <>
                <View style={[styles.statusControlBtn, styles.statusControlEndedBadge]}>
                  <Ionicons name="flag-outline" size={20} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={[styles.statusControlBtnText, { color: "#4B5563" }]}>Trận đấu đã kết thúc</Text>
                </View>
                <TouchableOpacity
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#16A34A",
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                  }}
                  onPress={() => navigation.navigate("Home", { screen: "MatchesTab" })}
                  activeOpacity={0.9}
                >
                  <Ionicons name="home" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>Quay lại trang chủ</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.statusControlBtn, styles.statusControlStartBtn]}
                onPress={handleStartMatch}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="play-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.statusControlBtnText}>Bắt đầu trận đấu</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* POPUP MODAL ĐÁNH GIÁ CÁ NHÂN TỪNG NGƯỜI CHƠI */}
        <Modal visible={!!singleRatingTarget} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
            <View style={{ width: "100%", backgroundColor: "#FFF", borderRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#111", textAlign: "center", marginBottom: 4 }}>
                Đánh giá người chơi
              </Text>
              <Text style={{ fontSize: 14, color: "#666", textAlign: "center", marginBottom: 16 }}>
                Chấm điểm cho <Text style={{ fontWeight: "700", color: "#111" }}>{singleRatingTarget?.name}</Text>
              </Text>

              <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setSingleStars(star)}>
                    <Ionicons
                      name={star <= singleStars ? "star" : "star-outline"}
                      size={32}
                      color="#F59E0B"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={{
                  backgroundColor: "#F9FAFB",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                  marginBottom: 20,
                  height: 70,
                  textAlignVertical: "top",
                }}
                placeholder="Nhập lời nhận xét (Vd: Đá nhiệt tình, giao lưu vui vẻ...)"
                value={singleComment}
                onChangeText={setSingleComment}
                multiline
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" }}
                  onPress={() => setSingleRatingTarget(null)}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#666" }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: ORANGE, alignItems: "center" }}
                  onPress={handleSubmitSingleRating}
                  disabled={submittingRating}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFF" }}>
                    {submittingRating ? "Đang gửi..." : "Gửi đánh giá"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL MỜI BẠN BÈ */}
        <Modal visible={showInviteModal} animationType="slide">
          <Screen style={styles.safeArea} edges={['left', 'right', 'bottom']}>
            <ScreenHeader style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.backArrow}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Chọn người bạn muốn mời</Text>
              <View style={styles.headerSpacer} />
            </ScreenHeader>

            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              {inviteLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={ORANGE} />
                </View>
              ) : followingUsers.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyInviteText}>Không có người dùng nào để mời</Text>
                  <Text style={styles.emptyInviteSub}>Bạn chưa follow ai hoặc tất cả đã tham gia</Text>
                </View>
              ) : (
                <FlatList
                  data={followingUsers}
                  keyExtractor={(item) => String(item._id || item.id)}
                  contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
                  renderItem={({ item }) => {
                    const uName = item.name || "Người dùng";
                    const isInvited = Boolean(item.isInvited);
                    return (
                      <View style={styles.inviteUserCard}>
                        <View style={[styles.userAvatar, { backgroundColor: "#ef4444" }]}>
                          <Text style={styles.userInitials}>{getInitials(uName)}</Text>
                        </View>
                        <View style={styles.inviteUserInfo}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.inviteUserName}>{uName}</Text>
                            <Ionicons name="people-outline" size={14} color={ORANGE} />
                          </View>
                          <Text style={styles.inviteUserSub}>{item.favoriteSport || "Thể thao"}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.inviteActionBtn, isInvited && styles.inviteActionBtnDisabled]}
                          onPress={() => handleInviteUser(String(item._id || item.id))}
                          disabled={actionLoading || isInvited}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.inviteActionBtnText}>{isInvited ? "Đã mời" : "Mời"}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </Screen>
        </Modal>

        {/* MODAL DUYỆT YÊU CẦU THAM GIA */}
        <Modal visible={showRequestModal} animationType="slide">
          <Screen style={styles.safeArea} edges={['left', 'right', 'bottom']}>
            <View style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top }]}>
              <BackButton onPress={() => setShowRequestModal(false)} style={styles.backButton} />
              <Text style={styles.headerTitle}>Yêu cầu tham gia</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
              {pendingRequests.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>Không có yêu cầu nào</Text>
                </View>
              ) : (
                pendingRequests.map((p, idx) => {
                  const requestUserId = getUserId(p);
                  const requestUser = typeof p === "object" ? p : { name: "Người dùng" };
                  const requestName = requestUser.name || "Người dùng";
                  const requestPositions = getRequestPositions(requestUserId);
                  const posLabels = requestPositions.map((posId) => getPositionDisplayLabel(posId));
                  return (
                    <View key={requestUserId ? `req_${requestUserId}` : `req_idx_${idx}`} style={styles.requestFigmaCard}>
                      <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }} onPress={() => openProfile(p)} activeOpacity={0.7}>
                        <View style={[styles.userAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                          <Text style={styles.userInitials}>{getInitials(requestName)}</Text>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#111", marginLeft: 10 }}>{requestName}</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#111", lineHeight: 20, marginBottom: 8 }}>
                        {requestName} muốn tham gia ở các vị trí:
                      </Text>
                      {posLabels.length > 0 ? (
                        <View style={{ marginBottom: 16, gap: 6 }}>
                          {posLabels.map((label, index) => (
                            <View key={`${requestUserId}-${label}-${index}`} style={{ flexDirection: "row", alignItems: "center" }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE, marginRight: 8 }} />
                              <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>{label}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 16 }}>
                          Không có vị trí cụ thể
                        </Text>
                      )}
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <TouchableOpacity
                          style={styles.requestRejectBtn}
                          onPress={() => handleRejectRequest(requestUserId)}
                          disabled={actionLoading}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.requestRejectText}>Từ chối</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.requestAcceptBtn}
                          onPress={() => handleAcceptRequest(requestUserId)}
                          disabled={actionLoading}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.requestAcceptText}>Đồng ý</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Screen>
        </Modal>
        <Modal
          visible={showPositionModal}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowPositionModal(false)}
        >
          <View style={styles.positionModalContent}>
            <View style={styles.positionModalHeader}>
              <Text style={styles.positionModalTitle}>Chọn vị trí muốn tham gia</Text>
              <TouchableOpacity onPress={() => setShowPositionModal(false)}>
                <Text style={styles.positionModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.positionModalList}>
              {positionOptions.map((option, idx) => {
                const isSelected = selectedPositions.includes(option.id);
                const isOccupied = option.disabled;
                const isDisabled = isOccupied || (!isSelected && selectedPositions.length >= 1);

                return (
                  <TouchableOpacity
                    key={option.id ? `pos_opt_${option.id}_${idx}` : `pos_opt_idx_${idx}`}
                    style={[
                      styles.positionOption,
                      isSelected && styles.positionOptionSelected,
                      isDisabled && styles.positionOptionDisabled,
                    ]}
                    onPress={() => togglePositionSelection(option)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.positionOptionText,
                        isSelected && styles.positionOptionTextSelected,
                        isDisabled && styles.positionOptionTextDisabled,
                      ]}>
                        {option.label} · {option.isBench ? `Dự bị · Đội ${option.teamNumber}` : `Đội ${option.teamNumber}`}
                      </Text>
                      {isOccupied && (
                        <Text style={{ color: "#9CA3AF", fontSize: 11.5, marginTop: 2, fontStyle: "italic" }}>
                          🔒 Đã có người chọn
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Text style={styles.positionOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.positionModalConfirm,
                selectedPositions.length !== 1 && styles.positionModalConfirmDisabled
              ]}
              onPress={handleConfirmJoinWithPositions}
              disabled={selectedPositions.length !== 1 || actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.positionModalConfirmText}>
                  Xác nhận tham gia (1 vị trí)
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>

        

      {/* ─── Invite Modal (from following list) ─── */}
      {/* ─── Invite Modal ─── */}
      <Modal visible={showInviteModal} animationType="slide">
        <Screen style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <ScreenHeader style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top }]}>
            <BackButton onPress={() => setShowInviteModal(false)} style={styles.backButton} />
            <Text style={styles.headerTitle}>Chọn người bạn muốn mời</Text>
            <View style={styles.headerSpacer} />
          </ScreenHeader>
          
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {inviteLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={ORANGE} />
              </View>
            ) : followingUsers.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyInviteText}>Không có người dùng nào để mời</Text>
                <Text style={styles.emptyInviteSub}>Bạn chưa follow ai hoặc tất cả đã tham gia</Text>
              </View>
            ) : (
              <FlatList
                data={followingUsers}
                keyExtractor={(item) => String(item._id || item.id)}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const uName = item.name || "Người dùng";
                  const isInvited = Boolean(item.isInvited);
                  return (
                    <View style={styles.inviteUserCard}>
                      <View style={[styles.userAvatar, { backgroundColor: '#ef4444' }]}>
                        <Text style={styles.userInitials}>{getInitials(uName)}</Text>
                      </View>
                      <View style={styles.inviteUserInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.inviteUserName}>{uName}</Text>
                          <Ionicons name="people-outline" size={14} color={ORANGE} />
                        </View>
                        <Text style={styles.inviteUserSub}>{item.favoriteSport || "Thể thao"}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.inviteActionBtn, isInvited && styles.inviteActionBtnDisabled]}
                        onPress={() => handleInviteUser(String(item._id || item.id))}
                        disabled={actionLoading || isInvited}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inviteActionBtnText}>{isInvited ? "Đã mời" : "Mời"}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </Screen>
      </Modal>

      {/* ─── Kick Confirm Modal ─── */}
      <Modal visible={showKickModal} transparent animationType="fade">
        <View style={styles.kickOverlay}>
          <View style={styles.kickBox}>
            <Text style={styles.kickTitle}>Kích thành viên</Text>
            <Text style={styles.kickSubtitle}>
              Bạn có chắc muốn kích <Text style={{ fontWeight: "700" }}>{kickTarget?.name || "người này"}</Text> ra khỏi trận?
            </Text>
            <TextInput
              style={styles.kickReasonInput}
              placeholder="Lý do kích (không bắt buộc)..."
              value={kickReason}
              onChangeText={setKickReason}
              multiline
            />
            <View style={styles.kickActions}>
              <TouchableOpacity
                style={styles.kickCancelBtn}
                onPress={() => { setShowKickModal(false); setKickTarget(null); setKickReason(""); }}
              >
                <Text style={styles.kickCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.kickConfirmBtn}
                onPress={handleKickUser}
                disabled={actionLoading}
              >
                <Text style={styles.kickConfirmText}>{actionLoading ? "Đang xử lý..." : "Kích ngay"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Options Modal (3 dots) ─── */}
      <Modal visible={showOptionsModal} transparent animationType="slide">
        <View style={styles.optionsOverlay}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Tùy chọn trận đấu</Text>
            
            <TouchableOpacity 
              style={styles.optionBtn} 
              onPress={() => { setShowOptionsModal(false); handleEdit(); }}
            >
              <Ionicons name="pencil-outline" size={22} color="#1F2937" style={{ width: 28 }} />
              <Text style={styles.optionBtnText}>Sửa trận đấu</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionBtn} 
              onPress={() => { setShowOptionsModal(false); handleDelete(); }}
            >
              <Ionicons name="trash-outline" size={22} color="#EF4444" style={{ width: 28 }} />
              <Text style={[styles.optionBtnText, { color: '#EF4444' }]}>Xóa trận đấu</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionsCancelBtn} 
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionsCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Court Detail Modal */}
      <CourtDetailModal
        visible={showCourtDetailModal}
        court={
          COURT_DIRECTORY.find(
            (c) => c.name === match.locationName || c.address === match.specificAddress
          ) || {
            name: match.locationName,
            address: match.specificAddress || match.locationName,
            intro: match.courtDescription,
            coords: coords,
            phone: match.contactPhone,
          }
        }
        onClose={() => setShowCourtDetailModal(false)}
      />

      {/* Virtual Account Modal */}
      <VirtualAccountModal
        visible={showVirtualModal}
        onClose={() => setShowVirtualModal(false)}
        matchId={matchId}
        matchParticipants={allParticipants}
        onMatchUpdated={async (updated) => {
          setMatch(updated);
          await reloadMatch();
        }}
        token={token}
      />

      {/* Position Assigning Modal for Owner */}
      <Modal visible={!!virtualPositionTarget} transparent animationType="slide">
        <View style={styles.positionModalOverlay}>
          <View style={styles.positionModalCard}>
            {/* Header with Virtual Account Preview */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#8E24AA', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>
                  {getInitials(virtualPositionTarget?.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                    {virtualPositionTarget?.name || "Tài khoản ảo"}
                  </Text>
                  <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#7E22CE', fontSize: 10, fontWeight: '700' }}>Ảo</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Chọn 1 vị trí thi đấu khả dụng:
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
              {virtualPositionOptions.map((option, idx) => {
                const isSelected = selectedVirtualPosId === option.id;
                const isDisabled = option.isDisabled;

                return (
                  <TouchableOpacity
                    key={option.id ? `vpos_opt_${option.id}_${idx}` : `vpos_opt_empty_${idx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isSelected ? '#FFF7ED' : (isDisabled ? '#F9FAFB' : '#FFFFFF'),
                      borderWidth: 1.5,
                      borderColor: isSelected ? ORANGE : (isDisabled ? '#E5E7EB' : '#E5E7EB'),
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      marginBottom: 8,
                      opacity: isDisabled ? 0.55 : 1,
                    }}
                    onPress={() => {
                      if (!isDisabled) {
                        setSelectedVirtualPosId(option.id);
                      }
                    }}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {option.teamNumber > 0 ? (
                          <View style={{
                            backgroundColor: option.teamNumber === 1 ? '#DBEAFE' : '#FEE2E2',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                          }}>
                            <Text style={{
                              color: option.teamNumber === 1 ? '#1D4ED8' : '#DC2626',
                              fontSize: 11,
                              fontWeight: '700',
                            }}>
                              Đội {option.teamNumber}
                            </Text>
                          </View>
                        ) : null}

                        <Text style={{
                          fontSize: 14,
                          fontWeight: '700',
                          color: isDisabled ? '#9CA3AF' : (isSelected ? '#C2410C' : '#111827'),
                        }}>
                          {option.label}
                        </Text>
                      </View>

                      {option.disabledReason ? (
                        <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 4 }}>
                          • {option.disabledReason}
                        </Text>
                      ) : null}
                    </View>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' }}
                onPress={() => setVirtualPositionTarget(null)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#4B5563' }}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: ORANGE,
                  alignItems: 'center',
                }}
                onPress={async () => {
                  if (!virtualPositionTarget) return;
                  try {
                    setActionLoading(true);
                    const targetId = getUserId(virtualPositionTarget);
                    await updateMemberPosition(matchId, userId, targetId, selectedVirtualPosId);
                    Alert.alert("Thành công", `Đã cập nhật vị trí cho ${virtualPositionTarget.name || "thành viên"}!`);
                    setVirtualPositionTarget(null);
                    setSelectedVirtualPosId("");
                    await reloadMatch();
                  } catch (err) {
                    Alert.alert("Lỗi", err?.message || "Không thể cập nhật vị trí");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>
                  {actionLoading ? "Đang lưu..." : "Lưu vị trí"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </Screen>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 9,
    marginTop: 8,
    marginBottom: 4,
    height: 58,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 94, 94, 0.19)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: "#111", marginLeft: 8 },
  headerSpacer: { width: 36 },
  joinHeaderBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: 145,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  joinHeaderBtnText: { color: '#333', fontSize: 16, fontWeight: '700' },
  joinBottomBtn: {
    marginTop: 12,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBottomBtnSecondary: {
    backgroundColor: "#fa0414",
    borderWidth: 1,
    borderColor: "#fa0414",
  },
  joinBottomBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  redDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff3b30",
  },
  container: { padding: 16, paddingBottom: 96 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  sportSquare: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1, marginLeft: 12 },
  title: { fontSize: 18, fontWeight: "800", color: "#111" },
  timeAgoText: { fontSize: 12, color: "#888", marginTop: 4 },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    marginLeft: 8,
  },
  gridContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  gridColumn: { flex: 1 },
  gridLabel: { fontSize: 12, color: "#666", fontWeight: "600", marginBottom: 6 },
  gridBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  gridValue: { fontSize: 13, fontWeight: "700", color: "#333" },
  locationRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
  },
  locationInfoCol: { flex: 1, flexDirection: "row", alignItems: "center" },
  locationInfoText: { flex: 1, fontSize: 13, color: "#333", fontWeight: "600" },
  viewLocationBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
    flexShrink: 0,
  },
  viewLocationBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoSection: { marginTop: 16, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 14, color: "#333", fontWeight: "500", lineHeight: 20 },
  outlineRoleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  outlineRoleTagText: { fontSize: 12, fontWeight: "700", color: "#333" },
  sectionCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#333", marginBottom: 12 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  emptyText: { fontSize: 13, color: "#999" },
  userRowCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  userRow: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  userRowRightAction: { marginLeft: 8, justifyContent: "center", flexShrink: 0 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  userInitials: { color: "#fff", fontSize: 13, fontWeight: "800" },
  userInfo: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 15, fontWeight: "700", color: "#111" },
  userSub: { fontSize: 12, color: "#4B5563", marginTop: 2, fontWeight: "500" },
  participantSectionContainer: { marginBottom: 14, paddingHorizontal: 0 },
  figmaBadge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  figmaBadgeText: { fontSize: 11, color: "#333", fontWeight: "700" },
  kickSmallBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "center",
  },
  kickSmallBtnText: { color: "#b91c1c", fontSize: 12, fontWeight: "700" },
  requestFigmaCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestRejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  requestRejectText: { fontSize: 15, fontWeight: "700", color: "#333" },
  requestAcceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: "center",
  },
  requestAcceptText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  positionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  positionModalCard: {
    width: "100%",
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  positionModalContent: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  positionModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  positionModalTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  positionModalClose: { fontSize: 24, color: "#666", padding: 4 },
  positionModalList: { flex: 1, padding: 16 },
  positionOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  positionOptionSelected: { backgroundColor: "#eff6ff", borderColor: "#3b82f6" },
  positionOptionDisabled: { opacity: 0.55, backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  positionOptionText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  positionOptionTextSelected: { color: "#1d4ed8" },
  positionOptionTextDisabled: { color: "#6b7280" },
  positionOptionCheck: { fontSize: 18, fontWeight: "700", color: "#3b82f6" },
  positionModalConfirm: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  positionModalConfirmDisabled: {
    backgroundColor: "#ccc",
  },
  positionModalConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // ─── Section title row with invite button ───
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  inviteSmallBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  inviteSmallBtnText: {
    color: "#333",
    fontSize: 17,
    fontWeight: "700",
  },
  kickSmallBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "center",
  },
  kickSmallBtnText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  // ─── Invite Modal ───
  inviteUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inviteUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteUserName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  inviteUserSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  inviteActionBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inviteActionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyInviteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
    textAlign: "center",
  },
  emptyInviteSub: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
  },
  copyLinkBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  copyLinkLabel: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  copyLinkValue: {
    fontWeight: "700",
  },
  copyLinkBtn: {
    backgroundColor: ORANGE,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copyLinkBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // ─── Kick Modal ───
  kickOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  kickBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  kickTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  kickSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  kickReasonInput: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  kickActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  kickCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  kickCancelText: {
    color: "#64748b",
    fontWeight: "700",
  },
  kickConfirmBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  kickConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
  // ─── Options Modal ───
  optionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 60,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionBtnText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    marginLeft: 12,
  },
  optionsCancelBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  optionsCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  bottomBarOuter: {
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
  },
  bottomBarWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 40,
    borderWidth: 1.2,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  iconFrame: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
    overflow: 'hidden',
  },
  activeIconFrame: {
    backgroundColor: '#FF5F3D',
  },
  tabBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  positionModalConfirmDisabled: { backgroundColor: "#ccc" },
  positionModalConfirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statusBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusBarText: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.3 },
  ownerMatchStatusContainer: { marginTop: 14, marginBottom: 8 },
  statusControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  statusControlStartBtn: { backgroundColor: "#16A34A" },
  statusControlEndBtn: { backgroundColor: "#DC2626" },
  statusControlEndedBadge: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  statusControlBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
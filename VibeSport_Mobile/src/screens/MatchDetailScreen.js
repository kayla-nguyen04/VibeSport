import React, { useEffect, useState, useMemo } from "react";
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
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getMatchById,
  deleteMatch,
  requestJoinMatch,
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
} from "../services/matchService";
import { getFollowingListRequest } from "../services/userApi";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TagIcon } from "../components/TagIcon";
import { primary } from "../theme";

const ORANGE = primary.DEFAULT; // '#FF6B3D'
const SPORT_TAG_MAP = { football: "Bóng đá", badminton: "Cầu lông", pickleball: "Pickleball" };
const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

// ─── Football position definitions (mirrored from CreateMatchScreen) ────────
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

const getPositionDisplayLabel = (posId) => {
  const pos = ALL_POSITIONS.find((item) => item.id === posId);
  if (pos) {
    const teamNumber = pos.id.startsWith("t1_") ? 1 : 2;
    return `${pos.label} (Đội ${teamNumber})`;
  }
  if (typeof posId === "string" && posId.includes("bench")) {
    const teamNumber = posId.startsWith("t1_") ? 1 : 2;
    return `Dự bị (Đội ${teamNumber})`;
  }
  return posId;
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

const getFootballFormatLabel = (maxPlayers) => {
  if (!maxPlayers) return "";
  const fmt = FOOTBALL_FORMATS[maxPlayers];
  return fmt ? fmt.label : "";
};

const getFootballPlayerCountPerTeam = (maxPlayers) => {
  if (!maxPlayers) return null;
  const fmt = FOOTBALL_FORMATS[maxPlayers];
  return fmt ? fmt.playerCountPerTeam : null;
};

const ROLE_LABELS = {
  goalkeeper: "Thủ môn",
  defender: "Hậu vệ",
  midfielder: "Tiền vệ",
  striker: "Tiền đạo",
  bench: "Dự bị",
};

const ROLE_TAG_COLORS = {
  goalkeeper: { bg: "#dcfce7", text: "#166534" },
  defender:   { bg: "#dbeafe", text: "#1e40af" },
  midfielder: { bg: "#fef9c3", text: "#854d0e" },
  striker:    { bg: "#fee2e2", text: "#991b1b" },
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

const formatTimeLabel = (timeStr) => {
  if (!timeStr) return "";
  const cleaned = timeStr.trim();
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    return `${parts[0]}g ${parts[1]}p`;
  }
  return cleaned;
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

const normalizeId = (id) => (id == null ? "" : String(id));

const getUserId = (user) => normalizeId(typeof user === "object" ? user?._id || user?.id : user);

function UserRow({ user, label, badge, onPress, rightAction, isMe, showTeammatesIcon }) {
  if (!user || typeof user !== "object") return null;
  const name = user.name || "Người dùng";

  return (
    <View style={styles.userRowCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
          <View style={[styles.userAvatar, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.userInitials}>{getInitials(name)}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.userName}>{name}</Text>
              {isMe && <Text style={{ fontSize: 13, color: '#888' }}>• bạn</Text>}
              {showTeammatesIcon && (
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

export default function MatchDetailScreen({ navigation, route }) {
  const { matchId: routeMatchId } = route.params;
  const insets = useSafeAreaInsets();
  const chatUnreadCount = useSelector((state) => state.chat?.unreadCount || 0);
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const matchId = routeMatchId || route?.params?.matchId;
  const initialMatch = route?.params?.match;
  const [match, setMatch] = useState(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [joinSelectedPositions, setJoinSelectedPositions] = useState([]);

  // Invite & Kick modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showKickModal, setShowKickModal] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDetailsCollapsed, setShowDetailsCollapsed] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [kickReason, setKickReason] = useState("");

  const userId = normalizeId(user?.id || user?._id);

  // Extract position data safely (before early return so useMemo is always called)
  const selectedPositionIds = match?.selectedPositionIds || [];
  const benchTeam1 = match?.benchMembersTeam1 || 0;
  const benchTeam2 = match?.benchMembersTeam2 || 0;

  // Calculate team-based position breakdown (must be before early return)
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

  const totalNeeded = selectedPositionIds.length + benchTeam1 + benchTeam2;

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
  };

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        setLoading(true);
        await reloadMatch();
      } catch (err) {
        Alert.alert("Lỗi", err.message);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId, navigation]);

  const creator = typeof match?.createdBy === "object" ? match.createdBy : null;
  const creatorId = getUserId(creator || match?.createdBy);
  const ownerRoleEntry = Array.isArray(match?.memberRoles)
    ? match.memberRoles.find((entry) => entry?.role === "owner")
    : null;
  const ownerId = getUserId(ownerRoleEntry?.userId || creator || match?.createdBy);
  const isOwner = !!ownerId && String(ownerId) === String(userId);
  const currentCount = match?.currentPlayers || match?.participants?.length || 0;
  const maxCount = match?.maxPlayers || 10;
  const coords = match?.location;
  const participants = match?.participants || [];
  const pendingRequests = match?.pendingJoinRequests || [];

  // Merge creator into participant list (always show first)
  const allParticipants = useMemo(() => {
    if (!creator) return participants;
    const creatorInList = participants.some(p => getUserId(p) === creatorId);
    if (creatorInList) return participants;
    return [creator, ...participants];
  }, [creator, creatorId, participants]);
  const pendingRequestPositions = match?.pendingJoinRequestPositions || [];
  const invitedMembers = match?.invitedMembers || [];

  const positionOptions = useMemo(() => {
    if (match?.sport !== "football") return [];

    const takenPositionIds = new Set();
    pendingRequestPositions.forEach((entry) => {
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
  }, [match?.sport, match?.selectedPositionIds, match?.benchMembersTeam1, match?.benchMembersTeam2, pendingRequestPositions, userId]);

  const isParticipant = participants.some((p) => getUserId(p) === userId);
  const hasPendingRequest = pendingRequests.some((p) => getUserId(p) === userId);
  const isInvited = invitedMembers.some((p) => getUserId(p) === userId);
  const canJoinMatch = !isOwner && !isParticipant && !hasPendingRequest && !isInvited && !isEnded && !isFull;

  const getRequestPositions = (requestUserId) => {
    const entry = pendingRequestPositions.find((item) => String(item.userId) === String(requestUserId));
    return Array.isArray(entry?.positionIds) ? entry.positionIds : [];
  };
  const isFull = match?.status === "full" || currentCount >= maxCount;
  const isEnded = match?.status === "completed" || match?.status === "cancelled";

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
    navigation.navigate("UserProfile", { userId: profileUserId });
  };

  const handleOpenMap = () => {
    if (!coords?.lat || !coords?.lng) {
      Alert.alert("Thông báo", "Trận đấu này chưa có thông tin vị trí trên bản đồ.");
      return;
    }
    const label = encodeURIComponent(match.locationName || "Vị trí trận đấu");
    const url = Platform.select({
      ios: `maps:0,0?q=${coords.lat},${coords.lng}(${label})`,
      android: `geo:${coords.lat},${coords.lng}?q=${coords.lat},${coords.lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`,
    });
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps in browser
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`);
    });
  };

  const handleRequestJoin = () => {
    if (match?.sport === "football" && positionOptions.length > 0) {
      setSelectedPositions([]);
      setShowPositionModal(true);
      return;
    }
    Alert.alert("Xác nhận tham gia", "Bạn có chắc muốn gửi yêu cầu tham gia trận này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: () => handleConfirmJoin(),
      },
    ]);
  };

  const handleCancelRequest = async () => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn hủy yêu cầu tham gia này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            const data = await cancelJoinRequest(match._id, userId);
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

  const handleConfirmJoin = async () => {
    try {
      setActionLoading(true);
      const data = await requestJoinMatch(match._id, userId);
      setMatch(data);
      Alert.alert("Thành công", "Đã gửi yêu cầu tham gia đến chủ trận");
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setActionLoading(false);
      setShowPositionModal(false);
      setJoinSelectedPositions([]);
    }
  };

  const handleConfirmJoinWithPositions = async () => {
    if (selectedPositions.length !== 1) {
      Alert.alert("Thông báo", "Vui lòng chọn đúng 1 vị trí để tham gia");
      return;
    }

    Alert.alert("Xác nhận tham gia", "Bạn có chắc muốn gửi yêu cầu với vị trí đã chọn?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setActionLoading(true);
            setShowPositionModal(false);
            const data = await requestJoinMatch(match._id, userId, selectedPositions);
            setMatch(data);
            setSelectedPositions([]);
            Alert.alert("Thành công", "Đã gửi yêu cầu tham gia đến chủ trận");
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
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
            const data = await cancelJoinRequest(match._id, userId);
            setMatch(data);
            setSelectedPositions([]);
            setShowPositionModal(true);
          } catch (err) {
            Alert.alert("Lỗi", err.message || "Không thể đổi vị trí");
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
            const data = await acceptJoinMatch(match._id, userId, requestUserId);
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
            const data = await rejectJoinMatch(match._id, userId, requestUserId);
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
    navigation.navigate("CreateMatch", { editMatch: match });
  };

  const handleDelete = () => {
    Alert.alert(
      "Xóa trận đấu",
      "Bạn có chắc muốn xóa trận này? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMatch(match._id, token);
              Alert.alert("Thành công", "Đã xóa trận đấu");
              navigation.navigate("Home", { screen: "MatchesTab" });
            } catch (err) {
              Alert.alert("Lỗi", err.message);
            }
          },
        },
      ]
    );
  };

  // ─── Owner: Invite from following list ───────────────────────
  const handleOpenInvite = async () => {
    try {
      setInviteLoading(true);
      setShowInviteModal(true);
      const res = await getFollowingListRequest(token);
      const list = res?.data || [];
      // Filter out users already participating, requested, or invited
      const participantIds = participants.map((p) => getUserId(p));
      const pendingIds = pendingRequests.map((p) => getUserId(p));
      const invitedIds = (match.invitedMembers || []).map((p) => getUserId(p));
      const filtered = list.filter((u) => {
        const uid = String(u._id || u.id);
        return !participantIds.includes(uid) && !pendingIds.includes(uid) && !invitedIds.includes(uid) && uid !== ownerId;
      });
      setFollowingUsers(filtered);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tải danh sách");
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
              ? "Người được mời có thể chấp nhận ngay."
              : "Chủ đội sẽ duyệt lời mời trước khi người này vào đội.";
            Alert.alert("Đã gửi lời mời", message);
            setFollowingUsers(prev => prev.filter(u => String(u._id || u.id) !== String(targetUserId)));
          } catch (err) {
            Alert.alert("Lỗi", err.message || "Không thể mời");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleAcceptInvite = async () => {
    try {
      setActionLoading(true);
      const data = await acceptTeamInvite(match._id, userId);
      setMatch(data);
      Alert.alert("Thành công", "Bạn đã tham gia đội này.");
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể chấp nhận lời mời");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectInvite = async () => {
    try {
      setActionLoading(true);
      const data = await rejectTeamInvite(match._id, userId);
      setMatch(data);
      Alert.alert("Đã từ chối", "Bạn đã từ chối lời mời tham gia đội.");
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể từ chối lời mời");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Owner: Kick participant ─────────────────────────────────
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
            Alert.alert("Lỗi", err.message || "Không thể kích");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
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
        <TouchableOpacity
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết trận đấu</Text>
        
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isOwner && match.status !== "completed" && (
            <>
              <TouchableOpacity
                style={[styles.joinHeaderBtn, { width: 110 }]}
                onPress={() => setShowRequestModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.joinHeaderBtnText}>Yêu cầu</Text>
                {pendingRequests.length > 0 && <View style={styles.redDot} />}
              </TouchableOpacity>
            
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
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
              <Ionicons
                name={showDetailsCollapsed ? "chevron-down" : "chevron-up"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {!showDetailsCollapsed && (
            <>
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}><Ionicons name="time-outline" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>{formatTimeLabel(match.startTime)} - {getDayLabel(match.date)} - {match.date}</Text>
                </View>

                {match.note ? (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIcon}><MaterialCommunityIcons name="square-edit-outline" size={16} color="#333" /></View>
                    <Text style={styles.infoText}>{match.note}</Text>
                  </View>
                ) : null}

                <View style={[styles.infoRow, { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }]}> 
                  <View style={styles.infoIcon}><MaterialCommunityIcons name="soccer-field" size={16} color="#333" /></View>
                  <Text style={styles.infoText}>Loại sân: {getFormatLabel(match.sport, match.maxPlayers) || `${Math.floor(maxCount / 2)} vs ${Math.floor(maxCount / 2)}`}</Text>
                </View>
              </View>

              <View style={styles.gridContainer}>
                <View style={styles.gridColumn}>
                  <Text style={styles.gridLabel}>Số người đã tuyển.</Text>
                  <View style={styles.gridBox}>
                    <Ionicons name="people-outline" size={16} color="#333" />
                    <Text style={styles.gridValue}>{currentCount}/{maxCount}</Text>
                  </View>
                </View>
                <View style={styles.gridColumn}>
                  <Text style={styles.gridLabel}>Tiền cọc sân.</Text>
                  <View style={styles.gridBox}>
                    <Ionicons name="wallet-outline" size={16} color="#333" />
                    <Text style={styles.gridValue} numberOfLines={1}>{formatCost(match.costPerPerson)}</Text>
                  </View>
                </View>
              </View>

              {neededRolesList.length > 0 && (
                <View style={{ marginBottom: 16 }}>
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
                {coords?.lat != null && coords?.lng != null && (
                  <TouchableOpacity style={styles.viewLocationBtn} onPress={handleOpenMap} activeOpacity={0.7}>
                    <Text style={styles.viewLocationBtnText}>Xem vị trí</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {/* Creator is shown in participant list below with badge */}

        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Danh sách tham gia</Text>
            {isOwner && (
              <TouchableOpacity style={styles.inviteSmallBtn} onPress={handleOpenInvite} activeOpacity={0.7}>
                <Text style={styles.inviteSmallBtnText}>Mời +</Text>
              </TouchableOpacity>
            )}
          </View>
          {allParticipants.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có ai tham gia</Text>
          ) : (
            allParticipants.map((p, idx) => {
              const pid = getUserId(p);
              const isCreatorParticipant = pid === creatorId;
              const isMe = String(pid) === String(userId);
              return (
                <UserRow
                  key={pid || idx}
                  user={typeof p === "object" ? p : { name: "Người chơi" }}
                  badge={isCreatorParticipant ? "Người tạo trận" : "Người tham gia"}
                  isMe={isMe}
                  showTeammatesIcon={!isCreatorParticipant}
                  onPress={() => openProfile(p)}
                  rightAction={
                    isOwner && !isCreatorParticipant && !isEnded ? (
                      <TouchableOpacity
                        style={styles.kickSmallBtn}
                        onPress={() => handleOpenKick(p)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.kickSmallBtnText}>Kích</Text>
                      </TouchableOpacity>
                    ) : null
                  }
                />
              );
            })
          )}

          {canJoinMatch && (
            <TouchableOpacity
              style={styles.joinBottomBtn}
              onPress={handleRequestJoin}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.joinBottomBtnText}>Tham gia</Text>
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
        </View>

        

        <Modal visible={showRequestModal} animationType="slide">
          <Screen style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowRequestModal(false)}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
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
                    <View key={requestUserId || idx} style={styles.requestFigmaCard}>
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

        

        {/* Position Selection Modal */}
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
              {positionOptions.map((option) => {
                const isSelected = selectedPositions.includes(option.id);
                const hasSameRoleInSameTeamSelected = selectedPositions.some((selectedId) => {
                  const selectedOption = positionOptions.find((item) => item.id === selectedId);
                  return selectedOption && selectedOption.teamNumber === option.teamNumber && selectedOption.role === option.role && selectedId !== option.id;
                });
                const isDisabled = option.disabled || (!isSelected && selectedPositions.length >= 1);

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.positionOption,
                      isSelected && styles.positionOptionSelected,
                      isDisabled && styles.positionOptionDisabled,
                    ]}
                    onPress={() => togglePositionSelection(option)}
                    disabled={isDisabled}
                  >
                    <Text style={[
                      styles.positionOptionText,
                      isSelected && styles.positionOptionTextSelected,
                      isDisabled && styles.positionOptionTextDisabled,
                    ]}>
                      {option.label} · {option.isBench ? `Dự bị · Đội ${option.teamNumber}` : `Đội ${option.teamNumber}`}
                    </Text>
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

        

      </ScrollView>

      {/* ─── Invite Modal (from following list) ─── */}
      {/* ─── Invite Modal ─── */}
      <Modal visible={showInviteModal} animationType="slide">
        <Screen style={styles.safeArea}>
          <ScreenHeader style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowInviteModal(false)}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chọn người bạn muốn mời</Text>
            <View style={styles.headerSpacer} />
          </ScreenHeader>
          
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <View style={styles.copyLinkBox}>
              <Text style={styles.copyLinkLabel}>Link: <Text style={styles.copyLinkValue}>{match._id}</Text></Text>
              <TouchableOpacity style={styles.copyLinkBtn} onPress={() => Alert.alert("Đã sao chép link")}>
                <Text style={styles.copyLinkBtnText}>Sao chép link</Text>
              </TouchableOpacity>
            </View>

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
                        style={styles.inviteActionBtn}
                        onPress={() => handleInviteUser(String(item._id || item.id))}
                        disabled={actionLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inviteActionBtnText}>Mời</Text>
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


      {/* ─── Custom Bottom Tab Bar ─── */}

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
    height: 74,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(99, 94, 94, 0.19)",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  backArrow: { fontSize: 22, color: "#333" },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: "800", color: "#111", marginLeft: 8 },
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
  joinHeaderBtnText: { color: '#333', fontSize: 12, fontWeight: '700' },
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
  // sportIcon removed – now renders TagIcon directly
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
  gridColumn: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
    marginBottom: 6,
  },
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
  gridValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  locationRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
  },
  locationInfoCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  locationInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
  },
  costLabel: { fontSize: 13, color: "#856404", fontWeight: "600" },
  costValue: { fontSize: 15, color: "#856404", fontWeight: "800" },
  infoSection: { marginTop: 16, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 14, color: "#333", fontWeight: "500", lineHeight: 20 },
  infoTextMuted: { flex: 1, fontSize: 13, color: "#888", lineHeight: 20 },
  viewLocationBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
    flexShrink: 0,
  },
  viewLocationBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  pendingContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffdddd',
    borderRadius: 6,
  },
  cancelBtnText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 14,
  },
  invitedContainer: {
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  invitedBadgeText: {
    color: '#1e40af',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  invitedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptInviteBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  acceptInviteBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectInviteBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  rejectInviteBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  teamBlock: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  teamLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  teamLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222",
    flex: 1,
  },
  teamCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
  },
  roleTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 18,
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  outlineRoleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  outlineRoleTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },
  noteBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },
  noteLabel: { fontSize: 12, fontWeight: "700", color: "#888", marginBottom: 4 },
  noteText: { fontSize: 14, color: "#555", lineHeight: 20 },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#333", marginBottom: 12 },
  helperInfoText: { fontSize: 12, color: "#888", fontStyle: "italic", marginLeft: 4, flex: 1 },
  emptyText: { fontSize: 13, color: "#999" },
  userRowCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    padding: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  userRowContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 },
  userRow: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  userRowRightAction: { marginLeft: 8, justifyContent: "center", flexShrink: 0 },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitials: { color: "#fff", fontSize: 13, fontWeight: "800" },
  userInfo: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 15, fontWeight: "700", color: "#111" },
  userSub: { fontSize: 12, color: "#888", marginTop: 2 },
  figmaBadge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  figmaBadgeText: {
    fontSize: 11,
    color: "#333",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#fff3ef",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, color: ORANGE, fontWeight: "700" },
  chevron: { fontSize: 22, color: "#ccc", marginLeft: 8 },
  requestSummaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  requestSummaryText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  openRequestBtn: {
    backgroundColor: "#fff3ef",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  openRequestBtnText: {
    color: ORANGE,
    fontWeight: "700",
    fontSize: 13,
  },
  requestModalItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
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
  requestRejectText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  requestAcceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: "center",
  },
  requestAcceptText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  requestActions: { flexDirection: "row", gap: 8, marginLeft: 8, alignItems: "center" },
  requestPanel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  requestPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  requestPanelTitle: { fontSize: 14, fontWeight: "800", color: "#334155" },
  requestPanelChevron: { fontSize: 16, color: "#64748b" },
  requestPanelBody: { padding: 12, paddingTop: 8 },
  requestItem: { marginBottom: 10 },
  requestActions: { flexDirection: "row", gap: 8, marginLeft: 8, alignItems: "center" },
  acceptBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rejectBtn: {
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rejectBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  requestPositionBox: {
    marginTop: 6,
    marginLeft: 52,
    padding: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  requestPositionLabel: { fontSize: 11, fontWeight: "700", color: "#475569", marginBottom: 6 },
  requestPositionTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  requestPositionTag: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  requestPositionTagText: { fontSize: 11, fontWeight: "700", color: "#0369a1" },
  joinSection: { marginBottom: 12 },
  joinBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pendingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff8e1",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  pendingBadgeText: { color: "#856404", fontSize: 14, fontWeight: "700" },
  cancelBtn: { backgroundColor: "#ef4444", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  cancelBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  fullBadge: {
    backgroundColor: "#f3f3f3",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  fullBadgeText: { color: "#888", fontSize: 14, fontWeight: "700" },
  leaveActionBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  leaveActionText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
  ownerActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  editActionBtn: {
    flex: 1,
    backgroundColor: "#fff8e1",
    borderWidth: 1,
    borderColor: "#ffe082",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  editActionText: { fontSize: 15, fontWeight: "700", color: "#333" },
  deleteActionBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  deleteActionText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
  // Position Selection Modal
  modalOverlay: {
  flex: 1,
  backgroundColor: "#fff",
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
  positionModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  positionModalClose: {
    fontSize: 24,
    color: "#666",
    padding: 4,
  },
  positionModalList: {
    flex: 1,
    padding: 16,
  },
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
  positionOptionSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  positionOptionDisabled: {
    opacity: 0.55,
    backgroundColor: "#f3f4f6",
    borderColor: "#d1d5db",
  },
  positionOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  positionOptionTextSelected: {
    color: "#1d4ed8",
  },
  positionOptionTextDisabled: {
    color: "#6b7280",
  },
  positionOptionCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3b82f6",
  },
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
    fontSize: 12,
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyLinkBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
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
});

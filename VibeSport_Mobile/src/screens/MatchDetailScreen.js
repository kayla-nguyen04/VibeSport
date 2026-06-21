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
} from "react-native";
import { useSelector } from "react-redux";
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
} from "../services/matchService";
import { getFollowingListRequest } from "../services/userApi";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };
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

const ROLE_LABELS = {
  goalkeeper: "Thủ môn",
  defender: "Hậu vệ",
  midfielder: "Tiền vệ",
  striker: "Tiền đạo",
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
  if (c >= 1000) return `${c / 1000}K / người`;
  return `${c} VND`;
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

function UserRow({ user, label, badge, onPress, rightAction }) {
  if (!user || typeof user !== "object") return null;
  const name = user.name || "Người dùng";

  return (
    <View style={styles.userRowWrap}>
      <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
        <View style={[styles.userAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
          <Text style={styles.userInitials}>{getInitials(name)}</Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{name}</Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {label ? <Text style={styles.userMeta}>{label}</Text> : null}
          {user.area ? <Text style={styles.userMeta}>📍 {user.area}</Text> : null}
        </View>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </TouchableOpacity>
      {rightAction}
    </View>
  );
}

export default function MatchDetailScreen({ navigation, route }) {
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const matchId = route?.params?.matchId;
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

  if (loading || !match) {
    return (
      <Screen style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      </Screen>
    );
  }

  const creator = typeof match.createdBy === "object" ? match.createdBy : null;
  const creatorId = getUserId(creator || match.createdBy);
  const isOwner = creatorId === userId;
  const icon = SPORT_ICONS[match.sport] || "⚽";
  const currentCount = match.currentPlayers || match.participants?.length || 0;
  const maxCount = match.maxPlayers || 10;
  const coords = match.location;
  const participants = match.participants || [];
  const pendingRequests = match.pendingJoinRequests || [];

  const isParticipant = participants.some((p) => getUserId(p) === userId);
  const hasPendingRequest = pendingRequests.some((p) => getUserId(p) === userId);
  const isFull = match.status === "full" || currentCount >= maxCount;
  const isEnded = match.status === "completed" || match.status === "cancelled";

  const openProfile = (profileUser) => {
    const profileUserId = getUserId(profileUser);
    if (!profileUserId || profileUserId === userId) {
      navigation.navigate("Home", { activeTab: "profile" });
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
    if (match.sport === "football" && selectedPositionIds.length > 0) {
      setShowPositionModal(true);
      return;
    }
    handleConfirmJoin();
  };

  const handleCancelRequest = async () => {
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
  };

  const handleConfirmJoin = async () => {
    try {
      setActionLoading(true);
      // Currently the API does not accept positions; we just send join request
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
    if (selectedPositions.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một vị trí");
      return;
    }
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
  };

  const togglePositionSelection = (positionId) => {
    setSelectedPositions(prev =>
      prev.includes(positionId)
        ? prev.filter(id => id !== positionId)
        : [...prev, positionId]
    );
  };

  const handleAcceptRequest = async (requestUserId) => {
    try {
      setActionLoading(true);
      const data = await acceptJoinMatch(match._id, userId, requestUserId);
      setMatch(data);
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestUserId) => {
    try {
      setActionLoading(true);
      const data = await rejectJoinMatch(match._id, userId, requestUserId);
      setMatch(data);
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setActionLoading(false);
    }
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
              await deleteMatch(match._id);
              Alert.alert("Thành công", "Đã xóa trận đấu");
              navigation.navigate("Home", { activeTab: "teams" });
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
      // Filter out users already participating or with pending requests
      const participantIds = participants.map(p => getUserId(p));
      const pendingIds = pendingRequests.map(p => getUserId(p));
      const filtered = list.filter(u => {
        const uid = String(u._id || u.id);
        return !participantIds.includes(uid) && !pendingIds.includes(uid) && uid !== userId;
      });
      setFollowingUsers(filtered);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tải danh sách");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteUser = async (targetUserId) => {
    try {
      setActionLoading(true);
      const data = await inviteTeamMember(match._id, targetUserId);
      setMatch(data);
      Alert.alert("Đã gửi lời mời", "Người được mời sẽ thấy yêu cầu và cần chấp nhận để vào trận.");
      // Remove invited user from the list
      setFollowingUsers(prev => prev.filter(u => String(u._id || u.id) !== String(targetUserId)));
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể mời");
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
    try {
      setActionLoading(true);
      const targetId = getUserId(kickTarget);
      const data = await kickTeamMember(match._id, targetId, kickReason);
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
  };

  return (
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết trận đấu</Text>
        <View style={styles.headerSpacer} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.sportSquare}>
              <Text style={styles.sportIcon}>{icon}</Text>
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{match.title}</Text>
              <Text style={styles.statusText}>
                {match.status === "full" ? "Đã đủ người" : match.status === "completed" ? "Đã kết thúc" : "Tìm người"}
              </Text>
            </View>
          </View>

          <View style={styles.costStrip}>
            <Text style={styles.costLabel}>🪙 Chi phí sân</Text>
            <Text style={styles.costValue}>{formatCost(match.costPerPerson)}</Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🕒</Text>
              <Text style={styles.infoText}>{match.startTime} • {getDayLabel(match.date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>{match.locationName}</Text>
            </View>
            {coords?.lat != null && coords?.lng != null && (
              <TouchableOpacity style={styles.viewLocationBtn} onPress={handleOpenMap} activeOpacity={0.7}>
                <Text style={styles.viewLocationIcon}>🗺️</Text>
                <Text style={styles.viewLocationText}>Xem vị trí trên bản đồ</Text>
                <Text style={styles.viewLocationArrow}>→</Text>
              </TouchableOpacity>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>{icon}</Text>
              <Text style={styles.infoText}>
                {match.sport === "football" ? "11 vs 11" : `${Math.floor(maxCount / 2)} vs ${Math.floor(maxCount / 2)}`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>👥</Text>
              <Text style={styles.infoText}>{currentCount}/{maxCount} người</Text>
            </View>
          </View>

          {match.note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Ghi chú</Text>
              <Text style={styles.noteText}>{match.note}</Text>
            </View>
          ) : null}
        </View>

        {/* Số người cần tìm */}
        {match.sport === "football" && totalNeeded > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.neededHeaderRow}>
              <Text style={styles.sectionTitle}>🔍 Số người cần tìm</Text>
              <View style={styles.totalNeededBadge}>
                <Text style={styles.totalNeededText}>{totalNeeded} người</Text>
              </View>
            </View>

            {/* Team 1 */}
            {(teamBreakdown.teamA.count > 0 || teamBreakdown.teamA.bench > 0) && (
              <View style={styles.teamBlock}>
                <View style={styles.teamLabelRow}>
                  <View style={[styles.teamDot, { backgroundColor: "#3b82f6" }]} />
                  <Text style={styles.teamLabel}>Đội 1</Text>
                  <Text style={styles.teamCount}>
                    {teamBreakdown.teamA.count + teamBreakdown.teamA.bench} người
                  </Text>
                </View>
                <View style={styles.roleTags}>
                  {Object.entries(teamBreakdown.teamA.roles).map(([role, qty]) => (
                    <View
                      key={`a_${role}`}
                      style={[styles.roleTag, { backgroundColor: ROLE_TAG_COLORS[role]?.bg || "#f3f4f6" }]}
                    >
                      <Text style={[styles.roleTagText, { color: ROLE_TAG_COLORS[role]?.text || "#374151" }]}>
                        {ROLE_LABELS[role] || role} ×{qty}
                      </Text>
                    </View>
                  ))}
                  {teamBreakdown.teamA.bench > 0 && (
                    <View style={[styles.roleTag, { backgroundColor: "#f3f4f6" }]}>
                      <Text style={[styles.roleTagText, { color: "#6b7280" }]}>
                        Dự bị ×{teamBreakdown.teamA.bench}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Team 2 */}
            {(teamBreakdown.teamB.count > 0 || teamBreakdown.teamB.bench > 0) && (
              <View style={styles.teamBlock}>
                <View style={styles.teamLabelRow}>
                  <View style={[styles.teamDot, { backgroundColor: "#ef4444" }]} />
                  <Text style={styles.teamLabel}>Đội 2</Text>
                  <Text style={styles.teamCount}>
                    {teamBreakdown.teamB.count + teamBreakdown.teamB.bench} người
                  </Text>
                </View>
                <View style={styles.roleTags}>
                  {Object.entries(teamBreakdown.teamB.roles).map(([role, qty]) => (
                    <View
                      key={`b_${role}`}
                      style={[styles.roleTag, { backgroundColor: ROLE_TAG_COLORS[role]?.bg || "#f3f4f6" }]}
                    >
                      <Text style={[styles.roleTagText, { color: ROLE_TAG_COLORS[role]?.text || "#374151" }]}>
                        {ROLE_LABELS[role] || role} ×{qty}
                      </Text>
                    </View>
                  ))}
                  {teamBreakdown.teamB.bench > 0 && (
                    <View style={[styles.roleTag, { backgroundColor: "#f3f4f6" }]}>
                      <Text style={[styles.roleTagText, { color: "#6b7280" }]}>
                        Dự bị ×{teamBreakdown.teamB.bench}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {creator && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Người tạo trận</Text>
            <UserRow
              user={creator}
              label="Chủ trận"
              badge="Tạo trận"
              onPress={() => openProfile(creator)}
            />
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              Người tham gia ({participants.length})
            </Text>
            {isOwner && !isEnded && (
              <TouchableOpacity style={styles.inviteSmallBtn} onPress={handleOpenInvite} activeOpacity={0.7}>
                <Text style={styles.inviteSmallBtnText}>＋ Mời</Text>
              </TouchableOpacity>
            )}
          </View>
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có ai tham gia</Text>
          ) : (
            participants.map((p, idx) => {
              const pid = getUserId(p);
              const isCreatorParticipant = pid === creatorId;
              return (
                <UserRow
                  key={pid || idx}
                  user={typeof p === "object" ? p : { name: "Người chơi" }}
                  label={isCreatorParticipant ? "Chủ trận" : "Thành viên"}
                  badge={isCreatorParticipant ? "Tạo trận" : null}
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
        </View>

        {isOwner && pendingRequests.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Yêu cầu tham gia ({pendingRequests.length})</Text>
            {pendingRequests.map((p, idx) => {
              const requestUserId = getUserId(p);
              return (
                <UserRow
                  key={requestUserId || idx}
                  user={typeof p === "object" ? p : { name: "Người dùng" }}
                  label="Muốn tham gia trận"
                  onPress={() => openProfile(p)}
                  rightAction={
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAcceptRequest(requestUserId)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.acceptBtnText}>Chấp nhận</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleRejectRequest(requestUserId)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.rejectBtnText}>Từ chối</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              );
            })}
          </View>
        )}

        {!isOwner && !isEnded && !isParticipant && (
          <View style={styles.joinSection}>
            {hasPendingRequest ? (
              <View style={styles.pendingContainer}>
                <Text style={styles.pendingBadgeText}>⏳ Đã gửi yêu cầu tham gia</Text>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRequest} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Hủy yêu cầu</Text>
                </TouchableOpacity>
              </View>
            ) : isFull ? (
              <View style={styles.fullBadge}>
                <Text style={styles.fullBadgeText}>Trận đã đủ người</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.joinBtn, actionLoading && styles.joinBtnDisabled]}
                onPress={handleRequestJoin}
                disabled={actionLoading}
                activeOpacity={0.7}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.joinBtnText}>Tham gia</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

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
              {selectedPositionIds.map((posId) => {
                const pos = ALL_POSITIONS.find((p) => p.id === posId);
                if (!pos) return null;
                const isSelected = selectedPositions.includes(posId);
                return (
                  <TouchableOpacity
                    key={posId}
                    style={[
                      styles.positionOption,
                      isSelected && styles.positionOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedPositions((prev) =>
                        prev.includes(posId) ? prev.filter((id) => id !== posId) : [...prev, posId]
                      );
                    }}
                  >
                    <Text style={[
                      styles.positionOptionText,
                      isSelected && styles.positionOptionTextSelected
                    ]}>
                      {pos.label} (Đội {posId.startsWith('t1_') ? '1' : '2'})
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
                selectedPositions.length === 0 && styles.positionModalConfirmDisabled
              ]}
              onPress={handleConfirmJoinWithPositions}
              disabled={selectedPositions.length === 0 || actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.positionModalConfirmText}>
                  Xác nhận tham gia ({selectedPositions.length} vị trí)
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>

        {!isOwner && isParticipant && !isEnded && (
          <TouchableOpacity style={styles.leaveActionBtn} onPress={handleLeave} activeOpacity={0.7}>
            <Text style={styles.leaveActionText}>Rút khỏi trận</Text>
          </TouchableOpacity>
        )}

        {isOwner && match.status !== "completed" && (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.editActionBtn} onPress={handleEdit} activeOpacity={0.7}>
              <Text style={styles.editActionText}>✏️ Sửa trận đấu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteActionBtn} onPress={handleDelete} activeOpacity={0.7}>
              <Text style={styles.deleteActionText}>🗑️ Xóa trận đấu</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ─── Invite Modal (from following list) ─── */}
      <Modal visible={showInviteModal} animationType="slide">
        <Screen style={styles.safeArea}>
          <ScreenHeader style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowInviteModal(false)}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mời người đang follow</Text>
            <View style={styles.headerSpacer} />
          </ScreenHeader>
          {inviteLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#0066cc" />
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
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const uName = item.name || "Người dùng";
                return (
                  <View style={styles.inviteUserCard}>
                    <View style={[styles.userAvatar, { backgroundColor: AVATAR_COLORS[uName.length % AVATAR_COLORS.length] }]}>
                      <Text style={styles.userInitials}>{getInitials(uName)}</Text>
                    </View>
                    <View style={styles.inviteUserInfo}>
                      <Text style={styles.inviteUserName}>{uName}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backArrow: { fontSize: 22, color: "#333" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111", marginLeft: 8 },
  headerSpacer: { width: 36 },
  container: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  sportSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0d6efd",
    alignItems: "center",
    justifyContent: "center",
  },
  sportIcon: { fontSize: 24 },
  titleBlock: { flex: 1, marginLeft: 12 },
  title: { fontSize: 18, fontWeight: "800", color: "#111" },
  statusText: { fontSize: 13, color: "#22c55e", fontWeight: "700", marginTop: 4 },
  costStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fffbf0",
    padding: 12,
    borderRadius: 8,
    marginTop: 14,
  },
  costLabel: { fontSize: 13, color: "#856404", fontWeight: "600" },
  costValue: { fontSize: 15, color: "#856404", fontWeight: "800" },
  infoSection: { marginTop: 16, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "flex-start" },
  infoIcon: { fontSize: 14, width: 28 },
  infoText: { flex: 1, fontSize: 14, color: "#333", fontWeight: "500", lineHeight: 20 },
  infoTextMuted: { flex: 1, fontSize: 13, color: "#888", lineHeight: 20 },
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
  emptyText: { fontSize: 13, color: "#999" },
  userRowWrap: { marginBottom: 10 },
  userRow: { flexDirection: "row", alignItems: "center" },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitials: { color: "#fff", fontSize: 13, fontWeight: "800" },
  userInfo: { marginLeft: 12, flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 15, fontWeight: "700", color: "#111" },
  userMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  badge: {
    backgroundColor: "#eef4ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, color: "#0066cc", fontWeight: "700" },
  chevron: { fontSize: 22, color: "#ccc", marginLeft: 8 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 8, marginLeft: 52 },
  acceptBtn: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rejectBtn: {
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rejectBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  joinSection: { marginBottom: 12 },
  joinBtn: {
    backgroundColor: "#0066cc",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pendingBadge: {
    backgroundColor: "#fff8e1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  pendingBadgeText: { color: "#856404", fontSize: 14, fontWeight: "700" },
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
  ownerActions: { gap: 10, marginTop: 4 },
  editActionBtn: {
    backgroundColor: "#fff8e1",
    borderWidth: 1,
    borderColor: "#ffe082",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  editActionText: { fontSize: 15, fontWeight: "700", color: "#333" },
  deleteActionBtn: {
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
  positionOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  positionOptionTextSelected: {
    color: "#1d4ed8",
  },
  positionOptionCheck: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3b82f6",
  },
  positionModalConfirm: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#0066cc",
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
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteSmallBtnText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "700",
  },
  kickSmallBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 6,
    marginLeft: 52,
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
    backgroundColor: "#0066cc",
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
});

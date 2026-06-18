import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSelector } from "react-redux";
import {
  getMatchById,
  deleteMatch,
  requestJoinMatch,
  acceptJoinMatch,
  rejectJoinMatch,
  leaveMatch,
} from "../services/matchService";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };
const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

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
  const matchId = route?.params?.matchId;
  const initialMatch = route?.params?.match;
  const [match, setMatch] = useState(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);
  const [actionLoading, setActionLoading] = useState(false);

  const userId = normalizeId(user?.id || user?._id);

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

  const handleRequestJoin = async () => {
    try {
      setActionLoading(true);
      const data = await requestJoinMatch(match._id, userId);
      setMatch(data);
      Alert.alert("Thành công", "Đã gửi yêu cầu tham gia đến chủ trận");
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    } finally {
      setActionLoading(false);
    }
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
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>🗺️</Text>
                <Text style={styles.infoTextMuted}>
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </Text>
              </View>
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
          <Text style={styles.sectionTitle}>
            Người tham gia ({participants.length})
          </Text>
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
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>⏳ Đã gửi yêu cầu tham gia</Text>
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
});

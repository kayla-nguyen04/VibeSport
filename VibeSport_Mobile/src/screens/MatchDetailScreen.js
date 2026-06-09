import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSelector } from "react-redux";
import { getMatchById, deleteMatch } from "../services/matchService";
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

export default function MatchDetailScreen({ navigation, route }) {
  const user = useSelector((state) => state.auth?.user);
  const matchId = route?.params?.matchId;
  const initialMatch = route?.params?.match;
  const [match, setMatch] = useState(initialMatch || null);
  const [loading, setLoading] = useState(!initialMatch);

  const userId = normalizeId(user?.id || user?._id);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getMatchById(matchId);
        setMatch(data);
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
  const creatorId = normalizeId(creator?._id || creator?.id || match.createdBy);
  const isOwner = creatorId === userId;
  const icon = SPORT_ICONS[match.sport] || "⚽";
  const currentCount = match.currentPlayers || match.participants?.length || 0;
  const maxCount = match.maxPlayers || 10;
  const coords = match.location;

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
              <Text style={styles.infoIcon}>⚽</Text>
              <Text style={styles.infoText}>
                {Math.floor(maxCount / 2)} vs {Math.floor(maxCount / 2)}
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
          <View style={styles.creatorCard}>
            <Text style={styles.sectionTitle}>Người tạo trận</Text>
            <View style={styles.creatorRow}>
              <View style={[styles.creatorAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
                <Text style={styles.creatorInitials}>{getInitials(creator.name)}</Text>
              </View>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{creator.name || "Người dùng"}</Text>
                {creator.area ? <Text style={styles.creatorMeta}>📍 {creator.area}</Text> : null}
                {creator.favoriteSport ? (
                  <Text style={styles.creatorMeta}>⚽ {creator.favoriteSport}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {(match.participants || []).length > 0 && (
          <View style={styles.participantsCard}>
            <Text style={styles.sectionTitle}>Người tham gia</Text>
            <View style={styles.participantList}>
              {match.participants.map((p, idx) => {
                const name = typeof p === "object" ? p.name : "Người chơi";
                return (
                  <View key={idx} style={styles.participantItem}>
                    <View style={[styles.participantAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                      <Text style={styles.participantInitials}>{getInitials(name)}</Text>
                    </View>
                    <Text style={styles.participantName}>{name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
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
  creatorCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#333", marginBottom: 12 },
  creatorRow: { flexDirection: "row", alignItems: "center" },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorInitials: { color: "#fff", fontSize: 14, fontWeight: "800" },
  creatorInfo: { marginLeft: 12, flex: 1 },
  creatorName: { fontSize: 16, fontWeight: "700", color: "#111" },
  creatorMeta: { fontSize: 13, color: "#666", marginTop: 2 },
  participantsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  participantList: { gap: 10 },
  participantItem: { flexDirection: "row", alignItems: "center" },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  participantInitials: { color: "#fff", fontSize: 11, fontWeight: "800" },
  participantName: { marginLeft: 10, fontSize: 14, color: "#333", fontWeight: "500" },
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

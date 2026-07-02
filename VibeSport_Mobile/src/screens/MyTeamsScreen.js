import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { getMatches, deleteMatch, updateTeamStatus } from "../services/matchService";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };

const SPORT_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "football", label: "Bóng đá" },
  { key: "badminton", label: "Cầu lông" },
  { key: "pickleball", label: "Pickleball" },
];

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

const getSportBgColor = (sport) => {
  if (sport === "football") return "#fee2e2"; // Light pinkish-red
  if (sport === "badminton") return "#dbeafe"; // Light blue
  if (sport === "pickleball") return "#ffedd5"; // Light orange
  return "#f1f5f9"; // Light gray
};

const formatCost = (c) => {
  if (!c || c === 0) return "Miễn phí";
  if (c >= 1000) return `${c / 1000}K / người`;
  return `${c} VND`;
};

export default function MyTeamsScreen({ navigation }) {
  const user = useSelector((state) => state.auth?.user);
  const unreadCount = useSelector((state) => state.notifications?.unreadCount || 0);
  const userId = user?.id || user?._id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myMatches, setMyMatches] = useState([]);
  const [activeSport, setActiveSport] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);

  const loadMyMatches = async () => {
    try {
      setLoading(true);
      const allMatches = await getMatches();
      // Filter matches where user is creator or participant
      const filtered = allMatches.filter((m) => {
        const creatorId = typeof m.createdBy === "object" ? m.createdBy?._id || m.createdBy?.id : m.createdBy;
        const isCreator = String(creatorId) === String(userId);
        const isParticipant = m.participants?.some((p) => {
          const pid = typeof p === "object" ? p?._id || p?.id : p;
          return String(pid) === String(userId);
        });
        return isCreator || isParticipant;
      });
      setMyMatches(filtered);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tải danh sách đội");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMyMatches();
    }, [userId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMyMatches();
    setRefreshing(false);
  };

  const handleOpenSearch = () => {
    setIsSearchMode(true);
  };

  const handleCloseSearch = () => {
    setIsSearchMode(false);
    setSearchQuery("");
  };

  const handleStatusChange = async (matchId, newStatus) => {
    try {
      await updateTeamStatus(matchId, newStatus);
      Alert.alert("Thành công", "Đã cập nhật trạng thái đội");
      loadMyMatches();
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật trạng thái");
    }
  };

  const handleDeleteTeam = (matchId) => {
    Alert.alert(
      "Xóa đội / Hủy trận",
      "Bạn có chắc muốn xóa đội này? Hành động này sẽ hủy và xóa trận đấu liên kết.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMatch(matchId);
              Alert.alert("Thành công", "Đã xóa đội thành công");
              loadMyMatches();
            } catch (err) {
              Alert.alert("Lỗi", err.message || "Không thể xóa đội");
            }
          },
        },
      ]
    );
  };

  const handleLongPress = (item) => {
    const creatorId = typeof item.createdBy === "object" ? item.createdBy?._id || item.createdBy?.id : item.createdBy;
    const isOwner = String(creatorId) === String(userId);

    if (!isOwner) return;

    Alert.alert(
      "Quản lý đội",
      `Đội: ${item.title}`,
      [
        {
          text: "✏️ Sửa",
          onPress: () => navigation.navigate("CreateMatch", { editMatch: item })
        },
        {
          text: "🗑️ Xóa",
          style: "destructive",
          onPress: () => handleDeleteTeam(item._id)
        },
        {
          text: "Hủy",
          style: "cancel"
        }
      ],
      { cancelable: true }
    );
  };

  const renderStatusBadge = (teamStatus, status) => {
    let label = "CHƯA BẮT ĐẦU";
    let bg = "#f1f5f9";
    let text = "#64748b";
    let dot = "#94a3b8";

    const currentStatus = teamStatus || "not_started";

    if (currentStatus === "ongoing") {
      label = "ĐANG BẮT ĐẦU";
      bg = "#dcfce7";
      text = "#15803d";
      dot = "#22c55e";
    } else if (currentStatus === "paused") {
      label = "TẠM DỪNG";
      bg = "#fef9c3";
      text = "#a16207";
      dot = "#eab308";
    } else if (currentStatus === "ended" || status === "completed") {
      label = "ĐÃ KẾT THÚC";
      bg = "#fee2e2";
      text = "#b91c1c";
      dot = "#ef4444";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <View style={[styles.statusBadgeDot, { backgroundColor: dot }]} />
        <Text style={[styles.statusBadgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const creatorId = typeof item.createdBy === "object" ? item.createdBy?._id || item.createdBy?.id : item.createdBy;
    const isOwner = String(creatorId) === String(userId);
    const sportIcon = SPORT_ICONS[item.sport] || "⚽";
    const sportBg = getSportBgColor(item.sport);

    // Get position of the current user
    const posObj = item.memberPositions?.find((p) => String(p.userId) === String(userId));
    const posId = posObj ? posObj.positionId : "";
    const position = ALL_POSITIONS.find((p) => p.id === posId);
    const myPositionLabel = position ? position.label : "trống";

    const getPositionColor = (role) => {
      if (role === "goalkeeper") return "#166534"; // green
      if (role === "defender") return "#2563eb"; // blue
      if (role === "midfielder") return "#854d0e"; // yellow/brown
      if (role === "striker") return "#b91c1c"; // red/orange
      return "#475569"; // slate gray
    };
    const positionRole = position ? position.role : "";
    const positionColor = getPositionColor(positionRole);

    const currentCount = item.currentPlayers ?? item.participants?.length ?? 0;
    const benchCount = Number(item.benchMembersTeam1 ?? 0) + Number(item.benchMembersTeam2 ?? 0);
    const totalMax = Number(item.maxPlayers ?? currentCount + benchCount ?? 0);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("MyTeamDetail", { matchId: item._id })}
        onLongPress={() => handleLongPress(item)}
      >
        <View style={styles.cardLayoutRow}>
          {/* Cột trái: Icon môn thể thao + Badge vương miện */}
          <View style={[styles.sportIconContainer, { backgroundColor: sportBg }]}>
            <Text style={styles.sportEmoji}>{sportIcon}</Text>
            {isOwner && (
              <View style={styles.crownBadge}>
                <Text style={styles.crownEmoji}>👑</Text>
              </View>
            )}
          </View>

          {/* Cột giữa: Tên đội, vai trò, số người */}
          <View style={styles.cardMiddleContent}>
            <Text style={styles.cardTitleText} numberOfLines={1}>{item.title}</Text>
            <View style={styles.cardSubtitleRow}>
              <Text style={[styles.positionText, { color: positionColor }]}>{myPositionLabel}</Text>
              <Text style={styles.dividerDot}> • </Text>
              <Text style={styles.memberCountText}>{currentCount}/{totalMax} người</Text>
            </View>
          </View>

          {/* Cột phải: Trạng thái badge */}
          <View style={styles.cardRightContent}>
            {renderStatusBadge(item.teamStatus, item.status)}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getFilteredMatches = () => {
    const sportFiltered = activeSport === "all" ? myMatches : myMatches.filter((m) => m.sport === activeSport);
    const sortedMatches = [...sportFiltered].sort((a, b) => {
      const aEnded = (a.teamStatus === "ended" || a.status === "completed");
      const bEnded = (b.teamStatus === "ended" || b.status === "completed");
      return aEnded === bEnded ? 0 : aEnded ? 1 : -1;
    });
    if (!searchQuery.trim()) return sortedMatches;
    const query = searchQuery.trim().toLowerCase();
    return sortedMatches.filter((m) => (m.title || "").toLowerCase().includes(query));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader style={styles.screenHeader}>
        {isSearchMode ? (
          <View style={styles.searchHeaderRow}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo tên đội"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={handleCloseSearch} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Text style={[styles.headerIconText, styles.closeText]}>Hủy</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Danh sách đội</Text>
            <View style={styles.headerRightIcons}>
              <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7} onPress={handleOpenSearch}>
                <Ionicons name="search-outline" size={22} color="#1F2937" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("Notification")}
              >
                <View style={styles.notificationIconWrap}>
                  <Ionicons name="notifications-outline" size={22} color="#1F2937" />
                  {unreadCount > 0 && <View style={styles.notificationDot} />}
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScreenHeader>

      {/* Sport filter chips scroll bar */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersInner}>
          {SPORT_FILTERS.map((f) => {
            const isActive = activeSport === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveSport(f.key)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8f3621" />
        </View>
      ) : (
        <FlatList
          data={getFilteredMatches()}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không tìm thấy đội nào.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#8f3621"]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchHeaderRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    padding: 0,
    height: 32,
  },
  searchClearBtn: {
    marginLeft: 8,
  },
  closeText: {
    color: "#1F2937",
    fontWeight: "700",
  },
  notificationIconWrap: {
    position: "relative",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000000",
  },
  headerRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIconBtn: {
    position: "relative",
    padding: 4,
  },
  headerIconText: {
    fontSize: 20,
  },
  notificationDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444", // red dot
    borderWidth: 1,
    borderColor: "#fff",
  },
  filtersSection: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filtersInner: {
    paddingHorizontal: 16,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: "#0b74ff",
    borderColor: "#0b74ff",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLayoutRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sportIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sportEmoji: {
    fontSize: 24,
  },
  crownBadge: {
    position: "absolute",
    bottom: -4,
    left: -4,
    backgroundColor: "#8f3621", // Theme colored crown badge bg (or gold)
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  crownEmoji: {
    fontSize: 10,
  },
  cardMiddleContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  cardSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  positionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dividerDot: {
    fontSize: 12,
    color: "#94a3b8",
  },
  memberCountText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  cardRightContent: {
    marginLeft: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
  },
});

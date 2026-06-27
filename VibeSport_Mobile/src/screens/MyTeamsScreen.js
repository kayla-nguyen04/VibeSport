import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { getMatches, deleteMatch, updateTeamStatus } from "../services/matchService";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };

export default function MyTeamsScreen({ navigation }) {
  const user = useSelector((state) => state.auth?.user);
  const userId = user?.id || user?._id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myMatches, setMyMatches] = useState([]);

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

  const renderStatusBadge = (teamStatus, status) => {
    let label = "Chưa bắt đầu";
    let bg = "#e0f2fe";
    let text = "#0369a1";

    const currentStatus = teamStatus || "not_started";

    if (currentStatus === "ongoing") {
      label = "Đang diễn ra";
      bg = "#dcfce7";
      text = "#15803d";
    } else if (currentStatus === "paused") {
      label = "Tạm dừng";
      bg = "#fef9c3";
      text = "#a16207";
    } else if (currentStatus === "ended" || status === "completed") {
      label = "Đã kết thúc";
      bg = "#f3f4f6";
      text = "#4b5563";
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusBadgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const creatorId = typeof item.createdBy === "object" ? item.createdBy?._id || item.createdBy?.id : item.createdBy;
    const isOwner = String(creatorId) === String(userId);
    const sportIcon = SPORT_ICONS[item.sport] || "⚽";
    const teamStatus = item.teamStatus || "not_started";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("MyTeamDetail", { matchId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.sportIconBg}>
            <Text style={styles.sportIcon}>{sportIcon}</Text>
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardCreator}>Chủ đội: {item.createdBy?.name || "Bạn"}</Text>
          </View>
          {isOwner && item.pendingJoinRequests && item.pendingJoinRequests.length > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{item.pendingJoinRequests.length} chờ duyệt</Text>
            </View>
          )}
          {renderStatusBadge(item.teamStatus, item.status)}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.infoText}>🕒 Bắt đầu: <Text style={styles.infoHighlight}>{item.startTime} • {item.date}</Text></Text>
          <Text style={styles.infoText}>📍 Sân: {item.locationName}</Text>
          <Text style={styles.infoText}>👥 Lực lượng: {item.participants?.length || 0}/{item.maxPlayers} cầu thủ</Text>
        </View>

        {isOwner && (
          <View style={styles.ownerControlRow}>
            {teamStatus === "not_started" && (
              <TouchableOpacity
                style={[styles.btn, styles.btnStart]}
                onPress={() => handleStatusChange(item._id, "ongoing")}
              >
                <Text style={styles.btnText}>Bắt đầu</Text>
              </TouchableOpacity>
            )}

            {teamStatus === "ongoing" && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPause]}
                  onPress={() => handleStatusChange(item._id, "paused")}
                >
                  <Text style={styles.btnText}>Tạm dừng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnEnd]}
                  onPress={() => handleStatusChange(item._id, "ended")}
                >
                  <Text style={styles.btnText}>Kết thúc</Text>
                </TouchableOpacity>
              </>
            )}

            {teamStatus === "paused" && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnStart]}
                  onPress={() => handleStatusChange(item._id, "ongoing")}
                >
                  <Text style={styles.btnText}>Tiếp tục</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnEnd]}
                  onPress={() => handleStatusChange(item._id, "ended")}
                >
                  <Text style={styles.btnText}>Kết thúc</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.crudDivider} />

            <TouchableOpacity
              style={[styles.btn, styles.btnEdit]}
              onPress={() => navigation.navigate("CreateMatch", { editMatch: item })}
            >
              <Text style={styles.btnEditText}>✏️ Sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnDelete]}
              onPress={() => handleDeleteTeam(item._id)}
            >
              <Text style={styles.btnDeleteText}>🗑️ Xóa</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen style={styles.container}>
      <ScreenHeader style={styles.screenHeader}>
        <Text style={styles.headerTitle}>Đội của tôi</Text>
        <TouchableOpacity
          style={styles.btnAddTeam}
          onPress={() => navigation.navigate("CreateMatch")}
        >
          <Text style={styles.btnAddTeamText}>+ Tạo</Text>
        </TouchableOpacity>
      </ScreenHeader>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0b74ff" />
        </View>
      ) : (
        <FlatList
          data={myMatches}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Bạn chưa tham gia hay tạo đội nào.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate("CreateMatch")}
              >
                <Text style={styles.emptyBtnText}>⚽ Tạo trận mới</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#0b74ff"]} />
          }
        />
      )}
    </Screen>
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
    paddingTop: Platform.OS === "ios" ? 12 : 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
  },
  btnAddTeam: {
    backgroundColor: "#ff4d2d",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  btnAddTeamText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
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
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
    marginBottom: 12,
  },
  sportIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  sportIcon: {
    fontSize: 20,
  },
  cardTitleBlock: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardCreator: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardInfo: {
    marginBottom: 12,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#475569",
  },
  infoHighlight: {
    fontWeight: "600",
    color: "#0f172a",
  },
  ownerControlRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  btnStart: {
    backgroundColor: "#10b981",
  },
  btnPause: {
    backgroundColor: "#f59e0b",
  },
  btnEnd: {
    backgroundColor: "#ef4444",
  },
  btnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  crudDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 4,
  },
  btnEdit: {
    backgroundColor: "#f1f5f9",
  },
  btnEditText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  btnDelete: {
    backgroundColor: "#fef2f2",
  },
  btnDeleteText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: "#0b74ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
  },
});

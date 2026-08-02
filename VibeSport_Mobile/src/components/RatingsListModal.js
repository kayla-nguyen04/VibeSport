import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "./Screen";
import { ScreenHeader } from "./ScreenHeader";
import { HeaderIconButton } from "./ProfileScreenComponents";
import { getUserRatingsRequest } from "../services/ratingApi";
import { icon, primary } from "../theme";
import { API_BASE_URL } from "./constants/api";

const fixMediaUrl = (url) => {
  if (!url) return null;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
};

const getInitials = (name) => {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
};

export function RatingsListModal({ visible, onClose, userId, token }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [ratingsList, setRatingsList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId && token) {
      loadRatings();
    }
  }, [visible, userId, token]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      const data = await getUserRatingsRequest(userId, token);
      setRatingsList(data?.ratings || []);
    } catch (error) {
      console.warn("[RatingsListModal] Load error:", error);
      Alert.alert("Thông báo", "Không thể tải danh sách nhận xét đánh giá.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewMatch = (matchObj) => {
    const targetMatchId = typeof matchObj === "object" && matchObj != null ? matchObj._id || matchObj.id : matchObj;
    if (!targetMatchId) {
      Alert.alert("Thông báo", "Trận đấu không tồn tại hoặc đã bị xóa.");
      return;
    }
    onClose();
    navigation.navigate("MatchDetail", { matchId: String(targetMatchId) });
  };

  const handleOpenProfile = (reviewerObj) => {
    const reviewerId = typeof reviewerObj === "object" && reviewerObj != null ? reviewerObj._id || reviewerObj.id : reviewerObj;
    if (!reviewerId) {
      Alert.alert("Thông báo", "Không tìm thấy thông tin trang cá nhân.");
      return;
    }
    onClose();
    if (String(reviewerId) === String(userId)) {
      navigation.navigate("Home", { screen: "ProfileTab" });
    } else {
      navigation.navigate("UserProfile", {
        userId: reviewerId,
        initialProfile: typeof reviewerObj === "object" ? reviewerObj : undefined,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ScreenHeader style={[styles.headerBar, { paddingTop: insets.top, height: 60 + insets.top }]}>
          <View style={styles.headerSide}>
            <HeaderIconButton onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color={icon.dark} />
            </HeaderIconButton>
          </View>
          <Text style={styles.headerTitle}>Đánh giá nhận được</Text>
          <View style={[styles.headerSide, styles.headerRightSide]} />
        </ScreenHeader>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={primary.DEFAULT} />
            <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
          </View>
        ) : (
          <FlatList
            data={ratingsList}
            keyExtractor={(item) => String(item._id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const reviewer = item.fromUser;
              const avatarUri = fixMediaUrl(reviewer?.picture || reviewer?.avatar);
              const rName = reviewer?.name || "Thành viên";
              const matchTitle = typeof item.matchId === "object" && item.matchId != null
                ? item.matchId.title
                : "Chi tiết trận đấu";

              return (
                <View style={styles.ratingCard}>
                  {/* Reviewer Info Row - Clickable to open Profile */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      style={styles.reviewerHeader}
                      onPress={() => handleOpenProfile(reviewer)}
                      activeOpacity={0.7}
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.reviewerAvatar} />
                      ) : (
                        <View style={styles.reviewerAvatarPlaceholder}>
                          <Text style={styles.reviewerInitials}>{getInitials(rName)}</Text>
                        </View>
                      )}
                      <Text style={styles.reviewerName}>{rName}</Text>
                    </TouchableOpacity>

                    {/* Star Rating Row */}
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= item.stars ? "star" : "star-outline"}
                          size={16}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>

                  {/* Comment */}
                  {item.comment ? (
                    <Text style={styles.cardComment}>"{item.comment}"</Text>
                  ) : null}

                  {/* Footer Row: Match Name & View Match Button */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.matchTitleText} numberOfLines={1}>
                      Trận: {matchTitle}
                    </Text>
                    
                    <TouchableOpacity
                      style={styles.viewMatchBtn}
                      onPress={() => handleViewMatch(item.matchId)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="football-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                      <Text style={styles.viewMatchBtnText}>Xem trận đấu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="star-outline" size={54} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Bạn chưa có đánh giá nào</Text>
                <Text style={styles.emptySubtitle}>
                  Sau khi kết thúc các trận đấu, nhận xét từ bạn đấu sẽ xuất hiện tại đây.
                </Text>
              </View>
            }
          />
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  headerBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  headerSide: { width: 40, flexDirection: "row", alignItems: "center" },
  headerRightSide: { justifyContent: "flex-end" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: { marginTop: 12, color: "#6B7280", fontSize: 14 },
  listContent: { padding: 16 },
  ratingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  reviewerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  reviewerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerInitials: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  reviewerName: {
    fontWeight: "700",
    fontSize: 15,
    color: "#111827",
  },
  starRow: { flexDirection: "row", gap: 2 },
  cardComment: {
    fontSize: 13.5,
    color: "#374151",
    marginTop: 8,
    fontStyle: "italic",
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  matchTitleText: {
    fontSize: 12.5,
    color: "#6B7280",
    flex: 1,
    marginRight: 8,
    fontWeight: "500",
  },
  viewMatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f97316",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewMatchBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
});

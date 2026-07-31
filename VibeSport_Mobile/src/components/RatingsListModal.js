import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "./Screen";
import { ScreenHeader } from "./ScreenHeader";
import { HeaderIconButton } from "./ProfileScreenComponents";
import { getUserRatingsRequest } from "../services/ratingApi";
import { icon, primary } from "../theme";

export function RatingsListModal({ visible, onClose, userId, token }) {
  const [ratingsList, setRatingsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null); // Item đang được chọn để xem chi tiết

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen style={styles.screen}>
        <ScreenHeader style={styles.headerBar}>
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
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedRating(item)}
                style={styles.ratingCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.reviewerName}>
                    {item.fromUser?.name || "Thành viên"}
                  </Text>
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

                <Text style={styles.clickHintText}>
                  Nhấn để xem nhận xét chi tiết ➔
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="star-outline" size={54} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Bạn chưa có đánh giá nào</Text>
                <Text style={styles.emptySubtitle}>
                  Sau khi kết thúc các trận đấu, nhận xét từ bạn đấu sẽ xuất
                  hiện tại đây.
                </Text>
              </View>
            }
          />
        )}

        {/* POPUP CHI TIẾT NHẬN XẾT KHI CLICK VÀO HÀNG ĐÁNH GIÁ */}
        <Modal visible={!!selectedRating} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>
                Đánh giá từ {selectedRating?.fromUser?.name || "Thành viên"}
              </Text>

              <View style={styles.starRowCenter}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={
                      s <= (selectedRating?.stars || 5)
                        ? "star"
                        : "star-outline"
                    }
                    size={24}
                    color="#F59E0B"
                  />
                ))}
              </View>

              <Text style={styles.detailComment}>
                {selectedRating?.comment
                  ? `"${selectedRating.comment}"`
                  : "Không có lời nhắn."}
              </Text>

              <Text style={styles.detailMatchText}>
                Trận: {selectedRating?.matchId?.title || "Giao hữu"}
              </Text>

              <TouchableOpacity
                style={styles.closeDetailBtn}
                onPress={() => setSelectedRating(null)}
              >
                <Text style={styles.closeDetailBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewerName: { fontWeight: "700", fontSize: 15, color: "#111827" },
  starRow: { flexDirection: "row", gap: 2 },
  clickHintText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
    fontStyle: "italic",
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
  // Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  detailBox: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  starRowCenter: { flexDirection: "row", gap: 4, marginBottom: 14 },
  detailComment: {
    fontSize: 14,
    color: "#374151",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 12,
  },
  detailMatchText: { fontSize: 12, color: "#9CA3AF", marginBottom: 20 },
  closeDetailBtn: {
    backgroundColor: primary.DEFAULT,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  closeDetailBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});

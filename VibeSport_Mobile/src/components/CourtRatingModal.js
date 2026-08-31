import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "./Screen";
import { ScreenHeader } from "./ScreenHeader";
import { HeaderIconButton } from "./ProfileScreenComponents";
import { getCourtRatingsRequest, submitCourtRating, getMyCourtRating } from "../services/courtRatingApi";
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

export function CourtRatingModal({ visible, onClose, courtId, courtName, token, userId }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [ratingsList, setRatingsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // State cho form gửi đánh giá
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [myRating, setMyRating] = useState(null);

  useEffect(() => {
    if (visible && courtId && token) {
      loadRatings();
      loadMyRating();
    }
  }, [visible, courtId, token]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      const data = await getCourtRatingsRequest(courtId, token);
      setRatingsList(data?.ratings || []);
    } catch (error) {
      console.warn("[CourtRatingModal] Load error:", error);
      Alert.alert("Thông báo", "Không thể tải danh sách đánh giá sân.");
    } finally {
      setLoading(false);
    }
  };

  const loadMyRating = async () => {
    try {
      const data = await getMyCourtRating(courtId, token);
      if (data) {
        setMyRating(data);
        setStars(data.stars || 5);
        setComment(data.comment || "");
      }
    } catch (error) {
      console.warn("[CourtRatingModal] Load my rating error:", error);
    }
  };

  const handleSubmitRating = async () => {
    if (!stars || (stars < 1 || stars > 5)) {
      Alert.alert("Thông báo", "Vui lòng chọn số sao từ 1 đến 5.");
      return;
    }

    try {
      setSubmitting(true);
      await submitCourtRating(courtId, stars, comment, token);
      Alert.alert("Thành công", "Cảm ơn bạn đã đánh giá sân!");
      setShowRatingForm(false);
      setComment("");
      setStars(5);
      await loadRatings();
      await loadMyRating();
    } catch (error) {
      console.warn("[CourtRatingModal] Submit error:", error);
      Alert.alert("Lỗi", error.message || "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
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
          <Text style={styles.headerTitle} numberOfLines={1}>Đánh giá {courtName || "sân"}</Text>
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
            ListHeaderComponent={
              <View style={styles.ratingForm}>
                <Text style={styles.formTitle}>Đánh giá sân của bạn</Text>
                
                {/* Hiển thị nếu đã đánh giá */}
                {myRating ? (
                  <View style={styles.alreadyRatedBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={styles.alreadyRatedText}>Bạn đã đánh giá sân này</Text>
                  </View>
                ) : (
                  <>
                    {/* Chọn sao */}
                    <Text style={styles.formLabel}>Số sao</Text>
                    <View style={styles.starSelector}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <TouchableOpacity
                          key={s}
                          onPress={() => setStars(s)}
                          style={styles.starButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={s <= stars ? "star" : "star-outline"}
                            size={32}
                            color={s <= stars ? "#F59E0B" : "#D1D5DB"}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Nhập bình luận */}
                    <Text style={styles.formLabel}>Mô tả đánh giá</Text>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Chia sẻ ý kiến của bạn về sân bãi..."
                      placeholderTextColor="#9CA3AF"
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>{comment.length}/500</Text>

                    {/* Nút gửi */}
                    <TouchableOpacity
                      style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                      onPress={handleSubmitRating}
                      disabled={submitting}
                      activeOpacity={0.8}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitBtnText}>Gửi đánh giá</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const reviewer = item.user;
              const avatarUri = fixMediaUrl(reviewer?.picture || reviewer?.avatar);
              const rName = reviewer?.name || "Thành viên";

              return (
                <View style={styles.ratingCard}>
                  {/* Reviewer Info Row */}
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

                  {/* Timestamp */}
                  {item.createdAt ? (
                    <Text style={styles.timestamp}>
                      {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </Text>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              !loading && (
                <View style={styles.centerState}>
                  <Ionicons name="star-outline" size={54} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>Chưa có đánh giá nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Hãy là người đầu tiên đánh giá sân này!
                  </Text>
                </View>
              )
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
  
  // Form styles
  ratingForm: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 10,
  },
  alreadyRatedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  alreadyRatedText: {
    fontSize: 13,
    color: "#10B981",
    fontWeight: "600",
  },
  starSelector: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 13,
    color: "#111827",
  },
  charCount: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Rating card styles
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
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  starRow: {
    flexDirection: "row",
    gap: 3,
  },
  cardComment: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 19,
  },
  timestamp: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 8,
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
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
});

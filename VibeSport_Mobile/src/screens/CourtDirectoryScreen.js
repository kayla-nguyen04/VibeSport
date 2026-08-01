import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Dimensions,
  Platform,
} from "react-native";
import { useSelector } from "react-redux";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { getCourtsRequest } from "../services/courtService";
import { CourtDetailModal, COURT_DIRECTORY } from "../components/CourtDetailModal";
import { TagIcon } from "../components/TagIcon";
import { primary } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ORANGE = primary.DEFAULT; // '#FF6B3D'

const SPORT_OPTIONS = [
  { key: "all", label: "Tất cả", icon: "apps" },
  { key: "football", label: "Bóng đá", tag: "Bóng đá" },
  { key: "badminton", label: "Cầu lông", tag: "Cầu lông" },
  { key: "pickleball", label: "Pickleball", tag: "Pickleball" },
];

const SPORT_NAMES = {
  football: "Bóng đá",
  badminton: "Cầu lông",
  pickleball: "Pickleball",
};

const formatCurrency = (amount) => {
  if (!amount) return "";
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function CourtDirectoryScreen({ navigation }) {
  const unreadCount = useSelector((state) => state.notifications?.unreadCount || 0);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Modal court detail state
  const [showCourtDetailModal, setShowCourtDetailModal] = useState(false);
  const [selectedCourtForDetail, setSelectedCourtForDetail] = useState(null);

  const fetchCourts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCourtsRequest();
      setCourts(Array.isArray(data) && data.length > 0 ? data : COURT_DIRECTORY);
    } catch (err) {
      console.log("Load courts error, using static directory:", err.message);
      setCourts(COURT_DIRECTORY);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCourts();
  };

  // Lọc sân theo tìm kiếm và môn thể thao
  const filteredCourts = courts.filter((court) => {
    const matchesSport =
      selectedSport === "all" || court.sportType === selectedSport;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (court.name && court.name.toLowerCase().includes(query)) ||
      (court.address && court.address.toLowerCase().includes(query)) ||
      (court.district && court.district.toLowerCase().includes(query));
    return matchesSport && matchesSearch;
  });

  const handleOpenDetail = (court) => {
    setSelectedCourtForDetail(court);
    setShowCourtDetailModal(true);
  };

  const renderCourtCard = ({ item: court }) => {
    const imageUri =
      Array.isArray(court.images) && court.images.length > 0
        ? court.images[0]
        : "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800";

    const sportLabel = SPORT_NAMES[court.sportType] || "Bóng đá";

    // Tính hiển thị giá DV từ serviceDetails hoặc constant range
    const drinkMin = court.serviceDetails?.drinkService?.minPrice || 10000;
    const drinkMax = court.serviceDetails?.drinkService?.maxPrice || 25000;
    const equipMin = court.serviceDetails?.equipmentService?.minPrice || 30000;
    const equipMax = court.serviceDetails?.equipmentService?.maxPrice || 60000;
    const serviceMin = Math.min(drinkMin, equipMin);
    const serviceMax = Math.max(drinkMax, equipMax);

    // Tính khoảng giá thuê sân
    const priceFromVal = court.priceFrom || court.hourlyRate || 300000;
    const priceToVal = court.priceTo || (priceFromVal ? priceFromVal * 2 : 700000);

    return (
      <View style={styles.courtCard}>
        {/* Banner Ảnh Sân */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.courtImage} resizeMode="cover" />
          
          {/* Badge Môn thể thao */}
          <View style={styles.sportBadge}>
            <TagIcon tagName={sportLabel} size={16} color="#fff" />
            <Text style={styles.sportBadgeText}>{sportLabel}</Text>
          </View>

          {/* Rating Badge */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>{court.rating || 4.5}</Text>
            <Text style={styles.reviewCountText}>({court.reviewCount || court.reviewsCount || 100})</Text>
          </View>
        </View>

        {/* Thông tin sân */}
        <View style={styles.cardContent}>
          <Text style={styles.courtName} numberOfLines={1}>{court.name}</Text>

          {/* Địa chỉ */}
          <View style={styles.infoRow}>
            <Ionicons name="location" size={15} color={ORANGE} style={{ marginRight: 6 }} />
            <Text style={styles.addressText} numberOfLines={2}>{court.address}</Text>
          </View>

          {/* Giờ mở cửa */}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={15} color="#6B7280" style={{ marginRight: 6 }} />
            <Text style={styles.metaText}>Mở cửa: {court.openHours || `${court.openTime || "06:00"} - ${court.closeTime || "23:00"}`}</Text>
          </View>

          {/* Giá sân & Giá DV */}
          <View style={styles.priceRow}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Giá thuê sân</Text>
              <Text style={styles.priceValue}>
                {formatCurrency(priceFromVal)}đ - {formatCurrency(priceToVal)}đ /h
              </Text>
            </View>

            <View style={styles.serviceCostRow}>
              <Text style={styles.serviceCostLabel}>Giá DV ước tính:</Text>
              <Text style={styles.serviceCostValue}>
                {formatCurrency(serviceMin)}đ – {formatCurrency(serviceMax)}đ
              </Text>
            </View>
          </View>

          {/* Nút Hành động */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => handleOpenDetail(court)}
              activeOpacity={0.8}
            >
              <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.detailBtnText}>Xem chi tiết sân</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const hasActiveFilters = selectedSport !== "all" || searchQuery.length > 0;
  const filterSummary = `${selectedSport !== "all" ? SPORT_NAMES[selectedSport] : ""} ${searchQuery ? `"${searchQuery}"` : ""}`.trim();

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.container}>
      {/* App Header với style thiết lập theo yêu cầu */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/logovibe_tachnen.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>
            Mẫu<Text style={styles.logoHighlight}> Sân</Text>
          </Text>
          
        </View>

        <View style={styles.headerActions}>
          {/* Nút Thông báo */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Notification")}
            activeOpacity={0.7}
          >
            <View style={{ position: "relative" }}>
              <Ionicons name="notifications-outline" size={24} color="#1F2937" />
              {unreadCount > 0 && <View style={styles.notificationDot} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Filter Toggle (Giống màn Trận đấu) ─── */}
      <View style={styles.filterToggleRow}>
        <TouchableOpacity
          style={styles.filterToggleButton}
          activeOpacity={0.85}
          onPress={() => setIsFiltersCollapsed((prev) => !prev)}
        >
          <View style={styles.filterToggleLeft}>
            <Ionicons name="filter-outline" size={18} color="#333" />
            <Text style={styles.filterToggleText}>Bộ lọc</Text>
            {hasActiveFilters ? (
              <Text style={styles.filterToggleHint}>• {filterSummary}</Text>
            ) : null}
          </View>
          <Ionicons name={isFiltersCollapsed ? "chevron-down" : "chevron-up"} size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* ─── Sport Filters Chips (Giống màn Trận đấu) ─── */}
      {!isFiltersCollapsed && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersInner}>
            {SPORT_OPTIONS.map((sport) => {
              const isSelected = selectedSport === sport.key;
              return (
                <TouchableOpacity
                  key={sport.key}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSelectedSport(sport.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {sport.label}
                  </Text>
                  {sport.tag ? (
                    <View style={styles.chipIconContainer}>
                      <TagIcon tagName={sport.tag} size={14} color={isSelected ? ORANGE : "#333"} />
                    </View>
                  ) : (
                    <View style={styles.chipIconContainer}>
                      <Ionicons name={sport.icon} size={14} color={isSelected ? ORANGE : "#333"} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ─── Search Bar (Giống màn Trận đấu) ─── */}
      {!isFiltersCollapsed && (
        <View style={styles.searchSection}>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm tên sân, địa chỉ, quận..."
              placeholderTextColor="#aaa"
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchSubmitBtn} onPress={() => {}}>
              <Ionicons name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loadingText}>Đang tải danh sách mẫu sân...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCourts}
          keyExtractor={(item) => item._id || item.id || item.name}
          renderItem={renderCourtCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ios-search" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Không tìm thấy mẫu sân phù hợp</Text>
              <Text style={styles.emptySubtitle}>Thử thay đổi từ khóa hoặc bộ lọc môn thể thao</Text>
            </View>
          }
        />
      )}

      {/* Modal Xem Chi Tiết Sân */}
      <CourtDetailModal
        visible={showCourtDetailModal}
        court={selectedCourtForDetail}
        onClose={() => setShowCourtDetailModal(false)}
        navigation={navigation}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginHorizontal: 9,
    marginTop: Platform.OS === "ios" ? 8 : 16,
    marginBottom: 10,
    height: 74,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 94, 94, 0.19)",
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 44,
    height: 44,
    marginRight: -6,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#000000",
  },
  logoHighlight: {
    color: ORANGE,
  },
  screenTagBadge: {
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  screenTagText: {
    color: ORANGE,
    fontSize: 11.5,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    backgroundColor: "#F3F4F6",
  },
  notificationDot: {
    position: "absolute",
    top: 1,
    right: 1,
    backgroundColor: "#EF4444",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  // Filter Toggle
  filterToggleRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterToggleLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  filterToggleHint: {
    fontSize: 12,
    color: "#888",
  },

  // Sport Filters Chips (Giống màn Trận đấu)
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filtersInner: {
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  chipActive: {
    backgroundColor: "#fff",
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  chipTextActive: {
    color: ORANGE,
  },
  chipIconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Search Bar (Giống màn Trận đấu)
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#333",
  },
  searchSubmitBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
  },
  courtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  imageContainer: {
    width: "100%",
    height: 165,
    position: "relative",
  },
  courtImage: {
    width: "100%",
    height: "100%",
  },
  sportBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(17, 24, 39, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sportBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    elevation: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  reviewCountText: {
    fontSize: 11,
    color: "#6B7280",
  },
  cardContent: {
    padding: 14,
    gap: 8,
  },
  courtName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressText: {
    fontSize: 13,
    color: "#4B5563",
    flex: 1,
    lineHeight: 18,
  },
  metaText: {
    fontSize: 12.5,
    color: "#6B7280",
  },
  priceRow: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginTop: 4,
    gap: 6,
  },
  priceBlock: {},
  priceLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  priceValue: {
    fontSize: 13.5,
    fontWeight: "800",
    color: ORANGE,
    marginTop: 1,
  },
  serviceCostRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  serviceCostLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4B5563",
  },
  serviceCostValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E40AF",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  detailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ORANGE,
    paddingVertical: 11,
    borderRadius: 12,
  },
  detailBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    fontSize: 13.5,
    color: "#6B7280",
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
  },
});

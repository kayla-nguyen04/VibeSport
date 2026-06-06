import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { getMatches } from "../services/matchService";

const SPORT_FILTERS = [
  { key: "all", label: "Tất cả", icon: "" },
  { key: "football", label: "Bóng đá", icon: "⚽" },
  { key: "badminton", label: "Cầu lông", icon: "🏸" },
  { key: "pickleball", label: "Pickleball", icon: "🏓" },
];

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };
const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

const formatCost = (c) => {
  if (!c || c === 0) return "Miễn phí";
  if (c >= 1000) return `${c / 1000}K / người`;
  return `${c} VND`;
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const normalizeId = (id) => (id == null ? "" : String(id));

export default function TeamsScreen({ navigation }) {
  const user = useSelector((state) => state.auth?.user);
  const [activeSubTab, setActiveSubTab] = useState("near");
  const [activeSport, setActiveSport] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const userId = normalizeId(user?.id || user?._id);

  const loadMatches = useCallback(async (keyword, area, time, subTab = activeSubTab) => {
    try {
      setLoading(true);
      const filters = {};
      if (activeSport !== "all") filters.sport = activeSport;
      if (keyword && keyword.trim()) filters.q = keyword.trim();
      if (area && area.trim()) filters.area = area.trim();
      if (time && time.trim()) filters.startTime = time.trim();
      if (subTab === "created" && userId) filters.createdBy = userId;

      const data = await getMatches(filters);
      setMatches(data || []);
      setSearched(true);
    } catch (err) {
      console.log("Load matches error:", err.message);
      setMatches([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [activeSport, activeSubTab, userId]);

  useEffect(() => {
    loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
  }, [activeSport, activeSubTab]);

  useFocusEffect(
    useCallback(() => {
      loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
    }, [loadMatches, searchText, areaFilter, timeFilter, activeSubTab])
  );

  const handleSearch = () => {
    loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
  };

  const isUserParticipant = (match) => {
    const pList = match.participants || [];
    return pList.some((p) => {
      const pid = typeof p === "object" ? p._id || p.id : p;
      return normalizeId(pid) === userId;
    });
  };

  const getDisplayData = () => {
    if (activeSubTab === "near") {
      return matches;
    }
    if (activeSubTab === "joined") {
      return matches.filter(isUserParticipant);
    }
    if (activeSubTab === "created") {
      return matches.filter((m) => {
        const creator = m.createdBy;
        const creatorId =
          typeof creator === "object" ? creator?._id || creator?.id : creator;
        return normalizeId(creatorId) === userId;
      });
    }
    return matches;
  };

  const renderBrowseCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const joined = isUserParticipant(item);
    const creatorName =
      typeof item.createdBy === "object" ? item.createdBy?.name : null;

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.matchSubtitle}>
              {item.startTime} • {item.locationName}
              {creatorName ? ` • ${creatorName}` : ""}
            </Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillYellow]}>
            <Text style={styles.statusPillText}>
              {item.status === "full" ? "Đã đủ người" : "Tìm người"}
            </Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoColText}>
              👥 {item.currentPlayers} / {item.maxPlayers} người
            </Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoColText} numberOfLines={1}>🏟️ {item.locationName}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoColText}>📅 {item.date}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          {joined ? (
            <View style={styles.joinedBadge}>
              <Text style={styles.joinedBadgeText}>✓ Đã tham gia</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity style={styles.detailBlueBtn} activeOpacity={0.7}>
            <Text style={styles.detailBlueBtnText}>
              {joined ? "Xem chi tiết" : "Tham gia"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderJoinedCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const isSoon = item.status === "soon";
    
    return (
      <View key={item._id} style={styles.card}>
        {/* Header Block */}
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.matchSubtitle}>{item.startTime} • {item.locationName}</Text>
          </View>
          <View style={[styles.statusPill, isSoon ? styles.statusPillYellow : styles.statusPillYellow]}>
            <Text style={styles.statusPillText}>
              {isSoon ? "Sắp diễn ra" : "Tìm người"}
            </Text>
          </View>
        </View>

        {/* Info Grid with Borders */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoColText}>👥 {item.currentPlayers} / {item.maxPlayers} người</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoColText} numberOfLines={1}>🏟️ {item.locationName}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoColText}>📅 {item.date}</Text>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          <View style={styles.joinedBadge}>
            <Text style={styles.joinedBadgeText}>✓ Đã tham gia</Text>
          </View>
          <TouchableOpacity style={styles.leaveBtn} activeOpacity={0.7}>
            <Text style={styles.leaveBtnText}>Rút khỏi trận</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render Created Card ("Đã tạo") ───
  const renderCreatedCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const isEnded = item.status === "completed" || item.status === "ended";
    const currentCount = item.currentPlayers || item.participants?.length || 0;
    const maxCount = item.maxPlayers || 10;
    const slotsLeft = maxCount - currentCount;
    const progressPercent = Math.min(100, (currentCount / maxCount) * 100);

    return (
      <View key={item._id} style={styles.card}>
        {/* Header Block */}
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.matchSubtitle}>{item.subtitle || "FC Đống Đa • Do bạn tạo"}</Text>
          </View>
          <View style={[styles.statusDotWrapper, isEnded ? styles.statusDotGrayBg : styles.statusDotGreenBg]}>
            <View style={[styles.statusDotCircle, isEnded ? styles.statusDotGray : styles.statusDotGreen]} />
            <Text style={[styles.statusDotText, isEnded ? styles.statusDotTextGray : styles.statusDotTextGreen]}>
              {isEnded ? "Đã kết thúc" : "Tìm người"}
            </Text>
          </View>
        </View>

        {!isEnded ? (
          <>
            {/* Cost Banner strip */}
            <View style={styles.costStrip}>
              <Text style={styles.costStripLabel}>🪙 Chi phí sân</Text>
              <Text style={styles.costStripValue}>{formatCost(item.costPerPerson)}</Text>
            </View>

            {/* Two-column Details list */}
            <View style={styles.detailsList}>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailText}>🕒 {item.startTime} - {item.date}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailText} numberOfLines={1}>📍 {item.locationName}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailText}>⚽ {item.format || `${Math.floor(maxCount/2)} vs ${Math.floor(maxCount/2)}`}</Text>
                </View>
              </View>
            </View>

            {/* Avatars & slots */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarGroup}>
                {(item.participants || []).slice(0, 3).map((p, idx) => (
                  <View key={idx} style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length], marginLeft: idx > 0 ? -6 : 0 }]}>
                    <Text style={styles.avatarInitials}>{getInitials(p.name)}</Text>
                  </View>
                ))}
                {(item.participants || []).length > 3 && (
                  <View style={[styles.avatarCircle, styles.avatarExtra, { marginLeft: -6 }]}>
                    <Text style={styles.avatarExtraText}>+{item.participants.length - 3}</Text>
                  </View>
                )}
                <Text style={styles.avatarCountText}>{currentCount}/{maxCount} người</Text>
              </View>
              <Text style={styles.slotsLeftText}>{slotsLeft > 0 ? `Còn ${slotsLeft} slot` : "Hết slot"}</Text>
            </View>

            {/* Progress Bar (Blue/Red progress indicator) */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>

            {/* Footer actions */}
            <View style={styles.createdActions}>
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>📍 0.8 km</Text>
              </View>
              <View style={styles.createdBtns}>
                <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
                  <Text style={styles.editBtnText}>✏️ Sửa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailBlueBtn} activeOpacity={0.7}>
                  <Text style={styles.detailBlueBtnText}>Xem chi tiết</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Ended match compact layout */}
            <View style={styles.endedInfoList}>
              <View style={styles.endedInfoRow}>
                <Text style={styles.endedInfoText}>🕒 {item.startTime} - {item.date}</Text>
                <Text style={[styles.endedInfoText, { marginLeft: 20 }]} numberOfLines={1}>📍 {item.locationName}</Text>
              </View>
              <View style={styles.endedInfoRow}>
                <Text style={styles.endedInfoText}>👥 {currentCount}/{maxCount} người</Text>
                <Text style={[styles.endedInfoText, { marginLeft: 20 }]}>🪙 {formatCost(item.costPerPerson)}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (activeSubTab === "created") return renderCreatedCard(item);
    if (activeSubTab === "near") return renderBrowseCard(item);
    return renderJoinedCard(item);
  };

  return (
    <View style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trận đấu</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation?.navigate?.("CreateMatch")}>
          <Text style={styles.createBtnText}>+ Tạo trận</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Sub Tabs ─── */}
      <View style={styles.subTabs}>
        {[
          { key: "near", label: "Gần tôi" },
          { key: "joined", label: "Đã tham gia" },
          { key: "created", label: "Đã tạo" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, activeSubTab === tab.key && styles.subTabActive]}
            onPress={() => {
              setActiveSubTab(tab.key);
            }}
          >
            <Text style={[styles.subTabText, activeSubTab === tab.key && styles.subTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Sport Filters ─── */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersInner}>
          {SPORT_FILTERS.map((f) => {
            const isActive = activeSport === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveSport(f.key)}
              >
                {f.icon ? (
                  <View style={styles.chipIconContainer}>
                    <Text style={styles.chipIcon}>{f.icon}</Text>
                  </View>
                ) : null}
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Search & Filters Bar ─── */}
      <View style={styles.searchBar}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm trận đấu, tên sân..."
            placeholderTextColor="#aaa"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchText(""); loadMatches("", areaFilter, timeFilter, activeSubTab); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.filterInputWrap, { marginRight: 8 }]}>
            <Text style={styles.filterRowIcon}>📍</Text>
            <TextInput
              style={styles.filterInput}
              value={areaFilter}
              onChangeText={setAreaFilter}
              placeholder="Khu vực..."
              placeholderTextColor="#aaa"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {areaFilter.length > 0 && (
              <TouchableOpacity onPress={() => { setAreaFilter(""); loadMatches(searchText, "", timeFilter, activeSubTab); }} style={styles.clearBtnMini}>
                <Text style={styles.clearBtnTextMini}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterInputWrap}>
            <Text style={styles.filterRowIcon}>🕒</Text>
            <TextInput
              style={styles.filterInput}
              value={timeFilter}
              onChangeText={setTimeFilter}
              placeholder="Giờ (19:00)..."
              placeholderTextColor="#aaa"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {timeFilter.length > 0 && (
              <TouchableOpacity onPress={() => { setTimeFilter(""); loadMatches(searchText, areaFilter, "", activeSubTab); }} style={styles.clearBtnMini}>
                <Text style={styles.clearBtnTextMini}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── Match List ─── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff4d2d" />
          <Text style={styles.loadingText}>Đang tải trận đấu...</Text>
        </View>
      ) : (
        <FlatList
          data={getDisplayData()}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listInner}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => loadMatches(searchText, areaFilter, timeFilter, activeSubTab)}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⚽</Text>
              <Text style={styles.emptyTitle}>
                {activeSubTab === "created"
                  ? "Bạn chưa tạo trận nào"
                  : activeSubTab === "joined"
                    ? "Bạn chưa tham gia trận nào"
                    : "Không tìm thấy trận đấu"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeSubTab === "near"
                  ? "Hãy tạo trận mới hoặc thay đổi bộ lọc tìm kiếm."
                  : activeSubTab === "created"
                    ? "Nhấn + Tạo trận để bắt đầu."
                    : "Tìm trận ở tab Gần tôi và tham gia."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─────────────────────── STYLES ───────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: "#888", fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#333", textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: "#999", textAlign: "center", marginTop: 4 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 12 : 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#000" },
  createBtn: {
    backgroundColor: "#ff4d2d",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Sub Tabs
  subTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  subTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  subTabActive: { borderBottomColor: "#0066cc" },
  subTabText: { fontSize: 15, fontWeight: "600", color: "#888" },
  subTabTextActive: { color: "#0066cc", fontWeight: "800" },

  // Sport Filters Chips
  filters: { backgroundColor: "#fff", paddingBottom: 12 },
  filtersInner: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 6,
  },
  chipActive: {
    backgroundColor: "#0066cc",
    borderColor: "#0066cc",
  },
  chipIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f0f2f5",
    alignItems: "center",
    justifyContent: "center",
  },
  chipIcon: { fontSize: 12 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#666" },
  chipTextActive: { color: "#fff", fontWeight: "700" },

  // Search & Filters Bar
  searchBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f3f5", borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.4 },
  searchInput: { flex: 1, fontSize: 14, color: "#333", paddingVertical: 0 },
  clearBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#ccc", alignItems: "center", justifyContent: "center" },
  clearBtnText: { fontSize: 10, color: "#fff", fontWeight: "700" },

  // Filter mini inputs
  filterRow: { flexDirection: "row", marginTop: 8 },
  filterInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f2f3f5", borderRadius: 10, paddingHorizontal: 10, height: 36 },
  filterRowIcon: { fontSize: 12, marginRight: 6, opacity: 0.5 },
  filterInput: { flex: 1, fontSize: 13, color: "#333", paddingVertical: 0 },
  clearBtnMini: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ccc", alignItems: "center", justifyContent: "center" },
  clearBtnTextMini: { fontSize: 8, color: "#fff", fontWeight: "700" },

  // List
  listInner: { padding: 16, paddingBottom: 100 },

  // ══════════════ CARD COMPONENT (100% FIGMA MATCH) ══════════════
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sportSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0d6efd", // Blue bg
    alignItems: "center",
    justifyContent: "center",
  },
  sportSquareIcon: { fontSize: 22, color: "#fff" },
  titleContainer: { flex: 1, marginLeft: 12 },
  matchTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  matchSubtitle: { fontSize: 12, color: "#777", marginTop: 2 },

  // Status pills
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillYellow: { backgroundColor: "#fef8e8" },
  statusPillText: { fontSize: 11, fontWeight: "700", color: "#f5a623" },

  // Info grid columns (Đã tham gia tab)
  infoGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    borderRadius: 10,
    backgroundColor: "#fafafa",
    paddingVertical: 10,
  },
  infoCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  infoColText: { fontSize: 11, color: "#555", fontWeight: "600" },
  verticalDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#e0e0e0",
  },

  // Action row (Đã tham gia tab)
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f5f5f5",
  },
  joinedBadge: {
    backgroundColor: "#eefbf3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinedBadgeText: { fontSize: 12, color: "#22c55e", fontWeight: "800" },
  leaveBtn: {
    borderWidth: 1.2,
    borderColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  leaveBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },

  // ══════════════ CREATED CARD CUSTOM STYLES ══════════════
  statusDotWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 5,
  },
  statusDotGreenBg: { backgroundColor: "#eefbf3" },
  statusDotGrayBg: { backgroundColor: "#f3f3f3" },
  statusDotCircle: { width: 6, height: 6, borderRadius: 3 },
  statusDotGreen: { backgroundColor: "#22c55e" },
  statusDotGray: { backgroundColor: "#999" },
  statusDotText: { fontSize: 11, fontWeight: "700" },
  statusDotTextGreen: { color: "#22c55e" },
  statusDotTextGray: { color: "#888" },

  // Cost Banner
  costStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fffbf0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  costStripLabel: { fontSize: 13, color: "#856404", fontWeight: "600" },
  costStripValue: { fontSize: 15, color: "#856404", fontWeight: "800" },

  // Details two column list
  detailsList: {
    marginTop: 14,
    paddingHorizontal: 2,
    gap: 8,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    flex: 1,
  },
  detailText: { fontSize: 13, color: "#333", fontWeight: "500" },

  // Avatars row
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingHorizontal: 2,
  },
  avatarGroup: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  avatarInitials: { color: "#fff", fontSize: 9, fontWeight: "800" },
  avatarExtra: { backgroundColor: "#bbb" },
  avatarExtraText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  avatarCountText: { fontSize: 12, color: "#666", fontWeight: "600", marginLeft: 8 },
  slotsLeftText: { fontSize: 12, color: "#ef4444", fontWeight: "800" },

  // Progress Bar
  progressBarBg: {
    height: 5,
    backgroundColor: "#e9ecef",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0066cc", // Blue progress bar fill
  },

  // Created Actions footer
  createdActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f5f5f5",
  },
  distanceBadge: {
    backgroundColor: "#f2f3f5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  distanceBadgeText: { fontSize: 12, color: "#666", fontWeight: "600" },
  createdBtns: { flexDirection: "row", gap: 8 },
  editBtn: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  editBtnText: { fontSize: 12, color: "#333", fontWeight: "600" },
  detailBlueBtn: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailBlueBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Ended match layout
  endedInfoList: {
    marginTop: 12,
    backgroundColor: "#fafafa",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  endedInfoRow: {
    flexDirection: "row",
  },
  endedInfoText: { fontSize: 13, color: "#666" },
});

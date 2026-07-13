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
  Alert,
  Modal,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { getMatches, leaveMatch } from "../services/matchService";
import { getPostsRequest } from "../services/postApi";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TagIcon } from "../components/TagIcon";
import { Screen } from "../components/Screen";
import { primary } from "../theme";

const ORANGE = primary.DEFAULT; // '#FF6B3D'
const SPORT_TAG_MAP = { football: "Bóng đá", badminton: "Cầu lông", pickleball: "Pickleball" };
const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

const SPORT_FILTERS = [
  { key: "all", label: "Tất cả", tagName: null },
  { key: "football", label: "Bóng đá", tagName: "Bóng đá" },
  { key: "pickleball", label: "Pickleball", tagName: "Pickleball" },
  { key: "badminton", label: "Cầu lông", tagName: "Cầu lông" },
];

const SPORT_ICONS = { football: "⚽", badminton: "🏸", pickleball: "🏓" };
const formatCost = (c) => {
  if (!c || c === 0) return "Miễn phí";
  const formatted = c.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted} vnd/ người`;
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const normalizeId = (id) => (id == null ? "" : String(id));

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

const getParticipantName = (p) => (typeof p === "object" ? p?.name : null);

const formatTimeAgo = (dateString) => {
  if (!dateString) return "";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
};

const CreatorProfileRow = ({ creator, label }) => {
  if (!creator || typeof creator !== "object") return null;
  return (
    <View style={styles.creatorRow}>
      <View style={[styles.creatorAvatar, { backgroundColor: AVATAR_COLORS[0] }]}>
        <Text style={styles.creatorAvatarText}>{getInitials(creator.name)}</Text>
      </View>
      <View style={styles.creatorMeta}>
        <Text style={styles.creatorName}>{creator.name || "Người dùng"}</Text>
        <Text style={styles.creatorSub}>{label || creator.area || "Người tạo trận"}</Text>
      </View>
    </View>
  );
};

export default function TeamsScreen({ navigation }) {
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const [activeSubTab, setActiveSubTab] = useState("near");
  const [activeSport, setActiveSport] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [matches, setMatches] = useState([]);
  const [findTeamPosts, setFindTeamPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [findTeamLoading, setFindTeamLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const loadFindTeamPosts = useCallback(async () => {
    try {
      setFindTeamLoading(true);
      const res = await getPostsRequest(1, 50, token, "Tìm đội");
      setFindTeamPosts(res.data || []);
    } catch (err) {
      console.log("Load find team posts error:", err.message);
      setFindTeamPosts([]);
    } finally {
      setFindTeamLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeSubTab === "findteam") {
      loadFindTeamPosts();
    } else {
      loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
    }
  }, [activeSport, activeSubTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeSubTab === "findteam") {
        loadFindTeamPosts();
      } else {
        loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
      }
    }, [loadMatches, loadFindTeamPosts, searchText, areaFilter, timeFilter, activeSubTab])
  );

  const handleSearch = () => {
    loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
  };

  const handleViewDetail = (item) => {
    navigation?.navigate?.("MatchDetail", { matchId: item._id, match: item });
  };

  const handleEditMatch = (item) => {
    navigation?.navigate?.("CreateMatch", { editMatch: item });
  };

  const handleLeaveMatch = (item) => {
    Alert.alert("Rút khỏi trận", "Bạn có chắc muốn rút khỏi trận này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rút khỏi",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveMatch(item._id, userId);
            loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
            Alert.alert("Thành công", "Đã rút khỏi trận đấu");
          } catch (err) {
            Alert.alert("Lỗi", err.message);
          }
        },
      },
    ]);
  };

  const handleViewPostDetail = (post) => {
    navigation?.navigate?.("PostDetail", { postId: post._id, post });
  };

  const handleCreateOption = (option) => {
    setShowCreateModal(false);
    if (option === "match") {
      navigation?.navigate?.("CreateMatch");
    }
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

  const renderFigmaCard = (item, tabType) => {
    const joined = isUserParticipant(item);
    const creator = typeof item.createdBy === "object" ? item.createdBy : null;
    const currentCount = item.currentPlayers || item.participants?.length || 0;
    const maxCount = item.maxPlayers || 10;
    const timeLabel = item.startTime && typeof item.startTime === "string" ? item.startTime.replace(":", "g ") + "p" : "";
    const isEnded = item.status === "completed" || item.status === "cancelled";

    // Position needs (football only)
    const positionNeeds = [];
    if (item.sport === "football" && Array.isArray(item.selectedPositionIds)) {
      const ROLE_LABELS = { defender: "Hậu vệ", midfielder: "Trung vệ", forward: "Tiền đạo", goalkeeper: "Thủ môn" };
      const roleCounts = {};
      item.selectedPositionIds.forEach(id => {
        if (typeof id !== "string") return;
        const role = id.replace(/^t[12]_/, "").replace(/[0-9]/g, "");
        const mapped = role.startsWith("gk") ? "goalkeeper" : role.startsWith("lb") || role.startsWith("cb") || role.startsWith("rb") ? "defender" : role.startsWith("dm") || role.startsWith("cm") || role.startsWith("am") ? "midfielder" : role.startsWith("lw") || role.startsWith("rw") || role.startsWith("st") || role.startsWith("cf") ? "forward" : role;
        roleCounts[mapped] = (roleCounts[mapped] || 0) + 1;
      });
      Object.entries(roleCounts).forEach(([role, count]) => {
        positionNeeds.push({ label: ROLE_LABELS[role] || role, count });
      });
    }

    return (
      <View key={item._id} style={styles.card}>
        {/* Card Header: Avatar + Title + ... menu */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.sportSquare}>
              <TagIcon tagName={SPORT_TAG_MAP[item.sport] || "Bóng đá"} size={26} color="#fff" />
            </View>
            {creator && (
              <View style={[styles.creatorBadge, { backgroundColor: AVATAR_COLORS[0] }]}>
                <Text style={styles.creatorAvatarText}>{getInitials(creator.name)}</Text>
              </View>
            )}
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
            {creator && (
              <View style={styles.creatorMetaRow}>
                <Text style={styles.creatorName}>{creator.name || "Người dùng"}</Text>
                <Text style={styles.creatorTimeAgo}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
            )}
          </View>
          {tabType === "created" && (
            <TouchableOpacity style={styles.editBtnMini} activeOpacity={0.6} onPress={() => handleEditMatch(item)}>
               <Ionicons name="pencil" size={16} color="#888" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Info rows */}
        <View style={styles.figmaInfoList}>
          <View style={[styles.figmaInfoRow, { borderTopWidth: 0, paddingTop: 0 }]}>
            <View style={styles.figmaInfoIcon}><Ionicons name="time-outline" size={16} color="#333" /></View>
            <Text style={styles.figmaInfoText}>{timeLabel} - {getDayLabel(item.date)} - {item.date}</Text>
          </View>
          <View style={styles.figmaInfoRow}>
            <View style={styles.figmaInfoIcon}><Ionicons name="location-outline" size={16} color="#333" /></View>
            <Text style={styles.figmaInfoText}>{item.locationName}</Text>
          </View>
          {item.note ? (
            <View style={styles.figmaInfoRow}>
              <View style={styles.figmaInfoIcon}><Ionicons name="create-outline" size={16} color="#333" /></View>
              <Text style={styles.figmaInfoText}>{item.note}</Text>
            </View>
          ) : null}
          <View style={styles.figmaInfoRow}>
            <View style={styles.figmaInfoIcon}><Ionicons name="grid-outline" size={16} color="#333" /></View>
            <Text style={styles.figmaInfoText}>Loại sân : {item.sport === "football" ? `${Math.floor(maxCount/2)}vs ${Math.floor(maxCount/2)}` : `${Math.floor(maxCount/2)} vs ${Math.floor(maxCount/2)}`}</Text>
          </View>
        </View>

        {/* Grid boxes */}
        <View style={styles.figmaGrid}>
          <View style={styles.figmaGridCol}>
            <Text style={styles.figmaGridLabel}>Số người đã tìm.</Text>
            <View style={styles.figmaGridBox}>
              <Ionicons name="people-outline" size={15} color="#333" />
              <Text style={styles.figmaGridValue}>{currentCount}/{maxCount}</Text>
            </View>
          </View>
          <View style={styles.figmaGridCol}>
            <Text style={styles.figmaGridLabel}>Tiền cọc sân.</Text>
            <View style={styles.figmaGridBox}>
              <Ionicons name="wallet-outline" size={15} color="#333" />
              <Text style={styles.figmaGridValue} numberOfLines={1}>{formatCost(item.costPerPerson)}</Text>
            </View>
          </View>
        </View>

        {/* Position tags (football only) */}
        {positionNeeds.length > 0 && (
          <View style={styles.positionTagsSection}>
            <Text style={styles.positionTagsLabel}>Vị trí cần tìm.</Text>
            <View style={styles.positionTagsRow}>
              {positionNeeds.map((p, i) => (
                <View key={i} style={styles.positionTag}>
                  <Text style={styles.positionTagText}>{p.label} x{p.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Row */}
        <View style={styles.figmaActionRow}>
          {tabType === "created" ? (
             <Text style={[styles.joinedText, { color: isEnded ? "#888" : "#22c55e" }]}>{isEnded ? "Đã kết thúc" : "Do bạn tạo"}</Text>
          ) : tabType === "joined" ? (
             <Text style={styles.joinedText}>Đã tham gia</Text>
          ) : joined ? (
             <Text style={styles.joinedText}>Đã tham gia</Text>
          ) : (
             <View style={{ flex: 1 }} />
          )}

          <View style={{ flexDirection: "row", gap: 8 }}>
            {tabType === "joined" && (
              <TouchableOpacity
                style={[styles.viewDetailBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ef4444' }]}
                activeOpacity={0.7}
                onPress={() => handleLeaveMatch(item)}
              >
                <Text style={[styles.viewDetailBtnText, { color: '#ef4444' }]}>Rút khỏi</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewDetailBtn}
              activeOpacity={0.7}
              onPress={() => handleViewDetail(item)}
            >
              <Text style={styles.viewDetailBtnText}>Xem chi tiết</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderFindTeamCard = (item) => {
    const author = typeof item.userId === "object" ? item.userId : null;
    const sportTag = item.sportType || item.tags?.find((t) => t !== "Tìm đội") || "Bóng đá";

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.sportSquare, { backgroundColor: "#FF6B35" }]}>
            <Text style={styles.sportSquareIcon}>👥</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>Tìm đội • {sportTag}</Text>
            <Text style={styles.matchSubtitle}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
        </View>

        {author && (
          <TouchableOpacity
            style={styles.creatorRow}
            activeOpacity={0.7}
            onPress={() => {
              const authorId = author._id || author.id;
              if (authorId && normalizeId(authorId) !== userId) {
                navigation?.navigate?.("UserProfile", { userId: authorId });
              }
            }}
          >
            <View style={[styles.creatorAvatar, { backgroundColor: AVATAR_COLORS[1] }]}>
              {author.picture ? (
                <Image source={{ uri: author.picture }} style={styles.creatorAvatarImg} />
              ) : (
                <Text style={styles.creatorAvatarText}>{getInitials(author.name)}</Text>
              )}
            </View>
            <View style={styles.creatorMeta}>
              <Text style={styles.creatorName}>{author.name || "Người dùng"}</Text>
              <Text style={styles.creatorSub}>Người đăng</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.findTeamContent} numberOfLines={4}>{item.content}</Text>

        <View style={styles.actionRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.detailBlueBtn}
            activeOpacity={0.7}
            onPress={() => handleViewPostDetail(item)}
          >
            <Text style={styles.detailBlueBtnText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (activeSubTab === "findteam") return renderFindTeamCard(item);
    return renderFigmaCard(item, activeSubTab);
  };

  const isFindTeamTab = activeSubTab === "findteam";
  const listLoading = isFindTeamTab ? findTeamLoading : loading;
  const listData = isFindTeamTab ? findTeamPosts : getDisplayData();

  return (
    <Screen style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Image source={require("../../assets/logo_vibesport_icon.png")} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.headerTitle}>
              <Text style={styles.headerTitleBlack}>Tạo</Text>
              <Text style={styles.headerTitleOrange}>Trận</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createBtnText}>Tạo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Sub Tabs ─── */}
      <View style={styles.subTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsInner}>
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
        </ScrollView>
      </View>

      {/* ─── Sport Filters ─── */}
      {!isFindTeamTab && (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersInner}>
          {SPORT_FILTERS.map((f) => {
            const isActive = activeSport === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveSport(f.key)}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
                {f.tagName ? (
                  <View style={styles.chipIconContainer}>
                    <TagIcon tagName={f.tagName} size={14} color={isActive ? ORANGE : "#333"} />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      )}

      {/* ─── Search & Filters Bar ─── */}
      {!isFindTeamTab && (
      <View style={styles.searchSection}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm tên trận đấu, tên người đăng bài,..."
            placeholderTextColor="#aaa"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearch}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <View style={[styles.filterInputWrap, { marginRight: 12 }]}>
            <Ionicons name="time-outline" size={18} color="#333" style={styles.filterRowIcon} />
            <TextInput
              style={styles.filterInput}
              value={areaFilter}
              onChangeText={setAreaFilter}
              placeholder="Khu vực"
              placeholderTextColor="#aaa"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <View style={styles.filterInputWrap}>
            <Ionicons name="location-outline" size={18} color="#333" style={styles.filterRowIcon} />
            <TextInput
              style={styles.filterInput}
              value={timeFilter}
              onChangeText={setTimeFilter}
              placeholder="Giờ"
              placeholderTextColor="#aaa"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
        </View>
      </View>
      )}

      {/* ─── Match / Find Team List ─── */}
      {listLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff4d2d" />
          <Text style={styles.loadingText}>Đang tải trận đấu...</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listInner}
          showsVerticalScrollIndicator={false}
          refreshing={listLoading}
          onRefresh={() => (isFindTeamTab ? loadFindTeamPosts() : loadMatches(searchText, areaFilter, timeFilter, activeSubTab))}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>{isFindTeamTab ? "👥" : "⚽"}</Text>
              <Text style={styles.emptyTitle}>
                {activeSubTab === "findteam"
                  ? "Chưa có bài đăng tìm đội"
                  : activeSubTab === "created"
                  ? "Bạn chưa tạo trận nào"
                  : activeSubTab === "joined"
                    ? "Bạn chưa tham gia trận nào"
                    : "Không tìm thấy trận đấu"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeSubTab === "findteam"
                  ? "Nhấn + Tạo để đăng bài tìm đội mới."
                  : activeSubTab === "near"
                  ? "Hãy tạo trận mới hoặc thay đổi bộ lọc tìm kiếm."
                  : activeSubTab === "created"
                    ? "Nhấn + Tạo để bắt đầu."
                    : "Tìm trận ở tab Gần tôi và tham gia."}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCreateModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tạo mới</Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleCreateOption("match")}
            >
              <Text style={styles.modalOptionIcon}>⚽</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Tạo trận</Text>
                <Text style={styles.modalOptionSub}>Tạo trận đấu mới, tìm người chơi</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
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
  headerWrap: {
    paddingHorizontal: 9,
    paddingTop: 0,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 74,
    borderWidth: 1,
    borderColor: "rgba(99, 94, 94, 0.19)",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: { width: 32, height: 32 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerTitleBlack: { color: "#111" },
  headerTitleOrange: { color: ORANGE },
  createBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Sub Tabs
  subTabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  subTabsInner: {
    gap: 12,
  },
  subTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  subTabActive: {
    borderColor: ORANGE,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  subTabTextActive: {
    color: ORANGE,
  },

  // Sport Filters Chips
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
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
  chipIcon: {
    fontSize: 13,
  },

  // Search & Filters Bar
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
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
  filterRow: {
    flexDirection: "row",
  },
  filterInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  filterRowIcon: {
    marginRight: 8,
  },
  filterInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },

  // List
  listInner: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100 },

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
  avatarContainer: {
    position: "relative",
  },
  sportSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  creatorAvatarText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  moreBtn: {
    padding: 4,
  },
  titleContainer: { flex: 1, marginLeft: 12, justifyContent: "center" },
  matchTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  creatorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  creatorName: { fontSize: 13, fontWeight: "600", color: "#333" },
  creatorTimeAgo: { fontSize: 12, color: "#888", marginLeft: 6 },

  figmaInfoList: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  figmaInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  figmaInfoIcon: {
    width: 24,
    alignItems: "center",
  },
  figmaInfoText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },

  figmaGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  figmaGridCol: {
    flex: 1,
  },
  figmaGridLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
    fontWeight: "600",
  },
  figmaGridBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: "#fff",
  },
  figmaGridValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },

  positionTagsSection: {
    marginTop: 16,
  },
  positionTagsLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },
  positionTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  positionTag: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  positionTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111",
  },

  figmaActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  joinedText: {
    fontSize: 14,
    color: "#22c55e",
    fontWeight: "700",
  },
  viewDetailBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: "auto",
  },
  viewDetailBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  creatorAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  creatorMeta: { marginLeft: 10, flex: 1 },
  creatorSub: { fontSize: 11, color: "#888", marginTop: 1 },

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
  statusDotBlueBg: { backgroundColor: "#eef4ff" },
  statusDotGrayBg: { backgroundColor: "#f3f3f3" },
  statusDotCircle: { width: 6, height: 6, borderRadius: 3 },
  statusDotBlue: { backgroundColor: "#0066cc" },
  statusDotGray: { backgroundColor: "#999" },
  statusDotText: { fontSize: 11, fontWeight: "700" },
  statusDotTextBlue: { color: "#0066cc" },
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
  createdBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff8e1",
    borderWidth: 1,
    borderColor: "#ffe082",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnIcon: { fontSize: 16 },
  detailBlueBtn: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  detailBlueBtnLarge: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 110,
    alignItems: "center",
  },
  detailBlueBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

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

  findTeamContent: {
    marginTop: 12,
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 16,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#f8f9fa",
    marginBottom: 10,
  },
  modalOptionIcon: { fontSize: 28, marginRight: 14 },
  modalOptionText: { flex: 1 },
  modalOptionTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  modalOptionSub: { fontSize: 13, color: "#888", marginTop: 2 },
  modalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, color: "#888", fontWeight: "600" },
});

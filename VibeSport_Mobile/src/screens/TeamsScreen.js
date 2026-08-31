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
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { getMatches, leaveMatch, deleteMatch } from "../services/matchService";
import { getPostsRequest } from "../services/postApi";
import { API_BASE_URL } from "../components/constants/api";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TagIcon } from "../components/TagIcon";
import { Screen } from "../components/Screen";
import { primary } from "../theme";
import { savePost, unsavePost, deletePost, fetchSavedPosts } from "../redux/postSlice";
import { ReportModal } from "../components/ReportModal";
import { VibeAiModal } from "../components/VibeAiModal"; // 🟢 THÊM IMPORT VIBESPORT AI
import { getRequiredPlayersBySport, getMatchCostValue } from "../utils/matchRules";

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
  { id: "t1_st",  label: "Tiền đạo", role: "forward" },
];

const TEAM2_POSITIONS = [
  { id: "t2_gk",  label: "Thủ môn", role: "goalkeeper" },
  { id: "t2_lb",  label: "Hậu vệ",  role: "defender" },
  { id: "t2_cb1", label: "Hậu vệ",  role: "defender" },
  { id: "t2_cb2", label: "Hậu vệ",  role: "defender" },
  { id: "t2_rb",  label: "Hậu vệ",  role: "defender" },
  { id: "t2_dm1", label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_dm2", label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_lm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_am",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_rm",  label: "Tiền vệ",  role: "midfielder" },
  { id: "t2_st",  label: "Tiền đạo", role: "forward" },
];

const ALL_POSITIONS = [...TEAM1_POSITIONS, ...TEAM2_POSITIONS];

const ROLE_LABELS = { defender: "Hậu vệ", midfielder: "Tiền vệ", forward: "Tiền đạo", goalkeeper: "Thủ môn", bench: "Dự bị" };

const getFootballRole = (positionId) => {
  if (typeof positionId !== "string") return null;
  return ALL_POSITIONS.find((item) => item.id === positionId)?.role || null;
};

const formatCost = (c) => {
  if (!c || c === 0) return "Miễn phí";
  const formatted = c.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}đ`;
};

const formatServiceCostDisplay = (cost) => {
  if (cost == null || cost === "" || cost === 0 || cost === "0") return "10.000 – 50.000 VND";
  const costStr = String(cost).trim();
  if (costStr.includes("-")) {
    const parts = costStr.split("-");
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    if (!isNaN(p1) && !isNaN(p2)) {
      return `${p1.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} – ${p2.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND`;
    }
  }
  const num = parseInt(costStr, 10);
  if (!isNaN(num) && num > 0) {
    return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} VND`;
  }
  return costStr;
};

const isVirtualUser = (p) => {
  if (!p) return false;
  if (typeof p === 'boolean') return p;
  if (typeof p !== 'object') return false;
  if (p.isVirtual === true || p.isVirtual === 'true') return true;
  if (p.createdByUser != null) return true;
  if (typeof p.email === 'string' && (p.email.startsWith('virtual_') || p.email.includes('@virtual.vibesport.com'))) return true;
  if (typeof p.name === 'string' && (p.name.includes('(Ảo)') || p.name.includes('[Ảo]'))) return true;
  return false;
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const getMatchStatusInfo = (m) => {
  if (!m) return { label: "Chưa bắt đầu", icon: "time-outline", bg: "#FFF7ED", color: "#C2410C", borderColor: "#FFD8A8" };
  const isEnded = m.teamStatus === "ended" || m.status === "completed";
  const isOngoing = m.teamStatus === "ongoing";
  const isCancelled = m.status === "cancelled";

  if (isCancelled) {
    return {
      label: "Đã hủy",
      icon: "close-circle-outline",
      bg: "#FEE2E2",
      color: "#B91C1C",
      borderColor: "#FCA5A5",
    };
  }
  if (isEnded) {
    return {
      label: "Đã kết thúc",
      icon: "flag-outline",
      bg: "#F3F4F6",
      color: "#4B5563",
      borderColor: "#E5E7EB",
    };
  }
  if (isOngoing) {
    return {
      label: "Đang diễn ra",
      icon: "radio-button-on-outline",
      bg: "#DCFCE7",
      color: "#15803D",
      borderColor: "#86EFAC",
    };
  }
  return {
    label: "Chưa bắt đầu",
    icon: "time-outline",
    bg: "#FFF7ED",
    color: "#C2410C",
    borderColor: "#FFD8A8",
  };
};

const normalizeId = (id) => (id == null ? "" : String(id));

const getUserIdValue = (value) => normalizeId(typeof value === "object" ? value?._id || value?.id : value);

const getNormalizedRequiredPlayers = (match) => {
  if (!match) return 0;
  return getRequiredPlayersBySport(match.sport, match, Number(match.maxPlayers || 2));
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

// ─── TimeWheelPicker Component ───────────────────────────────────────────────
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;

const TimeWheelPicker = ({ value, onChange, startHour = 5 }) => {
  const hours = Array.from({ length: 19 }, (_, i) => startHour + i); // 5..23 or 6..24
  const minutes = [0, 15, 30, 45];

  const parseValue = (val) => {
    if (!val) return { h: hours[0], m: 0 };
    const parts = val.split(":");
    return { h: parseInt(parts[0], 10) || hours[0], m: parseInt(parts[1], 10) || 0 };
  };

  const { h: selectedH, m: selectedM } = parseValue(value);

  const hourScrollRef = React.useRef(null);
  const minuteScrollRef = React.useRef(null);

  const hourIndex = hours.indexOf(selectedH) === -1 ? 0 : hours.indexOf(selectedH);
  const minuteIndex = minutes.indexOf(selectedM) === -1 ? 0 : minutes.indexOf(selectedM);

  React.useEffect(() => {
    setTimeout(() => {
      hourScrollRef.current?.scrollTo({ y: hourIndex * WHEEL_ITEM_HEIGHT, animated: false });
      minuteScrollRef.current?.scrollTo({ y: minuteIndex * WHEEL_ITEM_HEIGHT, animated: false });
    }, 50);
  }, []);

  const handleHourScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const h = hours[Math.max(0, Math.min(idx, hours.length - 1))];
    const m = selectedM;
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const handleMinuteScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const m = minutes[Math.max(0, Math.min(idx, minutes.length - 1))];
    const h = selectedH;
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const renderWheelColumn = (items, selectedIdx, scrollRef, onScroll) => (
    <View style={{ width: 64, height: WHEEL_HEIGHT, overflow: "hidden", borderRadius: 12, backgroundColor: "#2C2C2E" }}>
      {/* Top fade */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: WHEEL_ITEM_HEIGHT * 2, zIndex: 2, backgroundColor: "rgba(44,44,46,0.7)" }} />
      {/* Highlight bar */}
      <View pointerEvents="none" style={{
        position: "absolute",
        top: WHEEL_ITEM_HEIGHT * 2,
        left: 0, right: 0,
        height: WHEEL_ITEM_HEIGHT,
        zIndex: 1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
      }} />
      {/* Bottom fade */}
      <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: WHEEL_ITEM_HEIGHT * 2, zIndex: 2, backgroundColor: "rgba(44,44,46,0.7)" }} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        contentContainerStyle={{ paddingTop: WHEEL_ITEM_HEIGHT * 2, paddingBottom: WHEEL_ITEM_HEIGHT * 2 }}
      >
        {items.map((item, idx) => (
          <View key={idx} style={{ height: WHEEL_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}>
            <Text style={{
              fontSize: 20,
              fontWeight: "600",
              color: idx === selectedIdx ? "#FFFFFF" : "rgba(255,255,255,0.35)",
            }}>
              {String(item).padStart(2, "0")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {renderWheelColumn(hours, hourIndex, hourScrollRef, handleHourScroll)}
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#333" }}>:</Text>
        {renderWheelColumn(minutes, minuteIndex, minuteScrollRef, handleMinuteScroll)}
      </View>
      {value ? (
        <TouchableOpacity onPress={() => onChange("")} style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: "#aaa", textDecorationLine: "underline" }}>Xóa</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
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
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const [activeSubTab, setActiveSubTab] = useState("near");
  const [activeSport, setActiveSport] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [pitchStatusFilter, setPitchStatusFilter] = useState("");
  const [minCostFilter, setMinCostFilter] = useState("");
  const [maxCostFilter, setMaxCostFilter] = useState("");
  const [minServiceFilter, setMinServiceFilter] = useState("");
  const [maxServiceFilter, setMaxServiceFilter] = useState("");
  const [matches, setMatches] = useState([]);
  const [findTeamPosts, setFindTeamPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [findTeamLoading, setFindTeamLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [optionsPost, setOptionsPost] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [postToReport, setPostToReport] = useState(null);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

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
      if (skillFilter) filters.skillLevel = skillFilter;
      if (pitchStatusFilter) filters.pitchStatus = pitchStatusFilter;

      const data = await getMatches(filters);
      setMatches(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch (err) {
      console.log("Load matches error:", err.message);
      setMatches([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [activeSport, activeSubTab, userId, skillFilter, pitchStatusFilter]);

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
  }, [activeSport, activeSubTab, searchText, areaFilter, timeFilter, loadMatches, loadFindTeamPosts]);

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

  const isMatchStartingWithinOneHour = (matchObj) => {
    if (!matchObj || !matchObj.date) return false;
    try {
      let year, month, day;
      if (matchObj.date.includes("/")) {
        const parts = matchObj.date.split("/").map(Number);
        day = parts[0];
        month = parts[1];
        year = parts[2];
      } else if (matchObj.date.includes("-")) {
        const parts = matchObj.date.split("-");
        if (parts[0].length === 4) {
          year = Number(parts[0]);
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          day = Number(parts[0]);
          month = Number(parts[1]);
          year = Number(parts[2]);
        }
      } else {
        return false;
      }

      const startStr = matchObj.startTime || "19:00";
      const [h, m] = startStr.split(":").map(Number);

      const matchStart = new Date(year, month - 1, day, h || 0, m || 0, 0);
      const now = new Date();

      const diffMs = matchStart.getTime() - now.getTime();
      return diffMs <= 3 * 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  };

  const handleViewDetail = (item) => {
    navigation?.navigate?.("MatchDetail", { matchId: item._id, match: item });
  };

  const handleEditMatch = (item) => {
    if (item?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể Sửa.");
      return;
    }
    if (isMatchStartingWithinOneHour(item)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể Sửa!");
      return;
    }
    Alert.alert(
      "Xác nhận chỉnh sửa",
      "Bạn có chắc chắn muốn chỉnh sửa thông tin trận đấu này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chỉnh sửa",
          onPress: () => {
            navigation?.navigate?.("CreateMatch", { editMatch: item });
          },
        },
      ]
    );
  };

  const handleDeleteMatch = (item) => {
    if (item?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể Xóa.");
      return;
    }
    if (isMatchStartingWithinOneHour(item)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 3 tiếng (hoặc đã diễn ra), không thể Hủy / Xóa!");
      return;
    }
    Alert.alert(
      "Xác nhận xóa trận đấu",
      "Bạn có chắc chắn muốn xóa trận đấu này không? Thao tác này sẽ hủy trận và không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa trận đấu",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteMatch(item._id, token);
              await loadMatches(searchText, areaFilter, timeFilter, activeSubTab);
              if (res?.isDeleted) {
                Alert.alert("Thành công", res?.message || "Đã xóa trận đấu thành công.");
              } else if (res?.pendingVote) {
                Alert.alert("Thông báo biểu quyết", res?.message || "Đã gửi yêu cầu biểu quyết xóa.");
              } else {
                Alert.alert("Thông báo", res?.message || "Đã xử lý yêu cầu.");
              }
            } catch (err) {
              Alert.alert("Lỗi", err?.message || String(err) || "Không thể thực hiện thao tác xóa.");
            }
          },
        },
      ]
    );
  };

  const handleMatchOptions = (item) => {
    const creator = typeof item.createdBy === "object" ? item.createdBy : item.createdBy;
    const creatorId = normalizeId(typeof creator === "object" ? creator?._id || creator?.id : creator);
    const isOwner = creatorId && creatorId === userId;

    const options = [
      {
        text: "Xem chi tiết",
        onPress: () => handleViewDetail(item),
      },
    ];

    if (isOwner) {
      options.push(
        {
          text: "Chỉnh sửa",
          onPress: () => handleEditMatch(item),
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => handleDeleteMatch(item),
        }
      );
    }

    options.push({
      text: "Hủy",
      style: "cancel",
    });

    Alert.alert(
      "Quản lý trận đấu",
      isOwner ? "Chọn hành động cho trận đấu của bạn" : "Chọn hành động",
      options
    );
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

  const getPostAuthorId = (post) => {
    if (!post) return "";
    const authorObj = post.createdBy || post.userId || post.author || post.user;
    if (typeof authorObj === "object" && authorObj != null) {
      return normalizeId(authorObj._id || authorObj.id);
    }
    return normalizeId(authorObj);
  };

  const isPostOwner = (post) => {
    if (!post) return false;
    if (post.isOwner === true || post.isMine === true || post.owner === true) return true;

    const currentUserId = normalizeId(user?._id || user?.id);
    if (!currentUserId) return false;

    const authorId = getPostAuthorId(post);
    return !!authorId && authorId === currentUserId;
  };

  const handleDeletePost = (post) => {
    Alert.alert("Xóa bài viết", "Bạn có chắc chắn muốn xóa bài viết này không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          dispatch(deletePost(post._id))
            .unwrap()
            .then(() => {
              Alert.alert("Thành công", "Đã xóa bài viết.");
            })
            .catch((err) => {
              Alert.alert("Lỗi", err || "Không thể xóa bài viết");
            })
            .finally(() => {
              setOptionsPost(null);
            });
        },
      },
    ]);
  };

  const updateFindTeamPostSavedState = useCallback((postId, isSaved) => {
    setFindTeamPosts((prev) => prev.map((item) => (item._id === postId ? { ...item, isSaved } : item)));
  }, []);

  const handleToggleSavePost = (post) => {
    if (!post?._id) {
      Alert.alert("Lỗi", "Bài viết không hợp lệ để lưu.");
      return;
    }

    const nextSavedState = !Boolean(post.isSaved);
    const action = nextSavedState ? savePost(post._id) : unsavePost(post._id);

    dispatch(action)
      .unwrap()
      .then(() => {
        updateFindTeamPostSavedState(post._id, nextSavedState);
        setOptionsPost((prev) => (prev?._id === post._id ? { ...prev, isSaved: nextSavedState } : prev));
        dispatch(fetchSavedPosts());
        Alert.alert(
          "Thành công",
          nextSavedState ? "Đã lưu bài viết." : "Đã bỏ lưu bài viết."
        );
      })
      .catch((err) => {
        Alert.alert("Lỗi", err?.error || "Không thể cập nhật trạng thái lưu bài viết.");
      })
      .finally(() => {
        setOptionsPost(null);
      });
  };

  const handleReportPost = (reason) => {
    setReportModalVisible(false);
    setPostToReport(null);
    setOptionsPost(null);
    Alert.alert("Thành công", "Cảm ơn bạn đã gửi báo cáo. Chúng tôi sẽ xem xét bài viết này sớm nhất có thể!");
  };

  const handlePostOptions = (post) => {
    if (!post) return;
    setOptionsPost(post);
  };

  const handleCreateOption = (option) => {
    setShowCreateModal(false);
    if (option !== "match") return;

    Alert.alert(
      "ℹ️ Thông báo",
      "Nếu đội ban đầu của bạn có quá ít người thì không nên tạo trận, thay vào đó hãy tìm trận đấu phù hợp",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Tiếp tục",
          onPress: () => navigation?.navigate?.("CreateMatch"),
        },
      ]
    );
  };

  const isUserParticipant = (match) => {
    const pList = match.participants || [];
    return pList.some((p) => {
      const pid = typeof p === "object" ? p._id || p.id : p;
      return normalizeId(pid) === userId;
    });
  };

  const applyClientFilters = (list) => {
    let result = list;
    // Lọc trình độ
    if (skillFilter) {
      result = result.filter((m) => (m.skillLevel || "") === skillFilter);
    }
    // Lọc trạng thái cọc
    if (pitchStatusFilter === "Đã cọc") {
      result = result.filter((m) => m.pitchStatus === "Đã cọc");
    } else if (pitchStatusFilter === "Chưa cọc") {
      result = result.filter((m) => m.pitchStatus !== "Đã cọc");
    }
    // Lọc quận/huyện
    if (districtFilter.trim()) {
      const kw = districtFilter.trim().toLowerCase();
      result = result.filter((m) =>
        (m.locationName || "").toLowerCase().includes(kw) ||
        (m.area || "").toLowerCase().includes(kw)
      );
    }
    // Lọc giờ từ-đến
    if (timeFrom || timeTo) {
      const toMinutes = (t) => { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + (m || 0); };
      const fromMin = timeFrom ? toMinutes(timeFrom) : 0;
      const toMin = timeTo ? toMinutes(timeTo) : 24 * 60;
      result = result.filter((m) => {
        const matchMin = toMinutes(m.startTime || "00:00");
        return matchMin >= fromMin && matchMin <= toMin;
      });
    }
    // Lọc giá/người
    const minC = minCostFilter ? parseInt(minCostFilter.replace(/\D/g, ""), 10) : null;
    const maxC = maxCostFilter ? parseInt(maxCostFilter.replace(/\D/g, ""), 10) : null;
    if (minC != null && !isNaN(minC)) result = result.filter((m) => (m.costPerPerson || 0) >= minC);
    if (maxC != null && !isNaN(maxC)) result = result.filter((m) => (m.costPerPerson || 0) <= maxC);
    // Lọc giá dịch vụ
    const minS = minServiceFilter ? parseInt(minServiceFilter.replace(/\D/g, ""), 10) : null;
    const maxS = maxServiceFilter ? parseInt(maxServiceFilter.replace(/\D/g, ""), 10) : null;
    if (minS != null && !isNaN(minS)) {
      result = result.filter((m) => {
        const sv = parseInt(String(m.serviceCost || "0").split("-")[0].replace(/\D/g, ""), 10) || 0;
        return sv >= minS;
      });
    }
    if (maxS != null && !isNaN(maxS)) {
      result = result.filter((m) => {
        const sv = parseInt(String(m.serviceCost || "0").split("-")[0].replace(/\D/g, ""), 10) || 0;
        return sv <= maxS;
      });
    }
    return result;
  };

  const getDisplayData = () => {
    let base;
    if (activeSubTab === "near") {
      base = matches.filter((m) => m.status !== "completed" && m.status !== "cancelled");
    } else if (activeSubTab === "joined") {
      base = matches.filter(isUserParticipant).filter((m) => m.status !== "completed" && m.status !== "cancelled");
    } else if (activeSubTab === "created") {
      base = matches.filter((m) => {
        const creator = m.createdBy;
        const creatorId = typeof creator === "object" ? creator?._id || creator?.id : creator;
        return normalizeId(creatorId) === userId;
      });
    } else if (activeSubTab === "ended") {
      base = matches.filter((m) => m.status === "completed" || m.status === "cancelled");
    } else {
      base = matches;
    }
    return applyClientFilters(base);
  };

  const renderFigmaCard = (item, tabType) => {
    const joined = isUserParticipant(item);
    const creator = typeof item.createdBy === "object" ? item.createdBy : null;
    const creatorId = getUserIdValue(item.createdBy);
    const participantList = Array.isArray(item.participants) ? item.participants : [];
    const actualJoinedCount = Number(item.currentPlayers ?? participantList.length ?? 0);
    const participantsCount = Math.max(actualJoinedCount, participantList.length || 0);
    const requiredPlayers = getNormalizedRequiredPlayers(item);
    const positionCount = Array.isArray(item.selectedPositionIds) ? item.selectedPositionIds.length : 0;
    const benchCount = Number(item.benchMembersTeam1 || 0) + Number(item.benchMembersTeam2 || 0);
    const totalNeededPositions = item.sport === "football" ? positionCount + benchCount : requiredPlayers;
    const maxCount = Math.max(Number(item.maxPlayers || requiredPlayers || 10), requiredPlayers || 1);
    const displayFound = `${participantsCount}/${Math.max(totalNeededPositions || maxCount, maxCount)}`;
    let timeLabel = item.time;
    if (!timeLabel || !timeLabel.includes("-")) {
      const startStr = item.startTime || "19:00";
      let endStr = item.endTime;
      if (!endStr) {
        const [h, m] = startStr.split(":").map(Number);
        const totalM = (h || 19) * 60 + (m || 0) + 90;
        const endH = String(Math.floor(totalM / 60) % 24).padStart(2, "0");
        const endM = String(totalM % 60).padStart(2, "0");
        endStr = `${endH}:${endM}`;
      }
      timeLabel = `${startStr} - ${endStr}`;
    }
    const isEnded = item.status === "completed" || item.status === "cancelled";

    const selectedPositionCount = Array.isArray(item.selectedPositionIds) ? item.selectedPositionIds.length : 0;
    const pitchTypeLabel = item.customPitchType
      ? `Sân ${item.customPitchType}`
      : (item.sport === "football"
        ? (maxCount === 10 ? "Sân 5 (5v5)" : maxCount === 14 ? "Sân 7 (7v7)" : "Sân 11 (11v11)")
        : ((selectedPositionCount > 0 && (item.sport === "badminton" || item.sport === "pickleball"))
          ? (selectedPositionCount <= 2 ? "Sân đơn (1v1)" : "Sân đôi (2v2)")
          : (maxCount === 2 ? "Sân đơn (1v1)" : "Sân đôi (2v2)")));

    const mainPlayersCount = Math.max(1, requiredPlayers || Number(item.maxPlayers || 10));
    const totalHoursVal = Number(item.totalHours || 1);
    const totalCostVal = Number(item.totalCourtCost || 0);
    const costPerPlayerVal = getMatchCostValue({ ...item, sport: item.sport, requiredPlayers: mainPlayersCount, totalCourtCost: totalCostVal });

    // Position needs with Team indicator
    const positionNeeds = [];
    if (item.sport === "football") {
      const POSITION_LABEL_MAP = {
        gk: "Thủ môn",
        lb: "Hậu vệ",
        cb: "Hậu vệ",
        cb1: "Hậu vệ",
        cb2: "Hậu vệ",
        rb: "Hậu vệ",
        dm: "Tiền vệ",
        dm1: "Tiền vệ",
        dm2: "Tiền vệ",
        cm: "Tiền vệ",
        am: "Tiền vệ",
        lm: "Tiền vệ",
        rm: "Tiền vệ",
        st: "Tiền đạo",
        st1: "Tiền đạo",
        st2: "Tiền đạo",
      };

      const teamRoleCounts = {};

      if (Array.isArray(item.selectedPositionIds)) {
        item.selectedPositionIds.forEach((id) => {
          if (typeof id !== "string") return;
          const teamNumber = id.startsWith("t1_") ? 1 : (id.startsWith("t2_") ? 2 : 0);
          const rawRole = id.replace(/^t[12]_/, "").replace(/_\d+$/, "").toLowerCase();
          const baseKey = rawRole.replace(/\d+$/, "");
          const roleLabel = POSITION_LABEL_MAP[rawRole] || POSITION_LABEL_MAP[baseKey] || "Cầu thủ";
          const teamLabel = teamNumber > 0 ? `Đội ${teamNumber}` : "";

          const key = teamLabel ? `${roleLabel} · ${teamLabel}` : roleLabel;
          if (!teamRoleCounts[key]) {
            teamRoleCounts[key] = { label: key, count: 0, teamNumber };
          }
          teamRoleCounts[key].count += 1;
        });
      }

      const b1 = Number(item.benchMembersTeam1 || 0);
      const b2 = Number(item.benchMembersTeam2 || 0);
      if (b1 > 0) {
        const key = "Dự bị · Đội 1";
        if (!teamRoleCounts[key]) teamRoleCounts[key] = { label: key, count: 0, teamNumber: 1 };
        teamRoleCounts[key].count += b1;
      }
      if (b2 > 0) {
        const key = "Dự bị · Đội 2";
        if (!teamRoleCounts[key]) teamRoleCounts[key] = { label: key, count: 0, teamNumber: 2 };
        teamRoleCounts[key].count += b2;
      }

      Object.values(teamRoleCounts).forEach((entry) => {
        positionNeeds.push(entry);
      });
    }

    return (
      <View key={item._id} style={styles.card}>
        {/* Match Status Bar */}
        {(() => {
          const statusInfo = getMatchStatusInfo(item);
          return (
            <View style={[styles.matchStatusBarContainer, { backgroundColor: statusInfo.bg, borderColor: statusInfo.borderColor }]}>
              <Ionicons name={statusInfo.icon} size={15} color={statusInfo.color} style={{ marginRight: 6 }} />
              <Text style={[styles.matchStatusBarText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          );
        })()}

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
          <TouchableOpacity style={styles.moreBtn} activeOpacity={0.6} onPress={() => handlePostOptions(item)}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Compact & Ultra-Sleek Info Container */}
        <View style={{ backgroundColor: "#F9FAFB", borderRadius: 14, padding: 10, marginVertical: 8, gap: 8 }}>
          {/* 1 & 3: Tên sân & Thời gian */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location-outline" size={15} color="#4B5563" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
                {item.locationName}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="time-outline" size={15} color="#4B5563" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#4B5563" }}>
                {timeLabel} - {item.date}
              </Text>
            </View>
          </View>

          {/* 2, 4, 5, 6, 7: Flexible Responsive Badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4,marginRight:10 }}>
            <View style={{ backgroundColor: "#FFFFFF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", marginRight:10}}>
              <MaterialCommunityIcons name="soccer-field" size={14} color="#6B7280" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: "#374151", fontWeight: "600" }}>{pitchTypeLabel}</Text>
            </View>

            <View style={{ backgroundColor: item.pitchStatus === "Đã cọc" ? "#FFF7ED" : "#FFFFFF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: item.pitchStatus === "Đã cọc" ? "#FFD8A8" : "#E5E7EB", flexDirection: "row", alignItems: "center", marginRight:10}}>
              <Ionicons name="card-outline" size={14} color={item.pitchStatus === "Đã cọc" ? ORANGE : "#6B7280"} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: item.pitchStatus === "Đã cọc" ? ORANGE : "#374151", fontWeight: "600" }}>
                {item.pitchStatus === "Đã cọc" && item.depositAmount ? `Đã cọc ${formatCost(item.depositAmount)}` : (item.pitchStatus || "Chưa cọc")}
              </Text>
            </View>

            <View style={{ backgroundColor: "#FFFFFF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center",marginRight:10 }}>
              <Ionicons name="ribbon-outline" size={14} color="#FF6B3D" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: ORANGE, fontWeight: "700" }}>{item.skillLevel || "Người mới"}</Text>
            </View>

            <View style={{ backgroundColor: "#ECFDF5", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#A7F3D0", flexDirection: "row", alignItems: "center", marginRight: 10 }}>
              <Ionicons name="cash-outline" size={14} color="#059669" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: "#059669", fontWeight: "700" }}>{formatCost(costPerPlayerVal)}</Text>
            </View>

            <View style={{ backgroundColor: "#FFF7ED", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#FFD8A8", flexDirection: "row", alignItems: "center",marginRight:10 }}>
              <Ionicons name="people-outline" size={14} color={ORANGE} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: "#C2410C", fontWeight: "700" }}>Đã tìm: {displayFound}</Text>
            </View>

            <View style={{ backgroundColor: "#FFFFFF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="basket-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: "#374151", fontWeight: "600" }}>Giá DV: {formatServiceCostDisplay(item.serviceCost)}</Text>
            </View>
          </View>
        </View>

        {positionNeeds.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8, paddingHorizontal: 2, marginLeft: 9 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>Vị trí cần tìm:</Text>
            {positionNeeds.map((p, i) => {
              const isTeam1 = p.teamNumber === 1;
              const isTeam2 = p.teamNumber === 2;

              return (
                <View
                  key={`pos_need_${i}`}
                  style={{
                    backgroundColor: isTeam1 ? "#DBEAFE" : (isTeam2 ? "#FEE2E2" : "#F3F4F6"),
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{
                    fontSize: 11.5,
                    fontWeight: "700",
                    color: isTeam1 ? "#1D4ED8" : (isTeam2 ? "#DC2626" : "#1F2937"),
                  }}>
                    {p.label}{p.count > 1 ? ` x${p.count}` : ""}
                  </Text>
                </View>
              );
            })}
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
          <TouchableOpacity
            style={styles.moreBtn}
            activeOpacity={0.7}
            onPress={() => handlePostOptions(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
          </TouchableOpacity>
        </View>
        {author && (
          <TouchableOpacity
            style={styles.creatorRow}
            activeOpacity={0.7}
            onPress={() => {
              const authorId = normalizeId(author?._id || author?.id || item.userId);
              if (authorId && authorId !== userId) {
                navigation?.navigate?.("UserProfile", {
                  userId: authorId,
                  initialProfile: author,
                });
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
  const hasActiveFilters = activeSport !== "all" || Boolean(searchText.trim()) || Boolean(areaFilter.trim()) ||
    Boolean(districtFilter.trim()) || Boolean(timeFilter.trim()) || Boolean(timeFrom) || Boolean(timeTo) || Boolean(skillFilter) ||
    Boolean(pitchStatusFilter) || Boolean(minCostFilter) || Boolean(maxCostFilter) ||
    Boolean(minServiceFilter) || Boolean(maxServiceFilter);
  const activeFilterCount = [activeSport !== "all", searchText.trim(), areaFilter.trim(),
    districtFilter.trim(), timeFilter.trim(), skillFilter, pitchStatusFilter,
    minCostFilter, maxCostFilter, minServiceFilter, maxServiceFilter
  ].filter(Boolean).length;
  const filterSummary = activeSport === "all"
    ? (hasActiveFilters ? `${activeFilterCount} bộ lọc` : "Tất cả môn")
    : SPORT_FILTERS.find((item) => item.key === activeSport)?.label || "Tất cả môn";

  const handleResetFilters = () => {
    setActiveSport("all");
    setSearchText("");
    setAreaFilter("");
    setDistrictFilter("");
    setTimeFilter("");
    setTimeFrom("");
    setTimeTo("");
    setSkillFilter("");
    setPitchStatusFilter("");
    setMinCostFilter("");
    setMaxCostFilter("");
    setMinServiceFilter("");
    setMaxServiceFilter("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Screen style={styles.container}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Image
              source={require("../../assets/logovibe_tachnen.png")}
              style={styles.headerLogo}
              resizeMode="contain"
              fadeDuration={0}
            />
            <Text style={styles.headerTitle}>
              <Text style={styles.headerTitleBlack}>Trận</Text>
              <Text style={styles.headerTitleOrange}> Đấu</Text>
            </Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={styles.createBtnText}>Tạo</Text>
          </TouchableOpacity>
        </View>

      {/* ─── Sub Tabs ─── */}
      <View style={styles.subTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsInner}>
          {[
            { key: "near", label: "Gần tôi" },
            { key: "joined", label: "Đã tham gia" },
            { key: "created", label: "Đã tạo" },
            { key: "ended", label: "Đã kết thúc" },
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

      {/* ─── Filter Toggle ─── */}
      {!isFindTeamTab && (
        <View style={styles.filterToggleRow}>
          <TouchableOpacity
            style={[styles.filterToggleButton, hasActiveFilters && { borderColor: ORANGE, borderWidth: 2 }]}
            activeOpacity={0.85}
            onPress={() => setFilterModalVisible(true)}
          >
            <View style={styles.filterToggleLeft}>
              <Ionicons name="options-outline" size={18} color={hasActiveFilters ? ORANGE : "#333"} />
              <Text style={[styles.filterToggleText, hasActiveFilters && { color: ORANGE }]}>Bộ lọc</Text>
              {hasActiveFilters ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleResetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#aaa" />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={18} color="#666" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Filter Modal Full Screen ─── */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#F0F2F5" }}>
          {/* Modal Header */}
          <View style={styles.filterModalHeader}>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Bộ lọc tìm kiếm</Text>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={{ color: ORANGE, fontWeight: "700", fontSize: 14 }}>Đặt lại</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, gap: 16 }}
          >
            {/* 1. Môn thể thao */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Môn thể thao</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {SPORT_FILTERS.map((f) => {
                  const isActive = activeSport === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterChip, styles.filterChipLarge, isActive && styles.filterChipActive]}
                      onPress={() => setActiveSport(f.key)}
                    >
                      {f.tagName ? <TagIcon tagName={f.tagName} size={15} color={isActive ? ORANGE : "#555"} /> : null}
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Tìm kiếm */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Tìm kiếm</Text>
              <View style={styles.searchWrap}>
                <TextInput
                  style={[styles.searchInput, { height: 50, borderColor: "#CDD1D8", borderWidth: 1.5 }]}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Tên trận, người tạo..."
                  placeholderTextColor="#aaa"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleSearch}>
                  <Ionicons name="search" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Giờ thi đấu */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Giờ thi đấu</Text>
              <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-around" }}>
                {/* Từ giờ */}
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: "600" }}>Từ giờ</Text>
                  <TimeWheelPicker
                    value={timeFrom}
                    onChange={setTimeFrom}
                  />
                </View>
                {/* Đến giờ */}
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, fontWeight: "600" }}>Đến giờ</Text>
                  <TimeWheelPicker
                    value={timeTo}
                    onChange={setTimeTo}
                    startHour={6}
                  />
                </View>
              </View>
            </View>

            {/* 4. Khu vực */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Khu vực</Text>
              <View style={[styles.filterInputWrap, { marginBottom: 10, borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                <Ionicons name="map-outline" size={16} color="#666" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.filterInput}
                  value={areaFilter}
                  onChangeText={setAreaFilter}
                  placeholder="Tỉnh / Thành phố"
                  placeholderTextColor="#aaa"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>
              <View style={[styles.filterInputWrap, { borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                <Ionicons name="location-outline" size={16} color="#666" style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.filterInput, { flex: 1 }]}
                  value={districtFilter}
                  onChangeText={setDistrictFilter}
                  placeholder="Quận / Huyện / Tên sân"
                  placeholderTextColor="#aaa"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                {districtFilter ? (
                  <TouchableOpacity onPress={() => setDistrictFilter("")}>
                    <Ionicons name="close-circle" size={16} color="#bbb" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* 5. Trình độ */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Trình độ</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {["", "Người mới", "Trung cấp", "Chuyên nghiệp"].map((lvl) => (
                  <TouchableOpacity
                    key={lvl || "all_skill"}
                    style={[styles.filterChip, styles.filterChipLarge, skillFilter === lvl && styles.filterChipActive]}
                    onPress={() => setSkillFilter(lvl)}
                  >
                    <Text style={[styles.filterChipText, skillFilter === lvl && styles.filterChipTextActive]}>
                      {lvl || "Tất cả"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 6. Cọc sân */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Cọc sân</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {[["", "Tất cả"], ["Đã cọc", "✅ Đã cọc"], ["Chưa cọc", "⏳ Chưa cọc"]].map(([val, lbl]) => (
                  <TouchableOpacity
                    key={val || "all_pitch"}
                    style={[styles.filterChip, styles.filterChipLarge, pitchStatusFilter === val && styles.filterChipActive]}
                    onPress={() => setPitchStatusFilter(val)}
                  >
                    <Text style={[styles.filterChipText, pitchStatusFilter === val && styles.filterChipTextActive]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 7. Giá/người */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Giá / người (đ)</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={[styles.filterInputWrap, { flex: 1, borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                  <TextInput style={styles.filterInput} value={minCostFilter} onChangeText={setMinCostFilter} placeholder="Từ" placeholderTextColor="#aaa" keyboardType="numeric" />
                </View>
                <Text style={{ alignSelf: "center", color: "#999", fontSize: 16 }}>–</Text>
                <View style={[styles.filterInputWrap, { flex: 1, borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                  <TextInput style={styles.filterInput} value={maxCostFilter} onChangeText={setMaxCostFilter} placeholder="Đến" placeholderTextColor="#aaa" keyboardType="numeric" />
                </View>
              </View>
            </View>

            {/* 8. Giá dịch vụ */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Giá dịch vụ (đ)</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={[styles.filterInputWrap, { flex: 1, borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                  <TextInput style={styles.filterInput} value={minServiceFilter} onChangeText={setMinServiceFilter} placeholder="Từ" placeholderTextColor="#aaa" keyboardType="numeric" />
                </View>
                <Text style={{ alignSelf: "center", color: "#999", fontSize: 16 }}>–</Text>
                <View style={[styles.filterInputWrap, { flex: 1, borderColor: "#CDD1D8", borderWidth: 1.5 }]}>
                  <TextInput style={styles.filterInput} value={maxServiceFilter} onChangeText={setMaxServiceFilter} placeholder="Đến" placeholderTextColor="#aaa" keyboardType="numeric" />
                </View>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Apply Button */}
          <View style={{ padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
            <TouchableOpacity
              style={styles.applyFilterBtn}
              onPress={() => { handleSearch(); setFilterModalVisible(false); }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.applyFilterBtnText}>Áp dụng bộ lọc</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* ─── Match / Find Team List ─── */}
      {listLoading && listData.length === 0 ? (
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
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⚽</Text>
              <Text style={styles.emptyTitle}>
                {activeSubTab === "ended"
                  ? "Chưa có trận đấu đã kết thúc"
                  : activeSubTab === "created"
                    ? "Bạn chưa tạo trận nào"
                    : activeSubTab === "joined"
                      ? "Bạn chưa tham gia trận nào"
                      : "Không tìm thấy trận đấu"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeSubTab === "ended"
                  ? "Các trận đấu đã hoàn thành hoặc bị hủy sẽ xuất hiện tại đây."
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

      {/* 🟢 NHÚNG VIBESPORT AI FAB & MODAL CHAT VÀO ĐÂY */}
      <VibeAiModal navigation={navigation} />

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

      <Modal
        animationType="slide"
        transparent={true}
        visible={optionsPost !== null}
        onRequestClose={() => setOptionsPost(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOptionsPost(null)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Tùy chọn bài viết</Text>

            {optionsPost && isPostOwner(optionsPost) ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    if (post) {
                      if (post.sport || post.locationName || post.maxPlayers) {
                        handleEditMatch(post);
                      } else {
                        navigation.navigate("CreatePost", { editPost: post });
                      }
                    }
                  }}
                  style={styles.bottomSheetOption}
                >
                  <Text style={styles.bottomSheetOptionText}>Sửa bài viết</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const post = optionsPost;
                    setOptionsPost(null);
                    if (post) {
                      if (post.sport || post.locationName || post.maxPlayers) {
                        handleDeleteMatch(post);
                      } else {
                        handleDeletePost(post);
                      }
                    }
                  }}
                  style={[styles.bottomSheetOption, { borderBottomWidth: 0 }]}
                >
                  <Text style={[styles.bottomSheetOptionText, { color: "#EF4444" }]}>Xóa bài viết</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => optionsPost && handleToggleSavePost(optionsPost)}
                  style={styles.bottomSheetOption}
                >
                  <Text style={styles.bottomSheetOptionText}>
                    {optionsPost?.isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (optionsPost) {
                      setPostToReport(optionsPost);
                      setReportModalVisible(true);
                      setOptionsPost(null);
                    }
                  }}
                  style={[styles.bottomSheetOption, { borderBottomWidth: 0 }]}
                >
                  <Text style={[styles.bottomSheetOptionText, { color: "#EF4444" }]}>Báo cáo bài viết</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => {
          setReportModalVisible(false);
          setPostToReport(null);
        }}
        onSelectReason={handleReportPost}
      />
      </Screen>
    </KeyboardAvoidingView>
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
    borderRadius: 16,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 4 : 8,
    marginBottom: 0,
    height: 58,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 94, 94, 0.19)",
    zIndex: 10,
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 44,
    height: 44,
    marginRight: -6,
  },

  headerTitle: { fontSize: 20, fontWeight: "bold" },
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
    marginTop: 12,
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
  filterBadge: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  filterPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#CDD1D8",
  },
  filterSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#CDD1D8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1.5,
    borderBottomColor: "#CDD1D8",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111",
  },
  filterChipLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CDD1D8",
    backgroundColor: "#F3F4F6",
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#CDD1D8",
  },
  timeChipActive: {
    backgroundColor: "#FFF7ED",
    borderColor: ORANGE,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#FFF7ED",
    borderColor: ORANGE,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  filterChipTextActive: {
    color: ORANGE,
  },
  applyFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },
  applyFilterBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
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
    backgroundColor: "#0066cc",
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
  bottomSheetContainer: {
    marginTop: "auto",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#fff",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 60,
  },
  bottomSheetHandle: {
    width: 60,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  bottomSheetTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },
  bottomSheetOption: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 16,
  },
  bottomSheetOptionText: {
    fontSize: 16,
    color: "#111",
  },
  matchStatusBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  matchStatusBarText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
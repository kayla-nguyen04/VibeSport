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
    } else {
      navigation?.navigate?.("CreateFindTeam");
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

  const renderBrowseCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const joined = isUserParticipant(item);
    const creator = typeof item.createdBy === "object" ? item.createdBy : null;

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillYellow]}>
            <Text style={styles.statusPillText}>
              {item.status === "full" ? "Đã đủ người" : "Tìm người"}
            </Text>
          </View>
        </View>

        <View style={styles.detailInfoList}>
          <View style={styles.detailInfoRow}>
            <Text style={styles.detailInfoIcon}>🕒</Text>
            <Text style={styles.detailInfoText}>{item.startTime} • {getDayLabel(item.date)}</Text>
          </View>
          <View style={styles.detailInfoRow}>
            <Text style={styles.detailInfoIcon}>📍</Text>
            <Text style={styles.detailInfoText} numberOfLines={2}>{item.locationName}</Text>
          </View>
          {item.location?.lat != null && item.location?.lng != null && (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailInfoIcon}>🗺️</Text>
              <Text style={styles.detailInfoTextMuted}>
                {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {creator && <CreatorProfileRow creator={creator} label="Người tạo trận" />}

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoColText}>
              👥 {item.currentPlayers} / {item.maxPlayers} người
            </Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoColText} numberOfLines={1}>🪙 {formatCost(item.costPerPerson)}</Text>
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
          <TouchableOpacity
            style={styles.detailBlueBtn}
            activeOpacity={0.7}
            onPress={() => handleViewDetail(item)}
          >
            <Text style={styles.detailBlueBtnText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderJoinedCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const creator = typeof item.createdBy === "object" ? item.createdBy : null;

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillYellow]}>
            <Text style={styles.statusPillText}>
              {item.status === "full" ? "Đã đủ người" : "Tìm người"}
            </Text>
          </View>
        </View>

        <View style={styles.detailInfoList}>
          <View style={styles.detailInfoRow}>
            <Text style={styles.detailInfoIcon}>🕒</Text>
            <Text style={styles.detailInfoText}>{item.startTime} • {getDayLabel(item.date)}</Text>
          </View>
          <View style={styles.detailInfoRow}>
            <Text style={styles.detailInfoIcon}>📍</Text>
            <Text style={styles.detailInfoText} numberOfLines={2}>{item.locationName}</Text>
          </View>
        </View>

        {creator && <CreatorProfileRow creator={creator} />}

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
          <TouchableOpacity
            style={styles.leaveBtn}
            activeOpacity={0.7}
            onPress={() => handleLeaveMatch(item)}
          >
            <Text style={styles.leaveBtnText}>Rút khỏi trận</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailBlueBtn}
            activeOpacity={0.7}
            onPress={() => handleViewDetail(item)}
          >
            <Text style={styles.detailBlueBtnText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCreatedCard = (item) => {
    const icon = SPORT_ICONS[item.sport] || "⚽";
    const isEnded = item.status === "completed" || item.status === "cancelled";
    const currentCount = item.currentPlayers || item.participants?.length || 0;
    const maxCount = item.maxPlayers || 10;
    const slotsLeft = maxCount - currentCount;
    const progressPercent = Math.min(100, (currentCount / maxCount) * 100);
    const creatorArea = user?.area || (typeof item.createdBy === "object" ? item.createdBy?.area : null);
    const subtitle = `${creatorArea || "FC"} • Do bạn tạo`;

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sportSquare}>
            <Text style={styles.sportSquareIcon}>{icon}</Text>
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.matchTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.matchSubtitle}>{subtitle}</Text>
          </View>
          <View style={[styles.statusDotWrapper, isEnded ? styles.statusDotGrayBg : styles.statusDotBlueBg]}>
            <View style={[styles.statusDotCircle, isEnded ? styles.statusDotGray : styles.statusDotBlue]} />
            <Text style={[styles.statusDotText, isEnded ? styles.statusDotTextGray : styles.statusDotTextBlue]}>
              {isEnded ? "Đã kết thúc" : item.status === "full" ? "Đã đủ người" : "Tìm người"}
            </Text>
          </View>
        </View>

        {!isEnded ? (
          <>
            <View style={styles.costStrip}>
              <Text style={styles.costStripLabel}>🪙 Chi phí sân</Text>
              <Text style={styles.costStripValue}>{formatCost(item.costPerPerson)}</Text>
            </View>

            <View style={styles.detailsList}>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoIcon}>🕒</Text>
                <Text style={styles.detailInfoText}>{item.startTime} • {getDayLabel(item.date)}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoIcon}>📍</Text>
                <Text style={styles.detailInfoText} numberOfLines={2}>{item.locationName}</Text>
              </View>
              {item.location?.lat != null && item.location?.lng != null && (
                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoIcon}>🗺️</Text>
                  <Text style={styles.detailInfoTextMuted}>
                    {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
                  </Text>
                </View>
              )}
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoIcon}>⚽</Text>
                <Text style={styles.detailInfoText}>
                  {Math.floor(maxCount / 2)} vs {Math.floor(maxCount / 2)}
                </Text>
              </View>
            </View>

            <View style={styles.avatarRow}>
              <View style={styles.avatarGroup}>
                {(item.participants || []).slice(0, 3).map((p, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length], marginLeft: idx > 0 ? -6 : 0 },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{getInitials(getParticipantName(p))}</Text>
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

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={styles.createdActions}>
              {item.location?.lat != null ? (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceBadgeText}>
                    📍 {item.location.lat.toFixed(2)}, {item.location.lng.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <View style={styles.createdBtns}>
                <TouchableOpacity
                  style={styles.editBtn}
                  activeOpacity={0.7}
                  onPress={() => handleEditMatch(item)}
                >
                  <Text style={styles.editBtnIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.detailBlueBtnLarge}
                  activeOpacity={0.7}
                  onPress={() => handleViewDetail(item)}
                >
                  <Text style={styles.detailBlueBtnText}>Xem chi tiết</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.endedInfoList}>
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailInfoIcon}>🕒</Text>
              <Text style={styles.endedInfoText}>{item.startTime} • {getDayLabel(item.date)}</Text>
            </View>
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailInfoIcon}>📍</Text>
              <Text style={styles.endedInfoText} numberOfLines={2}>{item.locationName}</Text>
            </View>
            <View style={styles.endedInfoRow}>
              <Text style={styles.endedInfoText}>👥 {currentCount}/{maxCount} người</Text>
              <Text style={[styles.endedInfoText, { marginLeft: 20 }]}>🪙 {formatCost(item.costPerPerson)}</Text>
            </View>
          </View>
        )}
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
    if (activeSubTab === "created") return renderCreatedCard(item);
    if (activeSubTab === "near") return renderBrowseCard(item);
    return renderJoinedCard(item);
  };

  const isFindTeamTab = activeSubTab === "findteam";
  const listLoading = isFindTeamTab ? findTeamLoading : loading;
  const listData = isFindTeamTab ? findTeamPosts : getDisplayData();

  return (
    <View style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trận đấu</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.createBtnText}>+ Tạo</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Sub Tabs ─── */}
      <View style={styles.subTabs}>
        {[
          { key: "near", label: "Gần tôi" },
          { key: "joined", label: "Đã tham gia" },
          { key: "created", label: "Đã tạo" },
          { key: "findteam", label: "Tìm đội" },
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
      {!isFindTeamTab && (
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
      )}

      {/* ─── Search & Filters Bar ─── */}
      {!isFindTeamTab && (
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
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => handleCreateOption("findteam")}
            >
              <Text style={styles.modalOptionIcon}>👥</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Tìm đội</Text>
                <Text style={styles.modalOptionSub}>Đăng bài tìm đội bóng</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  detailInfoList: { marginTop: 12, gap: 8 },
  detailInfoRow: { flexDirection: "row", alignItems: "flex-start" },
  detailInfoIcon: { fontSize: 13, width: 24, marginTop: 1 },
  detailInfoText: { flex: 1, fontSize: 13, color: "#333", fontWeight: "500", lineHeight: 18 },
  detailInfoTextMuted: { flex: 1, fontSize: 12, color: "#888", lineHeight: 18 },

  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  creatorAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  creatorAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  creatorMeta: { marginLeft: 10, flex: 1 },
  creatorName: { fontSize: 13, fontWeight: "700", color: "#222" },
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

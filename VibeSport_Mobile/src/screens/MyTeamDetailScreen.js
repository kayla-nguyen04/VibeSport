import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
} from "react-native";
import { useSelector } from "react-redux";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  getMatchById,
  updateTeamStatus,
  kickTeamMember,
  inviteTeamMember,
  updateMemberRole,
  updateMemberPosition,
} from "../services/matchService";
import { getFollowingListRequest } from "../services/userApi";
import { API_BASE_URL } from "../components/constants/api";

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

const AVATAR_COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1"];

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

export default function MyTeamDetailScreen({ route, navigation }) {
  const { matchId } = route.params;
  const user = useSelector((state) => state.auth?.user);
  const userId = user?.id || user?._id;
  const token = useSelector((state) => state.auth?.token);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [match, setMatch] = useState(null);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [showKickModal, setShowKickModal] = useState(false);
  const [kickTargetUser, setKickTargetUser] = useState(null);
  const [kickReason, setKickReason] = useState("");

  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionTargetUser, setPositionTargetUser] = useState(null);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTargetUser, setRoleTargetUser] = useState(null);

  const loadMatchDetails = async () => {
    try {
      setLoading(true);
      const data = await getMatchById(matchId);
      setMatch(data);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tải thông tin đội");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatchDetails();
  }, [matchId]);

  const handleStatusChange = async (newStatus) => {
    try {
      setActionLoading(true);
      const data = await updateTeamStatus(matchId, newStatus);
      setMatch(data);
      Alert.alert("Thành công", "Đã cập nhật trạng thái đội");
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật trạng thái");
    } finally {
      setActionLoading(false);
    }
  };

  // Load following users to invite
  const handleOpenInviteModal = async () => {
    try {
      setInviteLoading(true);
      setShowInviteModal(true);
      const res = await getFollowingListRequest(token);
      const list = res?.data || [];
      // Filter out users already participating
      const participantIds = (match?.participants || []).map(p => String(p._id || p.id));
      const filtered = list.filter(u => {
        const uid = String(u._id || u.id);
        return !participantIds.includes(uid) && uid !== String(userId);
      });
      setFollowingUsers(filtered);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể tải danh sách");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteUser = async (targetUserId) => {
    try {
      setActionLoading(true);
      const data = await inviteTeamMember(matchId, targetUserId);
      setMatch(data);
      Alert.alert("Đã mời");
      // Remove from list
      setFollowingUsers(prev => prev.filter(u => String(u._id || u.id) !== String(targetUserId)));
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể mời thành viên");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendLinkInvite = async () => {
    try {
      const matchLink = `vibesport://match/${matchId}`;
      await Share.share({
        message: `Tham gia đội của tôi trong trận đấu "${match.title}" tại đây: ${matchLink}`,
      });
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chia sẻ liên kết");
    }
  };

  const handleKickUser = async () => {
    if (!kickTargetUser) return;
    try {
      setActionLoading(true);
      const data = await kickTeamMember(matchId, kickTargetUser._id || kickTargetUser.id, kickReason);
      setMatch(data);
      Alert.alert("Thành công", "Đã kích thành viên");
      setShowKickModal(false);
      setKickTargetUser(null);
      setKickReason("");
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể kích thành viên");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (targetUserId, newRole) => {
    Alert.alert(
      "Chuyển chức vụ",
      newRole === "owner" 
        ? "Bạn có chắc muốn chuyển chức vụ Chủ đội cho thành viên này? Bạn sẽ trở thành Thành viên."
        : "Bạn có chắc muốn thay đổi chức vụ thành viên này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: async () => {
            try {
              setActionLoading(true);
              const data = await updateMemberRole(matchId, targetUserId, newRole);
              setMatch(data);
              Alert.alert("Thành công", "Đã cập nhật chức vụ");
              setShowRoleModal(false);
              setRoleTargetUser(null);
            } catch (err) {
              Alert.alert("Lỗi", err.message || "Không thể cập nhật chức vụ");
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUpdatePosition = async (targetUserId, positionId) => {
    try {
      setActionLoading(true);
      const data = await updateMemberPosition(matchId, targetUserId, positionId);
      setMatch(data);
      Alert.alert("Thành công", "Đã cập nhật vị trí thi đấu");
      setShowPositionModal(false);
      setPositionTargetUser(null);
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật vị trí");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !match) {
    return (
      <Screen style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0b74ff" />
        </View>
      </Screen>
    );
  }

  const creatorId = typeof match.createdBy === "object" ? match.createdBy?._id || match.createdBy?.id : match.createdBy;
  const isOwner = String(creatorId) === String(userId);
  const totalPlayers = match.participants?.length || 0;
  const teamStatus = match.teamStatus || "not_started";

  const renderMember = ({ item }) => {
    const mId = item._id || item.id;
    const isMe = String(mId) === String(userId);

    // Get role
    const roleObj = match.memberRoles?.find((r) => String(r.userId) === String(mId));
    const role = roleObj ? roleObj.role : (String(creatorId) === String(mId) ? "owner" : "member");

    // Get position
    const posObj = match.memberPositions?.find((p) => String(p.userId) === String(mId));
    const posId = posObj ? posObj.positionId : "";
    const position = ALL_POSITIONS.find((p) => p.id === posId);

    return (
      <View style={styles.memberCard}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[item.name ? item.name.length % AVATAR_COLORS.length : 0] }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        {/* Info */}
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name} {isMe && "(Tôi)"}</Text>
          
          <View style={styles.metaRow}>
            {/* Chức vụ */}
            <TouchableOpacity
              activeOpacity={isOwner && !isMe ? 0.7 : 1}
              onPress={() => {
                if (isOwner && !isMe) {
                  setRoleTargetUser(item);
                  setShowRoleModal(true);
                }
              }}
              style={[
                styles.roleBadge,
                role === "owner" ? styles.roleBadgeOwner : styles.roleBadgeMember,
                isOwner && !isMe && styles.editableTag
              ]}
            >
              <Text style={[styles.roleBadgeText, role === "owner" ? styles.roleBadgeTextOwner : styles.roleBadgeTextMember]}>
                Chức vụ: {role === "owner" ? "👑 Chủ đội" : "Thành viên"} {isOwner && !isMe ? "✏️" : ""}
              </Text>
            </TouchableOpacity>

            {/* Vị trí */}
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => {
                if (isOwner) {
                  setPositionTargetUser(item);
                  setShowPositionModal(true);
                }
              }}
              style={[
                styles.positionTag,
                isOwner && styles.editableTag
              ]}
            >
              <Text style={styles.positionTagText}>
                Vị trí: {posId ? `${posId.startsWith("t1_") ? "Đội Xanh" : "Đội Đỏ"} - ${position?.label || ""}` : "trống"} {isOwner ? "✏️" : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Kick Button */}
        {isOwner && !isMe && (
          <TouchableOpacity
            style={styles.actionBtnKick}
            onPress={() => {
              setKickTargetUser(item);
              setShowKickModal(true);
            }}
          >
            <Text style={styles.actionBtnKickText}>Kích</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Screen style={styles.container}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thành viên 2 đội</Text>
        <TouchableOpacity style={styles.btnInviteLink} onPress={handleSendLinkInvite}>
          <Text style={styles.btnInviteLinkText}>🔗 Link</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnInvite}
          onPress={() => {
            if (isOwner) {
              handleOpenInviteModal();
            } else {
              Alert.alert("Gợi ý mời", "Bạn có thể gửi liên kết chia sẻ cho người khác!");
            }
          }}
        >
          <Text style={styles.btnInviteText}>Mời +</Text>
        </TouchableOpacity>
      </ScreenHeader>

      <View style={styles.topMeta}>
        <Text style={styles.playerCount}>TỔNG SỐ {totalPlayers} CẦU THỦ</Text>
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>🕒 Bắt đầu: {match.startTime} • {match.date}</Text>
        </View>
      </View>

      <FlatList
        data={match.participants}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
      />

      {isOwner && (
        <View style={styles.bottomControlBar}>
          <Text style={styles.controlTitle}>Trạng thái đội:</Text>
          <View style={styles.controlButtons}>
            {teamStatus === "not_started" && (
              <TouchableOpacity
                style={[styles.btnControl, styles.btnStart]}
                onPress={() => handleStatusChange("ongoing")}
                disabled={actionLoading}
              >
                <Text style={styles.btnControlText}>Bắt đầu trận</Text>
              </TouchableOpacity>
            )}

            {teamStatus === "ongoing" && (
              <>
                <TouchableOpacity
                  style={[styles.btnControl, styles.btnPause]}
                  onPress={() => handleStatusChange("paused")}
                  disabled={actionLoading}
                >
                  <Text style={styles.btnControlText}>Tạm dừng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnControl, styles.btnEnd]}
                  onPress={() => handleStatusChange("ended")}
                  disabled={actionLoading}
                >
                  <Text style={styles.btnControlText}>Kết thúc</Text>
                </TouchableOpacity>
              </>
            )}

            {teamStatus === "paused" && (
              <>
                <TouchableOpacity
                  style={[styles.btnControl, styles.btnStart]}
                  onPress={() => handleStatusChange("ongoing")}
                  disabled={actionLoading}
                >
                  <Text style={styles.btnControlText}>Tiếp tục</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnControl, styles.btnEnd]}
                  onPress={() => handleStatusChange("ended")}
                  disabled={actionLoading}
                >
                  <Text style={styles.btnControlText}>Kết thúc</Text>
                </TouchableOpacity>
              </>
            )}

            {teamStatus === "ended" && (
              <Text style={styles.statusEndedText}>Trận đấu đã kết thúc</Text>
            )}
          </View>
        </View>
      )}

      {/* Invite Member Modal (from following list) */}
      <Modal visible={showInviteModal} animationType="slide">
        <Screen style={styles.modalScreen}>
          <ScreenHeader>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowInviteModal(false)}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mời người đang follow</Text>
          </ScreenHeader>

          {inviteLoading ? (
            <ActivityIndicator size="large" color="#0b74ff" style={styles.loader} />
          ) : followingUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không có người dùng nào để mời.</Text>
              <Text style={[styles.emptyText, { marginTop: 4, color: '#94a3b8' }]}>Bạn chưa follow ai hoặc tất cả đã tham gia.</Text>
            </View>
          ) : (
            <FlatList
              data={followingUsers}
              keyExtractor={(item) => String(item._id || item.id)}
              contentContainerStyle={styles.searchList}
              renderItem={({ item }) => (
                <View style={styles.searchResultCard}>
                  <View style={[styles.avatar, { backgroundColor: "#0b74ff" }]}>
                    <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultSub}>{item.favoriteSport || "Thể thao"}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.btnAddDirect}
                    onPress={() => handleInviteUser(String(item._id || item.id))}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnAddDirectText}>Mời vào đội</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Không có ai để mời.</Text>
                </View>
              }
            />
          )}
        </Screen>
      </Modal>

      {/* Kick Member Modal */}
      <Modal visible={showKickModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.kickBox}>
            <Text style={styles.modalTitle}>Kích thành viên</Text>
            <Text style={styles.modalSubtitle}>
              Bạn có chắc chắn muốn kích cầu thủ <Text style={{ fontWeight: "700" }}>{kickTargetUser?.name}</Text> ra khỏi đội?
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Nhập lý do kích (không bắt buộc)..."
              value={kickReason}
              onChangeText={setKickReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowKickModal(false);
                  setKickTargetUser(null);
                  setKickReason("");
                }}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleKickUser}>
                <Text style={styles.modalConfirmText}>Kích ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Position Modal */}
      <Modal visible={showPositionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.positionBox}>
            <Text style={styles.modalTitle}>Thay đổi vị trí chơi trên sân</Text>
            <Text style={styles.modalSubtitle}>Chọn vị trí thi đấu cho {positionTargetUser?.name}:</Text>
            <ScrollView style={styles.positionList}>
              <TouchableOpacity
                style={styles.positionOptionItem}
                onPress={() => handleUpdatePosition(positionTargetUser?._id || positionTargetUser?.id, "")}
              >
                <Text style={styles.positionOptionText}>Bỏ vị trí (Thành viên tự do)</Text>
              </TouchableOpacity>
              
              <Text style={styles.groupLabel}>Đội 1 (Đội Xanh)</Text>
              {TEAM1_POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos.id}
                  style={styles.positionOptionItem}
                  onPress={() => handleUpdatePosition(positionTargetUser?._id || positionTargetUser?.id, pos.id)}
                >
                  <Text style={styles.positionOptionText}>{pos.label} ({pos.id.toUpperCase()})</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.groupLabel}>Đội 2 (Đội Đỏ)</Text>
              {TEAM2_POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos.id}
                  style={styles.positionOptionItem}
                  onPress={() => handleUpdatePosition(positionTargetUser?._id || positionTargetUser?.id, pos.id)}
                >
                  <Text style={styles.positionOptionText}>{pos.label} ({pos.id.toUpperCase()})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.positionCloseBtn}
              onPress={() => {
                setShowPositionModal(false);
                setPositionTargetUser(null);
              }}
            >
              <Text style={styles.positionCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal visible={showRoleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.kickBox}>
            <Text style={styles.modalTitle}>Thay đổi chức vụ</Text>
            <Text style={styles.modalSubtitle}>Thay đổi chức vụ cho {roleTargetUser?.name}:</Text>
            <View style={styles.roleActionOptions}>
              <TouchableOpacity
                style={[styles.roleOptionBtn, { backgroundColor: "#0b74ff" }]}
                onPress={() => handleUpdateRole(roleTargetUser?._id || roleTargetUser?.id, "owner")}
              >
                <Text style={styles.roleOptionBtnText}>Chuyển quyền Chủ đội</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOptionBtn, { backgroundColor: "#64748b" }]}
                onPress={() => handleUpdateRole(roleTargetUser?._id || roleTargetUser?.id, "member")}
              >
                <Text style={styles.roleOptionBtnText}>Làm Thành viên</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setShowRoleModal(false);
                setRoleTargetUser(null);
              }}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    minHeight: 60,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 22,
    color: "#333",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },
  btnInviteLink: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  btnInviteLinkText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  btnInvite: {
    backgroundColor: "#0b74ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnInviteText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  topMeta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerCount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },
  timeBadge: {
    backgroundColor: "#fff8e1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 11,
    color: "#b45309",
    fontWeight: "600",
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  teamBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  teamBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  memberSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  positionTag: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  positionTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6d28d9",
  },
  noPositionText: {
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  editableTag: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
  },
  memberActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: "#0b74ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnOutlineText: {
    color: "#0b74ff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnKick: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnKickText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomControlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 8,
  },
  btnControl: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
  btnControlText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  statusEndedText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  modalScreen: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  searchBox: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  btnSearch: {
    backgroundColor: "#0b74ff",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 44,
  },
  btnSearchText: {
    color: "#fff",
    fontWeight: "700",
  },
  searchList: {
    padding: 16,
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  searchResultSub: {
    fontSize: 12,
    color: "#64748b",
  },
  btnAddDirect: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnAddDirectText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  kickBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 20,
  },
  reasonInput: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: "#64748b",
    fontWeight: "700",
  },
  modalConfirm: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalConfirmText: {
    color: "#fff",
    fontWeight: "700",
  },
  positionBox: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  positionList: {
    marginVertical: 12,
  },
  positionOptionItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  positionOptionText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  positionCloseBtn: {
    marginTop: 12,
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  positionCloseBtnText: {
    color: "#475569",
    fontWeight: "700",
  },
  roleActionOptions: {
    gap: 10,
    marginBottom: 16,
  },
  roleOptionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  roleOptionBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ─── Role badges ───────────────────────────────────────────────
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeOwner: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  roleBadgeMember: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  roleBadgeTextOwner: {
    color: "#92400e",
  },
  roleBadgeTextMember: {
    color: "#475569",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  loader: {
    marginTop: 40,
  },
});

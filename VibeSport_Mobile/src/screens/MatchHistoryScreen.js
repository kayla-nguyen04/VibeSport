import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';
import { getMatches } from '../services/matchService';
import { submitMatchRatings } from '../services/ratingApi';

const PAGE_SIZE = 10;
const ORANGE = '#FF6B00';

const getStatusConfig = (status) => {
  switch (status) {
    case 'completed':
    case 'ended':
      return { label: 'Đã kết thúc', color: '#10B981' };
    default:
      return { label: 'Đã kết thúc', color: '#10B981' };
  }
};

export default function MatchHistoryScreen({ navigation }) {
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id || user?._id;

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Single rating modal state
  const [singleRatingTarget, setSingleRatingTarget] = useState(null); // { match, targetUser }
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const pageRef = React.useRef(1);
  const isFetching = React.useRef(false);

  // Nạp dữ liệu gộp (Chỉ hiển thị trận đã kết thúc)
  const loadMatchesData = useCallback(async ({ refresh = false } = {}) => {
    if (!token || !userId || isFetching.current) return;

    isFetching.current = true;
    if (refresh) {
      pageRef.current = 1;
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const targetPage = refresh ? 1 : pageRef.current;
      
      const [createdRes, joinedRes] = await Promise.all([
        getMatches({ createdBy: userId, page: targetPage, limit: PAGE_SIZE }),
        getMatches({ participantId: userId, page: targetPage, limit: PAGE_SIZE })
      ]);

      const combined = [
        ...(Array.isArray(createdRes) ? createdRes : []),
        ...(Array.isArray(joinedRes) ? joinedRes : [])
      ];

      // Lọc trùng khớp dữ liệu bằng Map theo ID trận đấu
      const uniqueMap = new Map();
      combined.forEach((match) => {
        if (match && match._id) uniqueMap.set(String(match._id), match);
      });

      // Chỉ giữ lại các trận đấu ĐÃ KẾT THÚC / HOÀN THÀNH
      const completedList = Array.from(uniqueMap.values())
        .filter((item) => item.status === 'completed' || item.teamStatus === 'ended')
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      setMatches((current) => (refresh ? completedList : [...current, ...completedList]));
      setHasMore(completedList.length === PAGE_SIZE * 2);
      pageRef.current = refresh ? 2 : pageRef.current + 1;
    } catch (error) {
      console.warn('[MatchHistoryScreen] Fetch matches logic error:', error);
      Alert.alert('⚠️ Cập nhật thất bại', 'Không thể kết nối danh sách lịch sử trận đấu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetching.current = false;
    }
  }, [token, userId]);

  useEffect(() => {
    loadMatchesData({ refresh: true });
  }, []);

  const handleRefresh = () => loadMatchesData({ refresh: true });
  
  const handleLoadMore = () => {
    if (!loading && hasMore && !refreshing && !isFetching.current) {
      loadMatchesData({ refresh: false });
    }
  };

  const handleOpenDetail = (matchId) => {
    navigation.navigate('MatchDetail', { matchId });
  };

  // Mở Đánh giá cho 1 cá nhân
  const handleOpenSingleRating = (match, targetUser) => {
    setSingleRatingTarget({ match, targetUser });
    setStars(5);
    setComment('');
  };

  // Gửi đánh giá cho cá nhân
  const handleSubmitSingleRating = async () => {
    if (!singleRatingTarget || !token) return;
    const { match, targetUser } = singleRatingTarget;
    const targetId = typeof targetUser === 'object' ? (targetUser._id || targetUser.id) : targetUser;

    setSubmittingRating(true);
    try {
      await submitMatchRatings(
        match._id,
        [{ toUserId: targetId, stars, comment: comment.trim() }],
        token
      );
      Alert.alert('Thành công 🎉', `Đã gửi đánh giá cho ${(targetUser?.name || 'người chơi')}!`);
      setSingleRatingTarget(null);
    } catch (err) {
      Alert.alert('Đánh giá thất bại', err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderMatchItem = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);
    const displayDate = item.date && item.startTime ? `${item.startTime} • ${item.date}` : 'Chưa cập nhật thời gian';
    const otherParticipants = (item.participants || []).filter((p) => {
      const pId = typeof p === 'object' ? (p._id || p.id) : p;
      return String(pId) !== String(userId);
    });

    return (
      <View style={uiStyles.matchCard}>
        {/* DÒNG 1: ⚽ Tên trận đấu */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => handleOpenDetail(item._id)} style={uiStyles.row1}>
          <MaterialCommunityIcons name="soccer" size={20} color="#1F2937" />
          <Text style={uiStyles.matchTitle} numberOfLines={1}>
            {item.title || 'Trận đấu giao hữu'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* DÒNG 2: 📍 Tên sân thi đấu ────── Trạng thái */}
        <View style={uiStyles.row2}>
          <View style={uiStyles.locationWrap}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#7C8190" />
            <Text style={uiStyles.locationText} numberOfLines={1}>
              {item.locationName || 'Sân thi đấu'}
            </Text>
          </View>
          
          <View style={uiStyles.statusWrap}>
            <View style={[uiStyles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[uiStyles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* DÒNG 3: 🕒 Thời gian diễn ra */}
        <View style={uiStyles.row3}>
          <MaterialCommunityIcons name="clock-outline" size={15} color="#7C8190" />
          <Text style={uiStyles.timeText}>{displayDate}</Text>
        </View>

        {/* DANH SÁCH BẠN ĐẤU ĐỂ ĐÁNH GIÁ TỪNG NGƯỜI */}
        {otherParticipants.length > 0 && (
          <View style={uiStyles.participantsContainer}>
            <Text style={uiStyles.participantsHeader}>Thành viên trong trận:</Text>
            {otherParticipants.map((p) => {
              const pId = typeof p === 'object' ? (p._id || p.id) : p;
              const name = typeof p === 'object' ? (p.name || 'Người chơi') : 'Người chơi';
              const avatar = typeof p === 'object' ? p.avatar : null;

              return (
                <View key={pId} style={uiStyles.participantRow}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                    onPress={() => {
                      if (typeof p === 'object' && (p._id || p.id)) {
                        navigation.navigate('UserProfile', { userId: p._id || p.id });
                      }
                    }}
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={uiStyles.userAvatar} />
                    ) : (
                      <View style={[uiStyles.userAvatar, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={16} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={uiStyles.userName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>

                  {/* Nút Đánh giá từng người */}
                  <TouchableOpacity
                    style={uiStyles.singleRatingBtn}
                    onPress={() => handleOpenSingleRating(item, p)}
                  >
                    <Ionicons name="star" size={14} color="#EA580C" />
                    <Text style={uiStyles.singleRatingBtnText}>Đánh giá</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const targetName = singleRatingTarget?.targetUser?.name || 'người chơi';

  return (
    <Screen edges={['top', 'left', 'right']} style={uiStyles.screen}>
      <ScreenHeader style={uiStyles.headerBar}>
        <View style={uiStyles.headerSide}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <Text style={uiStyles.headerTitle}>Lịch sử trận đấu</Text>
        <View style={[uiStyles.headerSide, uiStyles.headerRightSide]} />
      </ScreenHeader>

      {loading && !refreshing && !matches.length ? (
        <View style={uiStyles.centerState}>
          <ActivityIndicator size="large" color="#0B74FF" />
          <Text style={uiStyles.loadingText}>Đang tải lịch sử trận đấu...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderMatchItem}
          contentContainerStyle={uiStyles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0B74FF" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={uiStyles.centerState}>
              <MaterialCommunityIcons name="soccer-field" size={54} color="#D1D5DB" />
              <Text style={uiStyles.emptyTitle}>Chưa có lịch sử trận đấu đã kết thúc</Text>
              <Text style={uiStyles.emptySubtitle}>Các trận đấu đã hoàn thành sẽ xuất hiện tại đây để bạn đánh giá từng thành viên.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && matches.length > 0 ? (
              <ActivityIndicator size="small" color="#0B74FF" style={{ marginVertical: 12 }} />
            ) : null
          }
        />
      )}

      {/* MODAL ĐÁNH GIÁ CHO TỪNG NGƯỜI */}
      <Modal
        visible={!!singleRatingTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setSingleRatingTarget(null)}
      >
        <View style={uiStyles.modalOverlay}>
          <View style={uiStyles.modalContainer}>
            <View style={uiStyles.modalHeader}>
              <Text style={uiStyles.modalTitle}>⭐ Đánh giá {targetName}</Text>
              <TouchableOpacity onPress={() => setSingleRatingTarget(null)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={uiStyles.modalSubTitle}>
              Trận: {singleRatingTarget?.match?.title}
            </Text>

            {/* Chọn số sao */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, my: 16, marginVertical: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setStars(star)}>
                  <Ionicons
                    name={star <= stars ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= stars ? '#F59E0B' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Ô nhập nhận xét */}
            <TextInput
              style={uiStyles.commentInput}
              placeholder="Nhập nhận xét thái độ thi đấu của bạn chơi..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
            />

            <TouchableOpacity
              style={[uiStyles.submitButton, submittingRating ? { opacity: 0.6 } : null]}
              disabled={submittingRating}
              onPress={handleSubmitSingleRating}
            >
              {submittingRating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={uiStyles.submitButtonText}>Gửi đánh giá ⭐</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const uiStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FB' },
  headerBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  headerSide: { width: 40, flexDirection: 'row', alignItems: 'center' },
  headerRightSide: { justifyContent: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#111827', fontSize: 17, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14, fontWeight: '500' },
  listContent: { paddingVertical: 12 },
  
  matchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  locationText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#7C8190',
    fontWeight: '500',
  },

  participantsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  participantsHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1F2937',
  },
  singleRatingBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFD8A8',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  singleRatingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubTitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#111827',
    textAlignVertical: 'top',
    height: 80,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

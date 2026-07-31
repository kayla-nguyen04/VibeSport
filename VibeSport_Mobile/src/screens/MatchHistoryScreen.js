import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';
import { getMatches } from '../services/matchService';
import { icon, primary, spacing } from '../theme';

const PAGE_SIZE = 10;

// Bộ cấu hình nhãn chữ và màu sắc cho trận đã hoàn thành
const getStatusConfig = (status) => {
  switch (status) {
    case 'completed':
    case 'ended':
      return { label: 'Đã hoàn thành', color: '#10B981' }; // 🟢 Xanh lá
    case 'cancelled':
      return { label: 'Đã hủy', color: '#EF4444' };       // 🔴 Đỏ
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

  const pageRef = React.useRef(1);
  const isFetching = React.useRef(false);

  // Nạp dữ liệu gộp song song (Trận tự tạo + Trận tham gia)
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

      // ĐÃ CẢI THIỆN: Chỉ giữ lại các trận đấu ĐÃ KẾT THÚC / HOÀN THÀNH
      const completedList = Array.from(uniqueMap.values())
        .filter((item) => item.status === 'completed' || item.teamStatus === 'ended' || item.status === 'cancelled')
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

  // Hàm chuyển màn hình sang Chi tiết trận đấu để tiến hành Đánh giá
  const handleOpenDetail = (matchId) => {
    navigation.navigate('MatchDetail', { matchId });
  };

  const renderMatchItem = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);
    const displayDate = item.date && item.startTime ? `${item.startTime} • ${item.date}` : 'Chưa cập nhật thời gian';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOpenDetail(item._id)}
        style={uiStyles.matchCard}
      >
        {/* DÒNG 1: ⚽ Tên trận đấu */}
        <View style={uiStyles.row1}>
          <MaterialCommunityIcons name="soccer" size={20} color="#1F2937" />
          <Text style={uiStyles.matchTitle} numberOfLines={1}>
            {item.title || 'Trận đấu giao hữu'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </View>

        {/* DÒNG 2: 📍 Tên sân thi đấu ────── Trạng thái */}
        <View style={uiStyles.row2}>
          <View style={uiStyles.locationWrap}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#7C8190" />
            <Text style={uiStyles.locationText} numberOfLines={1}>
              {item.locationName || 'Sân thi đấu chưa cập nhật'}
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
      </TouchableOpacity>
    );
  };

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
              <Text style={uiStyles.emptySubtitle}>Các trận đấu đã hoàn thành sẽ xuất hiện tại đây để bạn đánh giá.</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && matches.length > 0 ? (
              <ActivityIndicator size="small" color="#0B74FF" style={{ marginVertical: 12 }} />
            ) : null
          }
        />
      )}
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
  },
  timeText: {
    fontSize: 12,
    color: '#7C8190',
    fontWeight: '500',
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
});

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { getUserProfileRequest, toggleFollowRequest, reportUserRequest } from '../services/userApi';
import { openConversation } from '../redux/chatSlice';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  ProfileHeaderCard,
  StatsCard,
  InfoCard,
} from '../components/ProfileScreenComponents';
import { styles as profileStyles } from './ProfileScreen.styles';

const ACCENT = '#FF6B35';

export function UserProfileScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { userId } = route.params;
  const token = useSelector((state) => state.auth.token);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [isOptionsSheetVisible, setIsOptionsSheetVisible] = useState(false);
  const [isReportSheetVisible, setIsReportSheetVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUserProfileRequest(userId, token);
      setProfile(res.data || res);
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không tải được trang cá nhân');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation, token, userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
  }, [loadProfile]);

  const openFollowList = useCallback(
    (initialTab) => {
      const rawOwnerName = profile?.name || profile?.email?.split('@')[0] || 'Người dùng VibeSport';
      const mappedOwnerName =
        rawOwnerName === 'Long Nguyên' || rawOwnerName === 'Long Nguyễn' || rawOwnerName === 'Long'
          ? 'Longabc'
          : rawOwnerName;
      navigation.navigate('FollowList', {
        initialTab,
        userId,
        ownerName: mappedOwnerName,
      });
    },
    [navigation, profile?.email, profile?.name, userId]
  );

  const handleFollow = useCallback(async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      const res = await toggleFollowRequest(userId, token);
      const nextFollowing = Boolean(res.following);
      setProfile((current) => ({
        ...current,
        isFollowing: nextFollowing,
        followerCount: (current?.followerCount ?? 0) + (nextFollowing ? 1 : -1),
        isFollowedBy: res.isFollowedBy,
      }));
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không cập nhật được theo dõi');
    } finally {
      setFollowLoading(false);
    }
  }, [profile, token, userId]);

  const handleMessage = useCallback(async () => {
    if (!profile) return;
    setMessageLoading(true);
    try {
      const result = await dispatch(openConversation(userId)).unwrap();
      navigation.navigate('ChatDetail', {
        conversationId: result.data._id,
        peer: result.data.peer,
      });
    } catch (error) {
      Alert.alert('Lỗi', error?.message || error || 'Không thể mở cuộc trò chuyện');
    } finally {
      setMessageLoading(false);
    }
  }, [dispatch, navigation, profile, userId]);

  const handleReportReason = useCallback(async (reason) => {
    setIsReportSheetVisible(false);
    try {
      const res = await reportUserRequest(userId, reason, token);
      Alert.alert(
        'Báo cáo thành công',
        `Cảm ơn bạn đã gửi báo cáo. Chúng tôi sẽ xem xét lý do "${reason}" đối với trang cá nhân này và tiến hành xử lý nếu có vi phạm.`,
        [{ text: 'Đóng' }]
      );
      if (res.data?.reportCount !== undefined) {
        setProfile((current) => ({
          ...current,
          reportCount: res.data.reportCount,
        }));
      }
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể gửi báo cáo');
    }
  }, [userId, token]);

  const followLabel = profile?.isFollowing && profile?.isFollowedBy
    ? 'Bạn bè'
    : profile?.isFollowing
      ? 'Đang theo dõi'
      : profile?.isFollowedBy
        ? 'Theo dõi lại'
        : 'Theo dõi';

  if (loading && !profile) {
    return (
      <Screen style={profileStyles.screen}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.emptyText}>Đang tải hồ sơ...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={profileStyles.screen}>
      <ScreenHeader style={profileStyles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={profileStyles.headerTitle}>Hồ Sơ</Text>
        <TouchableOpacity onPress={() => setIsOptionsSheetVisible(true)} style={styles.headerBack}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#111827" />
        </TouchableOpacity>
      </ScreenHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={profileStyles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ACCENT} />
        }
      >
        <ProfileHeaderCard profile={profile} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionBtn, profile?.isFollowing && styles.actionBtnFollowing]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            <Text style={[styles.actionBtnText, profile?.isFollowing && styles.followText]}>
              {followLoading ? 'Đang xử lý...' : followLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionBtn, styles.messageBtn]}
            onPress={handleMessage}
            disabled={messageLoading}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#0b74ff" />
            <Text style={[styles.actionBtnText, { color: '#0b74ff' }]}> 
              {messageLoading ? 'Đang mở...' : 'Nhắn tin'}
            </Text>
          </TouchableOpacity>
        </View>

        <StatsCard profile={profile} onOpenFollowList={openFollowList} />
        <InfoCard profile={profile} />
      </ScrollView>

      <OptionsSheet
        visible={isOptionsSheetVisible}
        onClose={() => setIsOptionsSheetVisible(false)}
        onReport={() => setIsReportSheetVisible(true)}
      />

      <ReportSheet
        visible={isReportSheetVisible}
        onClose={() => setIsReportSheetVisible(false)}
        onBack={() => {
          setIsReportSheetVisible(false);
          setIsOptionsSheetVisible(true);
        }}
        onSelectReason={handleReportReason}
      />
    </Screen>
  );
}

function OptionsSheet({ visible, onClose, onReport }) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={profileStyles.sheetOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={profileStyles.sheetContainer}
        >
          <View style={profileStyles.sheetHandle} />
          <Text style={profileStyles.sheetTitle}>Tùy chọn</Text>
          
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => {
              onClose();
              onReport();
            }}
            style={[profileStyles.sheetOption, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }]}
          >
            <Text style={[profileStyles.sheetOptionText, { color: ACCENT, fontWeight: '600' }]}>
              Báo cáo trang cá nhân
            </Text>
            <Ionicons name="flag-outline" size={20} color={ACCENT} />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const REPORT_REASONS = [
  'Vấn đề liên quan đến người dưới 18 tuổi',
  'Bắt nạt, quấy rối hoặc lăng mạ/lạm dụng/ngược đãi',
  'Tự tử hoặc tự hại bản thân',
  'Nội dung mang tính bạo lực, thù ghét hoặc gây phiền toái',
  'Bán hoặc quảng bá mặt hàng bị hạn chế',
  'Nội dung người lớn',
  'Thông tin sai sự thật, lừa đảo hoặc gian lận',
  'Trang cá nhân giả',
  'Quyền sở hữu trí tuệ',
];

function ReportSheet({ visible, onClose, onSelectReason, onBack }) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={profileStyles.sheetOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[profileStyles.sheetContainer, { maxHeight: '80%' }]}
        >
          <View style={profileStyles.sheetHandle} />
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(99, 94, 94, 0.19)' }}>
            <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={ACCENT} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: ACCENT }}>Báo cáo</Text>
            <View style={{ width: 32 }} />
          </View>

          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 }}>
            Tại sao bạn báo cáo trang cá nhân này?
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
            Báo cáo của bạn là ẩn danh. Nếu ai đó đang gặp nguy hiểm, hãy gọi cho dịch vụ khẩn cấp tại địa phương.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {REPORT_REASONS.map((reason, index) => (
              <View key={index}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSelectReason(reason)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 14, color: '#1F2937', paddingRight: 8 }}>
                    {reason}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={ACCENT} />
                </TouchableOpacity>
                {index < REPORT_REASONS.length - 1 && (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(99, 94, 94, 0.19)' }} />
                )}
              </View>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    paddingTop: 16,
    fontSize: 14,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnFollowing: {
    backgroundColor: '#FFF0EA',
    borderColor: '#FFD4C2',
  },
  actionBtnText: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '600',
  },
  followText: {
    color: ACCENT,
  },
  messageBtn: {
    backgroundColor: '#FFFFFF',
  },
});

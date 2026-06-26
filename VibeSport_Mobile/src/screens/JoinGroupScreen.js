import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { BackButton } from '../components/BackButton';
import { getInviteLinkInfo, joinViaInviteLink } from '../redux/chatSlice';
import { API_BASE_URL } from '../components/constants/api';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

export default function JoinGroupScreen({ route, navigation }) {
  const { code } = route.params;
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await dispatch(getInviteLinkInfo(code)).unwrap();
        if (active) {
          setGroupInfo(res.data);
        }
      } catch (err) {
        if (active) {
          setError(err || 'Không thể lấy thông tin liên kết mời');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchInfo();
    return () => {
      active = false;
    };
  }, [code, dispatch]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const res = await dispatch(joinViaInviteLink(code)).unwrap();
      if (res.success) {
        if (res.alreadyMember) {
          Alert.alert('Thông báo', 'Bạn đã là thành viên của nhóm này.');
        } else if (res.requiresApproval) {
          if (res.alreadyRequested) {
            Alert.alert('Đã gửi yêu cầu', 'Bạn đã gửi yêu cầu tham gia, vui lòng chờ Quản trị viên duyệt.');
          } else {
            Alert.alert('Đã gửi yêu cầu', 'Yêu cầu tham gia đã gửi đến Quản trị viên.');
          }
          navigation.replace('ChatList');
          return;
        } else {
          Alert.alert('Thành công', 'Bạn đã tham gia nhóm thành công.');
        }
        navigation.replace('ChatDetail', {
          conversationId: res.data._id,
          peer: res.data.peer,
          isGroup: true,
        });
      }
    } catch (err) {
      Alert.alert('Lỗi', err || 'Không thể tham gia nhóm.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color="#0b74ff" />
        <Text style={styles.loadingText}>Đang tải thông tin nhóm...</Text>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" style={styles.errorIcon} />
        <Text style={styles.errorText}>Liên kết không hợp lệ hoặc đã hết hạn</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backHomeBtnText}>Quay lại trang chủ</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const groupName = groupInfo?.name || 'Nhóm VibeSport';
  const avatarColor = getAvatarColor(groupName);

  return (
    <Screen style={styles.container}>
      <BackButton onPress={() => navigation.navigate('Home')} style={styles.backButton} />
      
      <View style={styles.contentCard}>
        <View style={styles.avatarContainer}>
          {groupInfo?.avatar ? (
            <Image source={{ uri: fixMediaUrl(groupInfo.avatar) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{getInitials(groupName)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {groupName}
        </Text>
        
        <Text style={styles.subtitle}>
          Mời bạn tham gia cuộc trò chuyện nhóm
        </Text>

        <View style={styles.membersInfo}>
          <Ionicons name="people-outline" size={18} color="#64748B" />
          <Text style={styles.membersCount}>
            {groupInfo?.memberCount || 0} thành viên
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.joinBtn} 
          onPress={handleJoin} 
          disabled={joining}
          activeOpacity={0.8}
        >
          {joining ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.joinBtnText}>Tham gia nhóm</Text>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  backButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748B',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  backHomeBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backHomeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginTop: '25%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  membersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 32,
  },
  membersCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  joinBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#0b74ff',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b74ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

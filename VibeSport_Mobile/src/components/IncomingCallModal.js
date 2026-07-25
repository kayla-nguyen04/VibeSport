import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { clearIncomingCall, clearActiveCallChannel } from '../redux/chatSlice';
import { socketEmitter } from '../hooks/useSocket';
import { getUserProfileRequest } from '../services/userApi';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = (name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
}

export function IncomingCallModal() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  // FIX: state.auth.user có thể lưu id dưới field `id` HOẶC `_id` tùy nơi trong app
  // (xem CallScreen.js: currentUserId = currentUser?.id || currentUser?._id).
  // Trước đây chỉ đọc user?._id — nếu Redux lưu dưới `id`, userId luôn undefined
  // → handleReject fail điều kiện `if (channelName && callerId && userId)` một cách âm thầm
  // → KHÔNG emit call_rejected lên server → caller không bao giờ biết bị từ chối.
  const currentUser = useSelector((state) => state.auth.user);
  const userId = currentUser?.id || currentUser?._id;
  const userToken = useSelector((state) => state.auth.token);
  const incomingCall = useSelector((state) => state.chat.incomingCall);

  useEffect(() => {
    console.log('[IncomingCallModal] Redux incomingCall changed:', incomingCall);
  }, [incomingCall]);

  // Debug: log userId ngay khi component render để dễ verify field nào đang có giá trị
  useEffect(() => {
    console.log('[IncomingCallModal] 🆔 currentUser debug:', {
      hasUser: !!currentUser,
      'user.id': currentUser?.id,
      'user._id': currentUser?._id,
      resolvedUserId: userId,
    });
  }, [currentUser, userId]);

  // Phần A: auto-dismiss sau 30s nếu không có tương tác
  useEffect(() => {
    if (!incomingCall?.channelName) return;

    console.log('[IncomingCallModal] ⏱️ Mount/render with channel=', incomingCall.channelName, '— auto-dismiss timer 30s bắt đầu');
    const timer = setTimeout(() => {
      console.log('[IncomingCallModal] ⏱️ Auto-dismiss: 30s elapsed without response');
      dispatch(clearIncomingCall());
      dispatch(clearActiveCallChannel());
    }, 30000);

    return () => {
      console.log('[IncomingCallModal] ⏱️ Cleanup timer for channel=', incomingCall.channelName);
      clearTimeout(timer);
    };
  }, [incomingCall?.channelName, dispatch]);

  console.log('[IncomingCallModal] render, incomingCall=', incomingCall);

  if (!incomingCall) return null;

  const { channelName, callType, callerName, callerId, isGroup, groupName } = incomingCall;
  const isVideo = callType === 'video';
  // Hiển thị tên nhóm CHỈ khi đúng là group call VÀ server gửi groupName hợp lệ.
  // Nếu groupName null/undefined (DB lỗi / conv không có name) → fallback về
  // layout 1-1 style, không hiện "undefined" ra UI.
  const showGroupLabel = !!isGroup && !!groupName;
  const avatarColor = getAvatarColor(callerName || 'U');
  const initials = getInitials(callerName || 'User');

  const handleAccept = async () => {
    console.log('[IncomingCallModal] ✅ Accept call, channel=', channelName, {
      isGroup,
      groupName,
    });
    dispatch(clearIncomingCall());
    dispatch(clearActiveCallChannel());
    // Fetch profile của caller để truyền vào CallScreen làm `peer`,
    // giúp hiển thị tên thật thay vì agoraUid dạng số.
    // Nếu fetch lỗi, vẫn navigate với callerName từ incoming_call payload.
    const token = userToken;
    let peerInfo = {
      _id: callerId,
      name: callerName || 'Người dùng',
    };
    if (token && callerId) {
      try {
        const res = await getUserProfileRequest(String(callerId), token);
        const data = res?.data || res;
        if (data) {
          peerInfo = {
            _id: String(data.id || data._id || callerId),
            name: data.name || callerName || 'Người dùng',
            picture: data.picture || null,
          };
        }
      } catch (err) {
        console.warn('[IncomingCallModal] fetch caller profile failed:', err?.message);
        // Fallback vẫn OK vì callerName đã có sẵn
      }
    }
    navigation.navigate('Call', {
      channelName,
      callType,
      isGroup: !!isGroup,
      // groupName pass-through để CallScreen có thể dùng cho header / debug.
      groupName: groupName || null,
      peer: peerInfo,
      participants: isGroup ? [] : [peerInfo],
    });
  };

  const handleReject = () => {
    console.log('[IncomingCallModal] ❌ Reject call, channel=', channelName, {
      callerId,
      userId,
      hasAllRequiredFields: !!(channelName && callerId && userId),
    });
    if (channelName && callerId && userId) {
      console.log('[IncomingCallModal] 📤 emitting call_rejected', { callerId, channelName, calleeId: userId });
      socketEmitter.emit('call_rejected', { callerId, channelName, calleeId: userId });
    } else {
      // Trước đây lỗi này bị bỏ qua trong im lặng — giờ log rõ để không tái diễn bug tương tự
      console.warn('[IncomingCallModal] ⚠️ call_rejected NOT emitted — missing required field(s)', {
        channelName,
        callerId,
        userId,
      });
    }
    dispatch(clearIncomingCall());
    dispatch(clearActiveCallChannel());
  };

  return (
    <Modal
      visible={!!incomingCall}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>

          <View style={styles.iconRing}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={32}
              color="#ff6b1a"
            />
          </View>

          {showGroupLabel ? (
            // === Layout cho group call có groupName ===
            // Dòng 1: tên nhóm (to, đậm) — để người nhận biết cuộc gọi từ nhóm nào
            // Dòng 2: "{callerName} đang gọi..." — ngữ cảnh ai là người bấm gọi
            <>
              <Text style={styles.groupName} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={styles.callerName} numberOfLines={1}>
                {callerName || 'Người dùng'}
              </Text>
              <Text style={styles.subtitle}>
                {isVideo ? 'đang gọi video nhóm' : 'đang gọi thoại nhóm'}
              </Text>
            </>
          ) : (
            // === Layout mặc định (1-1 hoặc group không có groupName) ===
            // Giữ nguyên 100% giao diện cũ — không có nguy cơ regression.
            <>
              <Text style={styles.callerName} numberOfLines={2}>
                {callerName || 'Người dùng'}
              </Text>
              <Text style={styles.subtitle}>
                {isVideo ? 'cuộc gọi video đến' : 'cuộc gọi thoại đến'}
              </Text>
            </>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={handleReject}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#fff" />
              <Text style={styles.btnLabel}>Từ chối</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.7}
            >
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#fff" />
              <Text style={styles.btnLabel}>Nhận</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  iconRing: {
    position: 'absolute',
    right: 130,
    top: 120,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 6,
  },
  callerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  // === Group call: tên nhóm hiển thị phía trên tên người gọi ===
  // fontSize lớn hơn callerName để nhấn mạnh — người dùng nhiều nhóm cần
  // nhận diện nhanh nhóm nào đang gọi tới.
  groupName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 36,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 24,
  },
  btn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
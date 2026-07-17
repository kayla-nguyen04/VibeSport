import React, { useEffect } from 'react';
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
import { clearIncomingCall } from '../redux/chatSlice';
import { socketEmitter } from '../hooks/useSocket';

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
  const userId = useSelector((state) => state.auth.user?._id);
  const incomingCall = useSelector((state) => {
    const val = state.chat.incomingCall;
    console.log('[IncomingCallModal] Redux incomingCall:', val);
    return val;
  });

  // Phần A: auto-dismiss sau 30s nếu không có tương tác
  useEffect(() => {
    if (!incomingCall?.channelName) return;

    const timer = setTimeout(() => {
      console.log('[IncomingCallModal] Auto-dismiss: 30s elapsed without response');
      dispatch(clearIncomingCall());
    }, 30000);

    return () => clearTimeout(timer);
  }, [incomingCall?.channelName, dispatch]);

  console.log('[IncomingCallModal] render, incomingCall=', incomingCall);

  if (!incomingCall) return null;

  const { channelName, callType, callerName, callerId } = incomingCall;
  const isVideo = callType === 'video';
  const avatarColor = getAvatarColor(callerName || 'U');
  const initials = getInitials(callerName || 'User');

  const handleAccept = () => {
    dispatch(clearIncomingCall());
    navigation.navigate('Call', { channelName, callType, isGroup: false });
  };

  const handleReject = () => {
    if (channelName && callerId && userId) {
      socketEmitter.emit('call_rejected', { callerId, channelName, calleeId: userId });
    }
    dispatch(clearIncomingCall());
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

          <Text style={styles.callerName} numberOfLines={2}>
            {callerName || 'Người dùng'}
          </Text>
          <Text style={styles.subtitle}>
            {isVideo ? 'cuộc gọi video đến' : 'cuộc gọi thoại đến'}
          </Text>

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

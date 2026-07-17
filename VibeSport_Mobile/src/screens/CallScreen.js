import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeModules,
  PermissionsAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import Avatar from '../components/Avatar';
import IconButton from '../components/IconButton';
import { useAgoraCall } from '../hooks/useAgoraCall';
import { generateAgoraTokenRequest } from '../services/agoraApi';
import { objectIdToUid } from '../utils/objectIdToUid';
import { socketEmitter } from '../hooks/useSocket';
import { setActiveCallChannel, clearActiveCallChannel } from '../redux/chatSlice';
import {
  RtcSurfaceView,
  RenderModeType,
} from 'react-native-agora';
import { getAvatarColor } from '../theme/avatarPalette';
import {
  primary,
  color,
  background,
  text,
  spacing,
  borderRadius,
  shadows,
  typography,
  fontWeight,
  status,
} from '../theme';

export function CallScreen({ route, navigation }) {
  const { channelName, callType = 'video', isGroup = false, peer } = route.params || {};
  const dispatch = useDispatch();
  const jwtToken = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);

  const currentUserId = currentUser?.id || currentUser?._id;
  const isVideo = callType === 'video';
  const agoraUid = objectIdToUid(currentUserId);

  const {
    engineRef,
    remoteUsers,
    isMuted,
    isVideoOff,
    isJoined,
    isInitializing,
    isFrontCamera,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useAgoraCall();

  const [isLoading, setIsLoading] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  // Chờ engine xử lý preview xong rồi mới render RtcSurfaceView
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isVideo) {
          const cameraGranted = await requestAndroidPermission('camera');
          const audioGranted = await requestAndroidPermission('microphone');
          if (cancelled) return;
          if (!cameraGranted || !audioGranted) {
            Alert.alert(
              'Thiếu quyền',
              'Vibesport cần quyền Camera và Microphone để thực hiện cuộc gọi.',
              [{ text: 'OK' }]
            );
          }
        } else {
          const audioGranted = await requestAndroidPermission('microphone');
          if (cancelled) return;
          if (!audioGranted) {
            Alert.alert(
              'Thiếu quyền',
              'Vibesport cần quyền Microphone để thực hiện cuộc gọi.',
              [{ text: 'OK' }]
            );
          }
        }
        if (!cancelled) setPermissionsGranted(true);
      } catch (err) {
        console.warn('[DEBUG] permission error:', err);
        if (!cancelled) setPermissionsGranted(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isVideo]);

  async function requestAndroidPermission(permission) {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const result =
        permission === 'camera'
          ? granted[PermissionsAndroid.PERMISSIONS.CAMERA]
          : granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[DEBUG] PermissionsAndroid.request error:', err);
      return false;
    }
  }

  useEffect(() => {
    if (!permissionsGranted) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setJoinError(null);

        const res = await generateAgoraTokenRequest(jwtToken, {
          channelName: String(channelName),
          uid: agoraUid,
        });

        if (cancelled) return;

        if (!res?.success || !res?.token) {
          throw new Error(res?.message || 'Không nhận được token từ server.');
        }

        const ackPromise = new Promise((resolve, reject) => {
          socketEmitter.emit(
            'join_channel_request',
            { channelName: String(channelName) },
            (response) => {
              if (cancelled) { resolve(null); return; }
              if (response?.ok) {
                resolve(response);
              } else if (response?.reason === 'forbidden') {
                reject(new Error('Bạn không có quyền tham gia cuộc gọi này.'));
              } else if (response?.reason === 'full') {
                reject(new Error(`Cuộc gọi đã đủ ${response.maxParticipants} người.`));
              } else {
                reject(new Error('Không thể tham gia cuộc gọi.'));
              }
            }
          );
        });

        const timeoutPromise = new Promise((_, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Hết thời gian chờ phản hồi từ server. Vui lòng thử lại.'));
          }, 10000);
          ackPromise.then(() => clearTimeout(timer), () => clearTimeout(timer));
        });

        await Promise.race([ackPromise, timeoutPromise]);

        if (cancelled) return;

        // Bước 3: Server xác nhận → thực sự join Agora
        dispatch(setActiveCallChannel(channelName));
        await joinCall(String(channelName), callType, res.token, agoraUid);
        setIsVideoReady(true);
      } catch (err) {
        if (!cancelled) {
          setJoinError(err.message || 'Không thể tham gia cuộc gọi.');
          Alert.alert(
            'Lỗi cuộc gọi',
            err.message || 'Không thể tham gia cuộc gọi.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permissionsGranted]);

  const currentUserIdFromState = currentUser?.id || currentUser?._id;

  // Lấy peerId từ route.params.peer (được truyền từ ChatDetailScreen khi navigate sang CallScreen)
  const conversationIdFromChannel = String(channelName).replace(/^call_/, '');
  const peerId = !isGroup ? String(peer?._id || peer || '') : null;

  const handleEndCall = useCallback(() => {
    // Phân biệt hai trường hợp:
    // - remoteUsers.length === 0: caller hủy trước khi callee join → call_cancelled
    // - remoteUsers.length > 0: cuộc gọi đã kết nối → chỉ leave_channel
    if (remoteUsers.length === 0 && peerId) {
      // Caller hủy giữa chừng, chưa ai nhận máy
      socketEmitter.emit('call_cancelled', { peerId, channelName: String(channelName) });
    } else if (remoteUsers.length === 0 && isGroup) {
      // Group call: không có peerId cụ thể, server dùng targetIds đã lưu khi start_call
      socketEmitter.emit('call_cancelled', { peerId: null, channelName: String(channelName) });
    }
    socketEmitter.emit(
      'leave_channel',
      { channelName: String(channelName), callType },
      () => {}
    );
    leaveCall();
    navigation.goBack();
  }, [remoteUsers.length, peerId, isGroup, channelName, callType, leaveCall, navigation]);

  useEffect(() => {
    return () => {
      dispatch(clearActiveCallChannel());
    };
  }, [dispatch]);

  const handleEndCallAlert = () => {
    Alert.alert(
      'Kết thúc cuộc gọi',
      'Bạn có chắc muốn kết thúc cuộc gọi?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Kết thúc', style: 'destructive', onPress: handleEndCall },
      ]
    );
  };

  // ---- Remote video tile ----
  const renderRemoteVideoTile = ({ item }) => {
    const name = String(item.uid);
    const hasVideo = item.hasVideo;

    return (
      <View key={String(item.uid)} style={styles.tile}>
        {/* Video khi engine sẵn sàng VÀ remote có video; Avatar khi camera off hoặc đang kết nối */}
        {isVideoReady && hasVideo ? (
          <RtcSurfaceView
            style={styles.videoSurface}
            canvas={{
              uid: item.uid,
              renderMode: RenderModeType.RenderModeHidden,
            }}
          />
        ) : (
          <View style={styles.avatarBackground}>
            <Avatar
              name={name}
              size="xl"
              customBgColor={getAvatarColor(name)}
            />
            <Text style={styles.videoOffLabel}>
              {isVideoReady && !hasVideo ? 'Camera đang tắt' : 'Đang kết nối video...'}
            </Text>
          </View>
        )}
        <Text style={styles.tileName}>{name}</Text>
      </View>
    );
  };

  // ---- Video grid: LOCAL tách riêng (không re-render khi remoteUsers thay đổi) ----
  const renderVideoGrid = () => {
    const total = remoteUsers.length + 1; // +1 cho local user

    if (total === 1) {
      return (
        <View style={styles.singleVideoContainer}>
          <View key="local" style={[styles.tile, styles.localTile]}>
            {!isVideoOff && isVideoReady ? (
              <RtcSurfaceView
                style={styles.videoSurface}
                canvas={{
                  uid: 0,
                  renderMode: RenderModeType.RenderModeHidden,
                }}
              />
            ) : (
              <View style={styles.avatarBackground}>
                <Avatar
                  name={currentUser?.name || 'Bạn'}
                  size="xl"
                  customBgColor={getAvatarColor(currentUser?.name || 'Bạn')}
                />
                <Text style={styles.videoOffLabel}>
                  {!isVideoOff && isVideoReady
                    ? 'Đang kết nối video...'
                    : 'Camera đang tắt'}
                </Text>
              </View>
            )}
            <Text style={styles.tileName}>{currentUser?.name || 'Bạn'}</Text>
            <View style={styles.localBadge}>
              <Ionicons name="videocam" size={10} color={background.primary} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.gridContainer, { paddingBottom: 160 }]}>
        {/* Local user: tách riêng, không nằm trong FlatList để tránh re-mount khi remoteUsers thay đổi */}
        <View key="local" style={[styles.tile, styles.localTile]}>
          {!isVideoOff && isVideoReady ? (
            <RtcSurfaceView
              style={styles.videoSurface}
              canvas={{
                uid: 0,
                renderMode: RenderModeType.RenderModeHidden,
              }}
            />
          ) : (
            <View style={styles.avatarBackground}>
              <Avatar
                name={currentUser?.name || 'Bạn'}
                size="xl"
                customBgColor={getAvatarColor(currentUser?.name || 'Bạn')}
              />
              <Text style={styles.videoOffLabel}>
                {!isVideoOff && isVideoReady
                  ? 'Đang kết nối video...'
                  : 'Camera đang tắt'}
              </Text>
            </View>
          )}
          <Text style={styles.tileName}>{currentUser?.name || 'Bạn'}</Text>
          <View style={styles.localBadge}>
            <Ionicons name="videocam" size={10} color={background.primary} />
          </View>
        </View>

        {/* Remote users: trong FlatList, re-render thoải mái khi remoteUsers thay đổi */}
        <FlatList
          data={remoteUsers}
          numColumns={2}
          keyExtractor={(item) => String(item.uid)}
          renderItem={renderRemoteVideoTile}
          contentContainerStyle={styles.gridContent}
          scrollEnabled={false}
        />
      </View>
    );
  };

  const renderVoiceGrid = () => {
    const allParticipants = [
      { uid: agoraUid, hasAudio: !isMuted },
      ...remoteUsers,
    ];

    return (
      <View style={styles.voiceContainer}>
        <FlatList
          data={allParticipants}
          numColumns={2}
          keyExtractor={(item, idx) => (idx === 0 ? 'local' : String(item.uid))}
          renderItem={({ item, index }) => {
            const isLocal = index === 0;
            const name = isLocal ? (currentUser?.name || 'Bạn') : String(item.uid);
            const hasAudio = isLocal ? !isMuted : item.hasAudio;
            const avatarColor = getAvatarColor(name);

            return (
              <View key={isLocal ? 'local' : item.uid} style={styles.voiceTile}>
                <View style={styles.voiceAvatarWrap}>
                  <Avatar
                    name={name}
                    size="lg"
                    customBgColor={avatarColor}
                  />
                  {!hasAudio && (
                    <View style={styles.mutedIcon}>
                      <IconButton
                        icon={<Ionicons name="mic-off" size={12} color={background.primary} />}
                        size="sm"
                        backgroundColor={status.danger}
                      />
                    </View>
                  )}
                </View>
                <Text style={styles.voiceName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            );
          }}
          contentContainerStyle={styles.voiceContent}
        />
      </View>
    );
  };

  return (
    <Screen edges={['top']} style={styles.screen} statusBarStyle="light">
      <View style={styles.container}>
        {(isLoading || isInitializing) && (
          <View style={styles.centerOverlay}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={48}
              color="#fff"
            />
            <Text style={styles.loadingText}>
              {isLoading ? 'Đang xin quyền...' : 'Đang kết nối...'}
            </Text>
          </View>
        )}

        {!isLoading && !joinError && (
          <>
            <View style={styles.contentArea}>
              {isVideo ? renderVideoGrid() : renderVoiceGrid()}
            </View>

            <View style={styles.controlsBar}>
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={toggleMute}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color={isMuted ? '#fff' : '#1a202c'}
                />
              </TouchableOpacity>

              {isVideo && !isVideoOff && (
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={switchCamera}
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={24}
                    color="#1a202c"
                  />
                </TouchableOpacity>
              )}

              {isVideo && (
                <TouchableOpacity
                  style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
                  onPress={toggleVideo}
                >
                  <Ionicons
                    name={isVideoOff ? 'videocam-off' : 'videocam'}
                    size={24}
                    color={isVideoOff ? '#fff' : '#1a202c'}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.endCallBtn}
                onPress={handleEndCallAlert}
              >
                <Ionicons
                  name="call"
                  size={24}
                  color="#fff"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111827',
  },
  container: {
    flex: 1,
  },
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: background.primary,
    fontSize: typography.bodyLarge.fontSize,
    marginTop: spacing.md,
    fontWeight: fontWeight.medium,
  },
  contentArea: {
    flex: 1,
  },
  singleVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tile: {
    flex: 1,
    margin: spacing.xxs,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    aspectRatio: 9 / 16,
    maxHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localTile: {
    borderWidth: 2,
    borderColor: primary.DEFAULT,
  },
  videoSurface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tileName: {
    color: background.primary,
    fontSize: typography.body.fontSize,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xxs,
  },
  videoOffLabel: {
    color: text.hint,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xxs,
  },
  localBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: primary.DEFAULT,
    borderRadius: borderRadius.xs,
    padding: spacing.xxs,
  },
  voiceContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  voiceContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  voiceTile: {
    alignItems: 'center',
    margin: spacing.base,
    width: 140,
  },
  voiceAvatarWrap: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  mutedIcon: {
    position: 'absolute',
    bottom: -spacing.xs,
    right: -spacing.xs,
  },
  voiceName: {
    color: background.primary,
    fontSize: typography.bodyLarge.fontSize,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  controlBtnActive: {
    backgroundColor: status.danger,
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
    shadowColor: status.danger,
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});

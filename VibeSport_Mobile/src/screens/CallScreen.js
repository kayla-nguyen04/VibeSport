import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
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
import {
  setActiveCallChannel,
  clearActiveCallChannel,
  clearCallError,
  setCallState,
  setConnectedAt,
  resetCallState,
  setEndedReason,
} from '../redux/chatSlice';
let RtcSurfaceView = View;
let RtcTextureView = View;
let RenderModeType = {};
try {
  const agora = require('react-native-agora');
  if (agora.RtcSurfaceView) RtcSurfaceView = agora.RtcSurfaceView;
  if (agora.RtcTextureView) RtcTextureView = agora.RtcTextureView;
  if (agora.RenderModeType) RenderModeType = agora.RenderModeType;
} catch (e) {
  
}
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


async function requestPermission(permission) {
  if (Platform.OS === 'ios') {
    return true;
  }

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
    console.warn('[CallScreen] Permission error:', err);
    return false;
  }
}

export function CallScreen({ route, navigation }) {
  const {
    channelName,
    callType = 'video',
    isGroup = false,
    peer,
    participants: routeParticipants = [],
  } = route.params || {};
  const dispatch = useDispatch();
  const jwtToken = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);

  const currentUserId = currentUser?.id || currentUser?._id;
  const isVideo = callType === 'video';
  const agoraUid = objectIdToUid(currentUserId);

  
  const uidToName = React.useMemo(() => {
    const map = {};
    if (Array.isArray(routeParticipants) && routeParticipants.length > 0) {
      for (const p of routeParticipants) {
        if (!p) continue;
        const id = String(p._id || p.id || p);
        if (!id || id === 'undefined' || id === 'null') continue;
        const uid = objectIdToUid(id);
        if (uid && uid !== 0) {
          map[uid] = p.name || 'Người dùng';
        }
      }
    } else if (peer && (peer._id || peer.id)) {
      const id = String(peer._id || peer.id);
      const uid = objectIdToUid(id);
      if (uid && uid !== 0) {
        map[uid] = peer.name || 'Người dùng';
      }
    }
    return map;
  }, [isGroup, routeParticipants, peer]);

  // Helper: lấy tên hiển thị cho 1 agoraUid
  const getDisplayName = React.useCallback(
    (uid) => {
      const name = uidToName?.[uid];
      if (name) return name;
      return `User ${uid}`;
    },
    [uidToName]
  );

  const {
    engineRef,
    remoteUsers,
    isMuted,
    isVideoOff,
    isJoined,
    isInitializing,
    isFrontCamera,
    isSpeakerOn,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    toggleSpeaker,
    setOnConnectedCallback,
  } = useAgoraCall();

  const formatDuration = useCallback((sec) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  // ===== State machine + duration timer =====
  const callState = useSelector((state) => state.chat.callState);
  const connectedAt = useSelector((state) => state.chat.connectedAt);
  const endedReason = useSelector((state) => state.chat.endedReason);

  
  const hasLeftRef = useRef(false);

  
  const emitLeaveChannelOnce = useCallback(() => {
    if (hasLeftRef.current) {
      return false;
    }
    const cn = String(channelName || '');
    if (!cn) return false;
    hasLeftRef.current = true;
    socketEmitter.emit(
      'leave_channel',
      { channelName: cn, callType },
      () => {}
    );
    return true;
  }, [channelName, callType]);

  
  useEffect(() => {
    if (isJoined && !isVideoReady) {
      setIsVideoReady(true);
    }
  }, [isJoined, isVideoReady]);

  
  useEffect(() => {
    setOnConnectedCallback((ts) => {
      dispatch(setConnectedAt(ts));
      dispatch(setCallState('CONNECTED'));
    });
    return () => {
      setOnConnectedCallback(null);
    };
  }, [setOnConnectedCallback, dispatch]);

  useEffect(() => {
    if (callState !== 'CONNECTED' || !connectedAt) {
      setDurationSec(0);
      return undefined;
    }
    setDurationSec(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    const interval = setInterval(() => {
      setDurationSec(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState, connectedAt]);

  const callError = useSelector((state) => state.chat.callError);
  useEffect(() => {
    if (callError) {
      Alert.alert('Không thể gọi', callError, [
        {
          text: 'Đã hiểu',
          onPress: () => {
            dispatch(clearCallError());
            navigation.goBack();
          },
        },
      ]);
      dispatch(clearCallError());
    }
  }, [callError, dispatch, navigation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isVideo) {
          const cameraGranted = await requestPermission('camera');
          const audioGranted = await requestPermission('microphone');
          if (cancelled) return;
          if (!cameraGranted || !audioGranted) {
            Alert.alert(
              'Thiếu quyền',
              'Vibesport cần quyền Camera và Microphone để thực hiện cuộc gọi.',
              [{ text: 'OK' }]
            );
          }
        } else {
          const audioGranted = await requestPermission('microphone');
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
        console.warn('[CallScreen] permission error:', err);
        if (!cancelled) setPermissionsGranted(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isVideo]);

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
        // State machine: chuyển sang CONNECTING (chỉ khi state hiện tại không phải CONNECTED —
        // tránh reset timer nếu caller từng join rồi mà reconnect lại).
        if (callState !== 'CONNECTED') {
          dispatch(setCallState('CONNECTING'));
        }
        dispatch(setActiveCallChannel(channelName));
        await joinCall(String(channelName), callType, res.token, agoraUid);
        // isVideoReady sẽ được set bởi useEffect bên dưới khi isJoined = true
        // (onJoinChannelSuccess event từ engine)
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
   
    if (remoteUsers.length === 0 && peerId) {
      socketEmitter.emit('call_cancelled', { peerId, channelName: String(channelName) });
    } else if (remoteUsers.length === 0 && isGroup) {
      socketEmitter.emit('call_cancelled', { peerId: null, channelName: String(channelName) });
    }
    emitLeaveChannelOnce();
    dispatch(setEndedReason('self_ended'));
    dispatch(setCallState('ENDED'));
    leaveCall();
    navigation.goBack();
  }, [remoteUsers.length, peerId, isGroup, channelName, callType, leaveCall, navigation, emitLeaveChannelOnce, dispatch]);

  const noAnswerTimerRef = useRef(null);
  const clearNoAnswerTimer = useCallback(() => {
    if (noAnswerTimerRef.current) {
      clearTimeout(noAnswerTimerRef.current);
      noAnswerTimerRef.current = null;
    }
  }, []);

  const handleNoAnswerTimeout = useCallback(() => {
    console.warn('[CallScreen] ⏱️ No-answer timeout fired (35s) — auto cancelling call');
   
    if (remoteUsers.length === 0 && peerId) {
      socketEmitter.emit('call_cancelled', { peerId, channelName: String(channelName) });
    } else if (remoteUsers.length === 0 && isGroup) {
      socketEmitter.emit('call_cancelled', { peerId: null, channelName: String(channelName) });
    }
    emitLeaveChannelOnce();
    dispatch(setEndedReason('no_answer'));
    dispatch(setCallState('ENDED'));
    leaveCall();
    navigation.goBack();
  }, [remoteUsers.length, peerId, isGroup, channelName, emitLeaveChannelOnce, leaveCall, navigation, dispatch]);

  useEffect(() => {
    if (callState === 'CONNECTED' || callState === 'ENDED' || callState === 'IDLE') {
      clearNoAnswerTimer();
      return undefined;
    }
    clearNoAnswerTimer(); // defensive: clear timer cũ trước khi set mới
    noAnswerTimerRef.current = setTimeout(() => {
      noAnswerTimerRef.current = null;
      handleNoAnswerTimeout();
    }, 35000);

    return () => {
      clearNoAnswerTimer();
    };
  }, [callState, clearNoAnswerTimer, handleNoAnswerTimeout]);

  useEffect(() => {
    return () => {
     
      emitLeaveChannelOnce();
      dispatch(clearActiveCallChannel());
      dispatch(resetCallState());
    };
  }, [dispatch, channelName, callType, emitLeaveChannelOnce]);

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
    
    const name = getDisplayName(item.uid);
    const hasVideo = item.hasVideo;
    const willRenderVideo = isVideoReady && hasVideo;

    return (
      <View key={`remote-tile-${String(item.uid)}`} style={styles.tile}>
        {willRenderVideo ? (
          
          <RtcSurfaceView
            key={`remote-surface-${String(item.uid)}`}
            style={styles.videoSurface}
            canvas={{
              uid: item.uid,
              renderMode: RenderModeType.RenderModeFit,
              zOrderMediaOverlay: true,
              zOrderOnTop: false,
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

  const renderVideoGrid = () => {
    const total = remoteUsers.length + 1; // +1 cho local user
    if (total === 1) {
      return (
        <View style={styles.singleVideoContainer}>
          <View key="local-tile" style={styles.localTileFullScreen}>
            {!isVideoOff && isVideoReady ? (
              <RtcSurfaceView
                key="local-surface"
                style={styles.videoSurface}
                canvas={{
                  uid: 0,
                  renderMode: RenderModeType.RenderModeFit,
                  zOrderMediaOverlay: false,
                  zOrderOnTop: false,
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
          </View>
        </View>
      );
    }

    if (remoteUsers.length === 1) {
      const remote = remoteUsers[0];
      const name = getDisplayName(remote.uid);
      const hasVideo = remote.hasVideo;
      const willRenderVideo = isVideoReady && hasVideo;

      return (
        <View style={styles.oneToOneContainer}>
          <View key={`remote-tile-${String(remote.uid)}`} style={[styles.tile, styles.remoteTileOneToOne]}>
            {willRenderVideo ? (
              <RtcSurfaceView
                key={`remote-surface-${String(remote.uid)}`}
                style={styles.videoSurface}
                canvas={{
                  uid: remote.uid,
                  renderMode: RenderModeType.RenderModeHidden,
                  zOrderMediaOverlay: false,
                  zOrderOnTop: false,
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
          <View key="local-tile" style={[styles.tile, styles.localTileOneToOne]}>
            {!isVideoOff && isVideoReady ? (
              <RtcTextureView
                key="local-surface"
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
                  size="md"
                  customBgColor={getAvatarColor(currentUser?.name || 'Bạn')}
                />
              </View>
            )}
            <View style={styles.localBadge}>
              <Ionicons name="videocam" size={10} color={background.primary} />
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.gridContainer, { paddingBottom: 160 }]}>
        <View key="local-tile" style={[styles.tile, styles.localTile]}>
          {!isVideoOff && isVideoReady ? (
            <RtcTextureView
              key="local-surface"
              style={styles.videoSurface}
              canvas={{
                uid: 0,
                renderMode: RenderModeType.RenderModeFit,
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

        <View style={styles.gridWrap}>
          {remoteUsers.map((item) => {
            const name = getDisplayName(item.uid);
            const hasVideo = item.hasVideo;
            const willRenderVideo = isVideoReady && hasVideo;
            return (
              <View
                key={`remote-tile-${String(item.uid)}`}
                style={styles.gridCell}
              >
                <View style={styles.tile}>
                  {willRenderVideo ? (
                    <RtcSurfaceView
                      key={`remote-surface-${String(item.uid)}`}
                      style={styles.videoSurface}
                      canvas={{
                        uid: item.uid,
                        renderMode: RenderModeType.RenderModeFit,
                        zOrderMediaOverlay: true,
                        zOrderOnTop: false,
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
                        {isVideoReady && !hasVideo
                          ? 'Camera đang tắt'
                          : 'Đang kết nối video...'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.tileName}>{name}</Text>
                </View>
              </View>
            );
          })}
        </View>
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
            // Lấy tên thật từ uidToName map (peer/participants truyền từ ChatDetail/IncomingCallModal).
            // Fallback về String(uid) nếu map rỗng (vd user không trong participants list).
            const name = isLocal
              ? (currentUser?.name || 'Bạn')
              : (getDisplayName(item.uid) || `User ${item.uid}`);
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

            {/* ===== Top overlay: status text (RINGING / CONNECTING) + duration (CONNECTED) + ENDED message ===== */}
            {/* Hiển thị overlay trên remote view, không che controls bar. */}
            <View style={styles.topOverlay} pointerEvents="none">
              {callState !== 'CONNECTED' && callState !== 'ENDED' && (
                <Text style={styles.statusText}>
                  {callState === 'OUTGOING_RINGING' && 'Đang gọi…'}
                  {callState === 'INCOMING_RINGING' && 'Cuộc gọi đến…'}
                  {callState === 'CONNECTING' && 'Đang kết nối…'}
                  {/* Fallback nếu state không match enum (vd lỗi thư viện) */}
                  {!['OUTGOING_RINGING', 'INCOMING_RINGING', 'CONNECTING', 'CONNECTED'].includes(callState) && 'Đang kết nối…'}
                </Text>
              )}
              {callState === 'CONNECTED' && (
                <Text style={styles.durationText}>{formatDuration(durationSec)}</Text>
              )}
              {/* Khi callState === 'ENDED', hiển thị thông báo cuối theo endedReason.
                  Đây là lý do useSocket.js call_rejected delay 1.8s trước khi pop:
                  user kịp đọc dòng này trước khi CallScreen đóng. */}
              {callState === 'ENDED' && (
                <Text style={styles.statusText}>
                  {endedReason === 'timeout' && 'Không có phản hồi'}
                  {endedReason === 'call_rejected' && 'Cuộc gọi bị từ chối'}
                  {endedReason === 'call_busy' && 'Người nhận đang bận'}
                  {endedReason === 'call_cancelled' && 'Cuộc gọi đã hủy'}
                  {endedReason === 'call_answered_elsewhere' && 'Người khác đã nhấc máy'}
                  {/* Fallback cho các reason khác (no_answer, normal end, v.v.) */}
                  {endedReason &&
                    !['timeout', 'call_rejected', 'call_busy', 'call_cancelled', 'call_answered_elsewhere'].includes(endedReason) &&
                    'Đã kết thúc'}
                  {!endedReason && 'Đã kết thúc'}
                </Text>
              )}
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

              <TouchableOpacity
                style={styles.controlBtnWrap}
                onPress={toggleSpeaker}
                accessibilityLabel={isSpeakerOn ? 'Chuyển sang loa điện thoại' : 'Chuyển sang loa ngoài'}
              >
                <View style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}>
                  <Ionicons
                    name={isSpeakerOn ? 'volume-high' : 'phone-portrait'}
                    size={24}
                    color={isSpeakerOn ? '#fff' : '#1a202c'}
                  />
                </View>
                <Text style={styles.controlBtnLabel}>
                  {isSpeakerOn ? 'Loa ngoài' : 'Điện thoại'}
                </Text>
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
    position: 'relative',
    backgroundColor: '#000',
  },
 
  localTileFullScreen: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: undefined,
    maxHeight: undefined,
  },
 
  oneToOneContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  remoteTileOneToOne: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: undefined,
    maxHeight: undefined,
  },
 
  localTileOneToOne: {
    position: 'absolute',
    flex: 0,
    bottom: 140,
    right: spacing.lg,
    width: 100,
    height: 150,
    margin: 0,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: primary.DEFAULT,
    zIndex: 10,
    elevation: 10,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridCell: {
    width: '50%',
    padding: spacing.xxs / 2,
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
    flex: 0,
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
  
  topOverlay: {
    position: 'absolute',
    top: spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  statusText: {
    color: background.primary,
    fontSize: typography.body.fontSize,
    fontWeight: fontWeight.medium,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    textAlign: 'center',
  },
  durationText: {
    color: background.primary,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  controlsBar: {
  position: 'absolute',
  bottom: 50,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',        
  gap: spacing.xl,            
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
  
controlBtnWrap: {
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',        
},
controlBtnLabel: {
  position: 'absolute',       
  top: 60,                     
  color: background.primary,
  fontSize: 11,
  fontWeight: fontWeight.medium,
  textShadowColor: 'rgba(0, 0, 0, 0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
  width: 80,                   
  textAlign: 'center',
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
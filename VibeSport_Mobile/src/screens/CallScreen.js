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
import { setActiveCallChannel, clearActiveCallChannel, clearCallError } from '../redux/chatSlice';
let RtcSurfaceView = View;
let RenderModeType = {};
try {
  const agora = require('react-native-agora');
  if (agora.RtcSurfaceView) RtcSurfaceView = agora.RtcSurfaceView;
  if (agora.RenderModeType) RenderModeType = agora.RenderModeType;
} catch (e) {
  // Expo Go environment fallback
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

// Xin quyền Camera/Microphone.
// - Android: dùng PermissionsAndroid.requestMultiple
// - iOS: quyền được hệ điều hành tự hỏi khi Agora truy cập camera/mic lần đầu,
//   nên ở đây chỉ cần trả về true (miễn là Info.plist đã khai báo
//   NSCameraUsageDescription / NSMicrophoneUsageDescription).
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
    console.warn('[DEBUG] Permission error:', err);
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

  // === Map agoraUid → tên thật để hiển thị tile thay vì số uid ===
  // Vì Agora chỉ trả về uid dạng int, không kèm tên user.
  // - 1-1: route.params.peer có _id + name → map 1 entry.
  // - Group: route.params.participants là mảng đầy đủ từ conversationMeta.
  // - Fallback: nếu không có peer/participants (vd callee chưa navigate kèm
  //   peer thật), vẫn trả về map rỗng — render sẽ dùng `String(uid)` làm fallback.
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
    console.log('[CallScreen] 🗺️ uidToName map built:', {
      isGroup,
      routeParticipantsCount: routeParticipants?.length || 0,
      hasPeer: !!peer,
      mapEntries: Object.keys(map).length,
      map,
    });
    return map;
  }, [isGroup, routeParticipants, peer]);

  // Helper: lấy tên hiển thị cho 1 agoraUid
  const getDisplayName = React.useCallback(
    (uid) => {
      const name = uidToName?.[uid];
      if (name) return name;
      // Fallback: dùng uid dạng số để vẫn có gì đó hiển thị
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

  // === Ref cờ chống emit leave_channel trùng ===
  // - handleEndCall (chủ động bấm End) emit leave_channel 1 lần.
  // - useEffect cleanup (khi component unmount) cũng muốn emit để đảm bảo
  //   server nhận tín hiệu rời channel ngay cả khi leaveCall() bị miss.
  //   Nhưng nếu đã emit từ handleEndCall rồi thì cleanup phải NO-OP.
  // - Khi nhận call_ended từ phía kia (useSocket.js), safeGoBackFromCall()
  //   cũng sẽ unmount → cleanup fires. Trong trường hợp đó, ta VẪN CẦN emit
  //   leave_channel (để server xóa user khỏi channel + tính duration chính xác).
  //   Vậy nên cờ chỉ chặn emit trùng, KHÔNG chặn lần đầu.
  // - Use ref (không state) để thay đổi không gây re-render và luôn đọc được
  //   giá trị mới nhất trong cleanup (closure issue với state cũ).
  const hasLeftRef = useRef(false);

  // Helper: emit leave_channel đúng 1 lần duy nhất trong lifecycle của component.
  // Trả về true nếu đã emit (lần đầu), false nếu đã emit trước đó (skip).
  const emitLeaveChannelOnce = useCallback(() => {
    if (hasLeftRef.current) {
      console.log('[LEAVE] ⏭️ leave_channel skipped (already emitted this session)');
      return false;
    }
    const cn = String(channelName || '');
    if (!cn) return false;
    hasLeftRef.current = true;
    console.log('[LEAVE] 📤 emit leave_channel (first time)', { channelName: cn, callType });
    socketEmitter.emit(
      'leave_channel',
      { channelName: cn, callType },
      () => {}
    );
    return true;
  }, [channelName, callType]);

  // Log trạng thái render mỗi lần thay đổi để debug video
  useEffect(() => {
    console.log('[RENDER] 📊 CallScreen state', {
      isVideoReady,
      isJoined,
      isLoading,
      isVideoOff,
      remoteUsersCount: remoteUsers?.length ?? 0,
      remoteUsers: remoteUsers?.map((u) => ({ uid: u.uid, hasVideo: u.hasVideo, hasAudio: u.hasAudio })),
    });
  }, [isVideoReady, isJoined, isLoading, isVideoOff, remoteUsers]);

  // isVideoReady = true KHI engine thực sự join channel thành công
  // (onJoinChannelSuccess event từ Agora SDK) — thay vì set ngay sau
  // joinChannel() return (vì đó chỉ là dispatch, chưa chắc join thành công).
  useEffect(() => {
    if (isJoined && !isVideoReady) {
      console.log('[RENDER] 🎬 Engine joined channel (onJoinChannelSuccess) → set isVideoReady = true');
      setIsVideoReady(true);
    }
  }, [isJoined, isVideoReady]);

  // Hiển thị callError từ Redux (vd not_following) rồi clear ngay
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
        console.warn('[DEBUG] permission error:', err);
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
    // Emit leave_channel đúng 1 lần (sẽ chặn re-emit từ useEffect cleanup)
    emitLeaveChannelOnce();
    leaveCall();
    navigation.goBack();
  }, [remoteUsers.length, peerId, isGroup, channelName, callType, leaveCall, navigation, emitLeaveChannelOnce]);

  useEffect(() => {
    return () => {
      // Cleanup khi CallScreen unmount. Cũng gọi emitLeaveChannelOnce() để
      // phát leave_channel nếu chưa có ai phát trước đó (vd bên kia gọi
      // safeGoBackFromCall() khi nhận call_ended → component unmount mà không
      // qua handleEndCall). Cờ hasLeftRef sẽ chặn việc emit trùng với
      // handleEndCall. dispatch(clearActiveCallChannel()) luôn chạy để reset
      // state Redux.
      emitLeaveChannelOnce();
      dispatch(clearActiveCallChannel());
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
    // Lấy tên thật từ uidToName map (đã build từ peer/participants).
    // Fallback về String(uid) nếu không tìm thấy (vd callee chưa có map).
    const name = getDisplayName(item.uid);
    const hasVideo = item.hasVideo;
    const willRenderVideo = isVideoReady && hasVideo;
    // Log mỗi lần render để verify logic
    console.log('[RENDER] 🧩 renderRemoteVideoTile', {
      uid: item.uid,
      uidType: typeof item.uid,
      displayName: name,
      hasVideo,
      isVideoReady,
      willRenderVideo,
    });

    return (
      <View key={`remote-tile-${String(item.uid)}`} style={styles.tile}>
        {/* Video khi engine sẵn sàng VÀ remote có video; Avatar khi camera off hoặc đang kết nối */}
        {willRenderVideo ? (
          // KEY ở đây (không chỉ trên View cha) là bắt buộc để React Native không
          // reuse native SurfaceView giữa 2 user khác nhau khi remoteUsers thay đổi.
          // Nếu thiếu, khi 1 user rời channel rồi user khác join, RtcSurfaceView có
          // thể bị reuse → frame buffer cũ bị giữ → màn hình đen.
          <RtcSurfaceView
            key={`remote-surface-${String(item.uid)}`}
            style={styles.videoSurface}
            canvas={{
              uid: item.uid,
              renderMode: RenderModeType.RenderModeFit,
              // Bước 2 debug: thử NGƯỢC — remote nổi lên trên, local chìm xuống.
              // Lý do: nếu remote bị đen do local surface đè, đảo ngược sẽ cho
              // thấy remote ngay. Nếu vẫn đen → vấn đề nằm ngoài zOrder (vd
              // native view reuse, hoặc texture/buffer chưa sẵn sàng).
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

  // ---- Video grid: LOCAL tách riêng (không re-render khi remoteUsers thay đổi) ----
  // === BƯỚC 3 DEBUG: Tách case 1-1 ra khỏi FlatList ===
  // Trước đây `if (total === 1)` chỉ check khi CHƯA có remote user nào join
  // (chỉ mình local), trong khi case 1-1 (1 remote + 1 local) lại rơi vào
  // nhánh dùng FlatList. FlatList's windowing/virtualization có thể can thiệp
  // vào native SurfaceView lifecycle:
  //   - CellRecyclerviewBridge có thể unmount/remount cell mỗi lần data thay đổi
  //   - Native SurfaceView chỉ được coi là "ready" khi attach vào window tree
  //     — FlatList đôi khi delay attach cho cells ngoài viewport logic
  //   - Kết quả: SDK bind buffer thành công (result=0) nhưng native surface
  //     chưa nhận được frame do view tree chưa ổn định → đen
  // Fix: case 1-1 (remoteUsers.length === 1) render trực tiếp trong View
  // thường, giống local. FlatList chỉ dùng cho group call (>=2 remotes).
  const renderVideoGrid = () => {
    const total = remoteUsers.length + 1; // +1 cho local user

    // CASE 1: Chỉ có mình local (chưa ai join hoặc voice call đơn lẻ)
    if (total === 1) {
      return (
        <View style={styles.singleVideoContainer}>
          <View key="local-tile" style={[styles.tile, styles.localTile]}>
            {!isVideoOff && isVideoReady ? (
              // KEY ổn định để React Native không re-mount native SurfaceView mỗi
              // lần isVideoOff / isVideoReady đổi trạng thái.
              <RtcSurfaceView
                key="local-surface"
                style={styles.videoSurface}
                canvas={{
                  uid: 0,
                  renderMode: RenderModeType.RenderModeFit,
                  // Bước 2 debug: local đẩy xuống dưới (false) để nhường chỗ
                  // cho remote. Nếu remote hiện ra → xác nhận nguyên nhân là
                  // local surface đang đè lên remote.
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
            <View style={styles.localBadge}>
              <Ionicons name="videocam" size={10} color={background.primary} />
            </View>
          </View>
        </View>
      );
    }

    // CASE 2: 1-1 call (1 remote + 1 local) — render trực tiếp, KHÔNG FlatList
    // để tránh virtualization can thiệp native SurfaceView lifecycle.
    if (remoteUsers.length === 1) {
      const remote = remoteUsers[0];
      const name = getDisplayName(remote.uid);
      const hasVideo = remote.hasVideo;
      const willRenderVideo = isVideoReady && hasVideo;
      console.log('[RENDER] 🧩 renderVideoGrid CASE 1-1 (direct render, no FlatList)', {
        uid: remote.uid,
        displayName: name,
        hasVideo,
        isVideoReady,
        willRenderVideo,
      });

      return (
        <View style={styles.oneToOneContainer}>
          {/* Remote tile — direct View, không FlatList */}
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

          {/* Local tile — small overlay (PIP-style) — direct View, không FlatList */}
          <View key="local-tile" style={[styles.tile, styles.localTileOneToOne]}>
            {!isVideoOff && isVideoReady ? (
              <RtcSurfaceView
                key="local-surface"
                style={styles.videoSurface}
                canvas={{
                  uid: 0,
                  renderMode: RenderModeType.RenderModeHidden,
                  zOrderMediaOverlay: true,
                  zOrderOnTop: true,
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

    // CASE 3: Group call (>=2 remotes) — render trực tiếp, KHÔNG FlatList
    // Bước 3 fix: FlatList virtualization can thiệp SurfaceView lifecycle ở
    // case 1-1, nên group call gần như chắc chắn cũng bị. Thay bằng View +
    // flexWrap + .map() trực tiếp.
    // Grid 2 cột được tái tạo bằng cách: parent flexDirection:'row',
    // flexWrap:'wrap', mỗi child width: 50%.
    // Trade-off: không còn virtualization → scroll/performance có thể kém
    // khi rất nhiều người. Xem comment cuối file để biết chi tiết.
    console.log('[RENDER] 🧩 renderVideoGrid CASE GROUP (direct map, no FlatList)', {
      remoteCount: remoteUsers.length,
      remotes: remoteUsers.map((u) => ({ uid: u.uid, hasVideo: u.hasVideo })),
    });

    return (
      <View style={[styles.gridContainer, { paddingBottom: 160 }]}>
        {/* Local user: tách riêng ở trên cùng, không nằm trong grid remote */}
        <View key="local-tile" style={[styles.tile, styles.localTile]}>
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
          <View style={styles.localBadge}>
            <Ionicons name="videocam" size={10} color={background.primary} />
          </View>
        </View>

        {/* Remote grid: View + flexWrap + .map() thay cho FlatList.
            KHÔNG có virtualization, KHÔNG có cell recycling. Mỗi remote user
            là 1 View thường chứa RtcSurfaceView với key theo uid.
            React key giúp React Native unmount chính xác khi user rời channel
            (không bị "ghost tile" do FlatList reuse sai cell). */}
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
                        // Bước 2: remote nổi lên trên local surface.
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
  // === BƯỚC 3: styles cho layout 1-1 trực tiếp (không qua FlatList) ===
  oneToOneContainer: {
    flex: 1,
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
    top: spacing.lg,
    right: spacing.lg,
    width: 120,
    height: 180,
    margin: 0,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: primary.DEFAULT,
    aspectRatio: undefined,
    maxHeight: undefined,
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
  // === BƯỚC 3 group: grid layout thay cho FlatList ===
  // gridWrap: container flex-wrap 2 cột
  // gridCell: mỗi ô 50% width để 2 tile fit mỗi row
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
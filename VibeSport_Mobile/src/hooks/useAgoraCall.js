import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
let AgoraModule = null;
try {
  AgoraModule = require('react-native-agora');
} catch (e) {
  console.warn('[Agora] react-native-agora native module not loaded (Expo Go environment).');
}

const createAgoraRtcEngine = AgoraModule?.createAgoraRtcEngine || (() => ({
  initialize: () => {},
  registerEventHandler: () => {},
  enableAudio: () => {},
  enableVideo: () => {},
  joinChannel: () => {},
  leaveChannel: () => {},
  release: () => {},
  muteLocalAudioStream: () => {},
  muteLocalVideoStream: () => {},
  startPreview: () => {},
  stopPreview: () => {},
}));

const ChannelProfileType = AgoraModule?.ChannelProfileType || {};
const ClientRoleType = AgoraModule?.ClientRoleType || {};
const ChannelMediaOptions = AgoraModule?.ChannelMediaOptions || {};
const RenderModeType = AgoraModule?.RenderModeType || {};
const LocalAudioStreamState = AgoraModule?.LocalAudioStreamState || {};
const LocalAudioStreamReason = AgoraModule?.LocalAudioStreamReason || {};
const RemoteVideoState = AgoraModule?.RemoteVideoState || {};
const AudioProfileType = AgoraModule?.AudioProfileType || {};
const AudioScenarioType = AgoraModule?.AudioScenarioType || {};

const APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID;

async function requestAudioPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Quyền ghi âm',
        message: 'VibeSport cần quyền ghi âm để thực hiện cuộc gọi.',
        buttonNeutral: 'Hỏi sau',
        buttonNegative: 'Hủy',
        buttonPositive: 'Cho phép',
      }
    );
    const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
    return ok;
  } catch (err) {
    console.warn('[useAgoraCall] RECORD_AUDIO permission error:', err);
    return false;
  }
}

export function useAgoraCall() {
  const engineRef = useRef(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  // Speaker (loa ngoài / earpiece).
  // - Voice call: mặc định false → earpiece (đúng UX call thoại).
  // - Video call Android: mặc định true → loa ngoài (xem video xa màn hình).
  // - Video call iOS: mặc định false → earpiece (giữ behavior cũ, user bật nếu cần).
  // Được set đúng giá trị trong joinCall() sau khi biết callType.
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  // Callback báo ra ngoài khi onJoinChannelSuccess xảy ra — dùng cho state machine
  // (dispatch setConnectedAt) và duration timer. Set qua joinCall options.
  const onConnectedCallbackRef = useRef(null);
  const setOnConnectedCallback = useCallback((cb) => {
    onConnectedCallbackRef.current = cb;
  }, []);

  const cleanup = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
    }
    setRemoteUsers([]);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsJoined(false);
    setIsFrontCamera(true);
    setIsSpeakerOn(false);
    onConnectedCallbackRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * Tham gia cuộc gọi Agora.
   *
   * @param {string} channelName   - Tên phòng (Agora channel)
   * @param {'voice'|'video'} callType
   * @param {string} agoraToken    - RTC token từ server
   * @param {number} agoraUid      - Agora UID (đã convert từ ObjectId → số)
   */
  const joinCall = useCallback(
    async (channelName, callType, agoraToken, agoraUid) => {
      if (isJoined || isInitializing) return;
      setIsInitializing(true);

      try {
        // Xin quyền RECORD_AUDIO trước khi khởi tạo engine
        const hasPermission = await requestAudioPermission();
        if (!hasPermission) {
          throw new Error('RECORD_AUDIO permission denied');
        }

        if (!AgoraModule) {
          throw new Error('Tính năng gọi điện (Agora RTC) yêu cầu bản build APK / Development Build (chưa tích hợp native module trên Expo Go).');
        }

        if (!APP_ID) {
          throw new Error('Chưa cấu hình EXPO_PUBLIC_AGORA_APP_ID trong file .env');
        }

        if (!engineRef.current) {
          const engine = createAgoraRtcEngine();
          const initResult = engine.initialize({ appId: APP_ID });
          if (initResult !== 0 && initResult !== undefined) {
            throw new Error(`Agora initialize failed code: ${initResult}`);
          }

          // 1. setChannelProfile TRƯỚC — audio/video modules phải biết profile trước khi enable
          engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

          // 2. setClientRole sau setChannelProfile
          engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

          // 3. Audio profile: tối ưu cho voice (noise suppression + codec)
          engine.setAudioProfile(
            AudioProfileType.AudioProfileSpeechStandard,
            AudioScenarioType.AudioScenarioVoiceChat
          );

          // 4. Enable audio module
          engine.enableAudio();

          // 5. Audio route (loa ngoài vs earpiece):
          // - Video call + Android: bật loa ngoài sẵn (cầm xa để xem video, áp tai vào loa thoại không hợp lý)
          // - Voice call (mọi platform) + Video call iOS: giữ earpiece (mặc định), user toggle nếu muốn
          const defaultSpeakerOn = callType === 'video' && Platform.OS === 'android';
          setIsSpeakerOn(defaultSpeakerOn);
          if (defaultSpeakerOn) {
            engine.setDefaultAudioRouteToSpeakerphone(true);
          }

          // 6. Volume indication: bật để onAudioVolumeIndication bắn event debug audio
          //    interval=200ms (min hợp lệ), smooth=3, reportVad=true
          engine.enableAudioVolumeIndication(200, 3, true);

          if (callType === 'video') {
            engine.enableVideo();
            engine.startPreview();
            engine.setupLocalVideo({
              uid: 0,
              renderMode: RenderModeType.RenderModeHidden,
            });
          }

          // ---- Event listeners ----
          engine.addListener('onJoinChannelSuccess', (connection, elapsed) => {
            setIsJoined(true);
            // Báo ra ngoài (state machine + duration timer).
            // Dùng ref để tránh stale closure và re-register listener.
            try {
              onConnectedCallbackRef.current?.(Date.now());
            } catch (err) {
              console.warn('[AGORA] onConnectedCallback error:', err?.message);
            }
          });

          engine.addListener('onUserJoined', (connection, remoteUid, elapsed) => {
            // Dùng setupRemoteVideo (single-channel) — không cần RtcConnection
            if (callType === 'video') {
              // Bắt buộc cast remoteUid về number vì SDK yêu cầu uid kiểu số
              const uidNum = Number(remoteUid);
              engine.setupRemoteVideo({
                uid: uidNum,
                renderMode: RenderModeType.RenderModeFit,
              });
            }
            // Mặc định hasVideo = false; chỉ set true khi nhận
            // onRemoteVideoStateChanged với state === Decoding.
            // Nếu set true ngay tại đây mà remote chưa bật camera thì
            // RtcSurfaceView sẽ render nền đen/avatar, gây hiểu nhầm.
            setRemoteUsers((prev) => {
              const exists = prev.some((u) => u.uid === remoteUid);
              if (exists) return prev;
              return [...prev, { uid: remoteUid, hasVideo: false, hasAudio: true }];
            });
          });

          engine.addListener('onUserOffline', (connection, remoteUid, reason) => {
            setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUid));
          });

          engine.addListener('onUserMuteVideo', (connection, remoteUid, muted) => {
            setRemoteUsers((prev) =>
              prev.map((u) =>
                u.uid === remoteUid ? { ...u, hasVideo: !muted } : u
              )
            );
          });

          engine.addListener('onUserMuteAudio', (connection, remoteUid, muted) => {
            setRemoteUsers((prev) =>
              prev.map((u) =>
                u.uid === remoteUid ? { ...u, hasAudio: !muted } : u
              )
            );
          });

          engine.addListener('onLocalAudioStateChanged', (connection, state, reason) => {
            // (silent — không cần log state change local audio)
          });

          // Remote video state — nguồn sự thật DUY NHẤT để biết remote có
          // đang phát video hay không. Trước đây hook này chỉ lắng nghe
          // onRemoteAudioStateChanged, khiến hasVideo bị hardcode = true
          // ngay khi remote join (dù chưa bật camera), gây hiện tượng
          // RtcSurfaceView render nền đen.
          engine.addListener('onRemoteVideoStateChanged', (connection, remoteUid, state, reason, elapsed) => {
            const stateName = RemoteVideoState[state] ?? `unknown(${state})`;
            // state:
            //  0 = Stopped  (remote chưa bật video / đã tắt)
            //  1 = Starting (đang bắt đầu nhận frame đầu tiên)
            //  2 = Decoding (đã nhận frame và đang decode bình thường)
            //  3 = Frozen   (mạng chập chờn, video bị đóng băng)
            //  4 = Failed   (lỗi)
            // → hasVideo = true chỉ khi đang decode hoặc đang khởi động
            //   (Starting) để UI không bị giật về avatar.
            const isVideoPlaying = state === RemoteVideoState.RemoteVideoStateDecoding
                                || state === RemoteVideoState.RemoteVideoStateStarting;
            setRemoteUsers((prev) => {
              const exists = prev.some((u) => u.uid === remoteUid);
              // Nếu chưa có trong state (event đến trước onUserJoined) thì
              // thêm mới với hasVideo đúng trạng thái
              if (!exists) {
                return [...prev, { uid: remoteUid, hasVideo: isVideoPlaying, hasAudio: true }];
              }
              return prev.map((u) =>
                u.uid === remoteUid ? { ...u, hasVideo: isVideoPlaying } : u
              );
            });

            // === BƯỚC 2 WORKAROUND: gọi lại setupRemoteVideo() khi state chuyển
            // sang Starting hoặc Decoding. ===
            // Lý do: native RtcSurfaceView mount có thể bị chậm hơn so với
            // onUserJoined event (đặc biệt khi RtcSurfaceView mount trong FlatList
            // — virtualization delay). Khi đó setupRemoteVideo() trong onUserJoined
            // sẽ bind vào native surface chưa ready, frame buffer không được route
            // đúng → màn hình đen. Gọi LẠI khi surface chắc chắn đã mount + render
            // xong (sau khi có frame thực tế báo về) sẽ ép SDK rebind buffer.
            // Workaround được cộng đồng react-native-agora confirm trong issue
            // tương tự (SO #64441672, Agora docs FAQ).
            if (
              callType === 'video' &&
              (state === RemoteVideoState.RemoteVideoStateStarting ||
               state === RemoteVideoState.RemoteVideoStateDecoding)
            ) {
              const uidNum = Number(remoteUid);
              try {
                engine.setupRemoteVideo({
                  uid: uidNum,
                  renderMode: RenderModeType.RenderModeFit,
                });
              } catch (err) {
                console.warn('[AGORA] ⚠️ setupRemoteVideo RE-CALL failed:', err?.message);
              }
            }
          });

          // Remote audio state — đánh dấu hasAudio=false khi remote drop audio stream
          engine.addListener('onRemoteAudioStateChanged', (connection, remoteUid, state, reason) => {
            // state: 0=Stopped, 1=Starting, 2=Running, 3=Stopping, 4=Frozen
            if (state === 0) {
              setRemoteUsers((prev) =>
                prev.map((u) => (u.uid === remoteUid ? { ...u, hasAudio: false } : u))
              );
            } else if (state === 2) {
              setRemoteUsers((prev) =>
                prev.map((u) => (u.uid === remoteUid ? { ...u, hasAudio: true } : u))
              );
            }
          });

          // onAudioVolumeIndication — không log để tránh spam log liên tục
          // (callback fire mỗi vài trăm ms khi có audio activity)
          engine.addListener('onAudioVolumeIndication', () => {});

          engineRef.current = engine;
        }

        // ChannelMediaOptions: bật publish audio + video
        const options = new ChannelMediaOptions();
        options.autoSubscribeVideo = true;
        options.autoSubscribeAudio = true;
        options.publishMicrophoneTrack = true;
        options.publishCameraTrack = callType === 'video';

        const joinResult = engineRef.current.joinChannel(
          agoraToken,
          channelName,
          agoraUid,
          options
        );
      } catch (error) {
        console.error('[Agora] joinCall error:', error);
        cleanup();
        throw error;
      } finally {
        setIsInitializing(false);
      }
    },
    [isJoined, isInitializing, cleanup]
  );

  const leaveCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!engineRef.current || !isJoined) return;
    try {
      const newMuted = !isMuted;
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);
    } catch (error) {
      console.error('[Agora] toggleMute error:', error);
    }
  }, [isJoined, isMuted]);

  const toggleVideo = useCallback(() => {
    if (!engineRef.current || !isJoined) return;
    try {
      const newVideoOff = !isVideoOff;
      engineRef.current.muteLocalVideoStream(newVideoOff);
      setIsVideoOff(newVideoOff);
    } catch (error) {
      console.error('[Agora] toggleVideo error:', error);
    }
  }, [isJoined, isVideoOff]);

  const switchCamera = useCallback(() => {
    if (!engineRef.current || !isJoined) return;
    try {
      const result = engineRef.current.switchCamera();
      if (result === 0) {
        setIsFrontCamera((prev) => !prev);
      }
    } catch (error) {
      console.error('[Agora] switchCamera error:', error);
    }
  }, [isJoined]);

  // Bật / tắt loa ngoài.
  // - Gọi setEnableSpeakerphone (Agora API đúng chuẩn để route audio ra loa ngoài).
  // - State local isSpeakerOn phản ánh engine state.
  // - Không yêu cầu isJoined (vẫn có thể set khi chưa join — engine sẽ apply cho
  //   lần join sau, hoặc áp dụng ngay nếu đang trong channel).
  const toggleSpeaker = useCallback(() => {
    if (!engineRef.current) return;
    try {
      const newOn = !isSpeakerOn;
      // setEnableSpeakerphone(false) = earpiece (loa thoại sát tai)
      // setEnableSpeakerphone(true)  = speakerphone (loa ngoài)
      engineRef.current.setEnableSpeakerphone(newOn);
      setIsSpeakerOn(newOn);
    } catch (error) {
      console.error('[Agora] toggleSpeaker error:', error);
    }
  }, [isJoined, isSpeakerOn]);

  return {
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
  };
}

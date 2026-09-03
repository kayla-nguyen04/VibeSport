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
  
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  
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
   * @param {string} channelName    Tên phòng (Agora channel)
   * @param {'voice'|'video'} callType
   * @param {string} agoraToken    RTC token từ server
   * @param {number} agoraUid      Agora UID (đã convert từ ObjectId → số)
   */
  const joinCall = useCallback(
    async (channelName, callType, agoraToken, agoraUid) => {
      if (isJoined || isInitializing) return;
      setIsInitializing(true);

      try {
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

          engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

          engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

          engine.setAudioProfile(
            AudioProfileType.AudioProfileSpeechStandard,
            AudioScenarioType.AudioScenarioVoiceChat
          );

          engine.enableAudio();

          
          const defaultSpeakerOn = callType === 'video' && Platform.OS === 'android';
          setIsSpeakerOn(defaultSpeakerOn);
          if (defaultSpeakerOn) {
            engine.setDefaultAudioRouteToSpeakerphone(true);
          }

          engine.enableAudioVolumeIndication(200, 3, true);

          if (callType === 'video') {
            engine.enableVideo();
            engine.startPreview();
            engine.setupLocalVideo({
              uid: 0,
              renderMode: RenderModeType.RenderModeHidden,
            });
          }

          engine.addListener('onJoinChannelSuccess', (connection, elapsed) => {
            setIsJoined(true);
            
            try {
              onConnectedCallbackRef.current?.(Date.now());
            } catch (err) {
              console.warn('[AGORA] onConnectedCallback error:', err?.message);
            }
          });

          engine.addListener('onUserJoined', (connection, remoteUid, elapsed) => {
            if (callType === 'video') {
              const uidNum = Number(remoteUid);
              engine.setupRemoteVideo({
                uid: uidNum,
                renderMode: RenderModeType.RenderModeFit,
              });
            }
            
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
          });

          engine.addListener('onRemoteVideoStateChanged', (connection, remoteUid, state, reason, elapsed) => {
            const stateName = RemoteVideoState[state] ?? `unknown(${state})`;
            
            const isVideoPlaying = state === RemoteVideoState.RemoteVideoStateDecoding
                                || state === RemoteVideoState.RemoteVideoStateStarting;
            setRemoteUsers((prev) => {
              const exists = prev.some((u) => u.uid === remoteUid);
              
              if (!exists) {
                return [...prev, { uid: remoteUid, hasVideo: isVideoPlaying, hasAudio: true }];
              }
              return prev.map((u) =>
                u.uid === remoteUid ? { ...u, hasVideo: isVideoPlaying } : u
              );
            });

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

          engine.addListener('onAudioVolumeIndication', () => {});

          engineRef.current = engine;
        }

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

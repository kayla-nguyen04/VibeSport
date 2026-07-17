import { useState, useEffect, useRef, useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  ChannelMediaOptions,
  RenderModeType,
  LocalAudioStreamState,
  LocalAudioStreamReason,
  AudioProfileType,
  AudioScenarioType,
} from 'react-native-agora';

const APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID;
const DEBUG = false;

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
    DEBUG && console.log('[DEBUG] RECORD_AUDIO permission:', ok ? 'GRANTED' : 'DENIED');
    return ok;
  } catch (err) {
    console.warn('[DEBUG] RECORD_AUDIO permission error:', err);
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

        if (!engineRef.current) {
          const engine = createAgoraRtcEngine();
          const initResult = engine.initialize({ appId: APP_ID });
          DEBUG && console.log('[DEBUG] initialize result:', initResult);
          if (initResult !== 0) {
            throw new Error(`Agora initialize failed: ${initResult}`);
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

          // 5. Android: chỉ video call mới force loa ngoài; voice call giữ earpiece (mặc định)
          if (Platform.OS === 'android' && callType === 'video') {
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
            DEBUG && console.log('[DEBUG] onJoinChannelSuccess', { connection, elapsed });
            setIsJoined(true);
          });

          engine.addListener('onUserJoined', (connection, remoteUid, elapsed) => {
            DEBUG && console.log('[DEBUG] onUserJoined', { remoteUid, connection });
            // Dùng setupRemoteVideo (single-channel) — không cần RtcConnection
            if (callType === 'video') {
              engine.setupRemoteVideo({
                uid: remoteUid,
                renderMode: RenderModeType.RenderModeHidden,
              });
            }
            setRemoteUsers((prev) =>
              prev.some((u) => u.uid === remoteUid)
                ? prev
                : [...prev, { uid: remoteUid, hasVideo: true, hasAudio: true }]
            );
          });

          engine.addListener('onUserOffline', (connection, remoteUid, reason) => {
            DEBUG && console.log('[DEBUG] onUserOffline', { remoteUid });
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
            DEBUG && console.log('[DEBUG] onLocalAudioStateChanged', {
              state: LocalAudioStreamState[state],
              reason: LocalAudioStreamReason[reason],
            });
          });

          // Debug: remote audio state — xác nhận remote có stream audio hay bị drop
          engine.addListener('onRemoteAudioStateChanged', (connection, remoteUid, state, reason) => {
            DEBUG && console.log('[DEBUG] onRemoteAudioStateChanged', { remoteUid, state, reason });
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

          // Debug: volume indication — xác nhận audio đang được decode/playback
          engine.addListener('onAudioVolumeIndication', (connection, speakers, speakerNumber, totalVolume) => {
            if (speakerNumber > 0) {
              DEBUG && console.log('[DEBUG] onAudioVolumeIndication', {
                speakers: speakers.map((s) => ({ uid: s.uid, volume: s.volume })),
                totalVolume,
              });
            }
          });

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
        DEBUG && console.log('[DEBUG] joinChannel result:', joinResult);
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
    DEBUG && console.log('[DEBUG] toggleMute called', {
      hasEngine: !!engineRef.current,
      isJoined,
    });
    if (!engineRef.current || !isJoined) return;
    try {
      const newMuted = !isMuted;
      DEBUG && console.log('[DEBUG] muteLocalAudioStream', newMuted);
      const result = engineRef.current.muteLocalAudioStream(newMuted);
      DEBUG && console.log('[DEBUG] muteLocalAudioStream result:', result);
      setIsMuted(newMuted);
    } catch (error) {
      console.error('[Agora] toggleMute error:', error);
    }
  }, [isJoined, isMuted]);

  const toggleVideo = useCallback(() => {
    DEBUG && console.log('[DEBUG] toggleVideo called', {
      hasEngine: !!engineRef.current,
      isJoined,
    });
    if (!engineRef.current || !isJoined) return;
    try {
      const newVideoOff = !isVideoOff;
      DEBUG && console.log('[DEBUG] muteLocalVideoStream', newVideoOff);
      const result = engineRef.current.muteLocalVideoStream(newVideoOff);
      DEBUG && console.log('[DEBUG] muteLocalVideoStream result:', result);
      setIsVideoOff(newVideoOff);
    } catch (error) {
      console.error('[Agora] toggleVideo error:', error);
    }
  }, [isJoined, isVideoOff]);

  const switchCamera = useCallback(() => {
    DEBUG && console.log('[DEBUG] switchCamera called', {
      hasEngine: !!engineRef.current,
      isJoined,
    });
    if (!engineRef.current || !isJoined) return;
    try {
      const result = engineRef.current.switchCamera();
      DEBUG && console.log('[DEBUG] switchCamera result:', result);
      if (result === 0) {
        setIsFrontCamera((prev) => !prev);
      }
    } catch (error) {
      console.error('[Agora] switchCamera error:', error);
    }
  }, [isJoined]);

  return {
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
  };
}

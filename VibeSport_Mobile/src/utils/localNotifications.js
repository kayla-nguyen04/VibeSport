import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

let Notifications = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('Notifications handler init error:', e?.message);
  }
}

let lastNotificationKey = '';
let lastNotificationTime = 0;

export async function requestNotificationPermission() {
  if (isExpoGo || !Notifications) {
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'VibeSport Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Permission request error:', err?.message);
    return false;
  }
}


const SETTINGS_KEY = '@vibesport_notification_settings';

export async function showLocalNotification({ title = 'VibeSport', body, data, type = 'general' }) {
  if (!body || isExpoGo || !Notifications) return;

  // Check user notification settings from AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      // If Master Switch is OFF -> block all notifications
      if (settings.masterEnabled === false) return;

      // Category filter check
      if (type === 'match' && settings.matchEnabled === false) return;
      if ((type === 'chat' || type === 'call') && settings.chatEnabled === false) return;
      if ((type === 'social' || type === 'comment' || type === 'like' || type === 'follow') && settings.socialEnabled === false) return;
    }
  } catch (e) {
    console.warn('Error reading notification settings:', e?.message);
  }

  // Deduplicate identical notifications arriving within 2 seconds
  const now = Date.now();
  const notificationKey = `${title}:${body}`;
  if (notificationKey === lastNotificationKey && now - lastNotificationTime < 2000) {
    return;
  }
  lastNotificationKey = notificationKey;
  lastNotificationTime = now;

  try {
    await requestNotificationPermission();

    // Check sound preference
    let playSound = true;
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.soundEnabled === false) playSound = false;
      }
    } catch (e) {}

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: playSound,
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: 'default', // Mandatory for Android 8.0+
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('showLocalNotification error:', err?.message);
  }
}

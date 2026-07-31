import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';

const STORAGE_KEY = '@vibesport_notification_settings';

const DEFAULT_SETTINGS = {
  masterEnabled: true,
  matchEnabled: true,
  chatEnabled: true,
  socialEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

export function NotificationSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.log('Error loading notification settings:', e);
    }
  };

  const updateSetting = async (key, value) => {
    let newSettings = { ...settings, [key]: value };
    
    // Nếu tắt Master Switch -> tắt tất cả sub-options
    if (key === 'masterEnabled' && !value) {
      newSettings = {
        masterEnabled: false,
        matchEnabled: false,
        chatEnabled: false,
        socialEnabled: false,
        soundEnabled: false,
        vibrationEnabled: false,
      };
    } else if (key !== 'masterEnabled' && value) {
      // Nếu bật bất kỳ sub-option nào -> tự động bật Master Switch
      newSettings.masterEnabled = true;
    }

    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.log('Error saving notification settings:', e);
    }
  };

  const renderSectionHeader = (title) => (
    <Text style={styles.sectionHeaderTitle}>{title}</Text>
  );

  const renderSwitchRow = (iconName, label, description, key, isLast = false) => {
    const isMaster = key === 'masterEnabled';
    const isDisabled = !settings.masterEnabled && !isMaster;

    return (
      <View style={[styles.settingRow, isLast && styles.noBorder]}>
        <View style={styles.settingIconWrap}>
          <Ionicons
            name={iconName}
            size={22}
            color={isDisabled ? '#9CA3AF' : isMaster ? '#FF5F3D' : '#374151'}
          />
        </View>

        <View style={styles.settingTextWrap}>
          <Text style={[styles.settingLabel, isDisabled && styles.disabledText]}>
            {label}
          </Text>
          {description ? (
            <Text style={[styles.settingDesc, isDisabled && styles.disabledText]}>
              {description}
            </Text>
          ) : null}
        </View>

        <Switch
          value={settings[key]}
          onValueChange={(val) => updateSetting(key, val)}
          disabled={isDisabled}
          trackColor={{ false: '#E5E7EB', true: '#FF5F3D' }}
          thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
        />
      </View>
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Cài Đặt Thông Báo</Text>
        <View style={{ width: 44 }} />
      </ScreenHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Switch Card */}
        <View style={styles.card}>
          {renderSwitchRow(
            'notifications',
            'Cho phép thông báo',
            'Bật hoặc tắt tất cả thông báo từ ứng dụng VibeSport',
            'masterEnabled',
            true
          )}
        </View>

        {/* Cài đặt chi tiết */}
        {renderSectionHeader('LOẠI THÔNG BÁO')}
        <View style={styles.card}>
          {renderSwitchRow(
            'football-outline',
            'Thông báo trận đấu',
            'Nhắc nhở trận sắp diễn ra, thay đổi lịch/sân, người tham gia mới',
            'matchEnabled'
          )}

          {renderSwitchRow(
            'chatbubbles-outline',
            'Tin nhắn & Cuộc gọi',
            'Thông báo khi nhận tin nhắn mới, chat nhóm, cuộc gọi video',
            'chatEnabled'
          )}

          {renderSwitchRow(
            'heart-outline',
            'Cộng đồng & Tương tác',
            'Thông báo khi ai đó thích/bình luận bài viết, người theo dõi mới',
            'socialEnabled',
            true
          )}
        </View>

        {/* Âm thanh & Rung */}
        {renderSectionHeader('ÂM THANH & RUNG')}
        <View style={styles.card}>
          {renderSwitchRow(
            'volume-medium-outline',
            'Âm thanh thông báo',
            'Phát tiếng chuông khi nhận được thông báo mới',
            'soundEnabled'
          )}

          {renderSwitchRow(
            'phone-portrait-outline',
            'Chế độ rung',
            'Rung thiết bị khi nhận thông báo',
            'vibrationEnabled',
            true
          )}
        </View>

        <Text style={styles.footerHint}>
          Lưu ý: Bạn cũng có thể tùy chỉnh quyền thông báo của ứng dụng VibeSport trong phần Cài đặt hệ thống của điện thoại.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 4 : 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  footerHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

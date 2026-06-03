import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ProfileScreen } from './ProfileScreen';

const FONT_SIZE = 13;
const ACTIVE_COLOR = '#0b74ff';
const INACTIVE_COLOR = '#7c8190';

const TABS = [
  {
    key: 'posts',
    label: 'Bài đăng',
    icon: ({ color, size }) => <MaterialCommunityIcons color={color} name="soccer" size={size} />,
  },
  {
    key: 'teams',
    label: 'Đội',
    icon: ({ color, size }) => <Ionicons color={color} name="people-outline" size={size} />,
  },
  {
    key: 'create',
    label: 'Tạo',
    icon: ({ color, size }) => <Feather color={color} name="plus" size={size} />,
    isCenter: true,
  },
  {
    key: 'social',
    label: 'MXH',
    icon: ({ color, size }) => <Ionicons color={color} name="chatbubble-outline" size={size} />,
  },
  {
    key: 'profile',
    label: 'Hồ sơ',
    icon: ({ color, size }) => <Ionicons color={color} name="person-outline" size={size} />,
  },
];

export function MainTabsScreen({ activeTab, onChangeTab, onLogout, onUpdateProfile, user }) {
  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[4];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={activeTab === 'profile' ? styles.profileContent : styles.content}>
        {activeTab === 'profile' ? (
          <ProfileScreen
            onLogout={onLogout}
            onUpdateProfile={onUpdateProfile}
            user={user}
          />
        ) : (
          <>
            <Text style={styles.layoutText}>Đây là layout</Text>
            <Text style={styles.layoutName}>{currentTab.label}</Text>
          </>
        )}
      </View>

      <View style={styles.bottomBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

          if (tab.isCenter) {
            return (
              <Pressable
                key={tab.key}
                onPress={() => onChangeTab(tab.key)}
                style={({ pressed, hovered }) => [
                  styles.centerButtonWrap,
                  (pressed || hovered) && styles.zoomedWrap,
                ]}
              >
                <View style={[styles.centerButton, isActive && styles.centerButtonActive]}>
                  {tab.icon({ color: '#ffffff', size: 28 })}
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              onPress={() => onChangeTab(tab.key)}
              style={({ pressed, hovered }) => [
                styles.tabButton,
                isActive && styles.activeTabButton,
                (pressed || hovered) && styles.zoomedTab,
              ]}
            >
              <View style={[styles.iconFrame, isActive && styles.activeIconFrame]}>
                {tab.icon({ color, size: 22 })}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#f4f6fb',
    width: '100%',
  },
  layoutText: {
    fontSize: FONT_SIZE,
    color: '#68707f',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  layoutName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0b1220',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingTop: 8,
  },
  activeTabButton: {
    transform: [{ scale: 1.08 }],
  },
  zoomedTab: {
    transform: [{ scale: 1.08 }],
  },
  iconFrame: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.4,
    borderColor: '#d8dde8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  activeIconFrame: {
    borderColor: ACTIVE_COLOR,
    backgroundColor: '#eef5ff',
  },
  tabLabel: {
    fontSize: 11,
    color: INACTIVE_COLOR,
  },
  activeTabLabel: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
  centerButtonWrap: {
    marginTop: -28,
    marginHorizontal: 6,
  },
  zoomedWrap: {
    transform: [{ scale: 1.08 }],
  },
  centerButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0b74ff',
    borderWidth: 4,
    borderColor: '#dce9ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0b74ff',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 10,
  },
  centerButtonActive: {
    borderColor: '#9fc3ff',
  },
});

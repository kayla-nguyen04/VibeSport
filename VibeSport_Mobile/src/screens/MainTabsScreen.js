import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { ProfileScreen } from './ProfileScreen';
import TeamsScreen from './TeamsScreen';
import { CommunityFeedScreen } from './CommunityFeedScreen';


const FONT_SIZE = 13;
const ACTIVE_COLOR = '#0b74ff';
const INACTIVE_COLOR = '#7c8190';

const TABS = [
  {
    key: 'posts',
    label: 'Bài đăng',
    icon: ({ color, size }) => <MaterialCommunityIcons color={color} name="home-outline" size={size} />,
  },
  {
    key: 'teams',
    label: 'Trận',
    icon: ({ color, size }) => <MaterialCommunityIcons color={color} name="soccer" size={size} />,
  },
  {
    key: 'fc',
    label: 'FC',
    icon: ({ color, size }) => (
      <View style={[styles.fcIcon, color === ACTIVE_COLOR && styles.fcIconActive]}>
        <Text style={[styles.fcIconText, color === ACTIVE_COLOR && styles.fcIconTextActive]}>FC</Text>
      </View>
    ),
  },
  {
    key: 'social',
    label: 'Chat',
    icon: ({ color, size }) => <Ionicons color={color} name="chatbubble-outline" size={size} />,
  },
  {
    key: 'profile',
    label: 'Hồ sơ',
    icon: ({ color, size }) => <Ionicons color={color} name="person-outline" size={size} />,
  },
];

const TAB_BAR_HEIGHT = 70;

export function MainTabsScreen({ activeTab, onChangeTab, onLogout, onUpdateProfile, user, navigation }) {
  const insets = useSafeAreaInsets();
  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[4];

  return (
    <View style={styles.screen}>
      {activeTab === 'posts' ? (
        <CommunityFeedScreen
          navigation={navigation}
          onGoToProfile={() => onChangeTab('profile')}
        />
      ) : (
        <Screen
          edges={['top', 'left', 'right']}
          style={
            activeTab === 'teams'
              ? styles.teamsContent
              : activeTab === 'profile'
                ? styles.profileContent
                : styles.content
          }
        >
          {activeTab === 'profile' ? (
            <ProfileScreen
              onLogout={onLogout}
              onUpdateProfile={onUpdateProfile}
              user={user}
            />
          ) : activeTab === 'teams' ? (
            <TeamsScreen navigation={navigation} />
          ) : (
            <View style={styles.placeholderCenter}>
              <Text style={styles.layoutText}>Đây là layout</Text>
              <Text style={styles.layoutName}>{currentTab.label}</Text>
            </View>
          )}
        </Screen>
      )}

      <View style={[styles.bottomBarWrap, { paddingBottom: insets.bottom }]}>
        <View style={styles.bottomBar}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

            return (
              <Pressable
                key={tab.key}
                onPress={() => onChangeTab(tab.key)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
              >
                <View style={[styles.iconFrame, isActive && styles.activeIconFrame]}>
                  {tab.icon({ color, size: 24 })}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  placeholderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  profileContent: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#f4f6fb',
    width: '100%',
  },
  teamsContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  bottomBarWrap: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1.2,
    borderTopColor: '#e8ecf2',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 18,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonPressed: {
    opacity: 0.7,
  },
  iconFrame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconFrame: {
    backgroundColor: 'rgba(11, 116, 255, 0.12)',
  },
  tabLabel: {
    fontSize: 11,
    color: INACTIVE_COLOR,
  },
  activeTabLabel: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
  fcIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eef5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fcIconActive: {
    backgroundColor: '#0b74ff',
  },
  fcIconText: {
    color: '#0b74ff',
    fontSize: 13,
    fontWeight: '800',
  },
  fcIconTextActive: {
    color: '#ffffff',
  },
});

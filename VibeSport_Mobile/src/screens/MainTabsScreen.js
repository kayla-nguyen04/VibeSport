import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ProfileScreen } from './ProfileScreen';
import TeamsScreen from './TeamsScreen';
import MyTeamsScreen from './MyTeamsScreen';
import { CommunityFeedScreen } from './CommunityFeedScreen';
import ChatListScreen from './ChatListScreen';


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
    key: 'team',
    label: 'Đội',
    icon: ({ color, size }) => <MaterialCommunityIcons color={color} name="account-group" size={size} />,
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
  const chatUnreadCount = useSelector((state) => state.chat.unreadCount);
  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[4];

  return (
    <View style={styles.screen}>
      {activeTab === 'posts' ? (
        <CommunityFeedScreen
          navigation={navigation}
          onGoToProfile={() => onChangeTab('profile')}
        />
      ) : activeTab === 'social' ? (
        <ChatListScreen navigation={navigation} />
      ) : (
        <Screen
          edges={['top', 'left', 'right']}
          style={
            activeTab === 'teams' || activeTab === 'team'
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
              navigation={navigation}
              user={user}
            />
          ) : activeTab === 'teams' ? (
            <TeamsScreen navigation={navigation} />
          ) : activeTab === 'team' ? (
            <MyTeamsScreen navigation={navigation} />
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
            const showChatBadge = tab.key === 'social' && chatUnreadCount > 0;

            return (
              <Pressable
                key={tab.key}
                onPress={() => onChangeTab(tab.key)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
              >
                <View style={[styles.iconFrame, isActive && styles.activeIconFrame]}>
                  {tab.icon({ color, size: 24 })}
                  {showChatBadge ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>
                        {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                      </Text>
                    </View>
                  ) : null}
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
    paddingHorizontal: 0,
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
  tabBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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

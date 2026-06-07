import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
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

export function MainTabsScreen({ activeTab, onChangeTab, onLogout, onUpdateProfile, user, navigation }) {
  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[4];
  const [tabLayouts, setTabLayouts] = useState({});
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const activeIndex = TABS.findIndex((tab) => tab.key === activeTab);

  useEffect(() => {
    if (tabLayouts[activeIndex]) {
      Animated.timing(indicatorAnim, {
        toValue: tabLayouts[activeIndex].x,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabLayouts, indicatorAnim]);

  const handleLayout = (event, index) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => ({ ...prev, [index]: { x, width } }));
  };

  const activeLayout = tabLayouts[activeIndex] || { width: 0 };

  return (
    <View style={styles.screen}>
      {activeTab === 'posts' ? (
        <CommunityFeedScreen
          navigation={navigation}
          onGoToProfile={() => onChangeTab('profile')}
        />
      ) : (
        <SafeAreaView style={activeTab === 'profile' || activeTab === 'teams' ? styles.profileContent : styles.content}>
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
        </SafeAreaView>
      )}

      <View style={styles.bottomBar}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeBackground,
            {
              width: activeLayout.width,
              transform: [{ translateX: indicatorAnim }],
            },
          ]}
        />

        {TABS.map((tab, index) => {
          const isActive = tab.key === activeTab;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onChangeTab(tab.key)}
              style={({ pressed, hovered }) => [
                styles.tabButton,
                isActive && styles.activeTabButton,
                (pressed || hovered) && styles.zoomedTab,
              ]}
              onLayout={(event) => handleLayout(event, index)}
            >
              <View style={[styles.iconFrame, isActive && styles.activeIconFrame]}>
                {tab.icon({ color, size: 22 })}
              </View>
            </Pressable>
          );
        })}
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
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#0b1220',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 12,
    position: 'relative',
  },
  activeBackground: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(11, 116, 255, 0.12)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  activeTabButton: {
    // No extra scaling on active tab; active background handles highlighting.
  },
  zoomedTab: {
    transform: [{ translateY: -2 }],
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
    fontSize: 14,
    fontWeight: '800',
  },
  fcIconTextActive: {
    color: '#ffffff',
  },
});

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { logoutUser, updateProfile } from '../redux/authSlice';
import { ProfileScreen } from '../screens/ProfileScreen';
import TeamsScreen from '../screens/TeamsScreen';
import FCScreen from '../screens/FCScreen';
import { CommunityFeedScreen } from '../screens/CommunityFeedScreen';
import ChatListScreen from '../screens/ChatListScreen';

const Tab = createBottomTabNavigator();

const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = '#1F2937';
const TAB_BAR_HEIGHT = 70;

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const chatUnreadCount = useSelector((state) => state.chat.unreadCount);

  return (
    <View style={[styles.bottomBarOuter, {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: insets.bottom + 12,
    },]}>
      <View style={styles.bottomBarWrap}>
        <View style={styles.bottomBar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const iconSize = isFocused ? 28 : 22;
            const iconColor = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

            let icon;
            if (route.name === 'PostsTab') {
              icon = <Ionicons name={isFocused ? "home" : "home-outline"} size={iconSize} color={iconColor} />;
            } else if (route.name === 'MatchesTab') {
              icon = <MaterialCommunityIcons name="soccer" size={iconSize} color={iconColor} />;
            } else if (route.name === 'TeamsTab') {
              icon = <MaterialCommunityIcons name={isFocused ? "account-group" : "account-group-outline"} size={iconSize} color={iconColor} />;
            } else if (route.name === 'SocialTab') {
              icon = <Ionicons name={isFocused ? "chatbubble" : "chatbubble-outline"} size={iconSize} color={iconColor} />;
            } else if (route.name === 'ProfileTab') {
              icon = <Ionicons name={isFocused ? "person" : "person-outline"} size={iconSize} color={iconColor} />;
            }

            const showChatBadge = route.name === 'SocialTab' && chatUnreadCount > 0;

            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
              >
                <View style={[styles.iconFrame, isFocused && styles.activeIconFrame]}>
                  {icon}
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

function PostsTabScreen({ navigation }) {
  return (
    <CommunityFeedScreen
      navigation={navigation}
      onGoToProfile={() => navigation.navigate('ProfileTab')}
    />
  );
}

function MatchesTabScreen({ navigation }) {
  return <TeamsScreen navigation={navigation} />;
}

function TeamsTabScreen({ navigation }) {
  return <FCScreen navigation={navigation} />;
}

function SocialTabScreen({ navigation }) {
  return <ChatListScreen navigation={navigation} />;
}

function ProfileTabScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  return (
    <ProfileScreen
      onLogout={() => dispatch(logoutUser())}
      onUpdateProfile={(payload) => dispatch(updateProfile(payload)).unwrap()}
      navigation={navigation}
      user={user}
    />
  );
}

export function MainTabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="PostsTab"
    >
      <Tab.Screen
        name="PostsTab"
        component={PostsTabScreen}
        options={{ tabBarLabel: 'Bài đăng' }}
      />
      <Tab.Screen
        name="MatchesTab"
        component={MatchesTabScreen}
        options={{ tabBarLabel: 'Trận' }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={TeamsTabScreen}
        options={{ tabBarLabel: 'Đội' }}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialTabScreen}
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTabScreen}
        options={{ tabBarLabel: 'Hồ sơ' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bottomBarOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
  },
  bottomBarWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 40,
    borderWidth: 1.2,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 8,
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
   width: 52,
  height: 52,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 26,
  overflow: 'hidden',
  },
  activeIconFrame: {
    backgroundColor: '#FF5F3D',
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
});

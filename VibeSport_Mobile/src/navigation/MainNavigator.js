import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';

import { logoutUser, updateProfile } from '../redux/authSlice';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import MapPickerScreen from '../screens/MapPickerScreen';
import AreaPickerScreen from '../screens/AreaPickerScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import { NotificationScreen } from '../screens/NotificationScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import FollowListScreen from '../screens/FollowListScreen';
import GroupManagementScreen from '../screens/GroupManagementScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import MyTeamDetailScreen from '../screens/MyTeamDetailScreen';

export const linking = {
  prefixes: ['vibesport://', 'https://vibesport.app'],
  config: {
    screens: {
      JoinGroup: 'chat/invite/:code',
    },
  },
};

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState('posts');

  useFocusEffect(
    useCallback(() => {
      const tab = route.params?.activeTab;
      if (tab) {
        setActiveTab(tab);
        navigation.setParams({ activeTab: undefined });
      }
    }, [navigation, route.params?.activeTab])
  );

  return (
    <View style={styles.homeWrapper}>
      <MainTabsScreen
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLogout={() => dispatch(logoutUser())}
        onUpdateProfile={(payload) => dispatch(updateProfile(payload)).unwrap()}
        user={user}
        navigation={navigation}
      />
    </View>
  );
}

export function LoadingScreen() {
  return (
    <Screen style={styles.centered}>
      <ActivityIndicator size="large" color="#111111" />
      <Text style={styles.loadingText}>Đang tải phiên đăng nhập...</Text>
    </Screen>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 280,
        gestureEnabled: true,
      }}
      initialRouteName="Home"
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CompleteProfile" component={ProfileSetupScreen} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <Stack.Screen name="MapPicker" component={MapPickerScreen} />
      <Stack.Screen name="AreaPicker" component={AreaPickerScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
      <Stack.Screen name="Notification" component={NotificationScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="GroupManagement" component={GroupManagementScreen} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
      <Stack.Screen name="MyTeamDetail" component={MyTeamDetailScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#3d3d3d',
  },
  homeWrapper: {
    flex: 1,
  },
});

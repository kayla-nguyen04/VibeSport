import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Screen } from '../components/Screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';

import { hydrateSession, logoutUser, updateProfile } from '../redux/authSlice';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';
import { useSocket } from '../hooks/useSocket';
import { AuthScreen } from '../screens/AuthScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import OtpScreen from '../screens/OtpScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import MapPickerScreen from '../screens/MapPickerScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SavedPostsScreen from '../screens/SavedPostsScreen';
import { NotificationScreen } from '../screens/NotificationScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import GroupManagementScreen from '../screens/GroupManagementScreen';
import MyTeamDetailScreen from '../screens/MyTeamDetailScreen';


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

function LoadingScreen() {
  return (
    <Screen style={styles.centered}>
      <ActivityIndicator size="large" color="#111111" />
      <Text style={styles.loadingText}>Đang tải phiên đăng nhập...</Text>
    </Screen>
  );
}

export function AuthNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating, user } = useSelector((state) => state.auth);

  const isProfileComplete = Boolean(user?.favoriteSport && user?.position && user?.area);

  usePresenceHeartbeat();
  useSocket();

  useEffect(() => {
    dispatch(hydrateSession());
  }, [dispatch]);

  if (isHydrating) {
    return <LoadingScreen />;
  }

  const navigatorKey = isAuthenticated
    ? isProfileComplete
      ? 'authenticated-complete'
      : 'authenticated-incomplete'
    : 'guest';

  return (
    <NavigationContainer key={navigatorKey}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 280,
          gestureEnabled: true,
        }}
        initialRouteName={isAuthenticated ? (isProfileComplete ? 'Home' : 'CompleteProfile') : 'Auth'}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="CompleteProfile" component={ProfileSetupScreen} />
            <Stack.Screen name="CreateMatch" component={CreateMatchScreen} />
            <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
            <Stack.Screen name="MapPicker" component={MapPickerScreen} />
            <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
            <Stack.Screen name="Notification" component={NotificationScreen} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
            <Stack.Screen name="GroupManagement" component={GroupManagementScreen} />
            <Stack.Screen name="MyTeamDetail" component={MyTeamDetailScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="OtpScreen" component={OtpScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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

import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';

import { hydrateSession, logoutUser, updateProfile } from '../redux/authSlice';
import { AuthScreen } from '../screens/AuthScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import { MainTabsScreen } from '../screens/MainTabsScreen';
import OtpScreen from '../screens/OtpScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

function HomeScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <MainTabsScreen
      activeTab={activeTab}
      onChangeTab={setActiveTab}
      onLogout={() => dispatch(logoutUser())}
      onUpdateProfile={(payload) => dispatch(updateProfile(payload))}
      user={user}
    />
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.centered}>
      <ActivityIndicator size="large" color="#111111" />
      <Text style={styles.loadingText}>Đang tải phiên đăng nhập...</Text>
    </SafeAreaView>
  );
}

export function AuthNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(hydrateSession());
  }, [dispatch]);

  if (isHydrating) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Home" component={HomeScreen} />
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
});

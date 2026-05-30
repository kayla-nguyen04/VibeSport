import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { AuthCard } from '../components/AuthCard';
import {
  clearAuthFeedback,
  forgotPasswordUser,
  googleLoginUser,
  hydrateSession,
  loginUser,
  logoutUser,
  registerUser,
  setAuthError,
} from '../redux/authSlice';
import { useFirebaseLogin } from '../hooks/useFirebaseLogin';
import { MainTabsScreen } from './MainTabsScreen';
import { SplashScreen } from './SplashScreen';

const FONT_SIZE = 13;

export function AuthScreen() {
  const dispatch = useDispatch();
  const { error, isAuthenticated, isHydrating, loading, successMessage, user } = useSelector((state) => state.auth);
  const [mode, setMode] = useState('splash');
  const [activeTab, setActiveTab] = useState('profile');

  const { loginWithGoogle } = useFirebaseLogin();

  const handleGoogleLogin = async () => {
    try {
      const profile = await loginWithGoogle();
      await dispatch(googleLoginUser(profile));
    } catch (error) {
      dispatch(setAuthError(error.message || 'Đăng nhập Google thất bại.'));
    }
  };

  useEffect(() => {
    dispatch(hydrateSession());
  }, [dispatch]);

  useEffect(() => {
    dispatch(clearAuthFeedback());
  }, [dispatch, mode]);

  const handleSubmit = async (values) => {
    const action =
      mode === 'login'
        ? await dispatch(loginUser(values))
        : mode === 'register'
          ? await dispatch(registerUser(values))
          : await dispatch(forgotPasswordUser(values));

    if (!action.error && (mode === 'register' || mode === 'forgot')) {
      setMode('login');
    }

    return action;
  };

  useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('profile');
    }
  }, [isAuthenticated]);

  if (isHydrating) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.loadingText}>Đang tải phiên đăng nhập...</Text>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return (
      <MainTabsScreen activeTab={activeTab} onChangeTab={setActiveTab} onLogout={() => dispatch(logoutUser())} user={user} />
    );
  }

  if (mode === 'splash') {
    return (
      <SplashScreen
        onNavigateToRegister={() => setMode('register')}
        onNavigateToLogin={() => setMode('login')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>
            {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Đăng ký' : 'Quên mật khẩu'}
          </Text>
          <AuthCard
            error={error}
            loading={loading}
            mode={mode}
            onForgotPassword={() => setMode('forgot')}
            onGoogleLogin={handleGoogleLogin}
            onSubmit={handleSubmit}
            onSwitchMode={() => setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'))}
            successMessage={successMessage}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 24,
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: FONT_SIZE,
    color: '#3d3d3d',
  },
});

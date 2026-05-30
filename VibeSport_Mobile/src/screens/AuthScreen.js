import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { AuthCard } from '../components/AuthCard';
import {
  clearAuthFeedback,
  forgotPasswordUser,
  hydrateSession,
  loginUser,
  logoutUser,
  registerUser,
} from '../redux/authSlice';
import { MainTabsScreen } from './MainTabsScreen';
import { SplashScreen } from './SplashScreen';

const LOGO = require('../../assets/logo_vibe.png');

const FONT_SIZE = 13;
const HEADER_TEXT = {
  login: {
    title: 'Đăng nhập',
    subtitle: 'Chào mừng trở lại! 👋',
  },
  register: {
    title: 'Tạo tài khoản',
    subtitle: 'Điền thông tin để bắt đầu!',
  },
  forgot: {
    title: 'Quên mật khẩu',
    subtitle: 'Nhập email để đặt lại mật khẩu.',
  },
};

export function AuthScreen() {
  const dispatch = useDispatch();
  const { error, isAuthenticated, isHydrating, loading, successMessage, user } = useSelector((state) => state.auth);
  const [mode, setMode] = useState('splash');
  const [activeTab, setActiveTab] = useState('profile');

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
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setMode('splash')} style={styles.backButton}>
              <Text style={styles.backButtonText}>{'‹'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headingGroup}>
            {mode === 'login' ? <Image source={LOGO} style={styles.logo} resizeMode="contain" /> : null}
            <Text style={styles.heading}>{HEADER_TEXT[mode].title}</Text>
            <Text style={styles.subheading}>{HEADER_TEXT[mode].subtitle}</Text>
          </View>

          <AuthCard
            error={error}
            loading={loading}
            mode={mode}
            onForgotPassword={() => setMode('forgot')}
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
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  navRow: {
    height: 56,
    justifyContent: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  backButtonText: {
    fontSize: 22,
    color: '#111111',
  },
  headingGroup: {
    marginTop: 8,
    marginBottom: 18,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginBottom: 24,
  },
  subheading: {
    marginTop: 10,
    fontSize: 16,
    color: '#4b4b4b',
    lineHeight: 24,
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

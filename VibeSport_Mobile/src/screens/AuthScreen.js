import { useEffect, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import { AuthCard } from '../components/AuthCard';
import { clearAuthFeedback, loginUser, setAuthError } from '../redux/authSlice';
import { sendOtp } from '../services/otpService';
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
};

export function AuthScreen({ route }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { error, loading, successMessage } = useSelector((state) => state.auth);
  const [mode, setMode] = useState(route.params?.initialMode ?? 'splash');

  useEffect(() => {
    if (route.params?.initialMode) {
      setMode(route.params.initialMode);
      navigation.setParams({ initialMode: undefined });
    }
  }, [navigation, route.params?.initialMode]);

  const switchMode = () => {
    dispatch(clearAuthFeedback());
    setMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'));
  };

  const handleSubmit = async (values) => {
    if (mode === 'register') {
      try {
        const result = await sendOtp(values.email);

        if (result.success) {
          navigation.navigate('OtpScreen', {
            email: values.email,
            flow: 'register',
            registerData: values,
          });
        } else {
          dispatch(setAuthError(result.message || 'Không gửi được mã OTP'));
        }
      } catch (err) {
        dispatch(setAuthError('Không thể kết nối máy chủ'));
        console.log(err);
      }
      return;
    }

    return dispatch(loginUser(values));
  };

  if (mode === 'splash') {
    return (
      <SplashScreen
        onNavigateToRegister={() => {
          dispatch(clearAuthFeedback());
          setMode('register');
        }}
        onNavigateToLogin={() => {
          dispatch(clearAuthFeedback());
          setMode('login');
        }}
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
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
            onSubmit={handleSubmit}
            onSwitchMode={switchMode}
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
});

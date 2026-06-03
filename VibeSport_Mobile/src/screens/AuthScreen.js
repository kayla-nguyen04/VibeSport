import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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

import { BackButton } from '../components/BackButton';
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
  const [sendingOtp, setSendingOtp] = useState(false);

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
      setSendingOtp(true);
      try {
        const result = await sendOtp(values.email);

        if (result.success) {
          setTimeout(() => {
            setSendingOtp(false);
            navigation.navigate('OtpScreen', {
              email: values.email,
              flow: 'register',
              registerData: values,
            });
          }, 800);
        } else {
          setSendingOtp(false);
          dispatch(setAuthError(result.message || 'Không gửi được mã OTP'));
        }
      } catch (err) {
        setSendingOtp(false);
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
            <BackButton onPress={() => setMode('splash')} />
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

      <Modal transparent={true} visible={sendingOtp} animationType="fade">
        <View style={styles.loadingContainer}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#ff5a1f" />
            <Text style={styles.loadingText}>Đang gửi mã xác minh...</Text>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

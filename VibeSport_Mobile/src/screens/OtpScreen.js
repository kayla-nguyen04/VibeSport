import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch } from 'react-redux';

import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { registerUser } from '../redux/authSlice';
import { sendOtp, verifyOtp } from '../services/otpService';

const OTP_EXPIRY_SECONDS = 15 * 60;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function OtpScreen({ navigation, route }) {
  const { email, flow = 'register', registerData } = route.params;
  const dispatch = useDispatch();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const inputs = useRef([]);
  const verifyingRef = useRef(false);
  const lastSubmittedCode = useRef('');

  useEffect(() => {
    if (timeLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleVerify = useCallback(
    async (codeOverride) => {
      const finalOtp = codeOverride ?? otp.join('');

      if (finalOtp.length < 6 || verifyingRef.current) {
        if (finalOtp.length < 6) {
          Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 số OTP');
        }
        return;
      }

      verifyingRef.current = true;
      setVerifying(true);

      try {
        const result = await verifyOtp(email, finalOtp);

        if (result.success) {
          if (flow === 'forgot') {
            Alert.alert('Xác minh thành công', 'Bạn có thể đặt lại mật khẩu', [
              {
                text: 'Tiếp tục',
                onPress: () => navigation.navigate('ResetPassword', { email }),
              },
            ]);
            return;
          }

          if (registerData) {
            const registerAction = await dispatch(registerUser(registerData));

            if (registerAction.error) {
              Alert.alert('Lỗi', registerAction.payload || 'Đăng ký thất bại');
              return;
            }
          }

          Alert.alert('Xác minh thành công', 'Đăng ký thành công. Vui lòng đăng nhập.', [
            {
              text: 'OK',
              onPress: () =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Auth', params: { initialMode: 'login' } }],
                }),
            },
          ]);
        } else {
          Alert.alert('Lỗi', 'OTP không đúng');
        }
      } catch (error) {
        console.log(error);
        Alert.alert('Lỗi', 'OTP không đúng hoặc đã hết hạn');
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [dispatch, email, flow, navigation, registerData]
  );

  useEffect(() => {
    const code = otp.join('');

    if (code.length < 6) {
      lastSubmittedCode.current = '';
      return;
    }

    if (code !== lastSubmittedCode.current && !verifyingRef.current) {
      lastSubmittedCode.current = code;
      handleVerify(code);
    }
  }, [otp, handleVerify]);

  const handleChange = (text, index) => {
    const digits = text.replace(/\D/g, '');

    if (digits.length > 1) {
      const newOtp = [...otp];
      digits.split('').forEach((digit, offset) => {
        if (index + offset < 6) {
          newOtp[index + offset] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);

    if (digits && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const result = await sendOtp(email);

      if (result.success) {
        setTimeLeft(OTP_EXPIRY_SECONDS);
        setOtp(['', '', '', '', '', '']);
        verifyingRef.current = false;
        lastSubmittedCode.current = '';
        inputs.current[0]?.focus();
        Alert.alert('Thành công', 'Mã OTP mới đã được gửi');
      } else {
        Alert.alert('Lỗi', result.message || 'Không gửi lại được mã OTP');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>
            Xác minh <Text style={styles.titleAccent}>OTP</Text>
          </Text>

          <Text style={styles.subtitle}>Nhập mã 6 số gửi đến email của bạn</Text>

          <View style={styles.emailBox}>
            <Text style={styles.email}>{email}</Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                style={[styles.input, digit ? styles.inputFilled : null]}
                keyboardType="number-pad"
                maxLength={6}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(event) => handleKeyPress(event, index)}
                editable={!verifying}
              />
            ))}
          </View>

          <Text style={styles.timer}>
            Mã hết hạn sau{' '}
            <Text style={styles.titleAccent}>{formatTime(Math.max(timeLeft, 0))}</Text>
          </Text>

          <Text style={styles.resend}>
            Không nhận được?{' '}
            <Text disabled={resending} onPress={handleResend} style={styles.titleAccent}>
              {resending ? 'Đang gửi...' : 'Gửi lại'}
            </Text>
          </Text>

          <TouchableOpacity
            disabled={verifying}
            style={[styles.button, verifying ? styles.buttonDisabled : null]}
            onPress={() => handleVerify()}
          >
            <Text style={styles.buttonText}>{verifying ? 'Đang xác nhận...' : 'Xác nhận'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 60,
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  titleAccent: {
    color: '#ff5a1f',
  },
  subtitle: {
    color: '#777',
    marginBottom: 25,
  },
  emailBox: {
    backgroundColor: '#fff5f1',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  email: {
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  input: {
    width: 50,
    height: 65,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  inputFilled: {
    borderColor: '#ff5a1f',
  },
  timer: {
    textAlign: 'center',
    color: '#777',
    marginBottom: 10,
  },
  resend: {
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#ff5a1f',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

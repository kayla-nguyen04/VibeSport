import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch } from 'react-redux';

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

  useEffect(() => {
    if (timeLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const result = await sendOtp(email);

      if (result.success) {
        setTimeLeft(OTP_EXPIRY_SECONDS);
        setOtp(['', '', '', '', '', '']);
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

  const handleVerify = async () => {
    const finalOtp = otp.join('');

    if (finalOtp.length < 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 số OTP');
      return;
    }

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
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
        <Text style={styles.backText}>‹ Quay lại</Text>
      </TouchableOpacity>

      <Text style={styles.title}>
        Xác minh <Text style={{ color: '#ff5a1f' }}>OTP</Text>
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
            style={[styles.input, digit ? { borderColor: '#ff5a1f' } : null]}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
          />
        ))}
      </View>

      <Text style={styles.timer}>
        Mã hết hạn sau{' '}
        <Text style={{ color: '#ff5a1f' }}>{formatTime(Math.max(timeLeft, 0))}</Text>
      </Text>

      <Text style={styles.resend}>
        Không nhận được?{' '}
        <Text disabled={resending} onPress={handleResend} style={{ color: '#ff5a1f' }}>
          {resending ? 'Đang gửi...' : 'Gửi lại'}
        </Text>
      </Text>

      <TouchableOpacity
        disabled={verifying}
        style={[styles.button, verifying ? styles.buttonDisabled : null]}
        onPress={handleVerify}
      >
        <Text style={styles.buttonText}>{verifying ? 'Đang xác nhận...' : 'Xác nhận'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  backWrap: {
    position: 'absolute',
    top: 50,
    left: 25,
  },
  backText: {
    fontSize: 16,
    color: '#111111',
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 10,
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
    marginBottom: 20,
  },
  input: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
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

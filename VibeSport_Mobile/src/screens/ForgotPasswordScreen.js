import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { sendOtp } from '../services/otpService';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSendReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Vui lòng nhập email');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      setError('Email không hợp lệ');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await sendOtp(normalizedEmail);

      if (result.success) {
        navigation.navigate('OtpScreen', {
          email: normalizedEmail,
          flow: 'forgot',
        });
      } else {
        Alert.alert('Lỗi', result.message || 'Không gửi được mã xác minh');
      }
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể kết nối máy chủ');
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons color="#111111" name="arrow-back" size={22} />
          </TouchableOpacity>

          <Text style={styles.title}>
            Quên <Text style={styles.titleAccent}>mật khẩu</Text>
          </Text>
          <Text style={styles.subtitle}>
            Nhập email đã đăng ký để nhận link đặt lại mật khẩu
          </Text>

          <Text style={styles.label}>EMAIL ĐÃ ĐĂNG KÝ</Text>
          <View style={styles.inputWrap}>
            <Ionicons color="#9ca3af" name="mail-outline" size={20} style={styles.inputIcon} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
              }}
              placeholder="nguyen@email.com"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={email}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.infoBox}>
            <Ionicons color="#2563eb" name="information-circle" size={22} />
            <Text style={styles.infoText}>
              Link đặt lại sẽ được gửi đến email của bạn và có hiệu lực trong{' '}
              <Text style={styles.infoBold}>15 phút</Text>.
            </Text>
          </View>

          <TouchableOpacity disabled={loading} onPress={handleSendReset} style={styles.button}>
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons color="#ffffff" name="paper-plane" size={18} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Gửi link đặt lại</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Nhớ mật khẩu?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.footerLink}> Đăng nhập</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
  },
  titleAccent: {
    color: '#ff5a1f',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    marginBottom: 28,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '700',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    minHeight: 56,
    borderRadius: 14,
    marginBottom: 24,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 14,
  },
  footerLink: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
});

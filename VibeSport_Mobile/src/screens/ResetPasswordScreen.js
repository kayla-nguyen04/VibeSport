import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch } from 'react-redux';

import { forgotPasswordUser } from '../redux/authSlice';

export default function ResetPasswordScreen({ navigation, route }) {
  const { email } = route.params;
  const dispatch = useDispatch();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu nhập lại không khớp');
      return;
    }

    setLoading(true);

    const action = await dispatch(
      forgotPasswordUser({
        email,
        password,
        confirmPassword,
      })
    );

    setLoading(false);

    if (!action.error) {
      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => navigation.navigate('Auth') },
      ]);
    } else {
      Alert.alert('Lỗi', action.payload || 'Không thể đặt lại mật khẩu');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        Đặt lại <Text style={styles.accent}>mật khẩu</Text>
      </Text>
      <Text style={styles.subtitle}>Tạo mật khẩu mới cho {email}</Text>

      <Text style={styles.label}>Mật khẩu mới</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setPassword}
        placeholder="Nhập mật khẩu mới"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      <Text style={styles.label}>Xác nhận mật khẩu</Text>
      <TextInput
        autoCapitalize="none"
        onChangeText={setConfirmPassword}
        placeholder="Nhập lại mật khẩu"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
      />

      <TouchableOpacity disabled={loading} onPress={handleReset} style={styles.button}>
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Lưu mật khẩu</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  accent: {
    color: '#ff5a1f',
  },
  subtitle: {
    color: '#777',
    marginBottom: 30,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b4b4b',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#ff5a1f',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

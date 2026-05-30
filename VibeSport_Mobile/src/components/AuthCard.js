import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const FONT_SIZE = 13;
const BRAND_LOGO = require('../../assets/logo_vibe.png');

const INITIAL_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
};

export function AuthCard({
  error,
  loading,
  mode,
  onForgotPassword,
  onGoogleLogin,
  onSubmit,
  onSwitchMode,
  successMessage,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const isRegisterMode = mode === 'register';
  const isForgotMode = mode === 'forgot';

  const helperText = useMemo(() => validationError || error || successMessage, [error, successMessage, validationError]);

  useEffect(() => {
    setForm(INITIAL_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setValidationError(null);
  }, [mode]);

  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const handleSubmit = async () => {
    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();

    if (!email || !password) {
      setValidationError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    if (!email.includes('@')) {
      setValidationError('Email không hợp lệ.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if ((isRegisterMode || isForgotMode) && password !== confirmPassword) {
      setValidationError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setValidationError(null);

    const resultAction = await onSubmit(
      isRegisterMode || isForgotMode ? { email, password, confirmPassword } : { email, password }
    );

    if (!resultAction?.error) {
      setForm(INITIAL_FORM);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.logoWrap}>
        <Image resizeMode="contain" source={BRAND_LOGO} style={styles.logoImage} />
      </View>

      <Text style={styles.brandText}>VibeSport</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onChangeText={(value) => updateField('email', value)}
        placeholder="example@email.com"
        placeholderTextColor="#9c9c9c"
        style={styles.input}
        value={form.email}
      />

      <Text style={styles.label}>{isForgotMode ? 'Mật khẩu mới' : 'Mật khẩu'}</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          autoCapitalize="none"
          autoComplete={isRegisterMode || isForgotMode ? 'new-password' : 'current-password'}
          onChangeText={(value) => updateField('password', value)}
          placeholder={isForgotMode ? 'Nhập mật khẩu mới' : 'Nhập mật khẩu'}
          placeholderTextColor="#9c9c9c"
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
          value={form.password}
        />
        <TouchableOpacity hitSlop={12} onPress={() => setShowPassword((visible) => !visible)}>
          <Text style={styles.toggleText}>{showPassword ? 'Ẩn' : 'Hiện'}</Text>
        </TouchableOpacity>
      </View>

      {isRegisterMode || isForgotMode ? (
        <>
          <Text style={styles.label}>{isForgotMode ? 'Nhập lại mật khẩu mới' : 'Nhập lại mật khẩu'}</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={(value) => updateField('confirmPassword', value)}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor="#9c9c9c"
              secureTextEntry={!showConfirmPassword}
              style={styles.passwordInput}
              value={form.confirmPassword}
            />
            <TouchableOpacity hitSlop={12} onPress={() => setShowConfirmPassword((visible) => !visible)}>
              <Text style={styles.toggleText}>{showConfirmPassword ? 'Ẩn' : 'Hiện'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {helperText ? (
        <Text style={[styles.errorText, successMessage && !validationError && !error ? styles.successText : null]}>
          {helperText}
        </Text>
      ) : null}

      {!isRegisterMode && !isForgotMode ? (
        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotWrap}>
          <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity disabled={loading} onPress={handleSubmit} style={styles.submitButton}>
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>
            {isRegisterMode ? 'Tạo tài khoản' : isForgotMode ? 'Đặt lại mật khẩu' : 'Đăng nhập'}
          </Text>
        )}
      </TouchableOpacity>

      {!isForgotMode ? (
        <TouchableOpacity disabled={loading} onPress={onGoogleLogin} style={styles.googleButton}>
          <Text style={styles.googleButtonText}>
            {isRegisterMode ? 'Tiếp tục với Google' : 'Đăng nhập với Google'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {isForgotMode ? 'Quay lại màn đăng nhập?' : isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
        </Text>
        <TouchableOpacity onPress={onSwitchMode}>
          <Text style={styles.footerLink}>
            {isForgotMode ? ' Đăng nhập ngay' : isRegisterMode ? ' Đăng nhập ngay' : ' Đăng ký ngay'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  logoImage: {
    width: 150,
    height: 120,
  },
  brandText: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#202020',
    marginBottom: 24,
  },
  label: {
    fontSize: FONT_SIZE,
    color: '#424242',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 14,
  },
  input: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 16,
    paddingHorizontal: 18,
    fontSize: FONT_SIZE,
    color: '#111111',
    backgroundColor: '#fcfcfc',
  },
  passwordWrap: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fcfcfc',
  },
  passwordInput: {
    flex: 1,
    fontSize: FONT_SIZE,
    color: '#111111',
  },
  toggleText: {
    color: '#2d6cdf',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  errorText: {
    color: '#d23939',
    fontSize: FONT_SIZE,
    marginTop: 14,
  },
  successText: {
    color: '#16803c',
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  forgotLink: {
    color: '#2d6cdf',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: FONT_SIZE,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7deea',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  googleButtonText: {
    color: '#202020',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#4d4d4d',
    fontSize: FONT_SIZE,
  },
  footerLink: {
    color: '#2d6cdf',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
});

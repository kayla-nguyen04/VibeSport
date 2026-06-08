import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const FONT_SIZE = 13;
const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export function AuthCard({
  error,
  loading,
  mode,
  onForgotPassword,
  onSubmit,
  onSwitchMode,
  successMessage,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const isRegisterMode = mode === 'register';
  const isForgotMode = mode === 'forgot';

  const helperText = useMemo(() => validationError || error || successMessage, [error, successMessage, validationError]);

  useEffect(() => {
    setForm(INITIAL_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setValidationError(null);
    setFieldErrors({});
  }, [mode]);

  const updateField = (field, value) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setValidationError(null);
  };

  const handleSubmit = async () => {
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();

    const nextFieldErrors = {};

    if (isRegisterMode) {
      if (!fullName) nextFieldErrors.fullName = 'Vui lòng nhập họ và tên';
      if (!email) nextFieldErrors.email = 'Vui lòng nhập email';
      if (!phone) nextFieldErrors.phone = 'Vui lòng nhập số điện thoại';
      if (!password) nextFieldErrors.password = 'Vui lòng nhập mật khẩu';
      if (!confirmPassword) nextFieldErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (isForgotMode) {
      if (!email) nextFieldErrors.email = 'Vui lòng nhập email';
    } else {
      if (!email) nextFieldErrors.email = 'Vui lòng nhập email';
      if (!password) nextFieldErrors.password = 'Vui lòng nhập mật khẩu';
    }

    if (email && !email.includes('@')) {
      nextFieldErrors.email = 'Email không hợp lệ';
    }

    if (isRegisterMode && phone && phone.length < 9) {
      nextFieldErrors.phone = 'Số điện thoại chưa hợp lệ';
    }

    if (password && password.length < 6) {
      nextFieldErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if ((isRegisterMode || isForgotMode) && password && confirmPassword && password !== confirmPassword) {
      nextFieldErrors.confirmPassword = 'Mật khẩu nhập lại không khớp';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setValidationError(null);
      return;
    }

    setFieldErrors({});
    setValidationError(null);

    const payload = isRegisterMode
      ? { fullName, email, phone, password, confirmPassword }
      : isForgotMode
        ? { email, password, confirmPassword }
        : { email, password };

    const resultAction = await onSubmit(payload);

    if (!resultAction?.error) {
      setForm(INITIAL_FORM);
    }
  };

  const submitTitle = isRegisterMode ? 'Tiếp tục' : isForgotMode ? 'Đặt lại mật khẩu' : 'Đăng nhập';

  return (
    <View style={styles.card}>
      {isRegisterMode ? (
        <>
          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(value) => updateField('fullName', value)}
            placeholder="Nhập họ và tên"
            placeholderTextColor="#9c9c9c"
            style={[styles.input, fieldErrors.fullName ? styles.inputError : null]}
            value={form.fullName}
          />
          {fieldErrors.fullName ? <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={(value) => updateField('email', value)}
            placeholder="Nhập email của bạn"
            placeholderTextColor="#9c9c9c"
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
            value={form.email}
          />
          {fieldErrors.email ? <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text> : null}

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="phone-pad"
            onChangeText={(value) => updateField('phone', value)}
            placeholder="Nhập số điện thoại"
            placeholderTextColor="#9c9c9c"
            style={[styles.input, fieldErrors.phone ? styles.inputError : null]}
            value={form.phone}
          />
          {fieldErrors.phone ? <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text> : null}

          <Text style={styles.label}>Mật khẩu</Text>
          <View style={[styles.passwordWrap, fieldErrors.password ? styles.inputError : null]}>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              onChangeText={(value) => updateField('password', value)}
              placeholder="Tạo mật khẩu"
              placeholderTextColor="#9c9c9c"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={form.password}
            />
            <TouchableOpacity hitSlop={12} onPress={() => setShowPassword((visible) => !visible)}>
              <Text style={styles.toggleText}>{showPassword ? 'Ẩn' : 'Hiện'}</Text>
            </TouchableOpacity>
          </View>
          {fieldErrors.password ? <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text> : null}

          <Text style={styles.label}>Xác nhận mật khẩu</Text>
          <View style={[styles.passwordWrap, fieldErrors.confirmPassword ? styles.inputError : null]}>
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
          {fieldErrors.confirmPassword ? <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={(value) => updateField('email', value)}
            placeholder="Nhập email của bạn"
            placeholderTextColor="#9c9c9c"
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
            value={form.email}
          />
          {fieldErrors.email ? <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text> : null}

          <Text style={styles.label}>{isForgotMode ? 'Mật khẩu mới' : 'Mật khẩu'}</Text>
          <View style={[styles.passwordWrap, fieldErrors.password ? styles.inputError : null]}>
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
          {fieldErrors.password ? <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text> : null}

          {isForgotMode ? (
            <>
              <Text style={styles.label}>Nhập lại mật khẩu mới</Text>
              <View style={[styles.passwordWrap, fieldErrors.confirmPassword ? styles.inputError : null]}>
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
              {fieldErrors.confirmPassword ? <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text> : null}
            </>
          ) : null}
        </>
      )}

      {helperText ? (
        <Text style={[styles.helperText, successMessage && !validationError && !error ? styles.successText : null]}>
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
          <Text style={styles.submitButtonText}>{submitTitle}</Text>
        )}
      </TouchableOpacity>


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
    borderRadius: 30,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  label: {
    fontSize: FONT_SIZE,
    color: '#4b4b4b',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 18,
    fontSize: FONT_SIZE,
    color: '#111111',
    backgroundColor: '#fafbff',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  fieldErrorText: {
    color: '#ef4444',
    fontSize: FONT_SIZE,
    marginTop: 8,
    marginBottom: -6,
  },
  passwordWrap: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafbff',
  },
  passwordInput: {
    flex: 1,
    fontSize: FONT_SIZE,
    color: '#111111',
  },
  toggleText: {
    color: '#ff5800',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  helperText: {
    color: '#d23939',
    fontSize: FONT_SIZE,
    marginTop: 14,
  },
  successText: {
    color: '#16803c',
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  forgotLink: {
    color: '#ff5800',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#ff5800',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  separatorText: {
    marginHorizontal: 12,
    color: '#9ca3af',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  googleButton: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#111111',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: FONT_SIZE,
  },
  footerLink: {
    color: '#ff5800',
    fontSize: FONT_SIZE,
    fontWeight: '700',
  },
});

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  TextInput,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';

export function SettingsScreen({ navigation }) {
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleOpenSupportOption = (type) => {
    setShowSupportModal(false);
    switch (type) {
      case 'phone':
        Linking.openURL('tel:0988123456').catch(() => {
          Alert.alert('Liên hệ hotline', 'Hotline hỗ trợ: 0988 123 456 (8h00 - 22h00)');
        });
        break;
      case 'zalo':
        Linking.openURL('https://zalo.me/0988123456').catch(() => {
          Alert.alert('Zalo Hỗ trợ', 'Vui lòng thêm Zalo SĐT: 0988 123 456 để được hỗ trợ trực tiếp.');
        });
        break;
      case 'email':
        Linking.openURL('mailto:support@vibesport.vn?subject=Y%EA%BFu%20c%E1%BA%A7u%20h%E1%BB%97%20tr%E1%BB%A3').catch(() => {
          Alert.alert('Email hỗ trợ', 'Email chăm sóc khách hàng: support@vibesport.vn');
        });
        break;
      default:
        break;
    }
  };

  const handleChangePasswordSubmit = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setChangingPass(true);
    setTimeout(() => {
      setChangingPass(false);
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Thành công', 'Đổi mật khẩu thành công!');
    }, 1000);
  };

  const renderSectionHeader = (title) => (
    <Text style={styles.sectionHeaderTitle}>{title}</Text>
  );

  const renderRow = (iconName, label, subtitle, onPress, isLast = false, isDanger = false) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.settingRow, isLast && styles.noBorder]}
    >
      <View style={[styles.iconWrap, isDanger && styles.dangerIconWrap]}>
        <Ionicons
          name={iconName}
          size={20}
          color={isDanger ? '#EF4444' : '#FF5F3D'}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, isDanger && styles.dangerText]}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Cài Đặt</Text>
        <View style={{ width: 44 }} />
      </ScreenHeader>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Nhóm Cài đặt hệ thống */}
        {renderSectionHeader('HỆ THỐNG & HỖ TRỢ')}
        <View style={styles.card}>
          {renderRow(
            'notifications-outline',
            'Cài đặt thông báo',
            'Tùy chỉnh bật/tắt thông báo trận đấu, tin nhắn, cộng đồng',
            () => navigation.navigate('NotificationSettings')
          )}

          {renderRow(
            'headset-outline',
            'Liên hệ hỗ trợ',
            'Hotline 24/7, Zalo CSKH, Email giải đáp thắc mắc',
            () => setShowSupportModal(true),
            true
          )}
        </View>

        {/* Nhóm Tài khoản & Bảo mật */}
        {renderSectionHeader('TÀI KHOẢN & BẢO MẬT')}
        <View style={styles.card}>
          {renderRow(
            'lock-closed-outline',
            'Đổi mật khẩu',
            'Cập nhật mật khẩu bảo mật cho tài khoản của bạn',
            () => setShowChangePasswordModal(true),
            true
          )}
        </View>

        {/* Thông tin ứng dụng */}
        {renderSectionHeader('VỀ ỨNG DỤNG')}
        <View style={styles.card}>
          {renderRow(
            'document-text-outline',
            'Điều khoản & Chính sách',
            'Quy định sử dụng và chính sách bảo mật dữ liệu',
            () => navigation.navigate('TermsPolicy')
          )}

          {renderRow(
            'information-circle-outline',
            'Thông tin phiên bản',
            'VibeSport Mobile v1.0.0 (Mới nhất)',
            () => Alert.alert('VibeSport v1.0.0', 'Nền tảng kết nối thể thao & đặt sân hàng đầu Việt Nam.')
          )}
        </View>
      </ScrollView>

      {/* ─── Support Modal ─── */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowSupportModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Liên Hệ Hỗ Trợ CSKH</Text>
              <Text style={styles.modalSubTitle}>Đội ngũ VibeSport sẵn sàng hỗ trợ bạn 24/7</Text>

              <TouchableOpacity
                style={styles.supportOptionBtn}
                onPress={() => handleOpenSupportOption('phone')}
              >
                <View style={[styles.supportIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="call-outline" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportOptionTitle}>Hotline CSKH</Text>
                  <Text style={styles.supportOptionDesc}>0988 123 456 (Gọi trực tiếp)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportOptionBtn}
                onPress={() => handleOpenSupportOption('zalo')}
              >
                <View style={[styles.supportIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportOptionTitle}>Zalo Hỗ Trợ Nhanh</Text>
                  <Text style={styles.supportOptionDesc}>Chat trực tiếp với tư vấn viên</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.supportOptionBtn}
                onPress={() => handleOpenSupportOption('email')}
              >
                <View style={[styles.supportIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="mail-outline" size={22} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportOptionTitle}>Email Hỗ Trợ</Text>
                  <Text style={styles.supportOptionDesc}>support@vibesport.vn</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowSupportModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Đóng</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ─── Change Password Modal ─── */}
      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouch}
            activeOpacity={1}
            onPress={() => setShowChangePasswordModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Đổi Mật Khẩu</Text>
                <Text style={styles.modalSubTitle}>Nhập mật khẩu hiện tại và mật khẩu mới</Text>

                <View style={styles.inputWrap}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowChangePasswordModal(false);
                        navigation.navigate('ForgotPassword');
                      }}
                    >
                      <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="Nhập mật khẩu cũ"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Mật khẩu mới</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowChangePasswordModal(false)}
                    disabled={changingPass}
                  >
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleChangePasswordSubmit}
                    disabled={changingPass}
                  >
                    <Text style={styles.submitBtnText}>
                      {changingPass ? 'Đang lưu...' : 'Xác nhận'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 4 : 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerIconWrap: {
    backgroundColor: '#FEE2E2',
  },
  textWrap: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dangerText: {
    color: '#EF4444',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalOverlayTouch: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 60,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalSubTitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  supportOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  supportIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  supportOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  supportOptionDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  // Input wrap for password
  inputWrap: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPassText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF5F3D',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#FF5F3D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

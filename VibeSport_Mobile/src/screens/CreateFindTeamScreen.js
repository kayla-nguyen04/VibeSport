import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { getTagsRequest } from '../services/tagApi';
import { createPostRequest } from '../services/postApi';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

export default function CreateFindTeamScreen({ navigation }) {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);

  const [content, setContent] = useState('');
  const [catalogTags, setCatalogTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('Bóng đá');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    getTagsRequest(token, 'sport')
      .then((res) => setCatalogTags(res.data || []))
      .catch(() => setCatalogTags([]));
  }, [token]);

  const handlePublish = async () => {
    if (!content.trim()) {
      Alert.alert('Nội dung trống', 'Vui lòng nhập nội dung bài đăng tìm đội.');
      return;
    }

    if (!selectedTag) {
      Alert.alert('Chưa chọn tag', 'Vui lòng chọn môn thể thao.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('location', '');
      formData.append('sportType', selectedTag);
      formData.append('tags', JSON.stringify(['Tìm đội', selectedTag]));

      await createPostRequest(formData, token);
      Alert.alert('Thành công', 'Đăng bài tìm đội thành công!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Thất bại', err.message || 'Đã xảy ra lỗi khi đăng bài.');
    } finally {
      setSubmitting(false);
    }
  };

  const sportTags = catalogTags.length
    ? catalogTags
    : [{ name: 'Bóng đá' }, { name: 'Cầu lông' }, { name: 'Pickleball' }];

  return (
    <Screen style={styles.safeArea}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tìm đội</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={submitting || !content.trim()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.publishBtn, (submitting || !content.trim()) && styles.publishBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.publishBtnText}>Đăng</Text>
          )}
        </TouchableOpacity>
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.userRow}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(user?.name) }]}>
                <Text style={styles.avatarPlaceholderText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Thành viên VibeSport'}</Text>
              <TouchableOpacity
                onPress={() => setShowTagDropdown(!showTagDropdown)}
                style={styles.tagDropdownTrigger}
              >
                <Text style={styles.tagDropdownText}>{selectedTag || 'Chọn môn'}</Text>
                <Ionicons name="chevron-down" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          </View>

          {showTagDropdown ? (
            <View style={styles.dropdownOptions}>
              {sportTags.map((tag) => (
                <TouchableOpacity
                  key={tag._id || tag.name}
                  onPress={() => {
                    setSelectedTag(tag.name);
                    setShowTagDropdown(false);
                  }}
                  style={[styles.dropdownItem, selectedTag === tag.name && styles.dropdownItemActive]}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedTag === tag.name && styles.dropdownItemTextActive,
                    ]}
                  >
                    {tag.name}
                  </Text>
                  {selectedTag === tag.name ? (
                    <Ionicons name="checkmark" size={16} color="#FF6B35" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <TextInput
            multiline
            placeholder="Mô tả nhu cầu tìm đội của bạn (vị trí, trình độ, thời gian...)"
            placeholderTextColor="#9CA3AF"
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            maxLength={3000}
          />
          <Text style={styles.charCounter}>{content.length}/3000 ký tự</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  publishBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: { backgroundColor: '#FFBEA3' },
  publishBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { paddingBottom: 24 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  userInfo: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  tagDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  tagDropdownText: { color: '#FF6B35', fontSize: 12, fontWeight: 'bold' },
  dropdownOptions: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: { backgroundColor: '#FFF0EA' },
  dropdownItemText: { color: '#374151', fontSize: 14 },
  dropdownItemTextActive: { color: '#FF6B35', fontWeight: 'bold' },
  contentInput: {
    minHeight: 160,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  charCounter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 16,
    marginBottom: 16,
  },
});

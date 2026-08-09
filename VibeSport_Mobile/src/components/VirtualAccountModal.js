import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';
import { BackButton } from './BackButton';
import {
  createVirtualUserRequest,
  getVirtualUsersRequest,
  addVirtualUserToMatchRequest,
  deleteVirtualUserRequest,
} from '../services/virtualUserApi';

const getInitials = (name) => {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
};

export function VirtualAccountModal({
  visible,
  onClose,
  matchId,
  matchParticipants = [],
  onMatchUpdated,
  token,
}) {
  const insets = useSafeAreaInsets();
  const [newVirtualName, setNewVirtualName] = useState('');
  const [virtualUsers, setVirtualUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (visible && token) {
      loadVirtualUsers();
    }
  }, [visible, token]);

  const loadVirtualUsers = async () => {
    try {
      setLoading(true);
      const res = await getVirtualUsersRequest(token);
      setVirtualUsers(res?.data || []);
    } catch (err) {
      console.error('[VirtualAccountModal] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVirtualUser = async () => {
    if (!newVirtualName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên tài khoản ảo ');
      return;
    }
    try {
      setCreating(true);
      const res = await createVirtualUserRequest(newVirtualName.trim(), null, token);
      Alert.alert('Thành công', `Đã tạo tài khoản ảo "${res?.data?.name}"!`);
      setNewVirtualName('');
      loadVirtualUsers();
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo tài khoản ảo');
    } finally {
      setCreating(false);
    }
  };

  const handleAddToMatch = async (vUser) => {
    const vId = String(vUser._id || vUser.id);
    try {
      setAddingId(vId);
      const res = await addVirtualUserToMatchRequest(matchId, vId, token);
      Alert.alert('Thành công', res?.message || `Đã thêm ${vUser.name} vào trận đấu!`);
      if (onMatchUpdated && res?.data) {
        onMatchUpdated(res.data);
      }
    } catch (err) {
      Alert.alert('Lỗi', err?.message || 'Không thể thêm tài khoản ảo vào trận');
    } finally {
      setAddingId(null);
    }
  };

  const handleDeleteVirtualUser = (vUser) => {
    const vId = String(vUser._id || vUser.id);
    Alert.alert(
      'Xác nhận xóa tài khoản ảo',
      `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản ảo "${vUser.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteVirtualUserRequest(vId, token);
              Alert.alert('Thành công', res?.message || `Đã xóa tài khoản ảo "${vUser.name}"!`);
              loadVirtualUsers();
            } catch (err) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa tài khoản ảo');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <ScreenHeader style={[styles.headerBar, { paddingTop: insets.top, height: 58 + insets.top }]}>
          <BackButton onPress={onClose} />
          <Text style={styles.headerTitle}>Tài khoản ảo</Text>
          <View style={{ width: 40 }} />
        </ScreenHeader>

        <View style={styles.container}>
          {/* Box 1: Tạo tài khoản ảo */}
          <View style={styles.createCard}>
            <Text style={styles.sectionTitle}>Tạo tài khoản ảo mới</Text>
            <Text style={styles.sectionSub}>
              Tài khoản ảo giúp bạn thêm bạn bè bên ngoài vào trận đấu để các thành viên khác có thể chấm điểm & đánh giá sau trận.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Nhập tên "
                placeholderTextColor="#6B7280"
                value={newVirtualName}
                onChangeText={setNewVirtualName}
              />
              <TouchableOpacity
                style={[styles.createBtn, creating && styles.disabledBtn]}
                onPress={handleCreateVirtualUser}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.createBtnText}>+ Tạo mới</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Box 2: Danh sách tài khoản ảo */}
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionTitle}>Danh sách tài khoản ảo của bạn</Text>
          </View>

          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#FF6B35" />
            </View>
          ) : virtualUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>Chưa có tài khoản ảo nào</Text>
              <Text style={styles.emptySub}>Hãy tạo tài khoản ảo ở trên để thêm vào trận đấu</Text>
            </View>
          ) : (
            <FlatList
              data={virtualUsers}
              keyExtractor={(item) => String(item._id || item.id)}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => {
                const vId = String(item._id || item.id);
                const isInMatch = matchParticipants.some(
                  (p) => String(typeof p === 'object' ? p._id || p.id : p) === vId
                );
                const isProcessing = addingId === vId;

                return (
                  <View style={styles.userCard}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.initialsText}>{getInitials(item.name)}</Text>
                    </View>

                    <View style={styles.userInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.virtualTag}>
                          <Text style={styles.virtualTagText}>Ảo</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.userRating}>
                          {Number(item.rating || 5.0).toFixed(1)}/5 · {item.stats?.matchesPlayed || 0} trận
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.addBtn,
                          isInMatch && styles.inMatchBtn,
                          isProcessing && styles.disabledBtn,
                        ]}
                        onPress={() => handleAddToMatch(item)}
                        disabled={isInMatch || isProcessing}
                        activeOpacity={0.8}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[styles.addBtnText, isInMatch && styles.inMatchBtnText]}>
                            {isInMatch ? 'Đã thêm' : '+ Thêm vào trận'}
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteVirtualUser(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  headerBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  container: { flex: 1, padding: 16 },
  createCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  nameInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#000000',
  },
  createBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.6 },
  listHeaderRow: { marginBottom: 10 },
  centerLoading: { paddingVertical: 40, alignItems: 'center' },
  emptyCard: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8E24AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 14.5, fontWeight: '700', color: '#111827', maxWidth: 140 },
  virtualTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  virtualTagText: { color: '#7E22CE', fontSize: 10.5, fontWeight: '700' },
  userRating: { fontSize: 12, color: '#6B7280' },
  addBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  inMatchBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  inMatchBtnText: { color: '#9CA3AF' },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
});

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VIBE_LOGO = require('../../assets/logo_vibe.png');

export const VIBE_REACTION = {
  type: 'vibe',
  label: 'Vibe',
  color: '#FF6B35',
};

export const REACTION_OPTIONS = [VIBE_REACTION];

export const REACTION_FILTERS = [{ type: 'all', label: 'Tất cả' }];

export const getReactionMeta = () => VIBE_REACTION;

export function VibeReactionIcon({ size = 20, style }) {
  return (
    <Image
      source={VIBE_LOGO}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  );
}

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charCodeSum % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

export function ReactionsPreview({ likesCount = 0, onPress }) {
  if (!likesCount) return null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.previewWrap}>
      <View style={styles.previewEmojiBubble}>
        <VibeReactionIcon size={18} />
      </View>
      <Text style={styles.previewCountText}>{likesCount}</Text>
    </TouchableOpacity>
  );
}

export function LikesModal({
  visible,
  loading,
  summary,
  onClose,
}) {
  const users = summary?.users || [];

  const renderUser = ({ item }) => (
    <View style={styles.likeUserRow}>
      <View>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.likeAvatar} />
        ) : (
          <View style={[styles.likeAvatarFallback, { backgroundColor: getAvatarColor(item.name) }]}>
            <Text style={styles.likeAvatarText}>{getInitials(item.name)}</Text>
          </View>
        )}
        <View style={[styles.likeReactionBadge, { borderColor: VIBE_REACTION.color }]}>
          <VibeReactionIcon size={12} />
        </View>
      </View>
      <View style={styles.likeUserInfo}>
        <Text style={styles.likeUserName}>{item.name || 'Thành viên VibeSport'}</Text>
        <Text style={styles.likeUserReaction}>{VIBE_REACTION.label}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.likesOverlay}>
        <TouchableOpacity activeOpacity={1} style={styles.likesSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.likesHeader}>
            <Text style={styles.likesTitle}>Cảm xúc VibeSport</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryRow}>
            <VibeReactionIcon size={24} />
            <Text style={styles.summaryText}>{summary?.totalLikes || 0} lượt Vibe</Text>
          </View>

          {loading ? (
            <View style={styles.likesLoading}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.likesLoadingText}>Đang tải danh sách...</Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item._id}
              renderItem={renderUser}
              style={styles.likesList}
              ListEmptyComponent={
                <View style={styles.likesEmpty}>
                  <VibeReactionIcon size={32} />
                  <Text style={styles.likesEmptyText}>Chưa có ai Vibe bài viết này.</Text>
                </View>
              }
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  previewEmojiBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  previewCountText: {
    marginLeft: 6,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  likesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  likesSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    maxHeight: '78%',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  likesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  likesLoading: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  likesLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  likesList: {
    marginTop: 4,
  },
  likeUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  likeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E5E7EB',
  },
  likeAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  likeReactionBadge: {
    position: 'absolute',
    right: -3,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    overflow: 'hidden',
  },
  likeUserInfo: {
    marginLeft: 12,
    flex: 1,
  },
  likeUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  likeUserReaction: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  likesEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  likesEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});

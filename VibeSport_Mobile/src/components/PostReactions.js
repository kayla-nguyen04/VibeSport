import React, { useMemo } from 'react';
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

const AVATAR_COLORS = ['#E53935', '#43A047', '#1E88E5', '#FB8C00', '#8E24AA', '#00ACC1'];

export const REACTION_OPTIONS = [
  { type: 'like', emoji: '👍', label: 'Thích', color: '#2563EB' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích', color: '#EF4444' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: '#F59E0B' },
];

export const REACTION_FILTERS = [
  { type: 'all', label: 'Tất cả' },
  ...REACTION_OPTIONS,
];

export const getReactionMeta = (reactionType) => (
  REACTION_OPTIONS.find((reaction) => reaction.type === reactionType) || REACTION_OPTIONS[0]
);

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

export function ReactionsPreview({ likesCount = 0, topReactions = [], onPress }) {
  if (!likesCount) return null;

  const visibleReactions = topReactions.length > 0 ? topReactions : ['like'];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.previewWrap}>
      <View style={styles.previewEmojiStack}>
        {visibleReactions.slice(0, 3).map((reactionType, index) => {
          const reaction = getReactionMeta(reactionType);
          return (
            <View
              key={`${reactionType}-${index}`}
              style={[styles.previewEmojiBubble, index > 0 && styles.previewEmojiOverlap]}
            >
              <Text style={styles.previewEmojiText}>{reaction.emoji}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.previewCountText}>{likesCount}</Text>
    </TouchableOpacity>
  );
}

export function ReactionPickerModal({ visible, onClose, onSelect }) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.reactionOverlay}>
        <View style={styles.reactionPicker}>
          {REACTION_OPTIONS.map((reaction) => (
            <TouchableOpacity
              key={reaction.type}
              activeOpacity={0.8}
              onPress={() => onSelect(reaction.type)}
              style={styles.reactionChoice}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={[styles.reactionLabel, { color: reaction.color }]}>{reaction.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function LikesModal({
  visible,
  loading,
  summary,
  activeFilter,
  onChangeFilter,
  onClose,
}) {
  const users = summary?.users || [];
  const filteredUsers = useMemo(() => {
    if (activeFilter === 'all') return users;
    return users.filter((user) => user.reactionType === activeFilter);
  }, [activeFilter, users]);

  const renderUser = ({ item }) => {
    const reaction = getReactionMeta(item.reactionType);
    return (
      <View style={styles.likeUserRow}>
        <View>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.likeAvatar} />
          ) : (
            <View style={[styles.likeAvatarFallback, { backgroundColor: getAvatarColor(item.name) }]}>
              <Text style={styles.likeAvatarText}>{getInitials(item.name)}</Text>
            </View>
          )}
          <View style={[styles.likeReactionBadge, { borderColor: reaction.color }]}>
            <Text style={styles.likeReactionEmoji}>{reaction.emoji}</Text>
          </View>
        </View>
        <View style={styles.likeUserInfo}>
          <Text style={styles.likeUserName}>{item.name || 'Thành viên VibeSport'}</Text>
          <Text style={styles.likeUserReaction}>{reaction.label}</Text>
        </View>
      </View>
    );
  };

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
            <Text style={styles.likesTitle}>Cảm xúc về bài viết</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            {REACTION_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.type;
              const count = filter.type === 'all'
                ? summary?.totalLikes || 0
                : summary?.reactions?.[filter.type] || 0;
              return (
                <TouchableOpacity
                  key={filter.type}
                  onPress={() => onChangeFilter(filter.type)}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {filter.emoji ? `${filter.emoji} ` : ''}{filter.label} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.likesLoading}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.likesLoadingText}>Đang tải danh sách...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item._id}
              renderItem={renderUser}
              style={styles.likesList}
              ListEmptyComponent={
                <View style={styles.likesEmpty}>
                  <Ionicons name="heart-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.likesEmptyText}>Chưa có ai trong nhóm này.</Text>
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
  previewEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  previewEmojiOverlap: {
    marginLeft: -7,
  },
  previewEmojiText: {
    fontSize: 13,
  },
  previewCountText: {
    marginLeft: 6,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  reactionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#101828',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  reactionChoice: {
    alignItems: 'center',
    minWidth: 72,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  reactionEmoji: {
    fontSize: 30,
  },
  reactionLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF7ED',
  },
  filterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#C2410C',
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
  },
  likeReactionEmoji: {
    fontSize: 11,
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
  },
  likesEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#94A3B8',
  },
});

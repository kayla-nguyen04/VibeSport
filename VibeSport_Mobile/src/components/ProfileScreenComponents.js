import { memo, useMemo } from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Avatar from './Avatar';
import { PostImages } from './PostImages';
import { API_BASE_URL } from './constants/api';
import { styles } from '../screens/ProfileScreen.styles';
import {
  background,
  fontSize,
  icon,
  primary,
  spacing,
  status,
  surface,
  text,
} from '../theme';
import { VibeReactionIcon, VIBE_REACTION } from './PostReactions';

const HEADER_HEIGHT = Platform.OS === 'ios'
  ? spacing['4xl'] - spacing.xs
  : spacing['4xl'] + spacing.sm;
const ICON_TOUCH_SIZE = spacing['4xl'] - spacing.xs;
const HEADER_SIDE_WIDTH = ICON_TOUCH_SIZE * 2;
const POST_PAGE_SIZE = 20;

function withOpacity(hexColor, opacity) {
  const hex = hexColor.replace('#', '');
  const value = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  const intValue = parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}


export function fixMediaUrl(url) {
  if (!url) return url;
  return url.replace(/http:\/\/[\d.]+:\d+/, API_BASE_URL);
}

function formatTime(dateString) {
  if (!dateString) return '';

  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return `${diffDays} ngày trước`;
}

function formatTeamPeriod(team) {
  if (!team?.joinedAt) return '';

  const joinedDate = new Date(team.joinedAt);
  const joined = `${String(joinedDate.getMonth() + 1).padStart(2, '0')}/${joinedDate.getFullYear()}`;

  if (!team.leftAt) return `Tham gia từ ${joined}`;

  const leftDate = new Date(team.leftAt);
  const left = `${String(leftDate.getMonth() + 1).padStart(2, '0')}/${leftDate.getFullYear()}`;
  return `Tham gia từ ${joined} - ${left}`;
}


export function HeaderIconButton({ children, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.headerIconButton}
    >
      {children}
    </TouchableOpacity>
  );
}

export function ProfileOptionsSheet({
  visible,
  onClose,
  onEditProfile,
  onSavedPosts,
  onSettings,
  onLogout,
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > spacing.sm && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > spacing['2xl'] || gestureState.vy > 0.8) {
            onClose();
          }
        },
      }),
    [onClose]
  );

  const options = [
    {
      key: 'edit',
      label: 'Chỉnh sửa hồ sơ',
      iconName: 'create-outline',
      onPress: onEditProfile,
    },
    {
      key: 'settings',
      label: 'Cài đặt',
      iconName: 'settings-outline',
      onPress: onSettings,
    },
    {
      key: 'logout',
      label: 'Đăng xuất',
      iconName: 'log-out-outline',
      onPress: onLogout,
      destructive: true,
    },
  ];

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.sheetOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetContainer}
          {...panResponder.panHandlers}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Tùy chọn hồ sơ</Text>

          {options.map((option, index) => (
            <View key={option.key}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={option.onPress}
                style={styles.sheetOption}
              >
                <Ionicons
                  name={option.iconName}
                  size={20}
                  color={option.destructive ? '#EF4444' : '#374151'}
                  style={{ marginRight: 14 }}
                />
                <Text
                  style={[
                    styles.sheetOptionText,
                    option.destructive && styles.sheetOptionTextDanger,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
              {index < options.length - 1 ? <View style={styles.sheetDivider} /> : null}
            </View>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

import { isUserOnline } from '../utils/presence';

function formatTimeShort48h(dateString) {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (isNaN(diffMs)) return null;

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  if (diffMs > FORTY_EIGHT_HOURS_MS) {
    return null; // Hide badge if over 48 hours
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 5) return 'vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays <= 2) return `${diffDays} ngày`;

  return null;
}

export const ProfileHeaderCard = memo(function ProfileHeaderCard({ profile, isSelf = false, onOpenFollowList }) {
  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Người dùng VibeSport';
  const rawBio = profile?.bio;
  const bio = rawBio && rawBio.length > 60 ? `${rawBio.slice(0, 60)}...` : rawBio;

  let isOnline = false;
  if (isSelf) {
    isOnline = true;
  } else if (typeof profile?.isOnline === 'boolean') {
    isOnline = profile.isOnline;
  } else if (profile?.lastSeenAt) {
    isOnline = isUserOnline(profile.lastSeenAt);
  }

  const offlineText48h = !isOnline ? formatTimeShort48h(profile?.lastSeenAt) : null;

  const stats = profile?.stats || {};
  const matchesPlayed = stats.matchesPlayed ?? profile?.matchesPlayed ?? 0;
  const followerCount = profile?.followerCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const rating = Number(profile?.rating ?? stats.rating ?? 0) || 0;
  const ratingDisplay = rating > 0 ? `${rating.toFixed(0)}/5` : '5/5';

  return (
    <View style={styles.profileCardLeftLayout}>
      <View style={styles.profileTopRow}>
        <View style={styles.avatarColumnContainer}>
          <View style={styles.avatarStatusWrap}>
            <Avatar
              source={fixMediaUrl(profile?.picture)}
              name={displayName}
              size="md"
            />
            {isOnline ? (
              <View style={styles.onlineDotBadge} />
            ) : offlineText48h ? (
              <View style={styles.offlinePillBadge}>
                <Text style={styles.offlinePillText}>{offlineText48h}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.avatarRatingBadge}>
            <Text style={styles.avatarRatingText}>{ratingDisplay}</Text>
            <Ionicons name="star" size={11} color="#F59E0B" />
          </View>
        </View>

        <View style={styles.profileRightContent}>
          <Text style={styles.profileNameLeft} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.statsInlineRow}>
            <View style={styles.statInlineItem}>
              <Text style={styles.statInlineValue}>{matchesPlayed}</Text>
              <Text style={styles.statInlineLabel}>trận đã chơi</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onOpenFollowList?.('followers')}
              style={styles.statInlineItem}
            >
              <Text style={styles.statInlineValue}>{followerCount}</Text>
              <Text style={styles.statInlineLabel}>người theo dõi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onOpenFollowList?.('following')}
              style={styles.statInlineItem}
            >
              <Text style={styles.statInlineValue}>{followingCount}</Text>
              <Text style={styles.statInlineLabel}>đang theo dõi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {bio ? (
        <Text style={styles.profileBioBottom} numberOfLines={2}>
          {bio}
        </Text>
      ) : null}
    </View>
  );
});

export function EmptyState({ iconName, title, loading }) {
  if (loading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="small" color={primary.DEFAULT} />
        <Text style={styles.emptyText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <Ionicons name={iconName} size={spacing['4xl']} color={text.hint} />
      <Text style={styles.emptyText}>{title}</Text>
    </View>
  );
}

function formatCount(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1000) {
    const val = num / 1000;
    return val % 1 === 0 ? `${val} K` : `${val.toFixed(1)} K`;
  }
  return String(num);
}

export const ProfilePostCard = memo(function ProfilePostCard({
  post,
  profile,
  onOpenPost,
  onOpenAuthor,
  onToggleLike,
  onShare,
  onOpenMenu,
}) {
  const author = post.userId && typeof post.userId === 'object' ? post.userId : null;
  const authorId = author?._id || author?.id || post.userId;
  const profileId = profile?._id || profile?.id;
  const belongsToProfile = Boolean(
    profileId
    && authorId
    && String(profileId) === String(authorId)
  );
  const authorName = author?.name || (belongsToProfile ? profile?.name : null) || 'Thành viên VibeSport';
  const authorPicture = author?.picture || (belongsToProfile ? profile?.picture : null);
  const isLiked = Boolean(post.isLiked);

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity activeOpacity={0.78} onPress={() => onOpenAuthor?.(post)}>
          <Avatar
            source={fixMediaUrl(authorPicture)}
            name={authorName}
            size="sm"
          />
        </TouchableOpacity>
        <View style={styles.postAuthorBlock}>
          <TouchableOpacity activeOpacity={0.78} onPress={() => onOpenAuthor?.(post)}>
            <Text style={styles.postAuthorName} numberOfLines={1}>
              {authorName}
            </Text>
          </TouchableOpacity>
          <Text style={styles.postTime}>{formatTime(post.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.postMenuButton} activeOpacity={0.7} onPress={() => onOpenMenu?.(post)}>
          <Ionicons name="ellipsis-horizontal" size={20} color={icon.dark} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.86} onPress={() => onOpenPost(post)}>
        {post.content ? (
          <Text style={styles.postContent}>{post.content}</Text>
        ) : null}
        {post.mediaUrls?.length ? (
          <View style={styles.postImagesWrap}>
            <PostImages images={post.mediaUrls.map(fixMediaUrl)} />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.postDivider} />

      <View style={styles.postActionRow}>
        <TouchableOpacity
          activeOpacity={0.76}
          onPress={() => onToggleLike(post)}
          style={styles.postActionButton}
        >
          {isLiked ? (
            <Ionicons name="heart" size={spacing.lg} color="#EF4444" />
          ) : (
            <Ionicons name="heart-outline" size={spacing.lg} color={surface.muted} />
          )}
          <Text
            style={[
              styles.postActionText,
              isLiked && { color: '#EF4444' },
            ]}
          >
            {formatCount(post.likesCount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.76}
          onPress={() => onOpenPost(post)}
          style={styles.postActionButton}
        >
          <Ionicons name="chatbubble-outline" size={spacing.lg} color={surface.muted} />
          <Text style={styles.postActionText}>{formatCount(post.commentsCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.76}
          onPress={() => onShare(post)}
          style={styles.postActionButton}
        >
          <Ionicons name="share-social-outline" size={spacing.lg} color={surface.muted} />
          <Text style={styles.postActionText}>{formatCount(post.sharesCount || 0)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export const TeamCard = memo(function TeamCard({ team }) {
  const logoUrl = team.logo ? fixMediaUrl(team.logo) : null;

  return (
    <View style={styles.teamCard}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.teamLogo} />
      ) : (
        <View style={styles.teamLogoPlaceholder}>
          <MaterialCommunityIcons name="shield-half-full" size={spacing.xl} color={primary.DEFAULT} />
        </View>
      )}
      <View style={styles.teamInfo}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.teamMeta} numberOfLines={1}>
          {team.role || 'Thành viên'}{team.sport ? ` · ${team.sport}` : ''}
        </Text>
        {formatTeamPeriod(team) ? (
          <Text style={styles.teamMeta} numberOfLines={1}>
            {formatTeamPeriod(team)}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

function getMatchStatusMeta(status) {
  switch (status) {
    case 'completed':
      return { label: 'Đã kết thúc', color: '#0f766e', backgroundColor: '#ccfbf1' };
    case 'full':
      return { label: 'Đủ người', color: '#b45309', backgroundColor: '#ffedd5' };
    case 'cancelled':
      return { label: 'Đã hủy', color: '#b91c1c', backgroundColor: '#fee2e2' };
    case 'open':
    default:
      return { label: 'Đang mở', color: '#1d4ed8', backgroundColor: '#dbeafe' };
  }
}

function formatMatchDateTime(match) {
  const parts = [match.date, match.startTime].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Chưa cập nhật thời gian';
}

export const MatchHistoryCard = memo(function MatchHistoryCard({ match, userId }) {
  const creatorId = match.createdBy?._id || match.createdBy;
  const participantIds = (match.participants || []).map((participant) => String(participant?._id || participant));
  const isCreator = String(creatorId || '') === String(userId || '');
  const isParticipant = participantIds.includes(String(userId || ''));
  const statusMeta = getMatchStatusMeta(match.status);

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHeaderRow}>
        <View style={styles.matchTitleBlock}>
          <Text style={styles.matchTitle} numberOfLines={2}>
            {match.title || 'Trận đấu'}
          </Text>
          <Text style={styles.matchMeta} numberOfLines={1}>
            {match.sport === 'football' ? 'Bóng đá' : match.sport === 'badminton' ? 'Cầu lông' : match.sport === 'pickleball' ? 'Pickleball' : match.sport || 'Thể thao'}
          </Text>
        </View>
        <View style={[styles.matchStatusBadge, { backgroundColor: statusMeta.backgroundColor }]}> 
          <Text style={[styles.matchStatusText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      <Text style={styles.matchMeta} numberOfLines={1}>
        {match.locationName || 'Chưa cập nhật địa điểm'}
      </Text>
      <Text style={styles.matchMeta} numberOfLines={1}>
        {formatMatchDateTime(match)}
      </Text>

      <View style={styles.matchFooterRow}>
        <Text style={styles.matchMeta} numberOfLines={1}>
          {match.currentPlayers ?? match.participants?.length ?? 0}/{match.maxPlayers ?? 0} người
        </Text>
        <Text style={styles.matchMeta} numberOfLines={1}>
          {isCreator ? 'Bạn là chủ trận' : isParticipant ? 'Bạn đã tham gia' : 'Đã liên quan'}
        </Text>
      </View>
    </View>
  );
});

export function EditProfileModal({
  visible,
  user,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editBio,
  setEditBio,
  onPickAvatar,
  onClose,
  onSave,
  saving,
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.editOverlay}>
        <View style={styles.editSheet}>
          <View style={styles.editHeader}>
            <Text style={styles.editTitle}>Chỉnh sửa hồ sơ</Text>
            <TouchableOpacity onPress={onClose} hitSlop={spacing.sm}>
              <Feather name="x" size={spacing.xl} color={text.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ key: 'form' }]}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editBody}
            renderItem={() => (
              <>
                <View style={styles.avatarEditCenter}>
                  <TouchableOpacity activeOpacity={0.8} onPress={onPickAvatar} style={styles.avatarEditTouch}>
                    <Avatar source={user?.picture} name={user?.name} size="xl" />
                    <View style={styles.avatarEditOverlay}>
                      <MaterialCommunityIcons name="camera" size={18} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={onPickAvatar}>
                    <Text style={styles.changeAvatarBtnText}>Thay đổi ảnh đại diện</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Tên hiển thị</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nhập tên hiển thị"
                  placeholderTextColor={text.hint}
                  maxLength={30}
                />

                <Text style={styles.inputLabel}>Số điện thoại</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Nhập số điện thoại"
                  placeholderTextColor={text.hint}
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Mô tả ngắn (tối đa 60 ký tự)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  value={editBio}
                  onChangeText={(val) => setEditBio(val.slice(0, 60))}
                  placeholder="Viết vài dòng về bạn (tối đa 60 ký tự)"
                  placeholderTextColor={text.hint}
                  maxLength={60}
                  multiline
                />

                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalInputDisabled]}
                  value={user?.email || ''}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </>
            )}
          />

          <View style={styles.editFooter}>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={onClose}
              style={styles.cancelButton}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={onSave}
              style={styles.saveButton}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ProfileTabBar({ activeTab, onSelectTab, includeSaved = true }) {
  const tabs = [
    { key: 'posts', label: 'Bài viết', icon: 'newspaper-outline' },
    ...(includeSaved ? [{ key: 'saved', label: 'Bài đã lưu', icon: 'bookmark-outline' }] : []),
    { key: 'history', label: 'Lịch sử', icon: 'time-outline' },
  ];

  return (
    <View style={styles.tabBarContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.75}
            onPress={() => onSelectTab(tab.key)}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
          >
            <Ionicons
              name={isActive ? tab.icon.replace('-outline', '') : tab.icon}
              size={18}
              color={isActive ? primary.DEFAULT : '#6B7280'}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


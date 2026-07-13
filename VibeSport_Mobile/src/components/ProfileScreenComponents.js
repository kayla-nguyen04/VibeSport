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
import { TagIcon } from './TagIcon';
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

export const SPORTS = [
  { key: 'Bóng đá', label: 'Bóng đá' },
  { key: 'Cầu lông', label: 'Cầu lông' },
  { key: 'Pickleball', label: 'Pickleball' },
];

export const POSITION_OPTIONS = {
  'Bóng đá': ['Tiền đạo', 'Tiền vệ', 'Hậu vệ', 'Thủ môn'],
  'Cầu lông': ['Đơn', 'Đôi', 'Đôi nam', 'Đôi nữ'],
  Pickleball: ['Forehand', 'Backhand', 'Đôi'],
};


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
      key: 'saved',
      label: 'Lưu bài viết',
      iconName: 'bookmark-outline',
      onPress: onSavedPosts,
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

export const ProfileHeaderCard = memo(function ProfileHeaderCard({ profile, onPickAvatar }) {
  const rawDisplayName = profile?.name || profile?.email?.split('@')[0] || 'Người dùng VibeSport';
  const displayName = (rawDisplayName === 'Long Nguyên' || rawDisplayName === 'Long') ? 'Longabc' : rawDisplayName;
  const bio = profile?.bio || 'Chưa cập nhật tiểu sử';
  const isLongNguyen = displayName === 'Long Nguyen';

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileAvatarFrame}>
        <Avatar
          source={profile?.picture}
          name={displayName}
          size="xl"
          customBgColor={isLongNguyen ? status.danger : undefined}
          customInitials={isLongNguyen ? 'L.' : undefined}
        />
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.78}
          onPress={onPickAvatar}
          style={styles.cameraBadge}
        >
          <MaterialCommunityIcons name="pencil" size={14} color={background.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.profileName} numberOfLines={1}>
        {displayName}
      </Text>
      <Text style={styles.profileBio} numberOfLines={2}>
        {bio}
      </Text>

      <View style={styles.activePill}>
        <Text style={styles.activeText}>Đang hoạt động</Text>
      </View>
    </View>
  );
});

function StatColumn({ value, label, onPress }) {
  const content = (
    <>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={styles.statColumn}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.statColumn}>
      {content}
    </View>
  );
}

export const StatsCard = memo(function StatsCard({ profile, onOpenFollowList }) {
  const stats = profile?.stats || {};
  const rating = Number(profile?.rating ?? stats.rating ?? 0) || 0;
  const ratingDisplay = rating > 0 ? `${rating.toFixed(0)}/5` : '5/5';

  return (
    <View style={styles.statsCard2x2}>
      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onOpenFollowList('following')}
          style={styles.statCell}
        >
          <Text style={styles.statValue}>{profile?.followingCount ?? 0}</Text>
          <Text style={styles.statLabel}>Đang theo dõi</Text>
        </TouchableOpacity>

        <View style={styles.statVerticalDivider} />

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onOpenFollowList('followers')}
          style={styles.statCell}
        >
          <Text style={styles.statValue}>{profile?.followerCount ?? 0}</Text>
          <Text style={styles.statLabel}>Người theo dõi</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statHorizontalDivider} />

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{stats.matchesPlayed ?? 0}</Text>
          <Text style={styles.statLabel}>Trận đã chơi</Text>
        </View>

        <View style={styles.statVerticalDivider} />

        <View style={styles.statCell}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Text style={styles.statValue}>{ratingDisplay}</Text>
            <Ionicons name="star" size={14} color="#CCCCCC" />
          </View>
          <Text style={styles.statLabel}>Đánh giá</Text>
        </View>
      </View>
    </View>
  );
});

function InfoRow({ iconNode, label, value }) {
  return (
    <View style={styles.infoRowCard}>
      <View style={styles.infoIconWrap}>{iconNode}</View>
      <View style={styles.infoTextBlock}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>
          {value || 'Chưa cập nhật'}
        </Text>
      </View>
    </View>
  );
}

export const InfoCard = memo(function InfoCard({ profile }) {
  return (
    <View style={styles.infoSection}>
      <InfoRow
        iconNode={<TagIcon tagName={profile?.favoriteSport} size={spacing.xl} color={primary.DEFAULT} />}
        label="Môn thể thao ưa thích"
        value={profile?.favoriteSport}
      />
      <InfoRow
        iconNode={<MaterialCommunityIcons name="soccer-field" size={spacing.xl} color={primary.DEFAULT} />}
        label="Vị trí thi đấu ưa thích"
        value={profile?.position}
      />
      <InfoRow
        iconNode={<Ionicons name="location-outline" size={spacing.xl} color={primary.DEFAULT} />}
        label="Khu vực"
        value={profile?.area}
      />
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

export const ProfilePostCard = memo(function ProfilePostCard({ post, profile, onOpenPost, onToggleLike, onShare, onOpenMenu }) {
  const author = post.userId || {};
  const rawAuthorName = author.name || profile?.name || 'Thành viên VibeSport';
  const authorName = (rawAuthorName === 'Long Nguyên' || rawAuthorName === 'Long') ? 'Longabc' : rawAuthorName;
  const authorPicture = author.picture || profile?.picture;
  const isLiked = Boolean(post.isLiked);
  const isLongNguyen = authorName === 'Long Nguyen';

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar
          source={authorPicture}
          name={authorName}
          size="sm"
          customBgColor={isLongNguyen ? '#FF0000' : undefined}
        />
        <View style={styles.postAuthorBlock}>
          <Text style={styles.postAuthorName} numberOfLines={1}>
            {authorName}
          </Text>
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
          <Ionicons
            name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
            size={spacing.lg}
            color={isLiked ? primary.DEFAULT : surface.muted}
          />
          <Text
            style={[
              styles.postActionText,
              isLiked && styles.postActionTextActive,
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
  editFavoriteSport,
  setEditFavoriteSport,
  editPosition,
  setEditPosition,
  editArea,
  setEditArea,
  editBio,
  setEditBio,
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

                <Text style={styles.inputLabel}>Môn thể thao</Text>
                <View style={styles.optionRow}>
                  {SPORTS.map((sport) => (
                    <TouchableOpacity
                      key={sport.key}
                      activeOpacity={0.78}
                      onPress={() => {
                        setEditFavoriteSport(sport.key);
                        const positions = POSITION_OPTIONS[sport.key] || [];
                        setEditPosition(positions[0] || '');
                      }}
                      style={[
                        styles.optionCard,
                        editFavoriteSport === sport.key && styles.optionCardActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          editFavoriteSport === sport.key && styles.optionTextActive,
                        ]}
                      >
                        {sport.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Vị trí chơi</Text>
                <View style={styles.optionRow}>
                  {(POSITION_OPTIONS[editFavoriteSport] || []).map((posOption) => (
                    <TouchableOpacity
                      key={posOption}
                      activeOpacity={0.78}
                      onPress={() => setEditPosition(posOption)}
                      style={[
                        styles.positionCard,
                        editPosition === posOption && styles.optionCardActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          editPosition === posOption && styles.optionTextActive,
                        ]}
                      >
                        {posOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Khu vực</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editArea}
                  onChangeText={setEditArea}
                  placeholder="Ví dụ: Cầu Giấy, Hà Nội"
                  placeholderTextColor={text.hint}
                />

                <Text style={styles.inputLabel}>Mô tả ngắn</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Viết vài dòng về bạn"
                  placeholderTextColor={text.hint}
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


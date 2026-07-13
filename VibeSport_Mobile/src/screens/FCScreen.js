import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 190;

// ─── Mock data ────────────────────────────────────────────────────────────────
const FC_DATA = {
  name: 'FC VIBESPORT',
  type: 'Công khai',
  memberCount: '6.000 thành viên',
  postsPerDay: '100 N / ngày',
  description:
    'Chào mừng tất cả các anh em chiến binh và người hâm mộ đã đến với đại gia đình Vibespo',
  avatarColors: ['#E53935', '#E53935', '#E53935'],
};

const MOCK_POSTS = [
  {
    id: '1',
    author: 'Dũng Nguyễn',
    timeAgo: '15 giờ trước',
    content: 'Quá đỉnh anh em ơi !',
    images: [
      require('../../assets/post_soccer1.png'),
      require('../../assets/post_soccer2.png'),
    ],
    likes: '10 K',
    comments: '5 K',
    shares: '3 K',
  },
  {
    id: '2',
    author: 'Minh Tuấn',
    timeAgo: '1 ngày trước',
    content: 'Trận đấu hôm nay cực kỳ hay! 🔥⚽',
    images: [require('../../assets/post_soccer2.png')],
    likes: '8.2 K',
    comments: '2.1 K',
    shares: '1.5 K',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppHeader({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderLeft}>
          <Image
            source={require('../../assets/logosp.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>
            <Text style={styles.appTitleVibe}>F</Text>
            <Text style={styles.appTitleSport}>C</Text>
          </Text>
        </View>
        <View style={styles.appHeaderRight}>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <View>
              <Ionicons name="notifications-outline" size={22} color="#1a1a1a" />
              <View style={styles.notifDot} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FCBanner() {
  return (
    <View style={styles.bannerContainer}>
      <Image
        source={require('../../assets/fc_banner.png')}
        style={styles.bannerImage}
        resizeMode="cover"
      />
      <View style={styles.bannerOverlay} />
    </View>
  );
}

function AvatarStack({ colors }) {
  return (
    <View style={styles.avatarStack}>
      {colors.map((color, i) => (
        <View
          key={i}
          style={[
            styles.stackAvatar,
            { backgroundColor: color, marginLeft: i === 0 ? 0 : -10, zIndex: colors.length - i },
          ]}
        >
          <Text style={styles.stackAvatarText}>L</Text>
        </View>
      ))}
      <View style={[styles.stackAvatar, styles.stackAvatarMore, { marginLeft: -10 }]}>
        <Text style={styles.stackAvatarMoreText}>+</Text>
      </View>
    </View>
  );
}

function ClubHeaderCard() {
  return (
    <View style={styles.clubHeaderCard}>
      <View style={styles.clubLogoWrap}>
        <Image
          source={require('../../assets/logosp.png')}
          style={styles.clubLogo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.clubName}>{FC_DATA.name}</Text>
      <TouchableOpacity style={styles.moreBtn} activeOpacity={0.7}>
        <Text style={styles.moreDots}>•••</Text>
      </TouchableOpacity>
    </View>
  );
}

function ClubDetailsCard() {
  const [joined, setJoined] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.clubDetailsCard}>
      {/* Info Rows */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Nhóm: </Text>
        <Text style={styles.infoValue}>{FC_DATA.type}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Thành viên: </Text>
        <Text style={styles.infoValue}>{FC_DATA.memberCount}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Bài viết: </Text>
        <Text style={styles.infoValue}>{FC_DATA.postsPerDay}</Text>
      </View>

      {/* Avatar Stack */}
      <AvatarStack colors={FC_DATA.avatarColors} />

      {/* Join Button */}
      <TouchableOpacity
        style={[styles.joinBtn, joined && styles.joinBtnJoined]}
        activeOpacity={0.85}
        onPress={() => setJoined(!joined)}
      >
        <Text style={[styles.joinBtnText, joined && styles.joinBtnTextJoined]}>
          {joined ? '✓ Đã tham gia' : 'Tham Gia'}
        </Text>
      </TouchableOpacity>

      {/* Description */}
      <View style={styles.descRow}>
        <Text style={styles.descLabel}>Giới thiệu: </Text>
        <Text style={styles.descText} numberOfLines={expanded ? undefined : 2}>
          {FC_DATA.description}
        </Text>
        {!expanded && (
          <TouchableOpacity onPress={() => setExpanded(true)}>
            <Text style={styles.seeMore}> ... xem thêm</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PostCard({ post }) {
  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAvatarWrap}>
          <View style={styles.postClubAvatarRing}>
            <Image
              source={require('../../assets/logosp.png')}
              style={styles.postClubAvatar}
              resizeMode="contain"
            />
          </View>
          <View style={styles.postAuthorAvatar} />
        </View>

        <View style={styles.postMeta}>
          <Text style={styles.postClubNameText}>{FC_DATA.name}</Text>
          <View style={styles.postSubRow}>
            <Text style={styles.postAuthorName}>{post.author}</Text>
            <Ionicons name="people-outline" size={14} color="#f97316" />
            <Text style={styles.postTime}>{post.timeAgo}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.postMoreBtn}>
          <Text style={styles.moreDots}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post Images Container (Grey background with rounded corner items inside) */}
      {post.images && post.images.length > 0 && (
        <View style={styles.postImagesContainer}>
          <View style={styles.postImagesInnerGrid}>
            {post.images.map((img, i) => (
              <View key={i} style={styles.postImageWrapper}>
                <Image source={img} style={styles.postImage} resizeMode="cover" />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Interaction Row */}
      <View style={styles.interactionRow}>
        <TouchableOpacity style={styles.interactionBtn} activeOpacity={0.7}>
          <Ionicons name="thumbs-up-outline" size={20} color="#f97316" />
          <Text style={styles.interactionCount}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.interactionBtn} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={18} color="#111" />
          <Text style={styles.interactionCount}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.interactionBtn} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={18} color="#111" />
          <Text style={styles.interactionCount}>{post.shares}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FCScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AppHeader navigation={navigation} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <FCBanner />
        <ClubHeaderCard />
        <ClubDetailsCard />

        {/* Mới nhất section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mới nhất</Text>
        </View>

        {MOCK_POSTS.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // App Header
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 8 : 16,
    marginBottom: 0,
    height: 74,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appLogo: {
    width: 44,
    height: 44,
    marginRight: -6,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  appTitleVibe: {
    color: '#1a1a1a',
  },
  appTitleSport: {
    color: '#f97316',
  },
  appHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  // Banner
  bannerContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  // Club Header Card (Card 1)
  clubHeaderCard: {
    backgroundColor: '#ffffff',
    marginTop: -25,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  clubLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  clubLogo: {
    width: 38,
    height: 38,
  },
  clubName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.2,
  },
  moreBtn: {
    padding: 4,
  },
  moreDots: {
    fontSize: 16,
    color: '#111',
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Club Details Card (Card 2)
  clubDetailsCard: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  infoValue: {
    fontSize: 14,
    color: '#4b5563',
  },

  // Avatar Stack
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  stackAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stackAvatarMore: {
    backgroundColor: '#cbd5e1',
  },
  stackAvatarMoreText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },

  // Join button
  joinBtn: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinBtnJoined: {
    backgroundColor: '#e5e7eb',
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  joinBtnTextJoined: {
    color: '#374151',
  },

  // Description
  descRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  descLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111',
  },
  descText: {
    fontSize: 13.5,
    color: '#4b5563',
    flex: 1,
    lineHeight: 20,
  },
  seeMore: {
    fontSize: 13.5,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },

  // Post Card
  postCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postAvatarWrap: {
    position: 'relative',
    width: 48,
    height: 48,
    marginRight: 12,
  },
  postClubAvatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#f97316',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  postClubAvatar: {
    width: 34,
    height: 34,
  },
  postAuthorAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  postMeta: {
    flex: 1,
  },
  postClubNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
  },
  postSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  postAuthorName: {
    fontSize: 13,
    color: '#111',
    fontWeight: '700',
  },
  postTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  postMoreBtn: {
    padding: 6,
  },

  // Post content
  postContent: {
    fontSize: 14,
    color: '#111',
    lineHeight: 21,
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Post images container
  postImagesContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 8,
    marginBottom: 12,
  },
  postImagesInnerGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  postImageWrapper: {
    flex: 1,
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },

  // Interaction row
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 24,
  },
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interactionCount: {
    fontSize: 13.5,
    color: '#6b7280',
    fontWeight: '600',
  },
});

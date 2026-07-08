import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { HeaderIconButton } from '../components/ProfileScreenComponents';
import { getPostsRequest } from '../services/postApi';
import { icon, primary, spacing } from '../theme';
import { styles } from './ProfileScreen.styles';

const PAGE_SIZE = 10;

export default function ProfileManagementScreen({ navigation }) {
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id || user?._id;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const loadPosts = useCallback(async ({ refresh = false } = {}) => {
    if (!token || !userId) return;

    if (refresh) {
      pageRef.current = 1;
      setRefreshing(true);
    } else if (!posts.length) {
      setLoading(true);
    }

    try {
      const response = await getPostsRequest(refresh ? 1 : pageRef.current, PAGE_SIZE, token, null, userId);
      const nextPosts = response?.data || [];
      setPosts((current) => (refresh ? nextPosts : [...current, ...nextPosts]));
      setHasMore(nextPosts.length === PAGE_SIZE);
      pageRef.current = refresh ? 2 : pageRef.current + 1;
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải bài viết');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [posts.length, token, userId]);

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    pageRef.current = 1;
    loadPosts({ refresh: true });
  }, [loadPosts]);

  const handleRefresh = () => loadPosts({ refresh: true });
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadPosts();
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.managementItemCard} activeOpacity={0.8} onPress={() => navigation.navigate('PostDetail', { postId: item._id })}>
      <View style={styles.managementItemContent}>
        <Text style={styles.managementItemTitle} numberOfLines={1}>{item.content || 'Bài viết'}</Text>
        <Text style={styles.managementItemMeta}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'Mới'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={icon.dark} />
    </TouchableOpacity>
  );

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader style={styles.headerBar}>
        <View style={styles.headerSide}>
          <HeaderIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
        </View>
        <Text style={styles.headerTitle}>Quản lý trang cá nhân</Text>
        <View style={[styles.headerSide, styles.headerRightSide]} />
      </ScreenHeader>

      {loading && !posts.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải bài viết...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary.DEFAULT} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={<View style={styles.centerState}><Text style={styles.emptyText}>Chưa có bài viết nào</Text></View>}
          ListFooterComponent={hasMore ? <ActivityIndicator size="small" color={primary.DEFAULT} style={{ marginVertical: 12 }} /> : null}
        />
      )}
    </Screen>
  );
}

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { HeaderIconButton } from '../components/ProfileScreenComponents';
import { getMatches } from '../services/matchService';
import { icon, primary, spacing } from '../theme';
import { styles } from './ProfileScreen.styles';

export default function MatchHistoryScreen({ navigation }) {
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id || user?._id;

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async ({ refresh = false } = {}) => {
    if (!token || !userId) return;

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getMatches({ createdBy: userId });
      setMatches(Array.isArray(response) ? response : []);
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải lịch sử trận đấu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMatches({ refresh: true });
  }, [token, userId]);

  const renderItem = ({ item }) => (
    <View style={styles.matchCard}>
      <View style={styles.matchHeaderRow}>
        <View style={styles.matchTitleBlock}>
          <Text style={styles.matchTitle}>{item.title || 'Trận đấu'}</Text>
          <Text style={styles.teamMeta}>{item.location || 'Địa điểm chưa cập nhật'}</Text>
        </View>
        <View style={[styles.matchStatusBadge, { backgroundColor: item.status === 'completed' ? '#E8F5E9' : '#FFF3E0' }]}>
          <Text style={styles.matchStatusText}>{item.status === 'completed' ? 'Hoàn thành' : 'Sắp tới'}</Text>
        </View>
      </View>
      <View style={styles.matchFooterRow}>
        <Text style={styles.teamMeta}>{item.date ? new Date(item.date).toLocaleDateString('vi-VN') : 'Chưa có thời gian'}</Text>
        <Text style={styles.teamMeta}>{item.participants?.length || 0} người</Text>
      </View>
    </View>
  );

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader style={styles.headerBar}>
        <View style={styles.headerSide}>
          <HeaderIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={spacing.xl} color={icon.dark} />
          </HeaderIconButton>
        </View>
        <Text style={styles.headerTitle}>Lịch sử trận đấu</Text>
        <View style={[styles.headerSide, styles.headerRightSide]} />
      </ScreenHeader>

      {loading && !matches.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải lịch sử trận đấu...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item, index) => item._id || `${item.title}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMatches({ refresh: true })} tintColor={primary.DEFAULT} />}
          ListEmptyComponent={<View style={styles.centerState}><Text style={styles.emptyText}>Chưa có lịch sử trận đấu</Text></View>}
        />
      )}
    </Screen>
  );
}

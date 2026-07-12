import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { HeaderIconButton } from '../components/ProfileScreenComponents';
import { getUserTeamsRequest } from '../services/userApi';
import { icon, primary, spacing } from '../theme';
import { styles } from './ProfileScreen.styles';

export default function ClubManagementScreen({ navigation }) {
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);
  const userId = user?.id || user?._id;

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTeams = async ({ refresh = false } = {}) => {
    if (!token || !userId) return;

    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getUserTeamsRequest(userId, token);
      setTeams(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      Alert.alert('Lỗi', error?.message || 'Không thể tải danh sách FC');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTeams({ refresh: true });
  }, [token, userId]);

  const renderItem = ({ item }) => (
    <View style={styles.teamCard}>
      <View style={styles.teamLogoPlaceholder}>
        <Ionicons name="people" size={24} color={primary.DEFAULT} />
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{item.name || 'FC'}</Text>
        <Text style={styles.teamMeta}>{item.role || 'Thành viên'}</Text>
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
        <Text style={styles.headerTitle}>Quản lý FC</Text>
        <View style={[styles.headerSide, styles.headerRightSide]} />
      </ScreenHeader>

      {loading && !teams.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={primary.DEFAULT} />
          <Text style={styles.emptyText}>Đang tải danh sách FC...</Text>
        </View>
      ) : (
        <FlatList
          data={teams}
          keyExtractor={(item, index) => item._id || `${item.name}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTeams({ refresh: true })} tintColor={primary.DEFAULT} />}
          ListEmptyComponent={<View style={styles.centerState}><Text style={styles.emptyText}>Chưa có FC nào</Text></View>}
        />
      )}
    </Screen>
  );
}

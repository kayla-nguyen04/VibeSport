import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { hydrateSession, updateProfile } from '../redux/authSlice';

const ICON_NAMES = {
  'Bóng đá': 'soccer',
  'Cầu lông': 'badminton',
  Pickleball: 'tennis',
};

const SPORTS = [
  {
    key: 'Bóng đá',
    label: 'Bóng đá',
    positions: ['Tiền đạo', 'Tiền vệ', 'Hậu vệ', 'Thủ môn'],
    description: 'Bóng đá là môn đồng đội 11 người, nhấn mạnh chiến thuật, phối hợp và kỹ năng kiểm soát bóng.',
  },
  {
    key: 'Cầu lông',
    label: 'Cầu lông',
    positions: ['Đơn', 'Đôi', 'Đôi nam', 'Đôi nữ'],
    description: 'Cầu lông là môn đối kháng nhanh, cần phản xạ, chính xác và di chuyển linh hoạt với vợt nhẹ.',
  },
  {
    key: 'Pickleball',
    label: 'Pickleball',
    positions: ['Forehand', 'Backhand', 'Đôi'],
    description: 'Pickleball kết hợp tennis và ping-pong trên sân nhỏ, phù hợp cho cả đôi và đơn với nhịp độ nhanh.',
  },
];

export default function ProfileSetupScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);

  const handleShowSportInfo = () => {
    const primarySport = selectedSports[0] || 'Bóng đá';
    const selectedSportData = SPORTS.find((sport) => sport.key === primarySport) || SPORTS[0];
    Alert.alert(selectedSportData.label, selectedSportData.description);
  };

  const positionOptions = useMemo(() => {
    const positions = selectedSports.flatMap((sportKey) => {
      const sport = SPORTS.find((item) => item.key === sportKey);
      return sport ? sport.positions : [];
    });

    return Array.from(new Set(positions));
  }, [selectedSports]);

  const primarySport = selectedSports[0] || 'Bóng đá';
  const selectedSportData = SPORTS.find((sport) => sport.key === primarySport) || SPORTS[0];

  // Filter out selected positions that are no longer valid when sports selection changes
  useEffect(() => {
    setSelectedPositions((current) =>
      current.filter((pos) => positionOptions.includes(pos))
    );
  }, [positionOptions]);

  // Load user data on mount
  useEffect(() => {
    const sportsFromUser = user?.favoriteSports?.length
      ? user.favoriteSports
      : user?.favoriteSport
        ? [user.favoriteSport]
        : [];

    if (sportsFromUser.length) {
      setSelectedSports(sportsFromUser);
    }
    if (user?.position) {
      setSelectedPositions(user.position.split(', ').filter(Boolean));
    }
    if (user?.area) {
      setArea(user.area);
    }
  }, [user]);

  // Receive location from MapPicker when user comes back
  useFocusEffect(
    useCallback(() => {
      const loc = route?.params?.selectedLocation;
      if (loc) {
        setArea(loc.address || '');
        navigation.setParams({ selectedLocation: undefined });
      }
    }, [navigation, route?.params?.selectedLocation])
  );

  const toggleSport = (sportKey) => {
    setSelectedSports((current) =>
      current.includes(sportKey)
        ? current.filter((key) => key !== sportKey)
        : [...current, sportKey]
    );
  };

  const togglePosition = (pos) => {
    setSelectedPositions((current) =>
      current.includes(pos)
        ? current.filter((item) => item !== pos)
        : [...current, pos]
    );
  };

  const handlePickLocation = () => {
    navigation.navigate('AreaPicker', {
      returnTo: 'CompleteProfile',
      currentAddress: area || '',
    });
  };

  const handleSubmit = async () => {
    if (!selectedSports.length || !selectedPositions.length || !area.trim()) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một môn thể thao, vị trí và khu vực.');
      return;
    }

    setLoading(true);
    try {
      await dispatch(
        updateProfile({
          userId: user?.id || user?._id,
          favoriteSport: selectedSports[0] || null,
          favoriteSports: selectedSports,
          position: selectedPositions.join(', '),
          area: area.trim(),
          profileCompleted: true,
        })
      ).unwrap();

      await dispatch(hydrateSession());

      Alert.alert('Hoàn tất', 'Thông tin của bạn đã được lưu.', [
        {
          text: 'Tiếp tục',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }),
        },
      ]);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể lưu thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <BackButton onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
              }
            }} />
            <Text style={styles.stepText}>Bước 1/1</Text>
          </View>

          <Text style={styles.title}>Hoàn thiện hồ sơ</Text>
          <Text style={styles.subtitle}>Chúng tôi cần thêm một số thông tin để cá nhân hóa trải nghiệm.</Text>

          <View style={styles.sportPreview}>
            <View style={styles.sportIconBox}>
              <MaterialCommunityIcons
                name={ICON_NAMES[primarySport] || 'sports'}
                size={26}
                color="#ffffff"
              />
            </View>
            <View style={styles.previewTextWrap}>
              <Text style={styles.previewLabel}>Môn thể thao của bạn</Text>
              <Text style={styles.previewSport}>
                {selectedSports.length ? selectedSports.join(' • ') : 'Chọn ít nhất 1 môn'}
              </Text>
            </View>
            <TouchableOpacity style={styles.infoIconWrap} onPress={handleShowSportInfo}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Môn thể thao yêu thích (có thể chọn nhiều)</Text>
          <View style={styles.optionRow}>
            {SPORTS.map((sport) => {
              const isSelected = selectedSports.includes(sport.key);
              return (
                <TouchableOpacity
                  key={sport.key}
                  onPress={() => toggleSport(sport.key)}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={ICON_NAMES[sport.key] || 'sports'}
                    size={18}
                    color={isSelected ? '#4f46e5' : '#6b7280'}
                    style={styles.optionIcon}
                  />
                  <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Vị trí thi đấu (có thể chọn nhiều)</Text>
          <View style={styles.optionRow}>
            {positionOptions.length ? (
              positionOptions.map((positionOption) => {
                const isSelected = selectedPositions.includes(positionOption);
                return (
                  <TouchableOpacity
                    key={positionOption}
                    onPress={() => togglePosition(positionOption)}
                    style={[
                      styles.positionCard,
                      isSelected && styles.positionCardActive,
                    ]}
                  >
                    <Text style={[styles.positionText, isSelected && styles.positionTextActive]}>
                      {positionOption}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.helperText}>Chọn ít nhất một môn thể thao để hiện các vị trí phù hợp.</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>Khu vực</Text>
          {area ? (
            <View style={[styles.locationBlock, styles.locationBlockActive]}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#10b981" />
              <Text style={[styles.locationText, styles.locationTextActive]} numberOfLines={2}>
                {area}
              </Text>
              <TouchableOpacity onPress={() => setArea('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.locationBlock}
              onPress={handlePickLocation}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#6b7280" />
              <Text style={styles.locationText}>
                Chọn khu vực (Tỉnh, Quận, Xã...)
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Đang lưu...' : 'Hoàn tất'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fe',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  stepText: {
    color: '#6b7280',
    fontSize: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  optionCard: {
    flexBasis: '31%',
    maxWidth: '31%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionCardActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  optionText: {
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
  optionTextActive: {
    color: '#4f46e5',
  },
  sportPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
  },
  sportIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  previewTextWrap: {
    flex: 1,
  },
  infoIconWrap: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  previewLabel: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  previewSport: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  optionIcon: {
    marginBottom: 8,
  },
  positionCard: {
    flexBasis: '48%',
    maxWidth: '48%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  positionCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  positionText: {
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
  positionTextActive: {
    color: '#2563eb',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  locationBlock: {
    flexDirection: 'row',
    alignItems: "center",
    gap: 10,
    width: '100%',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    marginBottom: 28,
  },
  locationBlockActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  locationText: {
    flex: 1,
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '500',
  },
  locationTextActive: {
    color: '#10b981',
  },
  button: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

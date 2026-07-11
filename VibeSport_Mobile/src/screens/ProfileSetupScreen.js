import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { BackButton } from '../components/BackButton';
import { Screen } from '../components/Screen';
import { hydrateSession, updateProfile } from '../redux/authSlice';

const ACCENT = '#FF6B35';
const BG = '#F5F5F5';

const ICON_NAMES = {
  'Bóng đá': 'soccer',
  'Cầu lông': 'badminton',
  Pickleball: 'table-tennis',
};

const SPORTS = [
  {
    key: 'Bóng đá',
    label: 'BÓNG ĐÁ',
    positions: ['Tiền đạo', 'Tiền vệ', 'Hậu vệ', 'Thủ môn'],
    description:
      'Bóng đá là môn đồng đội 11 người, nhấn mạnh chiến thuật, phối hợp và kỹ năng kiểm soát bóng.',
  },
  {
    key: 'Cầu lông',
    label: 'CẦU LÔNG',
    positions: ['Đơn', 'Đôi', 'Đôi nam', 'Đôi nữ'],
    description:
      'Cầu lông là môn đối kháng nhanh, cần phản xạ, chính xác và di chuyển linh hoạt với vợt nhẹ.',
  },
  {
    key: 'Pickleball',
    label: 'PICKLEBALL',
    positions: ['Forehand', 'Backhand', 'Đôi'],
    description:
      'Pickleball kết hợp tennis và ping-pong trên sân nhỏ, phù hợp cho cả đôi và đơn với nhịp độ nhanh.',
  },
];

export default function ProfileSetupScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [sportIndex, setSportIndex] = useState(0);
  const [selectedSports, setSelectedSports] = useState(['Bóng đá']);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [area, setArea] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedSport = SPORTS[sportIndex];

  // Aggregate playing positions from all selected sports
  const positionOptions = useMemo(() => {
    const options = [];
    selectedSports.forEach((sportKey) => {
      const sportObj = SPORTS.find((s) => s.key === sportKey);
      if (sportObj) {
        sportObj.positions.forEach((pos) => {
          if (!options.includes(pos)) {
            options.push(pos);
          }
        });
      }
    });
    return options;
  }, [selectedSports]);

  // Load user data on mount
  useEffect(() => {
    const sportsFromUser = user?.favoriteSports?.length
      ? user.favoriteSports
      : user?.favoriteSport
        ? [user.favoriteSport]
        : [];

    if (sportsFromUser.length) {
      setSelectedSports(sportsFromUser);
      const idx = SPORTS.findIndex((s) => s.key === sportsFromUser[0]);
      if (idx >= 0) setSportIndex(idx);
    } else {
      setSelectedSports(['Bóng đá']);
      setSportIndex(0);
    }

    if (user?.position) {
      const posArray = user.position.split(',').map(p => p.trim()).filter(Boolean);
      setSelectedPositions(posArray);
    }
    if (user?.area) setArea(user.area);
    if (user?.bio) setBio(user.bio);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const loc = route?.params?.selectedLocation;
      if (loc) {
        setArea(loc.address || '');
        navigation.setParams({ selectedLocation: undefined });
      }
    }, [navigation, route?.params?.selectedLocation])
  );

  const goPrevSport = () => {
    setSportIndex((i) => (i - 1 + SPORTS.length) % SPORTS.length);
  };

  const goNextSport = () => {
    setSportIndex((i) => (i + 1) % SPORTS.length);
  };

  const toggleSport = (sportKey) => {
    setSelectedSports((prev) => {
      if (prev.includes(sportKey)) {
        if (prev.length <= 1) return prev; // Keep at least one sport
        return prev.filter((s) => s !== sportKey);
      } else {
        return [...prev, sportKey];
      }
    });
  };

  const togglePosition = (pos) => {
    setSelectedPositions((prev) => {
      if (prev.includes(pos)) {
        return prev.filter((p) => p !== pos);
      } else {
        return [...prev, pos];
      }
    });
  };

  const handleShowSportInfo = () => {
    Alert.alert(selectedSport.label, selectedSport.description);
  };

  const handlePickLocation = () => {
    navigation.navigate('AreaPicker', {
      returnTo: 'CompleteProfile',
      currentAddress: area || '',
    });
  };

  const handleSkip = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleSubmit = async () => {
    if (selectedSports.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một môn thể thao.');
      return;
    }
    if (selectedPositions.length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một vị trí thi đấu.');
      return;
    }
    if (!area.trim()) {
      Alert.alert('Lỗi', 'Vui lòng chọn khu vực.');
      return;
    }

    setLoading(true);
    try {
      await dispatch(
        updateProfile({
          userId: user?.id || user?._id,
          favoriteSport: selectedSports[0],
          favoriteSports: selectedSports,
          position: selectedPositions.join(', '),
          area: area.trim(),
          bio: bio.trim(),
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
          {/* Header */}
          <View style={styles.header}>
            <BackButton
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
                }
              }}
            />
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Hoàn thiện hồ sơ</Text>
              <View style={styles.titleUnderline} />
            </View>
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.skipText}>Skip &gt;</Text>
            </TouchableOpacity>
          </View>

          {/* Sport carousel */}
          <Text style={styles.sectionLabel}>Chọn môn thể thao yêu thích</Text>
          <View style={styles.sportCarousel}>
            <TouchableOpacity style={styles.carouselArrow} onPress={goPrevSport} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color="#000" />
            </TouchableOpacity>

            <View style={styles.sportIconsRow}>
              {SPORTS.map((sport, idx) => {
                const isSelected = selectedSports.includes(sport.key);
                const boxSize = 72;
                const iconSize = 30;

                return (
                  <View key={sport.key} style={{ width: boxSize, height: boxSize, position: 'relative' }}>
                    {/* Retro shadow */}
                    <View
                      style={[
                        styles.shadowBg,
                        {
                          top: 4,
                          left: 4,
                          right: -4,
                          bottom: -4,
                          borderRadius: 16,
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setSportIndex(idx);
                        toggleSport(sport.key);
                      }}
                      activeOpacity={0.9}
                      style={[
                        styles.sportIconBox,
                        {
                          width: boxSize,
                          height: boxSize,
                          borderRadius: 16,
                          transform: isSelected ? [{ translateX: 2 }, { translateY: 2 }] : [],
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={ICON_NAMES[sport.key] || 'sports'}
                        size={iconSize}
                        color={isSelected ? ACCENT : '#000000'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.carouselArrow} onPress={goNextSport} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.sportNameRow}>
            <View style={{ position: 'relative' }}>
              <View style={[styles.shadowBg, { top: 4, left: 4, right: -4, bottom: -4, borderRadius: 24 }]} />
              <View style={styles.sportNamePill}>
                <Text style={styles.sportNameText}>{selectedSport.label}</Text>
              </View>
            </View>
            
            <View style={{ position: 'relative', width: 34, height: 34 }}>
              <View style={[styles.shadowBg, { top: 4, left: 4, right: -4, bottom: -4, borderRadius: 17 }]} />
              <TouchableOpacity style={styles.infoBtn} onPress={handleShowSportInfo} activeOpacity={0.9}>
                <Ionicons name="help-circle-outline" size={22} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Positions */}
          <Text style={styles.sectionLabel}>Chọn vị trí thi đấu yêu thích</Text>
          <View style={styles.positionGrid}>
            {positionOptions.map((pos) => {
              const isSelected = selectedPositions.includes(pos);
              return (
                <View key={pos} style={styles.positionCardWrapper}>
                  {/* Retro shadow */}
                  <View
                    style={[
                      styles.shadowBg,
                      {
                        top: 4,
                        left: 4,
                        right: -4,
                        bottom: -4,
                        borderRadius: 14,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => togglePosition(pos)}
                    activeOpacity={0.9}
                    style={[
                      styles.positionCardFront,
                      {
                        transform: isSelected ? [{ translateX: 2 }, { translateY: 2 }] : [],
                      },
                    ]}
                  >
                    <Text style={[styles.positionText, isSelected && styles.positionTextActive]}>
                      {pos}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Area */}
          <Text style={styles.sectionLabel}>Chọn vị khu vực của bạn</Text>
          <View style={styles.areaInputWrapper}>
            <View style={[styles.shadowBg, { top: 4, left: 4, right: -4, bottom: -4, borderRadius: 14 }]} />
            <TouchableOpacity style={styles.inputBlock} onPress={handlePickLocation} activeOpacity={0.9}>
              <Ionicons name="location-outline" size={22} color="#000" />
              <Text
                style={[styles.inputPlaceholder, area ? styles.inputValue : null]}
                numberOfLines={2}
              >
                {area || 'Chọn khu vực (Tỉnh, Quận, Xã, ...)'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <Text style={styles.sectionLabel}>Mô tả về bạn</Text>
          <TextInput
            style={styles.bioInput}
            placeholder="Giới thiệu về bản thân"
            placeholderTextColor="#bbb"
            value={bio}
            onChangeText={setBio}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />

          <View style={styles.submitBtnWrapper}>
            <View style={[styles.shadowBg, { top: 4, left: 4, right: -4, bottom: -4, borderRadius: 14 }]} />
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Hoàn tất</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingTop: 4,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  titleUnderline: {
    marginTop: 4,
    width: 120,
    height: 2,
    backgroundColor: '#0b74ff', // Blue underline to match mockup
    borderRadius: 1,
  },
  skipText: {
    fontSize: 13,
    color: '#aaa',
    fontWeight: '500',
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 14,
  },

  sportCarousel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  carouselArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportIconsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 100,
  },
  shadowBg: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  sportIconBox: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sportNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    gap: 10,
  },
  sportNamePill: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  sportNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.5,
  },
  infoBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  positionCardWrapper: {
    width: '47%',
    marginBottom: 16,
    position: 'relative',
  },
  positionCardFront: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  positionTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },

  areaInputWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  inputBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#888',
  },
  inputValue: {
    color: '#000',
    fontWeight: '500',
  },

  bioInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 100,
    fontSize: 14,
    color: '#333',
    marginBottom: 28,
  },

  submitBtnWrapper: {
    position: 'relative',
    width: '100%',
  },
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

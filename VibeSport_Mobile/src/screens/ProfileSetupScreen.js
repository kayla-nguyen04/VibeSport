import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { BackButton } from '../components/BackButton';
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

export default function ProfileSetupScreen({ navigation }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [favoriteSport, setFavoriteSport] = useState(user?.favoriteSport ?? 'Bóng đá');
  const [position, setPosition] = useState(user?.position ?? 'Tiền đạo');
  const [area, setArea] = useState(user?.area ?? '');
  const [loading, setLoading] = useState(false);

  const handleShowSportInfo = () => {
    const selectedSportData = SPORTS.find((sport) => sport.key === favoriteSport) || SPORTS[0];
    Alert.alert(selectedSportData.label, selectedSportData.description);
  };

  useEffect(() => {
    const selectedSport = SPORTS.find((sport) => sport.key === favoriteSport) || SPORTS[0];
    if (!selectedSport.positions.includes(position)) {
      setPosition(selectedSport.positions[0]);
    }
  }, [favoriteSport]);

  const selectedSport = SPORTS.find((sport) => sport.key === favoriteSport) || SPORTS[0];

  useEffect(() => {
    if (user?.favoriteSport) {
      setFavoriteSport(user.favoriteSport);
    }
    if (user?.position) {
      setPosition(user.position);
    }
    if (user?.area) {
      setArea(user.area);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!favoriteSport || !position || !area.trim()) {
      Alert.alert('Lỗi', 'Vui lòng chọn môn thể thao, vị trí và điền khu vực.');
      return;
    }

    setLoading(true);
    try {
      const updatedUser = await dispatch(
        updateProfile({
          userId: user?.id || user?._id,
          favoriteSport,
          position,
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 24}
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
                name={ICON_NAMES[favoriteSport] || 'sports'}
                size={26}
                color="#ffffff"
              />
            </View>
            <View style={styles.previewTextWrap}>
              <Text style={styles.previewLabel}>Môn thể thao của bạn</Text>
              <Text style={styles.previewSport}>{selectedSport.label}</Text>
            </View>
            <TouchableOpacity style={styles.infoIconWrap} onPress={handleShowSportInfo}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Môn thể thao yêu thích</Text>
          <View style={styles.optionRow}>
            {SPORTS.map((sport) => (
              <TouchableOpacity
                key={sport.key}
                onPress={() => setFavoriteSport(sport.key)}
                style={[
                  styles.optionCard,
                  favoriteSport === sport.key && styles.optionCardActive,
                ]}
              >
                <MaterialCommunityIcons
                  name={ICON_NAMES[sport.key] || 'sports'}
                  size={18}
                  color={favoriteSport === sport.key ? '#4f46e5' : '#6b7280'}
                  style={styles.optionIcon}
                />
                <Text style={[styles.optionText, favoriteSport === sport.key && styles.optionTextActive]}>
                  {sport.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Vị trí thi đấu</Text>
          <View style={styles.optionRow}> 
            {selectedSport.positions.map((positionOption) => (
              <TouchableOpacity
                key={positionOption}
                onPress={() => setPosition(positionOption)}
                style={[
                  styles.positionCard,
                  position === positionOption && styles.positionCardActive,
                ]}
              >
                <Text style={[styles.positionText, position === positionOption && styles.positionTextActive]}>
                  {positionOption}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Khu vực</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: Đống Đa, Hà Nội"
            placeholderTextColor="#9ca3af"
            value={area}
            onChangeText={setArea}
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Đang lưu...' : 'Hoàn tất'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  input: {
    width: '100%',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
    marginBottom: 28,
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

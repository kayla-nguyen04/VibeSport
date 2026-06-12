import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const ICON_FAMILIES = {
  Ionicons,
  MaterialCommunityIcons,
};

// Map tên tag tiếng Việt → icon vector (tên icon chỉ dùng nội bộ, không hiện UI)
const TAG_ICON_MAP = {
  'Bóng đá': { family: 'MaterialCommunityIcons', name: 'soccer' },
  'Bóng rổ': { family: 'MaterialCommunityIcons', name: 'basketball' },
  'Cầu lông': { family: 'MaterialCommunityIcons', name: 'badminton' },
  'Bóng chuyền': { family: 'MaterialCommunityIcons', name: 'volleyball' },
  'Bóng bàn': { family: 'MaterialCommunityIcons', name: 'table-tennis' },
  Tennis: { family: 'MaterialCommunityIcons', name: 'tennis' },
  Pickleball: { family: 'MaterialCommunityIcons', name: 'tennis-ball' },
  'Chạy bộ': { family: 'MaterialCommunityIcons', name: 'run' },
  'Bơi lội': { family: 'MaterialCommunityIcons', name: 'swim' },
  Gym: { family: 'MaterialCommunityIcons', name: 'dumbbell' },
  'Tìm đội': { family: 'Ionicons', name: 'people-outline' },
  'Giải đấu': { family: 'Ionicons', name: 'trophy-outline' },
  'Tập luyện': { family: 'Ionicons', name: 'clipboard-outline' },
  'Review sân': { family: 'Ionicons', name: 'location-outline' },
  'Tuyển thành viên': { family: 'Ionicons', name: 'megaphone-outline' },
};

export function TagIcon({ tagName, size = 14, color = '#FF6B35', style }) {
  const config = TAG_ICON_MAP[tagName] || { family: 'Ionicons', name: 'pricetag-outline' };
  const IconComponent = ICON_FAMILIES[config.family] || Ionicons;

  return <IconComponent name={config.name} size={size} color={color} style={style} />;
}

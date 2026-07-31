import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BackButton } from '../components/BackButton';

export function TermsPolicyScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('terms'); // 'terms' | 'privacy'

  return (
    <Screen edges={['top', 'left', 'right']} style={styles.screen}>
      <ScreenHeader style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Điều Khoản & Chính Sách</Text>
        <View style={{ width: 44 }} />
      </ScreenHeader>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('terms')}
          style={[styles.tabItem, activeTab === 'terms' && styles.activeTabItem]}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={activeTab === 'terms' ? '#FF5F3D' : '#6B7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'terms' && styles.activeTabText,
            ]}
          >
            Điều khoản dịch vụ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('privacy')}
          style={[styles.tabItem, activeTab === 'privacy' && styles.activeTabItem]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={activeTab === 'privacy' ? '#FF5F3D' : '#6B7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'privacy' && styles.activeTabText,
            ]}
          >
            Chính sách bảo mật
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'terms' ? (
          <View style={styles.contentCard}>
            <Text style={styles.lastUpdatedText}>Cập nhật lần cuối: 31/07/2026</Text>

            <Text style={styles.sectionTitle}>1. Giới thiệu chung</Text>
            <Text style={styles.paragraph}>
              Chào mừng bạn đến với mạng xã hội thể thao VibeSport. Khi đăng ký và sử dụng các dịch vụ tạo trận, ghép đội, đặt sân hoặc tham gia cộng đồng trên VibeSport, bạn đồng ý tuân thủ các điều khoản dịch vụ được quy định dưới đây.
            </Text>

            <Text style={styles.sectionTitle}>2. Quyền và trách nhiệm người dùng</Text>
            <Text style={styles.paragraph}>
              • Bạn cam kết cung cấp thông tin đăng ký chính xác (Họ tên, Số điện thoại, Email) và tự chịu trách nhiệm bảo mật mật khẩu cá nhân.{'\n'}
              • Tuyệt đối không giả mạo cá nhân, tổ chức hoặc sử dụng tài khoản vào các mục đích lừa đảo, gây mất an ninh trật tự.{'\n'}
              • Tự quản lý và bảo vệ tài sản cá nhân khi tham gia các trận đấu thể thao thực tế bên ngoài.
            </Text>

            <Text style={styles.sectionTitle}>3. Văn hóa tham gia trận đấu & Đặt sân</Text>
            <Text style={styles.paragraph}>
              • Tôn trọng đối thủ và đồng đội. VibeSport không chấp nhận bất kỳ hành vi bạo lực, xúc phạm hay khiêu khích nào trên sân.{'\n'}
              • Không hủy kèo trận đấu đột xuất gây ảnh hưởng đến các thành viên khác. Các tài khoản bùng kèo liên tục sẽ bị hệ thống tự động khóa tạm thời.{'\n'}
              • Tuân thủ nội quy riêng của từng cụm sân bóng, sân cầu lông hoặc pickleball nơi tổ chức trận đấu.
            </Text>

            <Text style={styles.sectionTitle}>4. Quy chuẩn nội dung cộng đồng</Text>
            <Text style={styles.paragraph}>
              • Không đăng tải bài viết, hình ảnh hoặc video có nội dung đồi trụy, vi phạm pháp luật hoặc thuần phong mỹ tục.{'\n'}
              • Nghiêm cấm hành vi đăng bài tin rác (spam), quảng cáo cá độ thể thao, cờ bạc trực tuyến trái phép.
            </Text>

            <Text style={styles.sectionTitle}>5. Quyền của Ban Quản Trị VibeSport</Text>
            <Text style={styles.paragraph}>
              VibeSport có quyền gỡ bỏ các bài viết vi phạm, tạm khóa hoặc xóa vĩnh viễn các tài khoản có hành vi gian lận, bùng kèo nhiều lần hoặc vi phạm nghiêm trọng tiêu chuẩn cộng đồng mà không cần báo trước.
            </Text>
          </View>
        ) : (
          <View style={styles.contentCard}>
            <Text style={styles.lastUpdatedText}>Cập nhật lần cuối: 31/07/2026</Text>

            <Text style={styles.sectionTitle}>1. Thu thập dữ liệu cá nhân</Text>
            <Text style={styles.paragraph}>
              Để mang lại trải nghiệm ghép trận và giao lưu thể thao tốt nhất, VibeSport thu thập một số thông tin cần thiết bao gồm:{'\n'}
              • Thông tin tài khoản: Họ tên, email, số điện thoại, ảnh đại diện.{'\n'}
              • Thông tin vị trí: Vị trí địa lý (nếu bạn cho phép) để tìm kiếm các trận đấu và cụm sân thể thao gần bạn nhất.
            </Text>

            <Text style={styles.sectionTitle}>2. Mục đích sử dụng thông tin</Text>
            <Text style={styles.paragraph}>
              • Gửi thông báo nhắc nhở lịch thi đấu, tin nhắn trò chuyện và thông báo tương tác bài viết.{'\n'}
              • Gợi ý đồng đội, đối thủ và các câu lạc bộ thể thao phù hợp với khu vực của bạn.{'\n'}
              • Cải thiện chất lượng dịch vụ, phòng chống lừa đảo và bảo vệ an toàn cho người dùng.
            </Text>

            <Text style={styles.sectionTitle}>3. Cam kết bảo mật dữ liệu</Text>
            <Text style={styles.paragraph}>
              • VibeSport cam kết KHÔNG bán, chia sẻ hoặc tiết lộ thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại.{'\n'}
              • Tất cả mật khẩu người dùng đều được mã hóa an toàn theo tiêu chuẩn mã hóa hiện đại.
            </Text>

            <Text style={styles.sectionTitle}>4. Quyền hạn của bạn đối với dữ liệu</Text>
            <Text style={styles.paragraph}>
              Bạn có quyền cập nhật, chỉnh sửa thông tin cá nhân hoặc yêu cầu gỡ bỏ tài khoản và toàn bộ dữ liệu liên quan bất kỳ lúc nào trong phần Cài đặt Hồ sơ hoặc liên hệ qua bộ phận CSKH.
            </Text>
          </View>
        )}

        <View style={styles.contactFooter}>
          <Ionicons name="help-buoy-outline" size={20} color="#FF5F3D" />
          <Text style={styles.contactFooterText}>
            Nếu có thắc mắc về điều khoản hoặc chính sách, vui lòng gửi email tới{' '}
            <Text style={styles.emailHighlight}>legal@vibesport.vn</Text>
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 4 : 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: '#FFF0EA',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FF5F3D',
    fontWeight: '700',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 22,
  },
  contactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  contactFooterText: {
    flex: 1,
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
  },
  emailHighlight: {
    color: '#FF5F3D',
    fontWeight: '700',
  },
});

import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Safe area wrapper — dùng thay SafeAreaView của react-native (chỉ hoạt động đúng trên iOS).
 * @param {import('react-native-safe-area-context').Edge[]} edges — mặc định cả 4 cạnh; tab nội dung dùng ['top','left','right']
 */
export function Screen({ children, style, edges = ['top', 'left', 'right', 'bottom'] }) {
  const safePadding = {
    paddingBottom: 16,
  };

  return (
    <SafeAreaView style={[styles.screen, safePadding, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

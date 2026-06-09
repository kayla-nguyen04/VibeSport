import { StyleSheet, View } from 'react-native';

/** Header cố định — zIndex/elevation để không bị ScrollView/Keyboard che nút trên Android */
export function ScreenHeader({ children, style }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    zIndex: 10,
    elevation: 10,
    backgroundColor: '#FFFFFF',
  },
});

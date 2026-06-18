import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export function BackButton({ onPress, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.button, style]}
    >
      <Text style={styles.icon}>{'‹'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    color: '#111111',
    fontWeight: '300',
  },
});

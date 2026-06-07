import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export function BackButton({ onPress, style }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.icon}>{'‹'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  icon: {
    fontSize: 22,
    color: '#111111',
    marginTop: -2,
  },
});

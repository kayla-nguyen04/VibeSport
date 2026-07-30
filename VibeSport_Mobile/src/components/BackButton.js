import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { icon } from '../theme';

const ICON_NAME = 'arrow-back';
const TOUCH_SIZE = 44;

export function BackButton({
  onPress,
  size = 24,
  color = icon.dark,
  name,
  style,
  variant = 'plain',
}) {
  return (
    <TouchableOpacity
      style={[
        style,
        styles.container,
        variant === 'soft' && styles.soft,
      ]}
      onPress={onPress}
      hitSlop={styles.hitSlop}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel="Quay lại"
    >
      <Ionicons name={name || ICON_NAME} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: TOUCH_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soft: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.08)',
  },
  hitSlop: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
});

export default BackButton;

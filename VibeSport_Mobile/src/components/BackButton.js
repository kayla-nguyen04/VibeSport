import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { icon } from '../theme';

const ICON_NAME = 'chevron-back';
const MIN_TOUCH_SIZE = 44;

const BackButton = ({
  onPress,
  size = 22,
  color = icon.dark,
}) => {
  const hitSlop = {
    top: (MIN_TOUCH_SIZE - size) / 2,
    bottom: (MIN_TOUCH_SIZE - size) / 2,
    left: (MIN_TOUCH_SIZE - size) / 2,
    right: (MIN_TOUCH_SIZE - size) / 2,
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel="Quay lại"
    >
      <Ionicons
        name={ICON_NAME}
        size={size}
        color={color}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export { BackButton };
export default BackButton;

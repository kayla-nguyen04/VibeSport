import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { text } from '../theme';

const TOUCH_TARGET = 44;

const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

const IconButton = ({
  icon,
  size = 'md',
  color,
  backgroundColor = 'transparent',
  onPress,
  disabled = false,
}) => {
  const iconSize = ICON_SIZES[size];
  const iconColor = color || text.primary;

  const touchPadding = Math.max(0, (TOUCH_TARGET - iconSize) / 2);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          padding: touchPadding,
          backgroundColor,
          borderRadius: 999,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {React.isValidElement(icon)
        ? React.cloneElement(icon, {
            size: iconSize,
            color: iconColor,
          })
        : icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default IconButton;

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { background, primary, text, status, borderRadius, fontSize, fontWeight, spacing } from '../theme';

const PRIMARY_HEIGHT = 53; 
const OUTLINE_HEIGHT = 39; 

const TEXT_HITSLOP = { top: 14, bottom: 14, left: 16, right: 16 }; 
const DESTRUCTIVE_HITSLOP = { top: 15, bottom: 15, left: 16, right: 16 }; 

const Button = ({
  title,
  variant = 'primary',
  onPress,
  disabled = false,
  icon,
}) => {
  const getContainerStyle = () => {
    const baseStyle = [styles.container];

    switch (variant) {
      case 'primary':
        return [
          ...baseStyle,
          styles.primary,
          {
            backgroundColor: primary.DEFAULT,
            borderRadius: borderRadius.base,
            height: PRIMARY_HEIGHT,
          },
        ];
      case 'outline':
        return [
          ...baseStyle,
          styles.outline,
          {
            backgroundColor: background.primary,
            borderColor: primary.DEFAULT,
            borderWidth: 1,
            borderRadius: borderRadius.md,
            height: OUTLINE_HEIGHT,
          },
        ];
      case 'text':
        return [...baseStyle, styles.text];
      case 'destructive':
        return [...baseStyle, styles.destructive];
      default:
        return baseStyle;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return [
          styles.textPrimary,
          { color: background.primary },
        ];
      case 'outline':
        return [
          styles.textOutline,
          { color: primary.DEFAULT },
        ];
      case 'text':
        return [
          styles.textButton,
          { color: text.hint },
        ];
      case 'destructive':
        return [
          styles.textDestructive,
          { color: status.dangerDarker },
        ];
      default:
        return {};
    }
  };

  const getHitSlop = () => {
    switch (variant) {
      case 'text':
        return TEXT_HITSLOP;
      case 'destructive':
        return DESTRUCTIVE_HITSLOP;
      default:
        return undefined;
    }
  };

  return (
    <TouchableOpacity
      style={[
        ...getContainerStyle(),
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={getHitSlop()}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={getTextStyle()}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {},
  destructive: {},
  disabled: {
    opacity: 0.5,
  },
  iconWrapper: {
    marginRight: spacing.xs,
  },
  textPrimary: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.bold,
  },
  textOutline: {
    fontSize: fontSize.bodySmall,
    fontWeight: fontWeight.regular,
  },
  textButton: {
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.regular,
  },
  textDestructive: {
    fontSize: fontSize.bodySmall,
    fontWeight: fontWeight.regular,
  },
});

export default Button;

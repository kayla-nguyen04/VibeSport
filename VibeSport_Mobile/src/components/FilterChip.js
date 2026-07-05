import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { background, primary, text, border, fontSize, fontWeight, borderRadius, spacing } from '../theme';

const FilterChip = ({ label, selected, onPress }) => {
  const strokeColor = selected
    ? primary.DEFAULT
    : `rgba(${parseInt(border.subtle.slice(1, 3), 16)}, ${parseInt(border.subtle.slice(3, 5), 16)}, ${parseInt(border.subtle.slice(5, 7), 16)}, ${border.subtleOpacity})`;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderColor: strokeColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 28, 
    paddingHorizontal: spacing.xl, 
    backgroundColor: background.primary,
    borderRadius: borderRadius['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: primary.DEFAULT,
  },
  label: {
    fontSize: fontSize.bodySmall, 
  },
  labelSelected: {
    color: primary.DEFAULT,
    fontWeight: fontWeight.medium,
  },
  labelUnselected: {
    color: text.primary,
    fontWeight: fontWeight.regular,
  },
});

export default FilterChip;

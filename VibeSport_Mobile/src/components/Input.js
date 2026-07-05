import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { background, primary, text, status, borderRadius, fontSize, fontWeight, input, spacing } from '../theme';

const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  variant = 'text',
  error,
  leftIcon,
  rightElement,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const getBorderColor = () => {
    if (error) {
      return status.danger;
    }
    if (isFocused) {
      return primary.DEFAULT; 
    }
    return `rgba(${parseInt(text.primary.slice(1, 3), 16)}, ${parseInt(text.primary.slice(3, 5), 16)}, ${parseInt(text.primary.slice(5, 7), 16)}, ${input.strokeOpacity})`;
  };

  const autoRightElement = variant === 'password' ? (
    <TouchableOpacity
      onPress={() => setIsPasswordVisible(!isPasswordVisible)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.passwordToggle}>
        {isPasswordVisible ? 'Ẩn' : 'Hiện'}
      </Text>
    </TouchableOpacity>
  ) : null;

  const finalRightElement = rightElement ?? autoRightElement;

  const cornerRadius = variant === 'search' ? 20 : borderRadius.xl;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          { borderColor: getBorderColor(), borderRadius: cornerRadius },
        ]}
      >
        {leftIcon}
        <TextInput
          style={[
            styles.input,
            variant === 'search' && styles.inputSearch,
          ]}
          placeholder={placeholder}
          placeholderTextColor={text.disabled}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={variant === 'password' && !isPasswordVisible}
          multiline={variant === 'multiline'}
          {...rest}
        />
        {finalRightElement}
      </View>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.base,
  },
  label: {
    color: text.primary,
    fontSize: fontSize.bodySmall,
    fontWeight: fontWeight.regular,
    marginBottom: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: background.secondary,
    borderWidth: 1,
    height: 48, 
    paddingHorizontal: spacing.base,
  },
  input: {
    flex: 1,
    color: text.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    padding: 0,
  },
  inputSearch: {
    paddingLeft: spacing.sm,
  },
  passwordToggle: {
    color: primary.DEFAULT,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    marginLeft: spacing.sm,
  },
  errorText: {
    color: status.danger,
    fontSize: fontSize.caption,
    marginTop: spacing.xs,
  },
});

export default Input;

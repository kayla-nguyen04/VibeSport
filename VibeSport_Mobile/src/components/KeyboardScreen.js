import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Screen } from './Screen';

export function KeyboardScreen({
  children,
  style,
  edges,
  keyboardVerticalOffset = 0,
  contentStyle,
}) {
  return (
    <Screen style={style} edges={edges}>
      <KeyboardAvoidingView
        style={[styles.flex, contentStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

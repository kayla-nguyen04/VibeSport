import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { background, text } from '../theme';
import BackButton from './BackButton';

const HEADER_HEIGHT = 59;       // thu nhỏ 20% từ 74
const TITLE_FONT_SIZE = 16;     // thu nhỏ 20% từ 20
const TITLE_FONT_WEIGHT = '600';

const Header = ({
  title,
  showBack = true,
  rightElement,
  onBackPress,
}) => {
  return (
    <View
      style={styles.container}
      accessibilityRole="header"
    >
      <View style={styles.leftSection}>
        {showBack && (
          <BackButton onPress={onBackPress} />
        )}
      </View>
      <View style={styles.centerSection}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.rightSection}>
        {rightElement}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HEADER_HEIGHT,
    backgroundColor: background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  centerSection: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: TITLE_FONT_WEIGHT,
    color: text.primary,
    textAlign: 'center',
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});

export default Header;

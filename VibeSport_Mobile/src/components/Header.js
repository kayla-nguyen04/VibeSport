import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { background, text, borderRadius } from '../theme';
import BackButton from './BackButton';

const HEADER_HEIGHT = 74;        
const TITLE_FONT_SIZE = 20;      
const TITLE_FONT_WEIGHT = '400'; 

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
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  centerSection: {
    flex: 1,
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

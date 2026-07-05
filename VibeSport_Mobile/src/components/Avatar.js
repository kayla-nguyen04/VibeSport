import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { background, status, fontWeight } from '../theme';
import { getAvatarColor } from '../theme/avatarPalette';

const AVATAR_SIZES = {
  xs: 30,
  sm: 48,
  md: 62,
  lg: 74,
  xl: 93,
};

const ONLINE_INDICATOR_RATIO = 0.25;

const Avatar = ({
  source,
  name,
  size = 'md',
  showOnline = false,
  borderColor,
  onPress,
}) => {
  const avatarSize = AVATAR_SIZES[size];
  const indicatorSize = avatarSize * ONLINE_INDICATOR_RATIO;
  const indicatorOffset = indicatorSize * 0.3;

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const words = fullName.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);
  const backgroundColor = getAvatarColor(name);

  const Container = onPress ? TouchableOpacity : View;

  const renderAvatar = () => (
    <View
      style={[
        styles.container,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: source ? 'transparent' : backgroundColor,
          borderColor: borderColor || 'transparent',
        },
      ]}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize: avatarSize * 0.4,
            },
          ]}
        >
          {initials}
        </Text>
      )}

      {showOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: indicatorSize,
              height: indicatorSize,
              borderRadius: indicatorSize / 2,
              backgroundColor: status.success,
              right: -indicatorOffset,
              bottom: -indicatorOffset,
            },
          ]}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Container onPress={onPress} activeOpacity={0.7}>
        {renderAvatar()}
      </Container>
    );
  }

  return renderAvatar();
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    color: background.primary,
    fontWeight: fontWeight.semibold,
  },
  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: background.primary,
  },
});

export default Avatar;

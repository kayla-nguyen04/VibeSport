import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { background, text, status, borderRadius, fontWeight } from '../theme';

const LABELS = {
  joined: 'Đã tham gia',
  notStarted: 'Chưa bắt đầu',
  ongoing: 'Đang bắt đầu',
};

const StatusBadge = ({ status: variant, text: customText }) => {
  const label = customText ?? LABELS[variant];

  if (variant === 'joined') {
    return (
      <View style={styles.joinedContainer}>
        <Text style={styles.joinedText}>{label}</Text>
      </View>
    );
  }

  if (variant === 'notStarted') {
    return (
      <View style={styles.notStartedContainer}>
        <Text style={styles.notStartedText}>{label}</Text>
      </View>
    );
  }

  if (variant === 'ongoing') {
    return (
      <View style={styles.ongoingContainer}>
        <Text style={styles.ongoingText}>{label}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  joinedContainer: {
    alignSelf: 'flex-start',
  },
  joinedText: {
    color: status.successDark,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  notStartedContainer: {
    alignSelf: 'flex-start',
    backgroundColor: background.primary,
    borderWidth: 1,
    borderColor: text.primary,
    borderRadius: borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  notStartedText: {
    color: text.primary,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  ongoingContainer: {
    alignSelf: 'flex-start',
    backgroundColor: background.primary,
    borderWidth: 1,
    borderColor: status.active,
    borderRadius: borderRadius.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ongoingText: {
    color: status.successDark,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
});

export default StatusBadge;

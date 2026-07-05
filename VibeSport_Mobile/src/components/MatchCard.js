import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import { background, text, borderRadius, shadows, spacing, fontWeight, fontSize } from '../theme';

const MatchCard = ({
  id,
  title,
  sport,
  time,
  location,
  participants,
  maxParticipants,
  status: statusVariant,
  author,
  onPress,
  timeIcon,
  locationIcon,
  participantsIcon,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row1}>
        <Avatar
          source={author.avatar}
          name={author.name}
          size="sm"
        />
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {sport}
          </Text>
        </View>
        {statusVariant && (
          <StatusBadge status={statusVariant} />
        )}
      </View>

      <View style={styles.row2}>
        <View style={styles.timeSection}>
          {timeIcon && <View style={styles.iconWrapper}>{timeIcon}</View>}
          <Text style={styles.rowText} numberOfLines={1}>{time}</Text>
        </View>
        <View style={styles.locationSection}>
          {locationIcon && <View style={styles.iconWrapper}>{locationIcon}</View>}
          <Text style={styles.rowText} numberOfLines={1}>{location}</Text>
        </View>
      </View>

      <View style={styles.row3}>
        {participantsIcon && <View style={styles.iconWrapper}>{participantsIcon}</View>}
        <Text style={styles.rowText} numberOfLines={1}>
          {`${participants}/${maxParticipants} người`}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: background.primary,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    ...shadows.md,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    color: text.primary,
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    color: text.hint,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  timeSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  iconWrapper: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    color: text.primary,
    fontSize: fontSize.bodySmall,
    fontWeight: fontWeight.regular,
  },
});

export default MatchCard;

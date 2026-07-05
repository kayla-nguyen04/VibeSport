import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { text, primary, status, spacing, background, border, fontWeight } from '../theme';

const NAV_HEIGHT = 62;

const ICON_SIZE = 24;

const DEFAULT_NAV_ITEMS = [
  { key: 'home', label: 'Home' },
  { key: 'match', label: 'Match' },
  { key: 'chat', label: 'Chat' },
  { key: 'team', label: 'Team' },
  { key: 'profile', label: 'Profile' },
];

const BottomNav = ({
  activeTab,
  onTabPress,
  unreadCount = 0,
  tabs = DEFAULT_NAV_ITEMS,
}) => {
  const hasBadge = (tabKey) => {
    return tabKey === 'chat' && unreadCount > 0;
  };

  const renderBadge = () => {
    if (unreadCount <= 0) return null;

    const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();

    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{displayCount}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const iconColor = isActive ? primary.DEFAULT : text.primary;

        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabPress(tab.key)}
            style={styles.tabItem}
          >
            <View style={styles.iconWrapper}>
              {tab.icon && React.isValidElement(tab.icon) ? (
                React.cloneElement(tab.icon, { size: ICON_SIZE, color: iconColor })
              ) : (
                <Text style={{ color: iconColor, fontSize: ICON_SIZE }}>{tab.icon}</Text>
              )}
              {hasBadge(tab.key) && renderBadge()}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: NAV_HEIGHT,
    backgroundColor: background.primary,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: border.default,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: background.primary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});

export default BottomNav;

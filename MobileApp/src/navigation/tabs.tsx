import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { colors, font } from '../theme';

/** Emoji tab icon with an active pill background. */
export function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={styles.icon}>{emoji}</Text>
    </View>
  );
}

export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textFaint,
  tabBarStyle: {
    backgroundColor: colors.bgElevated,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabBarLabelStyle: {
    fontSize: font.tiny,
    fontWeight: '700',
  },
};

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  icon: { fontSize: 18 },
});

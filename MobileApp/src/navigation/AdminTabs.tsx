import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminWeekScreen } from '../screens/admin/AdminWeekScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminFeedbackScreen } from '../screens/admin/AdminFeedbackScreen';
import { AdminPriceHistoryScreen } from '../screens/admin/AdminPriceHistoryScreen';
import { AdminMenuScreen } from '../screens/admin/AdminMenuScreen';
import { tabIcon, tabScreenOptions } from './tabs';

const Tab = createBottomTabNavigator();

export function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Week">
      <Tab.Screen
        name="Week"
        component={AdminWeekScreen}
        options={{ tabBarIcon: tabIcon('📋'), tabBarLabel: 'Week' }}
      />
      <Tab.Screen
        name="Users"
        component={AdminUsersScreen}
        options={{ tabBarIcon: tabIcon('👥') }}
      />
      <Tab.Screen
        name="Feedback"
        component={AdminFeedbackScreen}
        options={{ tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Menu"
        component={AdminMenuScreen}
        options={{ tabBarIcon: tabIcon('📖') }}
      />
      <Tab.Screen
        name="Prices"
        component={AdminPriceHistoryScreen}
        options={{ tabBarIcon: tabIcon('📊'), tabBarLabel: 'Prices' }}
      />
    </Tab.Navigator>
  );
}

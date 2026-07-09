import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminWeekScreen } from '../screens/admin/AdminWeekScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminFeedbackScreen } from '../screens/admin/AdminFeedbackScreen';
import { ViewMenuScreen } from '../screens/shared/ViewMenuScreen';
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
        component={ViewMenuScreen}
        options={{ tabBarIcon: tabIcon('📖') }}
      />
    </Tab.Navigator>
  );
}

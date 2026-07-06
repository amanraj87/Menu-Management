import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminOrdersScreen } from '../screens/admin/AdminOrdersScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminFeedbackScreen } from '../screens/admin/AdminFeedbackScreen';
import { ViewMenuScreen } from '../screens/shared/ViewMenuScreen';
import { tabIcon, tabScreenOptions } from './tabs';

const Tab = createBottomTabNavigator();

export function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Home">
      <Tab.Screen
        name="Home"
        component={AdminDashboardScreen}
        options={{ tabBarIcon: tabIcon('📊'), tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="Orders"
        component={AdminOrdersScreen}
        options={{ tabBarIcon: tabIcon('📋') }}
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

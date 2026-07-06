import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { VendorTodayScreen } from '../screens/vendor/VendorTodayScreen';
import { VendorWeekScreen } from '../screens/vendor/VendorWeekScreen';
import { VendorMenuScreen } from '../screens/vendor/VendorMenuScreen';
import { VendorFeedbackScreen } from '../screens/vendor/VendorFeedbackScreen';
import { tabIcon, tabScreenOptions } from './tabs';

const Tab = createBottomTabNavigator();

export function VendorTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Today">
      <Tab.Screen
        name="Today"
        component={VendorTodayScreen}
        options={{ tabBarIcon: tabIcon('🍳') }}
      />
      <Tab.Screen
        name="Week"
        component={VendorWeekScreen}
        options={{ tabBarIcon: tabIcon('🗓️') }}
      />
      <Tab.Screen
        name="Menu"
        component={VendorMenuScreen}
        options={{ tabBarIcon: tabIcon('📖'), tabBarLabel: 'Menu' }}
      />
      <Tab.Screen
        name="Feedback"
        component={VendorFeedbackScreen}
        options={{ tabBarIcon: tabIcon('💬') }}
      />
    </Tab.Navigator>
  );
}

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PersonTodayScreen } from '../screens/person/PersonTodayScreen';
import { PersonWeekScreen } from '../screens/person/PersonWeekScreen';
import { PersonFeedbackScreen } from '../screens/person/PersonFeedbackScreen';
import { ViewMenuScreen } from '../screens/shared/ViewMenuScreen';
import { tabIcon, tabScreenOptions } from './tabs';

const Tab = createBottomTabNavigator();

export function PersonTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions} initialRouteName="Today">
      <Tab.Screen
        name="Today"
        component={PersonTodayScreen}
        options={{ tabBarIcon: tabIcon('🍽️') }}
      />
      <Tab.Screen
        name="Week"
        component={PersonWeekScreen}
        options={{ tabBarIcon: tabIcon('🗓️') }}
      />
      <Tab.Screen
        name="Menu"
        component={ViewMenuScreen}
        options={{ tabBarIcon: tabIcon('📖') }}
      />
      <Tab.Screen
        name="Feedback"
        component={PersonFeedbackScreen}
        options={{ tabBarIcon: tabIcon('💬') }}
      />
    </Tab.Navigator>
  );
}

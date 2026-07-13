/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { routeFromNotificationData } from './src/navigation/navigationRef';

// FCM background/quit-state handler. Must be registered at the top level,
// before the app component mounts. Messages that carry a `notification` block
// are auto-displayed by the OS tray; this handler covers data-only messages and
// silences the "no background handler" warning.
setBackgroundMessageHandler(getMessaging(getApp()), async () => {});

// Tap on a notifee notification while the app is backgrounded → deep link.
// (Queues if the navigator isn't ready; flushed once it mounts.)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    routeFromNotificationData(detail.notification?.data);
  }
});

AppRegistry.registerComponent(appName, () => App);

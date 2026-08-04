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
import { displayRemoteMessage } from './src/services/push';
import { runNotificationAction } from './src/services/notificationActions';

// FCM background/quit-state handler. Must be registered at the top level,
// before the app component mounts. Messages that carry a `notification` block
// are auto-displayed by the OS tray. Data-only messages reach us here instead —
// we display them ourselves via notifee, which is the only way to attach action
// buttons (FCM's notification payload can't carry them).
setBackgroundMessageHandler(getMessaging(getApp()), async message => {
  if (message?.data && Object.keys(message.data).length > 0 && !message.notification) {
    await displayRemoteMessage(message);
  }
});

// Notifee events while the app is backgrounded / launched for the event:
//  - PRESS on the body → deep link (queued until the navigator mounts)
//  - ACTION_PRESS on a button → run it headlessly (e.g. re-send a meal)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    routeFromNotificationData(detail.notification?.data);
  } else if (type === EventType.ACTION_PRESS) {
    await runNotificationAction(
      detail.pressAction?.id,
      detail.notification?.data,
      detail.notification?.id,
    );
  }
});

AppRegistry.registerComponent(appName, () => App);

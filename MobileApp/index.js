/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// FCM background/quit-state handler. Must be registered at the top level,
// before the app component mounts. Messages that carry a `notification` block
// are auto-displayed by the OS tray; this handler covers data-only messages and
// silences the "no background handler" warning.
setBackgroundMessageHandler(getMessaging(getApp()), async () => {});

AppRegistry.registerComponent(appName, () => App);

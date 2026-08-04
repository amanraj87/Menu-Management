/**
 * Remote push notifications (FCM) — client side.
 *
 * Handles: asking for permission, fetching the device FCM token, registering it
 * with the backend against the current user, keeping it fresh on refresh, and
 * displaying messages received while the app is in the foreground (via notifee).
 *
 * Delivers the remote notifications P2/V1/A1/A2/A3 from the notification spec.
 * All three roles register a token (each is a recipient of at least one event).
 *
 * The background/quit-state handler lives in `index.js` (must be registered at
 * the top level, before the app mounts).
 */
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { gqlRequest } from '../api/client';
import { REGISTER_PUSH_TOKEN, UNREGISTER_PUSH_TOKEN } from '../api/operations';
import { routeFromNotificationData } from '../navigation/navigationRef';
import { RESEND_ACTION_ID, runNotificationAction } from './notificationActions';

export const REMOTE_CHANNEL_ID = 'remote-alerts';

let unsubMessage: (() => void) | null = null;
let unsubRefresh: (() => void) | null = null;
let routingReady = false;
let lastToken: string | null = null;

/** Create the Android channel used to display remote alerts. */
async function ensureChannel(): Promise<string> {
  return notifee.createChannel({
    id: REMOTE_CHANNEL_ID,
    name: 'Alerts',
    importance: AndroidImportance.HIGH,
  });
}

/** Display an FCM message as a local notification (used for foreground + data messages). */
export async function displayRemoteMessage(message: {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}): Promise<void> {
  const channelId = await ensureChannel();
  const title =
    message.notification?.title ?? message.data?.title ?? 'FoodOps';
  const body = message.notification?.body ?? message.data?.body ?? '';
  if (!title && !body) return;
  // Data-only messages may ask for an action button (e.g. the meal-skipped
  // alert offers "Send to vendor" so the admin needn't open the app).
  const actions =
    message.data?.action === RESEND_ACTION_ID
      ? [{ title: 'Send to vendor', pressAction: { id: RESEND_ACTION_ID } }]
      : undefined;
  await notifee.displayNotification({
    title,
    body,
    data: message.data ?? {},
    android: {
      channelId,
      pressAction: { id: 'default' },
      smallIcon: 'ic_launcher',
      ...(actions ? { actions } : {}),
    },
  });
}

async function pushToken(token: string): Promise<void> {
  try {
    await gqlRequest(REGISTER_PUSH_TOKEN, { token, platform: 'android' });
    lastToken = token;
  } catch {
    // Non-fatal: token registration will be retried next launch.
  }
}

/**
 * Ask for permission, fetch the FCM token, and register it with the backend for
 * the currently signed-in user. Idempotent; safe to call on every launch/login.
 */
export async function registerPushToken(): Promise<void> {
  const messaging = getMessaging(getApp());
  const settings = await requestPermission(messaging);
  const granted =
    settings === AuthorizationStatus.AUTHORIZED ||
    settings === AuthorizationStatus.PROVISIONAL;
  if (!granted) return;

  await ensureChannel();
  const token = await getToken(messaging);
  if (token) await pushToken(token);

  // Keep the foreground display + token-refresh handlers wired once.
  if (!unsubMessage) {
    unsubMessage = onMessage(messaging, async message => {
      await displayRemoteMessage(message as any);
    });
  }
  if (!unsubRefresh) {
    unsubRefresh = onTokenRefresh(messaging, async next => {
      await pushToken(next);
    });
  }

  initNotificationRouting();
}

/**
 * Wire notification-tap → navigation for every entry path:
 *  - foreground tap on a notifee-displayed notification
 *  - background tap on an OS-displayed FCM notification (app was running)
 *  - cold-start tap that launched the app (FCM + notifee)
 * Idempotent; safe to call more than once.
 */
export function initNotificationRouting(): void {
  if (routingReady) return;
  routingReady = true;
  const messaging = getMessaging(getApp());

  // Foreground: a notifee notification (FCM foreground display or the local
  // P1 reminder) was tapped.
  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      routeFromNotificationData(detail.notification?.data as any);
    } else if (type === EventType.ACTION_PRESS) {
      await runNotificationAction(
        detail.pressAction?.id,
        detail.notification?.data,
        detail.notification?.id,
      );
    }
  });

  // App was in the background and an OS-displayed FCM notification was tapped.
  onNotificationOpenedApp(messaging, remoteMessage => {
    routeFromNotificationData(remoteMessage?.data as any);
  });

  // App was launched from a quit state by tapping a notification.
  getInitialNotification(messaging)
    .then(remoteMessage => {
      if (remoteMessage) routeFromNotificationData(remoteMessage.data as any);
    })
    .catch(() => {});
  notifee
    .getInitialNotification()
    .then(initial => {
      if (initial) routeFromNotificationData(initial.notification?.data as any);
    })
    .catch(() => {});
}

/** Remove this device's token from the backend (call on sign-out). */
export async function unregisterPushToken(): Promise<void> {
  const token = lastToken;
  lastToken = null;
  if (!token) return;
  try {
    await gqlRequest(UNREGISTER_PUSH_TOKEN, { token });
  } catch {
    // ignore — best effort
  }
}

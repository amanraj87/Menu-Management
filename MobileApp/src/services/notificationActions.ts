/**
 * Notification action buttons.
 *
 * Lets the admin act straight from a notification instead of opening the app.
 * Currently one action: the "meal skipped" alert carries a **Send to vendor**
 * button that re-confirms that meal from the current selections and pushes the
 * vendor — the notification equivalent of opening the week and hitting
 * "Send to Shefs" for that one meal.
 *
 * Everything here must be safe to run in a HEADLESS context: the handler can
 * fire while the app is backgrounded or freshly booted for the event, so React,
 * navigation and SessionContext may never have run. `gqlRequest` falls back to
 * the persisted session for auth, and results are reported as a new
 * notification rather than a toast.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';
import { gqlRequest } from '../api/client';
import { RESEND_MEAL_TO_VENDOR } from '../api/operations';

/** Must match the pressAction id attached when the notification is displayed. */
export const RESEND_ACTION_ID = 'resendOrder';

const CHANNEL_ID = 'remote-alerts';

/** Report the outcome as its own notification (no UI thread available here). */
async function report(title: string, body: string): Promise<void> {
  const channelId = await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Alerts',
    importance: AndroidImportance.HIGH,
  });
  await notifee.displayNotification({
    title,
    body,
    android: { channelId, smallIcon: 'ic_launcher', pressAction: { id: 'default' } },
  });
}

/**
 * Run the action for a pressed notification button. No-ops for unknown actions
 * so it's safe to call from every notifee event handler.
 */
export async function runNotificationAction(
  actionId: string | undefined,
  data: Record<string, string | number | object> | undefined,
  notificationId?: string,
): Promise<void> {
  if (actionId !== RESEND_ACTION_ID) return;

  const date = typeof data?.date === 'string' ? data.date : undefined;
  const mealType = typeof data?.mealType === 'string' ? data.mealType : undefined;
  if (!date || !mealType) return;

  // Clear the original alert first so a slow network can't leave a stale
  // "Send to vendor" button the admin taps twice.
  if (notificationId) {
    await notifee.cancelNotification(notificationId).catch(() => {});
  }

  const label = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  try {
    const res = await gqlRequest<{ resendMealToVendor: number }>(
      RESEND_MEAL_TO_VENDOR,
      { date, mealType },
    );
    const n = res.resendMealToVendor ?? 0;
    await report(
      'Sent to the kitchen ✓',
      n > 0
        ? `${label} on ${date} updated — ${n} item${n === 1 ? '' : 's'} sent to the vendor.`
        : `${label} on ${date} now has no items; the vendor has been told.`,
    );
  } catch (e) {
    await report(`Couldn't send ${label.toLowerCase()}`, (e as Error).message);
  }
}

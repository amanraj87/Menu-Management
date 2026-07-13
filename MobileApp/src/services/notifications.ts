/**
 * Local (device-scheduled) notifications.
 *
 * P1 — "Meal selection closes soon": a weekly reminder that nudges the person
 * to finalize their item picks before the weekend planning window closes.
 * This is a LOCAL notification (scheduled on the device, no server / no cost).
 *
 * Remote notifications (P2/V1/A1/A2/A3) are a separate concern handled via FCM.
 */
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';

const CHANNEL_ID = 'plan-reminders';
const REMINDER_ID = 'weekly-plan-reminder';

/**
 * When the reminder fires. The weekend editing window closes at the start of
 * Monday, so we nudge on Sunday evening ("closes tonight"). Change these two
 * constants to move the reminder.
 */
const REMIND_DOW = 0; // 0 = Sunday ... 6 = Saturday
const REMIND_HOUR = 18; // 24h local time — Sunday 6:00 PM
const REMIND_MINUTE = 0;

/** The next local Date matching REMIND_DOW at REMIND_HOUR:REMIND_MINUTE. */
function nextReminderDate(from: Date): Date {
  const d = new Date(from);
  d.setHours(REMIND_HOUR, REMIND_MINUTE, 0, 0);
  // Days until the target weekday (0..6). If it's the same weekday but the
  // time has already passed, push to next week.
  let delta = (REMIND_DOW - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= from.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Ask the OS for notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Schedule (or re-schedule) the weekly "plan your week" reminder. Idempotent —
 * safe to call on every app launch; it replaces any existing schedule.
 */
export async function scheduleWeeklyPlanReminder(): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  const channelId = await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Meal planning reminders',
    importance: AndroidImportance.HIGH,
  });

  // Replace any previously scheduled instance so constants changes take effect.
  await notifee.cancelTriggerNotification(REMINDER_ID);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: nextReminderDate(new Date()).getTime(),
    repeatFrequency: RepeatFrequency.WEEKLY,
  };

  await notifee.createTriggerNotification(
    {
      id: REMINDER_ID,
      title: 'Meal selection closes soon',
      body: 'This is your weekend to plan next week — finalize your items before it locks.',
      data: { type: 'planWeek' },
      android: {
        channelId,
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
      },
    },
    trigger,
  );
}

/** Cancel the weekly reminder (e.g. on sign-out). */
export async function cancelWeeklyPlanReminder(): Promise<void> {
  await notifee.cancelTriggerNotification(REMINDER_ID);
}

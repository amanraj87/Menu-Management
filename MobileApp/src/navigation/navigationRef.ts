import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Global navigation ref so notification taps (which happen outside React
 * components) can drive navigation. Attached to the NavigationContainer in
 * RootNavigator.
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Maps a notification's `data.type` to the tab it should open. Tab names are
 * shared across role navigators (Person/Admin/Vendor), and only the signed-in
 * role's navigator is mounted, so a bare tab name resolves correctly.
 */
const TYPE_TO_TAB: Record<string, string> = {
  planWeek: 'Week', // P1 — person weekly planning reminder
  feedbackNew: 'Feedback', // admin — new feedback to review
  feedback: 'Feedback', // V1 — vendor: confirmed feedback to answer
  feedbackReply: 'Feedback', // P2/A3 — reply landed
  vendorDayNote: 'Week', // A1 — vendor set a day's final amount
  menuPrice: 'Menu', // A2 — vendor changed a meal price
  mealOptOut: 'Week', // admin — a person skipped an upcoming meal
  mealDone: 'Today', // person — reminder to update eaten status
  mealCancelled: 'Week', // vendor + user — a meal was cancelled/restored
  ordersSent: 'Week', // vendor — admin sent the week's orders
};

// Held when a tap arrives before the navigator is ready (cold start).
let pending: Record<string, string> | null = null;

/** Route to the screen for a notification payload, or defer until nav is ready. */
export function routeFromNotificationData(
  data?: Record<string, string> | null,
): void {
  if (!data?.type) return;
  const tab = TYPE_TO_TAB[data.type];
  if (!tab) return;

  if (navigationRef.isReady()) {
    navigationRef.navigate(tab as never);
    pending = null;
  } else {
    pending = data;
  }
}

/** Flush any tap that arrived before the navigator mounted. Call from onReady. */
export function flushPendingNavigation(): void {
  if (pending) {
    const data = pending;
    pending = null;
    routeFromNotificationData(data);
  }
}

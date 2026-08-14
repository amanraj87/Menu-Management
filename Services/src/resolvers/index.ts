import * as menuItems from './menuItems.js'
import * as selections from './selections.js'
import * as orders from './orders.js'
import * as me from './me.js'
import * as users from './users.js'
import * as feedback from './feedback.js'
import * as mealOptOuts from './mealOptOuts.js'
import * as mealDone from './mealDone.js'
import * as mealCancellations from './mealCancellations.js'
import * as settings from './settings.js'
import * as vendorDayNotes from './vendorDayNotes.js'
import * as vendorDuesResolvers from './vendorDues.js'
import * as pushTokens from './pushTokens.js'
import { runAutoImport } from '../jobs/autoImport.js'

export const resolvers = {
  Query: {
    me: me.me,
    login: users.login,
    users: users.users,
    menuItems: menuItems.menuItems,
    menuItem: menuItems.menuItem,
    mySelection: selections.mySelection,
    mySelectionsForWeek: selections.mySelectionsForWeek,
    myMealOptOuts: mealOptOuts.myMealOptOuts,
    myMealDoneForWeek: mealDone.myMealDoneForWeek,
    mealDoneStatus: mealDone.mealDoneStatus,
    aggregatedOrder: orders.aggregatedOrder,
    aggregatedOrdersForRange: orders.aggregatedOrdersForRange,
    confirmedOrders: orders.confirmedOrders,
    confirmedOrdersForRange: orders.confirmedOrdersForRange,
    orderRevisionsForRange: orders.orderRevisionsForRange,
    getSettings: settings.getSettings,
    weeklyExpense: selections.weeklyExpense,
    vendorDues: vendorDuesResolvers.vendorDues,
    mealCancellationsForRange: mealCancellations.mealCancellationsForRange,
    vendorDayNotesForRange: vendorDayNotes.vendorDayNotesForRange,
    priceHistory: menuItems.priceHistory,
    feedbacksForAdmin: feedback.feedbacksForAdmin,
    confirmedFeedbacks: feedback.confirmedFeedbacks,
    myFeedbacks: feedback.myFeedbacks,
  },
  Mutation: {
    signUp: users.signUp,
    resetPassword: users.resetPassword,
    createUser: users.createUser,
    createMenuItem: menuItems.createMenuItem,
    updateMenuItem: menuItems.updateMenuItem,
    deleteMenuItem: menuItems.deleteMenuItem,
    setMenuItemOfferedDays: menuItems.setMenuItemOfferedDays,
    putSelection: selections.putSelection,
    adminSetUserSelection: selections.adminSetUserSelection,
    toggleMealOptOut: mealOptOuts.toggleMealOptOut,
    markMealDone: mealDone.markMealDone,
    remindNotEaten: mealDone.remindNotEaten,
    confirmOrder: orders.confirmOrder,
    confirmOrderWithItems: orders.confirmOrderWithItems,
    notifyOrdersSentToVendor: orders.notifyOrdersSentToVendor,
    resendMealToVendor: orders.resendMealToVendor,
    createFeedback: feedback.createFeedback,
    confirmFeedback: feedback.confirmFeedback,
    rejectFeedback: feedback.rejectFeedback,
    replyToFeedback: feedback.replyToFeedback,
    deleteFeedback: feedback.deleteFeedback,
    updateSettings: settings.updateSettings,
    toggleMealCancellation: mealCancellations.toggleMealCancellation,
    updateVendorDayNote: vendorDayNotes.updateVendorDayNote,
    updateAdminDayComment: vendorDayNotes.updateAdminDayComment,
    registerPushToken: pushTokens.registerPushToken,
    unregisterPushToken: pushTokens.unregisterPushToken,
    runAutoImport,
  },
}

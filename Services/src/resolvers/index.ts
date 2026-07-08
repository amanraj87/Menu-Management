import * as menuItems from './menuItems.js'
import * as selections from './selections.js'
import * as orders from './orders.js'
import * as me from './me.js'
import * as users from './users.js'
import * as feedback from './feedback.js'
import * as mealOptOuts from './mealOptOuts.js'
import * as mealDone from './mealDone.js'

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
    confirmedOrders: orders.confirmedOrders,
    feedbacksForAdmin: feedback.feedbacksForAdmin,
    confirmedFeedbacks: feedback.confirmedFeedbacks,
  },
  Mutation: {
    signUp: users.signUp,
    resetPassword: users.resetPassword,
    createUser: users.createUser,
    createMenuItem: menuItems.createMenuItem,
    updateMenuItem: menuItems.updateMenuItem,
    deleteMenuItem: menuItems.deleteMenuItem,
    putSelection: selections.putSelection,
    toggleMealOptOut: mealOptOuts.toggleMealOptOut,
    markMealDone: mealDone.markMealDone,
    confirmOrder: orders.confirmOrder,
    confirmOrderWithItems: orders.confirmOrderWithItems,
    createFeedback: feedback.createFeedback,
    confirmFeedback: feedback.confirmFeedback,
  },
}

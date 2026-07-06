import * as menuItems from './menuItems.js'
import * as selections from './selections.js'
import * as orders from './orders.js'
import * as me from './me.js'
import * as users from './users.js'
import * as feedback from './feedback.js'

export const resolvers = {
  Query: {
    me: me.me,
    login: users.login,
    users: users.users,
    menuItems: menuItems.menuItems,
    menuItem: menuItems.menuItem,
    mySelection: selections.mySelection,
    mySelectionsForWeek: selections.mySelectionsForWeek,
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
    confirmOrder: orders.confirmOrder,
    confirmOrderWithItems: orders.confirmOrderWithItems,
    createFeedback: feedback.createFeedback,
    confirmFeedback: feedback.confirmFeedback,
  },
}

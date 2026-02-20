import * as menuItems from './menuItems.js'
import * as selections from './selections.js'
import * as orders from './orders.js'
import * as me from './me.js'
import * as users from './users.js'

export const resolvers = {
  Query: {
    me: me.me,
    users: users.users,
    menuItems: menuItems.menuItems,
    menuItem: menuItems.menuItem,
    mySelection: selections.mySelection,
    aggregatedOrder: orders.aggregatedOrder,
    confirmedOrders: orders.confirmedOrders,
  },
  Mutation: {
    createUser: users.createUser,
    createMenuItem: menuItems.createMenuItem,
    updateMenuItem: menuItems.updateMenuItem,
    deleteMenuItem: menuItems.deleteMenuItem,
    putSelection: selections.putSelection,
    confirmOrder: orders.confirmOrder,
  },
}

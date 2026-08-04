import { gql } from '@apollo/client'

export const ME = gql`
  query Me($userId: ID) {
    me(userId: $userId) {
      id
      name
      email
      role
    }
  }
`

export const LOGIN = gql`
  query Login($email: String!, $passwordHash: String!) {
    login(email: $email, passwordHash: $passwordHash) {
      id
      name
      email
      role
    }
  }
`

export const SIGN_UP = gql`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      id
      name
      email
      role
    }
  }
`

export const RESET_PASSWORD = gql`
  mutation ResetPassword($email: String!, $newPasswordHash: String!) {
    resetPassword(email: $email, newPasswordHash: $newPasswordHash)
  }
`

export const USERS = gql`
  query Users {
    users {
      id
      name
      email
      role
      createdAt
    }
  }
`

export const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
      email
      role
      createdAt
    }
  }
`

export const MENU_ITEMS = gql`
  query MenuItems($mealType: MealType) {
    menuItems(mealType: $mealType) {
      id
      name
      mealType
      unit
      pricePerUnit
      offeredDays
      createdAt
      updatedAt
    }
  }
`

export const SET_MENU_ITEM_OFFERED_DAYS = gql`
  mutation SetMenuItemOfferedDays($id: ID!, $days: [Int!]!) {
    setMenuItemOfferedDays(id: $id, days: $days) {
      id
      offeredDays
    }
  }
`

export const CREATE_MENU_ITEM = gql`
  mutation CreateMenuItem($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      id
      name
      mealType
      unit
      pricePerUnit
      offeredDays
      createdAt
      updatedAt
    }
  }
`

export const UPDATE_MENU_ITEM = gql`
  mutation UpdateMenuItem($id: ID!, $input: UpdateMenuItemInput!) {
    updateMenuItem(id: $id, input: $input) {
      id
      name
      mealType
      unit
      pricePerUnit
      offeredDays
      createdAt
      updatedAt
    }
  }
`

export const DELETE_MENU_ITEM = gql`
  mutation DeleteMenuItem($id: ID!) {
    deleteMenuItem(id: $id)
  }
`

export const MY_SELECTION = gql`
  query MySelection($date: String!, $mealType: MealType!) {
    mySelection(date: $date, mealType: $mealType) {
      id
      userId
      date
      mealType
      items { menuItemId quantity }
      updatedAt
    }
  }
`

export const MY_SELECTIONS_FOR_WEEK = gql`
  query MySelectionsForWeek($startDate: String!) {
    mySelectionsForWeek(startDate: $startDate) {
      id
      userId
      date
      mealType
      items { menuItemId quantity }
      updatedAt
    }
  }
`

export const PUT_SELECTION = gql`
  mutation PutSelection($input: PutSelectionInput!) {
    putSelection(input: $input) {
      id
      userId
      date
      mealType
      items { menuItemId quantity }
      updatedAt
    }
  }
`

export const ADMIN_SET_USER_SELECTION = gql`
  mutation AdminSetUserSelection($userId: ID!, $date: String!, $mealType: MealType!, $items: [SelectionItemInput!]!) {
    adminSetUserSelection(userId: $userId, date: $date, mealType: $mealType, items: $items) {
      id
      userId
      date
      mealType
      items { menuItemId quantity }
      updatedAt
    }
  }
`

export const AGGREGATED_ORDER = gql`
  query AggregatedOrder($date: String!, $mealType: MealType!) {
    aggregatedOrder(date: $date, mealType: $mealType) {
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
    }
  }
`

export const AGGREGATED_ORDERS_FOR_RANGE = gql`
  query AggregatedOrdersForRange($startDate: String!, $endDate: String!) {
    aggregatedOrdersForRange(startDate: $startDate, endDate: $endDate) {
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
    }
  }
`

export const CONFIRM_ORDER = gql`
  mutation ConfirmOrder($date: String!, $mealType: MealType!) {
    confirmOrder(date: $date, mealType: $mealType) {
      id
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy
      confirmedAt
    }
  }
`

export const CONFIRM_ORDER_WITH_ITEMS = gql`
  mutation ConfirmOrderWithItems($date: String!, $mealType: MealType!, $items: [ConfirmedOrderItemInput!]!) {
    confirmOrderWithItems(date: $date, mealType: $mealType, items: $items) {
      id
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy
      confirmedAt
    }
  }
`

export const CONFIRMED_ORDERS = gql`
  query ConfirmedOrders($date: String!) {
    confirmedOrders(date: $date) {
      id
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy
      confirmedAt
    }
  }
`

export const REMIND_NOT_EATEN = gql`
  mutation RemindNotEaten($date: String!, $mealType: MealType!) {
    remindNotEaten(date: $date, mealType: $mealType)
  }
`

export const VENDOR_DUES = gql`
  query VendorDues($startDate: String!, $endDate: String!) {
    vendorDues(startDate: $startDate, endDate: $endDate) {
      startDate
      endDate
      days {
        date
        mealsSubtotal
        delivery
        activeMeals
        computedTotal
        vendorFinalAmount
        owed
        hasOverride
        sentToVendor
      }
      mealsSubtotal
      delivery
      totalOwed
      overrideCount
      overrideDelta
      notSentCount
    }
  }
`

export const NOTIFY_ORDERS_SENT_TO_VENDOR = gql`
  mutation NotifyOrdersSentToVendor($startDate: String!, $endDate: String!) {
    notifyOrdersSentToVendor(startDate: $startDate, endDate: $endDate)
  }
`

export const CREATE_FEEDBACK = gql`
  mutation CreateFeedback($input: CreateFeedbackInput!) {
    createFeedback(input: $input) {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
    }
  }
`

export const FEEDBACKS_FOR_ADMIN = gql`
  query FeedbacksForAdmin {
    feedbacksForAdmin {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
      vendorReply
      vendorReplyAt
    }
  }
`

export const CONFIRM_FEEDBACK = gql`
  mutation ConfirmFeedback($id: ID!) {
    confirmFeedback(id: $id) {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
    }
  }
`

export const REJECT_FEEDBACK = gql`
  mutation RejectFeedback($id: ID!) {
    rejectFeedback(id: $id) {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
    }
  }
`

export const CONFIRMED_FEEDBACKS = gql`
  query ConfirmedFeedbacks {
    confirmedFeedbacks {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
      vendorReply
      vendorReplyAt
    }
  }
`

export const DELETE_FEEDBACK = gql`
  mutation DeleteFeedback($id: ID!) {
    deleteFeedback(id: $id)
  }
`

export const MY_FEEDBACKS = gql`
  query MyFeedbacks {
    myFeedbacks {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
      vendorReply
      vendorReplyAt
    }
  }
`

export const REPLY_TO_FEEDBACK = gql`
  mutation ReplyToFeedback($id: ID!, $reply: String!) {
    replyToFeedback(id: $id, reply: $reply) {
      id
      userId
      userName
      text
      status
      createdAt
      confirmedAt
      vendorReply
      vendorReplyAt
    }
  }
`

export const MY_MEAL_OPT_OUTS = gql`
  query MyMealOptOuts($startDate: String!) {
    myMealOptOuts(startDate: $startDate) {
      id
      userId
      date
      mealType
    }
  }
`

export const TOGGLE_MEAL_OPT_OUT = gql`
  mutation ToggleMealOptOut($date: String!, $mealType: MealType!, $optedOut: Boolean!) {
    toggleMealOptOut(date: $date, mealType: $mealType, optedOut: $optedOut)
  }
`

export const MY_MEAL_DONE_FOR_WEEK = gql`
  query MyMealDoneForWeek($startDate: String!) {
    myMealDoneForWeek(startDate: $startDate) {
      id
      userId
      userName
      date
      mealType
      markedAt
    }
  }
`

export const MARK_MEAL_DONE = gql`
  mutation MarkMealDone($date: String!, $mealType: MealType!, $done: Boolean!) {
    markMealDone(date: $date, mealType: $mealType, done: $done)
  }
`

export const CONFIRMED_ORDERS_FOR_RANGE = gql`
  query ConfirmedOrdersForRange($startDate: String!, $endDate: String!) {
    confirmedOrdersForRange(startDate: $startDate, endDate: $endDate) {
      id
      date
      mealType
      items {
        menuItemId
        name
        unit
        quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy
      confirmedAt
    }
  }
`

export const GET_SETTINGS = gql`
  query GetSettings {
    getSettings {
      monthlyMealCap
      deliveryCharge
      updatedAt
    }
  }
`

export const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($monthlyMealCap: Float, $deliveryCharge: Float) {
    updateSettings(monthlyMealCap: $monthlyMealCap, deliveryCharge: $deliveryCharge) {
      monthlyMealCap
      deliveryCharge
      updatedAt
    }
  }
`

export const WEEKLY_EXPENSE = gql`
  query WeeklyExpense($startDate: String!) {
    weeklyExpense(startDate: $startDate)
  }
`

export const MEAL_CANCELLATIONS_FOR_RANGE = gql`
  query MealCancellationsForRange($startDate: String!, $endDate: String!) {
    mealCancellationsForRange(startDate: $startDate, endDate: $endDate) {
      id
      date
      mealType
    }
  }
`

export const TOGGLE_MEAL_CANCELLATION = gql`
  mutation ToggleMealCancellation($date: String!, $mealType: MealType!, $cancelled: Boolean!) {
    toggleMealCancellation(date: $date, mealType: $mealType, cancelled: $cancelled)
  }
`

export const VENDOR_DAY_NOTES_FOR_RANGE = gql`
  query VendorDayNotesForRange($startDate: String!, $endDate: String!) {
    vendorDayNotesForRange(startDate: $startDate, endDate: $endDate) {
      id
      date
      finalAmount
      comment
      adminComment
      updatedAt
    }
  }
`

export const UPDATE_VENDOR_DAY_NOTE = gql`
  mutation UpdateVendorDayNote($date: String!, $finalAmount: Float, $comment: String!) {
    updateVendorDayNote(date: $date, finalAmount: $finalAmount, comment: $comment) {
      id
      date
      finalAmount
      comment
      adminComment
      updatedAt
    }
  }
`

export const UPDATE_ADMIN_DAY_COMMENT = gql`
  mutation UpdateAdminDayComment($date: String!, $comment: String!) {
    updateAdminDayComment(date: $date, comment: $comment) {
      id
      date
      finalAmount
      comment
      adminComment
      updatedAt
    }
  }
`

export const RUN_AUTO_IMPORT = gql`
  mutation RunAutoImport($targetWeekStart: String) {
    runAutoImport(targetWeekStart: $targetWeekStart)
  }
`

export const PRICE_HISTORY = gql`
  query PriceHistory($menuItemId: ID) {
    priceHistory(menuItemId: $menuItemId) {
      id
      menuItemId
      menuItemName
      oldPrice
      newPrice
      changedAt
    }
  }
`

export const MEAL_DONE_STATUS = gql`
  query MealDoneStatus($date: String!, $mealType: MealType!) {
    mealDoneStatus(date: $date, mealType: $mealType) {
      id
      userId
      userName
      date
      mealType
      markedAt
    }
  }
`

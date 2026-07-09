/** GraphQL operation documents (plain strings for the fetch client). */

export const LOGIN = `
  query Login($email: String!, $passwordHash: String!) {
    login(email: $email, passwordHash: $passwordHash) { id name email role }
  }
`;

export const SIGN_UP = `
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) { id name email role }
  }
`;

export const RESET_PASSWORD = `
  mutation ResetPassword($email: String!, $newPasswordHash: String!) {
    resetPassword(email: $email, newPasswordHash: $newPasswordHash)
  }
`;

export const USERS = `
  query Users {
    users { id name email role createdAt }
  }
`;

export const CREATE_USER = `
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) { id name email role createdAt }
  }
`;

export const MENU_ITEMS = `
  query MenuItems($mealType: MealType) {
    menuItems(mealType: $mealType) {
      id name mealType unit pricePerUnit createdAt updatedAt
    }
  }
`;

export const CREATE_MENU_ITEM = `
  mutation CreateMenuItem($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      id name mealType unit pricePerUnit createdAt updatedAt
    }
  }
`;

export const UPDATE_MENU_ITEM = `
  mutation UpdateMenuItem($id: ID!, $input: UpdateMenuItemInput!) {
    updateMenuItem(id: $id, input: $input) {
      id name mealType unit pricePerUnit createdAt updatedAt
    }
  }
`;

export const DELETE_MENU_ITEM = `
  mutation DeleteMenuItem($id: ID!) {
    deleteMenuItem(id: $id)
  }
`;

export const MY_SELECTIONS_FOR_WEEK = `
  query MySelectionsForWeek($startDate: String!) {
    mySelectionsForWeek(startDate: $startDate) {
      id userId date mealType items { menuItemId quantity } updatedAt
    }
  }
`;

export const PUT_SELECTION = `
  mutation PutSelection($input: PutSelectionInput!) {
    putSelection(input: $input) {
      id userId date mealType items { menuItemId quantity } updatedAt
    }
  }
`;

export const AGGREGATED_ORDER = `
  query AggregatedOrder($date: String!, $mealType: MealType!) {
    aggregatedOrder(date: $date, mealType: $mealType) {
      date mealType
      items {
        menuItemId name unit quantity
        personBreakdown { userId userName quantity }
      }
    }
  }
`;

export const CONFIRM_ORDER_WITH_ITEMS = `
  mutation ConfirmOrderWithItems($date: String!, $mealType: MealType!, $items: [ConfirmedOrderItemInput!]!) {
    confirmOrderWithItems(date: $date, mealType: $mealType, items: $items) {
      id date mealType
      items {
        menuItemId name unit quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy confirmedAt
    }
  }
`;

export const CONFIRMED_ORDERS = `
  query ConfirmedOrders($date: String!) {
    confirmedOrders(date: $date) {
      id date mealType
      items {
        menuItemId name unit quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy confirmedAt
    }
  }
`;

export const CREATE_FEEDBACK = `
  mutation CreateFeedback($input: CreateFeedbackInput!) {
    createFeedback(input: $input) {
      id userId userName text status createdAt confirmedAt
    }
  }
`;

export const FEEDBACKS_FOR_ADMIN = `
  query FeedbacksForAdmin {
    feedbacksForAdmin { id userId userName text status createdAt confirmedAt }
  }
`;

export const CONFIRM_FEEDBACK = `
  mutation ConfirmFeedback($id: ID!) {
    confirmFeedback(id: $id) {
      id userId userName text status createdAt confirmedAt
    }
  }
`;

export const REJECT_FEEDBACK = `
  mutation RejectFeedback($id: ID!) {
    rejectFeedback(id: $id) {
      id userId userName text status createdAt confirmedAt
    }
  }
`;

export const CONFIRMED_FEEDBACKS = `
  query ConfirmedFeedbacks {
    confirmedFeedbacks { id userId userName text status createdAt confirmedAt }
  }
`;

export const MY_MEAL_OPT_OUTS = `
  query MyMealOptOuts($startDate: String!) {
    myMealOptOuts(startDate: $startDate) { id userId date mealType }
  }
`;

export const TOGGLE_MEAL_OPT_OUT = `
  mutation ToggleMealOptOut($date: String!, $mealType: MealType!, $optedOut: Boolean!) {
    toggleMealOptOut(date: $date, mealType: $mealType, optedOut: $optedOut)
  }
`;

export const MY_MEAL_DONE_FOR_WEEK = `
  query MyMealDoneForWeek($startDate: String!) {
    myMealDoneForWeek(startDate: $startDate) { id userId userName date mealType markedAt }
  }
`;

export const MARK_MEAL_DONE = `
  mutation MarkMealDone($date: String!, $mealType: MealType!, $done: Boolean!) {
    markMealDone(date: $date, mealType: $mealType, done: $done)
  }
`;

export const CONFIRMED_ORDERS_FOR_RANGE = `
  query ConfirmedOrdersForRange($startDate: String!, $endDate: String!) {
    confirmedOrdersForRange(startDate: $startDate, endDate: $endDate) {
      id date mealType
      items {
        menuItemId name unit quantity
        personBreakdown { userId userName quantity }
      }
      confirmedBy confirmedAt
    }
  }
`;

export const GET_SETTINGS = `
  query GetSettings {
    getSettings { monthlyMealCap deliveryCharge updatedAt }
  }
`;

export const UPDATE_SETTINGS = `
  mutation UpdateSettings($monthlyMealCap: Float, $deliveryCharge: Float) {
    updateSettings(monthlyMealCap: $monthlyMealCap, deliveryCharge: $deliveryCharge) { monthlyMealCap deliveryCharge updatedAt }
  }
`;

export const WEEKLY_EXPENSE = `
  query WeeklyExpense($startDate: String!) {
    weeklyExpense(startDate: $startDate)
  }
`;

export const MEAL_CANCELLATIONS_FOR_RANGE = `
  query MealCancellationsForRange($startDate: String!, $endDate: String!) {
    mealCancellationsForRange(startDate: $startDate, endDate: $endDate) { id date mealType }
  }
`;

export const TOGGLE_MEAL_CANCELLATION = `
  mutation ToggleMealCancellation($date: String!, $mealType: MealType!, $cancelled: Boolean!) {
    toggleMealCancellation(date: $date, mealType: $mealType, cancelled: $cancelled)
  }
`;

export const VENDOR_DAY_NOTES_FOR_RANGE = `
  query VendorDayNotesForRange($startDate: String!, $endDate: String!) {
    vendorDayNotesForRange(startDate: $startDate, endDate: $endDate) { id date finalAmount comment updatedAt }
  }
`;

export const UPDATE_VENDOR_DAY_NOTE = `
  mutation UpdateVendorDayNote($date: String!, $finalAmount: Float, $comment: String!) {
    updateVendorDayNote(date: $date, finalAmount: $finalAmount, comment: $comment) { id date finalAmount comment updatedAt }
  }
`;

export const MEAL_DONE_STATUS = `
  query MealDoneStatus($date: String!, $mealType: MealType!) {
    mealDoneStatus(date: $date, mealType: $mealType) { id userId userName date mealType markedAt }
  }
`;

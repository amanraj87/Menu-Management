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

export const CONFIRMED_FEEDBACKS = `
  query ConfirmedFeedbacks {
    confirmedFeedbacks { id userId userName text status createdAt confirmedAt }
  }
`;

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
      createdAt
      updatedAt
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

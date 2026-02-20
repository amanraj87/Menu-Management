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
      defaultQuantity
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
      defaultQuantity
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
      defaultQuantity
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

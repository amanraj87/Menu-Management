export const typeDefs = `#graphql
  enum MealType {
    breakfast
    lunch
    dinner
  }

  type MenuItem {
    id: ID!
    name: String!
    mealType: MealType!
    unit: String!
    defaultQuantity: Int
    createdAt: String
    updatedAt: String
  }

  type SelectionItem {
    menuItemId: ID!
    quantity: Int!
  }

  type Selection {
    id: ID!
    userId: ID!
    date: String!
    mealType: MealType!
    items: [SelectionItem!]!
    updatedAt: String
  }

  type PersonBreakdown {
    userId: ID!
    userName: String!
    quantity: Int!
  }

  type AggregatedOrderItem {
    menuItemId: ID!
    name: String!
    unit: String!
    quantity: Int!
    personBreakdown: [PersonBreakdown!]!
  }

  type AggregatedOrder {
    date: String!
    mealType: MealType!
    items: [AggregatedOrderItem!]!
  }

  type ConfirmedOrderItem {
    menuItemId: ID!
    name: String!
    unit: String!
    quantity: Int!
    personBreakdown: [PersonBreakdown!]!
  }

  type ConfirmedOrder {
    id: ID!
    date: String!
    mealType: MealType!
    items: [ConfirmedOrderItem!]!
    confirmedBy: ID!
    confirmedAt: String!
  }

  enum UserRole {
    person
    admin
    vendor
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    createdAt: String
  }

  # Inputs
  input CreateUserInput {
    name: String!
    email: String!
    role: UserRole!
  }

  input CreateMenuItemInput {
    name: String!
    mealType: MealType!
    unit: String!
    defaultQuantity: Int
  }

  input UpdateMenuItemInput {
    name: String
    unit: String
    defaultQuantity: Int
  }

  input SelectionItemInput {
    menuItemId: ID!
    quantity: Int!
  }

  input PutSelectionInput {
    date: String!
    mealType: MealType!
    items: [SelectionItemInput!]!
  }

  # Queries
  type Query {
    """Current user from X-User-Id header, or user by id when userId is passed (for login)."""
    me(userId: ID): User
    users: [User!]!
    menuItems(mealType: MealType): [MenuItem!]!
    menuItem(id: ID!): MenuItem
    mySelection(date: String!, mealType: MealType!): Selection
    aggregatedOrder(date: String!, mealType: MealType!): AggregatedOrder!
    confirmedOrders(date: String!): [ConfirmedOrder!]!
  }

  # Mutations
  type Mutation {
    createUser(input: CreateUserInput!): User!
    createMenuItem(input: CreateMenuItemInput!): MenuItem!
    updateMenuItem(id: ID!, input: UpdateMenuItemInput!): MenuItem!
    deleteMenuItem(id: ID!): Boolean!
    putSelection(input: PutSelectionInput!): Selection!
    confirmOrder(date: String!, mealType: MealType!): ConfirmedOrder!
  }
`

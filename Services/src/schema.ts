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
    pricePerUnit: Float
    createdAt: String
    updatedAt: String
  }

  type SelectionItem {
    menuItemId: ID!
    quantity: Float!
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
    quantity: Float!
  }

  type AggregatedOrderItem {
    menuItemId: ID!
    name: String!
    unit: String!
    quantity: Float!
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
    quantity: Float!
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

  type Feedback {
    id: ID!
    userId: ID!
    userName: String!
    text: String!
    status: String!
    createdAt: String!
    confirmedAt: String
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

  input SignUpInput {
    name: String!
    email: String!
    passwordHash: String!
  }

  input CreateMenuItemInput {
    name: String!
    mealType: MealType!
    unit: String!
    pricePerUnit: Float
  }

  input UpdateMenuItemInput {
    name: String
    mealType: MealType
    unit: String
    pricePerUnit: Float
  }

  input SelectionItemInput {
    menuItemId: ID!
    quantity: Float!
  }

  input PutSelectionInput {
    date: String!
    mealType: MealType!
    items: [SelectionItemInput!]!
  }

  input ConfirmedOrderItemInput {
    menuItemId: ID!
    name: String!
    unit: String!
    quantity: Float!
  }

  input CreateFeedbackInput {
    text: String!
  }

  # Queries
  type Query {
    me(userId: ID): User
    login(email: String!, passwordHash: String!): User!
    users: [User!]!
    menuItems(mealType: MealType): [MenuItem!]!
    menuItem(id: ID!): MenuItem
    mySelection(date: String!, mealType: MealType!): Selection
    """Selections for 7 days starting at startDate (YYYY-MM-DD), for current user. 21 entries (7 days x 3 meals)."""
    mySelectionsForWeek(startDate: String!): [Selection!]!
    aggregatedOrder(date: String!, mealType: MealType!): AggregatedOrder!
    confirmedOrders(date: String!): [ConfirmedOrder!]!
    """Admin: all feedbacks (pending and confirmed)."""
    feedbacksForAdmin: [Feedback!]!
    """Vendor: only confirmed feedbacks."""
    confirmedFeedbacks: [Feedback!]!
  }

  # Mutations
  type Mutation {
    signUp(input: SignUpInput!): User!
    """Reset a user's password by email (self-service; no email verification)."""
    resetPassword(email: String!, newPasswordHash: String!): Boolean!
    createUser(input: CreateUserInput!): User!
    createMenuItem(input: CreateMenuItemInput!): MenuItem!
    updateMenuItem(id: ID!, input: UpdateMenuItemInput!): MenuItem!
    deleteMenuItem(id: ID!): Boolean!
    putSelection(input: PutSelectionInput!): Selection!
    confirmOrder(date: String!, mealType: MealType!): ConfirmedOrder!
    """Admin: confirm and send to vendor with optional edited items/quantities."""
    confirmOrderWithItems(date: String!, mealType: MealType!, items: [ConfirmedOrderItemInput!]!): ConfirmedOrder!
    createFeedback(input: CreateFeedbackInput!): Feedback!
    confirmFeedback(id: ID!): Feedback!
  }
`

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

  type MealOptOut {
    id: ID!
    userId: ID!
    date: String!
    mealType: MealType!
  }

  type MealDone {
    id: ID!
    userId: ID!
    userName: String!
    date: String!
    mealType: MealType!
    markedAt: String!
  }

  type Settings {
    monthlyMealCap: Float
    deliveryCharge: Float
    updatedAt: String
  }

  """A meal the vendor has cancelled for a given date (e.g. kitchen closed)."""
  type MealCancellation {
    id: ID!
    date: String!
    mealType: MealType!
  }

  type VendorDayNote {
    id: ID!
    date: String!
    finalAmount: Float
    comment: String!
    updatedAt: String
  }

  type Feedback {
    id: ID!
    userId: ID!
    userName: String!
    text: String!
    status: String!
    createdAt: String!
    confirmedAt: String
    vendorReply: String
    vendorReplyAt: String
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
    """Aggregated live user selections for a date range (inclusive), grouped by date+meal."""
    aggregatedOrdersForRange(startDate: String!, endDate: String!): [AggregatedOrder!]!
    confirmedOrders(date: String!): [ConfirmedOrder!]!
    """Confirmed orders for a date range (inclusive)."""
    confirmedOrdersForRange(startDate: String!, endDate: String!): [ConfirmedOrder!]!
    """App settings (monthly meal cap etc.)."""
    getSettings: Settings!
    """Admin: total price of ALL users' selections for 7 days starting at startDate."""
    weeklyExpense(startDate: String!): Float!
    """Vendor-cancelled meals within a date range (inclusive)."""
    mealCancellationsForRange(startDate: String!, endDate: String!): [MealCancellation!]!
    """Vendor day notes (final amount override + comment) for a date range."""
    vendorDayNotesForRange(startDate: String!, endDate: String!): [VendorDayNote!]!
    """Meal opt-outs for 7 days starting at startDate, for current user."""
    myMealOptOuts(startDate: String!): [MealOptOut!]!
    """Current user's meal-done marks for 7 days starting at startDate."""
    myMealDoneForWeek(startDate: String!): [MealDone!]!
    """Admin: all meal-done marks for a specific date and meal."""
    mealDoneStatus(date: String!, mealType: MealType!): [MealDone!]!
    """Admin: all feedbacks (pending and confirmed)."""
    feedbacksForAdmin: [Feedback!]!
    """Vendor: only confirmed feedbacks."""
    confirmedFeedbacks: [Feedback!]!
    """Current user's own submitted feedback (with any vendor reply)."""
    myFeedbacks: [Feedback!]!
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
    """Admin: overwrite a specific user's selection for a date+meal (bypasses the monthly cap)."""
    adminSetUserSelection(userId: ID!, date: String!, mealType: MealType!, items: [SelectionItemInput!]!): Selection!
    confirmOrder(date: String!, mealType: MealType!): ConfirmedOrder!
    """Admin: confirm and send to vendor with optional edited items/quantities."""
    confirmOrderWithItems(date: String!, mealType: MealType!, items: [ConfirmedOrderItemInput!]!): ConfirmedOrder!
    """Toggle a meal opt-out. optedOut=true inserts, false removes."""
    toggleMealOptOut(date: String!, mealType: MealType!, optedOut: Boolean!): Boolean!
    """Mark a meal as done (eaten) or undo it."""
    markMealDone(date: String!, mealType: MealType!, done: Boolean!): Boolean!
    createFeedback(input: CreateFeedbackInput!): Feedback!
    confirmFeedback(id: ID!): Feedback!
    rejectFeedback(id: ID!): Feedback!
    """Admin: permanently delete a feedback."""
    deleteFeedback(id: ID!): Boolean!
    """Vendor: reply to a confirmed feedback. Visible to the admin and the user who submitted it."""
    replyToFeedback(id: ID!, reply: String!): Feedback!
    """Admin: update app settings. Pass the fields to change (monthly cap, delivery charge; null clears)."""
    updateSettings(monthlyMealCap: Float, deliveryCharge: Float): Settings!
    """Vendor/admin: cancel or restore a meal for a specific date."""
    toggleMealCancellation(date: String!, mealType: MealType!, cancelled: Boolean!): Boolean!
    """Vendor: set or update the final amount and comment for a day."""
    updateVendorDayNote(date: String!, finalAmount: Float, comment: String!): VendorDayNote!
    """Admin: manually run the weekly auto-import into the given week (defaults to next week). Returns slots created."""
    runAutoImport(targetWeekStart: String): Int!
    """Register this device's FCM push token for the signed-in user (upsert by token)."""
    registerPushToken(token: String!, platform: String!): Boolean!
    """Remove a device's FCM push token (e.g. on sign-out)."""
    unregisterPushToken(token: String!): Boolean!
  }
`

# Menu Management — GraphQL API (Services)

TypeScript + GraphQL backend for the Menu Management WebApp. Uses the same MongoDB collections as described in `WebApp/docs/MONGO_COLLECTIONS.md`.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env`.
   - Set `MONGO_URI` to your MongoDB connection string (e.g. `mongodb+srv://...` or `mongodb://localhost:27017/menu-management`).
   - Optional: `CURRENT_USER_ID` — ObjectId of a user for dev (when no `X-User-Id` header).
   - Optional: `PORT` — default `4000`.

3. **Run**
   ```bash
   npm run dev
   ```
   GraphiQL: **http://localhost:4000/graphql**

## Auth (current user)

The API uses a **current user** for:

- `mySelection` / `putSelection` — which person’s selection
- `confirmOrder` — must be **admin**

Provide the user in one of these ways:

- **Header** (recommended): `X-User-Id: <users._id ObjectId>`. Optional: `X-User-Role: admin` (otherwise role is loaded from `users`).
- **Dev**: set `CURRENT_USER_ID` in `.env` to an ObjectId from your `users` collection.

## GraphQL schema (summary)

- **Queries:** `menuItems(mealType?)`, `menuItem(id)`, `mySelection(date, mealType)`, `aggregatedOrder(date, mealType)`, `confirmedOrders(date)`.
- **Mutations:** `createMenuItem(input)`, `updateMenuItem(id, input)`, `deleteMenuItem(id)`, `putSelection(input)`, `confirmOrder(date, mealType)`.

Enums: `MealType` = `breakfast` | `lunch` | `dinner`.  
Inputs: `CreateMenuItemInput`, `UpdateMenuItemInput`, `PutSelectionInput` (date, mealType, items).

## Collections (MongoDB)

Same as WebApp docs:

- **users** — name, email, role (`person` | `admin` | `vendor`)
- **menu_items** — name, mealType, unit, defaultQuantity
- **selections** — userId, date, mealType, items: [{ menuItemId, quantity }]
- **confirmed_orders** — date, mealType, items (with personBreakdown), confirmedBy, confirmedAt

Collection names are in `src/constants/collections.ts`.

## WebApp integration

The WebApp is currently built for a **REST** API. To use this GraphQL API from the WebApp you can:

1. **Add a GraphQL client** (e.g. Apollo Client or graphql-request) in the WebApp and replace REST calls with GraphQL operations, or  
2. **Add a thin REST bridge** in this service that translates REST routes (e.g. `/api/menu-items`, `/api/selections`, etc.) into GraphQL calls and responds with the same JSON shape the WebApp expects.

# MongoDB collections for Menu Management

Create these collections in your MongoDB database. Field types below are logical; use your driver’s conventions (e.g. ObjectId for `_id` and refs).

---

## Database & collection hierarchy (Services uses this)

The **Services** backend connects to **one database** and uses **four collections** inside it:

```
<DATABASE>                    ← from MONGO_URI path, or MONGO_DB_NAME env, or default "menu-management"
├── users                     ← COLLECTIONS.users
├── menu_items                ← COLLECTIONS.menu_items
├── selections                ← COLLECTIONS.selections
└── confirmed_orders          ← COLLECTIONS.confirmed_orders
```

**How the database name is chosen (Services `src/db.ts`):**

1. If **`MONGO_DB_NAME`** is set in `.env`, that value is used.
2. Else the first path segment of **`MONGO_URI`** is used (e.g. `mongodb+srv://.../MyDb` → `MyDb`).
3. Else **`menu-management`** is used.

**Verify in MongoDB Compass:** Connect with the same URI as in Services `.env`, open the database that matches the name above, and confirm the four collections exist. If your data lives in a different database (e.g. "FoodMenu" in Atlas), set **`MONGO_DB_NAME=FoodMenu`** in Services `.env` or put the DB name in the URI path.

---

## 1. `users`

Stores everyone who can use the app: persons (choose food), admin (see combined + confirm), vendor (update menu).

| Field       | Type     | Required | Description |
|------------|----------|----------|-------------|
| `_id`      | ObjectId | yes      | Auto-generated |
| `name`     | string   | yes      | Display name |
| `email`    | string   | yes      | Unique; used for login |
| `role`     | string   | yes      | One of: `person`, `admin`, `vendor` |
| `createdAt`| Date     | no       | Optional |

**Index:** `email` (unique).

---

## 2. `menu_items`

Menu items that vendor can add/edit/delete. Persons choose from these for each meal.

| Field            | Type   | Required | Description |
|------------------|--------|----------|-------------|
| `_id`            | ObjectId | yes    | Auto-generated |
| `name`           | string | yes      | e.g. "Chicken Biryani", "Idly" |
| `mealType`       | string | yes      | One of: `breakfast`, `lunch`, `dinner` |
| `unit`           | string | yes      | e.g. `portion`, `kg`, `piece` |
| `defaultQuantity`| number | no       | Default when person selects (e.g. 1) |
| `createdAt`      | Date   | no       | Optional |
| `updatedAt`      | Date   | no       | Optional |

**Index:** `mealType` (for listing by meal).

---

## 3. `selections`

Each person’s choices for a **single day** and **single meal** (breakfast, lunch, or dinner). One document per user per date per meal.

| Field      | Type     | Required | Description |
|------------|----------|----------|-------------|
| `_id`      | ObjectId | yes      | Auto-generated |
| `userId`   | ObjectId | yes      | Ref `users._id` |
| `date`     | string   | yes      | `YYYY-MM-DD` |
| `mealType` | string   | yes      | `breakfast`, `lunch`, or `dinner` |
| `items`    | array    | yes      | See below |
| `updatedAt`| Date     | no       | Optional |

**`items`** array element:

| Field         | Type   | Description |
|---------------|--------|-------------|
| `menuItemId`  | ObjectId | Ref `menu_items._id` |
| `quantity`    | number | e.g. 1, 2 portions |

**Index:** unique on `(userId, date, mealType)` so one selection per person per day per meal.

---

## 4. `confirmed_orders`

Snapshot when admin confirms an order for a given date and meal. Vendor sees these as “confirmed” orders.

| Field        | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `_id`       | ObjectId | yes      | Auto-generated |
| `date`      | string   | yes      | `YYYY-MM-DD` |
| `mealType`  | string   | yes      | `breakfast`, `lunch`, or `dinner` |
| `items`     | array    | yes      | Snapshot at confirm time (see below) |
| `confirmedBy` | ObjectId | yes    | Ref `users._id` (admin) |
| `confirmedAt` | Date    | yes      | When confirmed |

**`items`** array element (snapshot):

| Field            | Type   | Description |
|------------------|--------|-------------|
| `menuItemId`     | ObjectId | Ref `menu_items._id` |
| `name`           | string | Item name at confirm time |
| `unit`           | string | e.g. portion, kg |
| `quantity`       | number | Total quantity |
| `personBreakdown`| array  | Who added how much (see below) |

**`personBreakdown`** element:

| Field    | Type   | Description |
|----------|--------|-------------|
| `userId` | ObjectId | Ref `users._id` |
| `userName` | string | Snapshot of name |
| `quantity` | number | That person’s quantity for this item |

**Index:** unique on `(date, mealType)` so one confirmed order per date per meal.

---

## Summary

| Collection        | Purpose |
|-------------------|--------|
| **users**         | Persons, admin, vendor; login and roles |
| **menu_items**    | Vendor-managed menu (name, mealType, unit) |
| **selections**    | Each person’s choices per date + meal (items + quantity) |
| **confirmed_orders** | Admin-confirmed snapshot per date + meal (items, total qty, personBreakdown) |

Backend should expose APIs that read/write these collections. The webapp calls these endpoints (see `src/shared/api/client.ts`). Collection names are exported in the app as `COLLECTIONS` from `src/shared/constants/collections.ts` so your backend can use the same names when querying MongoDB.

**GraphQL implementation:** The repo’s `Services` folder provides a TypeScript + GraphQL API that implements the same operations (see `Services/README.md`). The WebApp is currently REST-based; to use the GraphQL API you can add a REST→GraphQL bridge in Services or switch the WebApp to a GraphQL client.

---

## Expected API endpoints (for your backend)

Base URL: set `VITE_API_URL` in `.env` (e.g. `http://localhost:3001/api`). If unset, requests go to `/api`.

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/menu-items?mealType=breakfast\|lunch\|dinner` | List menu items (optional filter) |
| POST | `/menu-items` | Create menu item (body: name, mealType, unit, defaultQuantity?) |
| PATCH | `/menu-items/:id` | Update menu item (body: name?, unit?, defaultQuantity?) |
| DELETE | `/menu-items/:id` | Delete menu item |
| GET | `/selections?date=YYYY-MM-DD&mealType=...` | Get current user's selection for that date+meal (return `{ selection: null }` if none) |
| PUT | `/selections` | Upsert current user's selection (body: date, mealType, items: [{ menuItemId, quantity }]) |
| GET | `/orders/aggregated?date=...&mealType=...` | Admin: aggregated items + total qty + personBreakdown for that date+meal |
| POST | `/orders/confirm` | Admin: confirm order (body: date, mealType); creates `confirmed_orders` doc |
| GET | `/orders/confirmed?date=YYYY-MM-DD` | List confirmed orders for that date (for vendor / today & tomorrow views) |

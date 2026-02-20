# 🍱 Food Vendor Menu Management WebApp

## Overview

This project digitizes weekly food menu management between an
organization and its food vendor. Instead of sharing Excel/PDF files
every week, this system becomes the **single source of truth** for menu
updates, order generation, and vendor communication.

------------------------------------------------------------------------

## 🧠 Problem Statement

-   Menu changes every week
-   Excel versions become outdated
-   Vendor confusion due to multiple files
-   Manual aggregation of food quantities
-   No centralized tracking

------------------------------------------------------------------------

## 🎯 Solution

Build a **Menu Management Platform** where: - Admin manages weekly
menus - System auto-generates vendor orders - Vendor always sees the
latest menu - Changes are version-controlled - Notifications happen
automatically

------------------------------------------------------------------------

## 🏗️ High-Level Architecture

    Frontend (React / Next.js)
            |
     REST / GraphQL APIs
            |
    Backend (Node.js / NestJS)
            |
    --------------------------------------------------
    | Menu Service | Order Service | Notification Service |
    --------------------------------------------------
            |
           MongoDB (Single Source of Truth)

------------------------------------------------------------------------

## 🧩 Core Modules

### 1. Menu Management Service

-   Create weekly menu
-   Edit anytime
-   Clone previous week
-   Version control
-   Vendor auto-sync

### MongoDB Collections

#### menus

``` json
{
  "_id": "ObjectId",
  "week_start_date": "date",
  "version": 4,
  "status": "active",
  "created_by": "admin"
}
```

#### daily_menus

``` json
{
  "_id": "ObjectId",
  "menu_id": "ObjectId",
  "day": "Monday",
  "meals": ["breakfast", "lunch", "dinner"]
}
```

#### meal_items

``` json
{
  "_id": "ObjectId",
  "daily_menu_id": "ObjectId",
  "meal_type": "lunch",
  "item_name": "Chicken Biryani",
  "spice_level": "medium",
  "serves": 4
}
```

#### person_meals

``` json
{
  "person_name": "Aman",
  "meal_item_id": "ObjectId",
  "quantity": 1
}
```

------------------------------------------------------------------------

### 2. Order Generation Engine

Automatically aggregates quantities for vendors.

Example Output:

    Monday Lunch Order
    ------------------
    Chicken Biryani : 6 portions
    Pulka : 20 pieces
    Curd : 1.5 KG

MongoDB Aggregation Example:

``` js
db.person_meals.aggregate([
 { $group:
   { _id:"$meal_item_id",
     total:{$sum:"$quantity"}
   }
 }
])
```

------------------------------------------------------------------------

### 3. Vendor Portal

Vendor views: - Today's Orders - Tomorrow's Orders - Menu Updates -
Order History

------------------------------------------------------------------------

### 4. Change Management

Whenever a menu changes: 1. Admin edits menu 2. New version created 3.
Vendor notified automatically 4. Old menu archived

Version Pattern:

``` json
{
  "menu_id": "ObjectId",
  "version": 5,
  "is_active": true
}
```

------------------------------------------------------------------------

### 5. Notification System

Triggers: - Menu updated - New week published - Quantity modified

Channels: - Email - WhatsApp API - Push Notifications

------------------------------------------------------------------------

## 🖥️ Frontend Architecture

### Admin Panel

-   Weekly calendar view
-   Menu builder
-   Person assignment
-   Excel import
-   Real-time editing

### Vendor Panel

-   Daily orders
-   Preparation confirmation
-   Delivery tracking

------------------------------------------------------------------------

## ⚙️ Backend Tech Stack

  Layer      Technology
  ---------- ------------------
  Backend    Node.js + NestJS
  Database   MongoDB
  ORM        Mongoose
  Auth       JWT
  Realtime   Socket.io
  Queue      BullMQ
  Cache      Redis
  Hosting    AWS / GCP

------------------------------------------------------------------------

## 📦 Data Flow

    Admin updates menu
            ↓
    API updates MongoDB
            ↓
    Menu version increments
            ↓
    Order engine recalculates
            ↓
    Vendor notified instantly

------------------------------------------------------------------------

## 🧱 Suggested MongoDB Collections

    users
    vendors
    persons
    menus
    daily_menus
    meal_items
    person_meals
    orders
    order_history
    notifications

------------------------------------------------------------------------

## 🔥 Phase 2 Enhancements

-   Grocery estimation
-   Monthly billing automation
-   Consumption analytics
-   Diet preferences
-   Skip meal feature
-   AI menu suggestions
-   Food waste prediction

------------------------------------------------------------------------

## 🚀 Deployment Architecture

    Next.js Frontend
            |
    API Gateway
            |
    Microservices Layer
            |
    MongoDB Cluster

------------------------------------------------------------------------

## ⭐ Key Insight

This system evolves from a simple menu tracker into a **Food Operations
Management Platform** similar to enterprise cafeteria systems.

------------------------------------------------------------------------

## 👨‍💻 Author

Architecture designed for digitizing vendor-based meal operations using
MongoDB as the primary datastore.

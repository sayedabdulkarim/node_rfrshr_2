# SchemaMind - Natural Language to Full API Generator

> Describe your API in plain English -> Get a complete production-ready Express + MongoDB backend

---

## The Problem

Har naya project mein same kaam: schemas banao, routes likho, validation add karo, auth lagao.
Kya agar English mein bolo aur poora backend ready mil jaaye?

---

## What It Does

1. User types: "I need a food delivery app with users, restaurants, menu items, orders, reviews, and real-time order tracking"
2. AI generates:
   - MongoDB schemas (with proper refs, indexes, timestamps)
   - Express routes (full CRUD + custom endpoints)
   - Validation (Zod/Joi schemas)
   - Auth middleware (JWT + role-based)
   - Postman collection
3. Interactive ER diagram shows entity relationships
4. User can iterate: "Add soft delete to all models" / "Add image upload to restaurants"
5. Download as a ready-to-run project ZIP

---

## Tech Stack

```
Frontend:      React + TailwindCSS
Visualization: React Flow (interactive ER diagram)
Code Editor:   Monaco Editor (VS Code in browser)
Backend:       Node.js + Express
AI:            Claude API (structured output / function calling)
Output:        ZIP file (downloadable Express project)
```

---

## Features Breakdown

### Input Panel (Left Side)
- Chat-like interface for natural language input
- Example prompts: "E-commerce with products, cart, orders, payments"
- Iteration mode: modify generated code via chat
- History of all generations

### ER Diagram (Center)
- Interactive entity-relationship diagram (React Flow)
- Drag to rearrange entities
- Click entity -> see fields, types, validations
- Lines show relationships (1:1, 1:N, N:N)
- Color coded: blue=user models, green=data models, red=junction tables

### Code Preview (Right Side - Monaco Editor)
- Tab-based file explorer (like VS Code)
- Syntax highlighted code preview
- Editable: modify generated code before download
- Files: models/, routes/, middleware/, config/, server.js, .env.example

### Generated Output Structure

```
generated-project/
├── server.js              (Express app setup, CORS, middleware)
├── .env.example           (required env variables)
├── package.json           (all dependencies)
├── config/
│   └── db.js              (MongoDB connection)
├── models/
│   ├── User.js            (with bcrypt pre-save hook)
│   ├── Restaurant.js
│   ├── MenuItem.js
│   ├── Order.js
│   └── Review.js
├── routes/
│   ├── authRoutes.js      (register, login, me)
│   ├── restaurantRoutes.js
│   ├── menuRoutes.js
│   ├── orderRoutes.js
│   └── reviewRoutes.js
├── middleware/
│   ├── auth.js            (JWT verify)
│   ├── roleCheck.js       (admin/user/vendor)
│   └── validate.js        (Zod validation)
├── validators/
│   ├── userValidator.js
│   └── orderValidator.js
└── postman/
    └── collection.json    (ready to import)
```

---

## Architecture

```
User Chat Input ──> Node.js Backend ──> Claude API
                         │                   │
                         │            Structured JSON Output
                         │                   │
                         ├──> Code Generator Engine
                         │         │
                         │    Generates: Models, Routes,
                         │    Middleware, Validators, Config
                         │         │
                         ├──> React Frontend
                         │    (ER Diagram + Code Preview)
                         │
                         └──> ZIP Builder ──> Download
```

---

## AI Prompt Strategy

```
Step 1: Extract Entities
  Input:  "food delivery app with users, restaurants, orders"
  Output: { entities: ["User", "Restaurant", "MenuItem", "Order", "Review"] }

Step 2: Generate Schemas
  For each entity, AI generates:
  {
    "name": "Order",
    "fields": [
      { "name": "user", "type": "ObjectId", "ref": "User", "required": true },
      { "name": "restaurant", "type": "ObjectId", "ref": "Restaurant" },
      { "name": "items", "type": "[{ menuItem: ObjectId, quantity: Number }]" },
      { "name": "totalAmount", "type": "Number" },
      { "name": "status", "type": "String", "enum": ["pending","confirmed","delivered"] }
    ],
    "indexes": ["user", "restaurant", "status"],
    "timestamps": true
  }

Step 3: Generate Routes
  AI generates CRUD + custom routes based on entity relationships

Step 4: Generate Validation
  AI creates Zod schemas matching the Mongoose schemas

Step 5: Iterate
  User: "Add payment integration with Razorpay"
  AI: Updates Order model + adds payment routes + adds webhook handler
```

---

## Iteration Examples (Chat Commands)

```
"Add image upload to restaurants using multer"
"Make all delete routes soft-delete"
"Add pagination to all list endpoints"
"Add rate limiting to auth routes"
"Add Swagger documentation"
"Add search endpoint for restaurants by name and cuisine"
"Change database to PostgreSQL with Prisma"
```

---

## Why This Is Unique

- This is META: using AI to build what MERN developers build daily
- Not a chatbot - it's a DEVELOPER TOOL with visual output
- Interactive ER diagram (React Flow) = impressive demo
- Shows: structured AI output, code generation, full-stack architecture
- Open-source potential: people will ACTUALLY use this = GitHub stars
- Interview: "I built a tool that generates entire backends from English descriptions"

---

## Build Order

```
Week 1: AI integration - NL to entity extraction + schema generation
Week 2: Code generator engine - models, routes, middleware templates
Week 3: React frontend - chat input + Monaco code preview
Week 4: React Flow ER diagram + interactive editing
Week 5: ZIP builder + download + iteration mode + polish
```

---

*Category: Full Stack + AI + Developer Tool*
*Difficulty: Advanced*
*Resume Impact: Very High - shows product thinking + meta-level understanding*

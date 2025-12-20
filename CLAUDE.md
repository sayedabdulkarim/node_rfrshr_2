# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack MERN Todo application with JWT authentication and role-based access control. Also serves as a learning sandbox for Node.js patterns (Buffer vs Stream, Worker Threads, MongoDB aggregations).

- **Server**: Express 5 backend with MongoDB (port 5001)
- **Client**: React frontend with Context API (port 3000)

## Development Commands

```bash
# Server (from /server directory)
npm start                    # Start with nodemon (auto-reload)

# Client (from /client directory)
npm start                    # React dev server
npm test                     # Jest/React Testing Library
npm test -- --watchAll=false # Run tests once (CI mode)
npm run build                # Production build
```

## Environment Setup

Server requires `/server/.env`:
```
MONGODB_URI=mongodb://localhost:27017/your_db
JWT_SECRET=your_secret_key
PORT=5001
```

## Architecture Overview

### Backend Architecture
The server follows a standard Express MVC pattern:

**Authentication Flow:**
1. User credentials → `authRoutes.js` → User model → bcrypt validation
2. JWT token generated with user ID payload
3. Token returned to client and stored in localStorage
4. Protected routes verify token via `middleware/auth.js`
5. Decoded user ID attached to `req.user` for route handlers

**Middleware Chain:**
```
Request → CORS → Body Parser → Morgan (logging) → Route Handler → Auth Middleware (if protected) → Controller
```

**Error Handling:**
- Global error handler catches Mongoose validation errors (400)
- Duplicate key errors (11000 code) → 400 responses
- JWT errors (invalid/expired tokens) → 401 responses
- 404 handler for unknown routes
- All errors logged to console with stack traces

### Frontend Architecture
React app using Context API for global state management:

**Authentication Context (`AuthContext.js`):**
- Manages user state and localStorage persistence
- Provides `login()`, `register()`, `logout()` methods
- Auto-loads user from localStorage on mount
- `isAuthenticated` derived from user state

**API Layer (`services/api.js`):**
- Axios instance with interceptors
- Request interceptor: Auto-attaches JWT token from localStorage
- Response interceptor: Handles 401 errors by clearing storage and redirecting to `/login`
- Centralized error handling for token expiration

**Protected Routes:**
- `ProtectedRoute` component checks `isAuthenticated` via `useAuth()` hook
- Redirects to `/login` if not authenticated
- Dashboard and todo features behind authentication

### Data Flow
```
Frontend Component → Context API (useAuth/useTodos) → api.js (axios) →
Express Route → Auth Middleware → Controller → Mongoose Model → MongoDB
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Create new user, returns JWT token
- `POST /login` - Authenticate user, returns JWT token
- `GET /me` - Get current user (requires Bearer token)

### Todos (`/api/todos`) - All Protected
- `GET /` - Get all todos for authenticated user
- `POST /` - Create todo (`{ text: string }`)
- `PUT /:id` - Update todo
- `DELETE /:id` - Delete todo
- `PUT /:id/toggle` - Toggle completion status

### Additional Demo Routes
- `/api/files` - Buffer vs Stream file handling demos
- `/api/profile` - Profile picture upload (multer + sharp)
- `/api/orders` - MongoDB aggregation pipeline examples
- `/api/tasks` - Search, filter, sort, pagination patterns

## Key Patterns

### JWT Token Flow
- Tokens stored in localStorage under `user` key as `{ id, email, name, roles, token }`
- Request interceptor in `api.js` attaches `Authorization: Bearer <token>` header
- `protect` middleware verifies token, attaches user to `req.user`
- User IDs enforce data isolation (users only see their own todos)

### CORS Configuration
Server allows `http://localhost:3000` and `http://127.0.0.1:3000` origins with credentials. Update `corsOptions` in `server.js` when changing client port or deploying.

### Password Security
- Passwords hashed with bcryptjs (10 salt rounds) via pre-save hook
- User model has `matchPassword()` instance method for comparison
- Password field excluded by default (`select: false` in schema)

## Common Development Patterns

### Adding New Protected Routes
1. Create route file in `/server/routes`
2. Import `protect` middleware from `middleware/auth.js`
3. Apply to routes: `router.get('/', protect, controller)`
4. Access authenticated user via `req.user` in controller

### Adding New Frontend Pages
1. Create component in `/client/src/pages`
2. Add route to `App.js`
3. Wrap with `<ProtectedRoute>` if authentication required
4. Access auth state via `useAuth()` hook

### Role-Based Access Control
- Users have `roles` array referencing Role documents
- Role model defines `name` and `permissions` array
- `AuthContext` provides `hasRole()` and `hasPermission()` helpers
- `checkPermission.js` middleware available for route-level permission checks

## Demo/Learning Modules

The `/server/demo` directory contains isolated learning examples:
- `aggregate/` - MongoDB aggregation pipeline patterns
- `todoSearch/` - Search, filter, sort, pagination with/without aggregation
- `worker_threads/` - CPU-intensive task offloading
- `import_require_diff/` - ES modules vs CommonJS comparison
- `optimize_performance_nodejs/` - Performance optimization patterns

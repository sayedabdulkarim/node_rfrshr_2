# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack MERN Todo application with JWT authentication. The project consists of two separate applications:
- **Server**: Node.js/Express backend with MongoDB (port 5001)
- **Client**: React frontend with Context API for state management (port 3000)

## Development Commands

### Server (from `/server` directory)
```bash
npm start              # Start server with nodemon (auto-reload)
```

### Client (from `/client` directory)
```bash
npm start              # Start React development server
npm test               # Run tests with Jest/React Testing Library
npm run build          # Build for production
```

### Environment Setup
Server requires `.env` file in `/server` directory:
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

## Key Patterns

### JWT Token Flow
- Tokens stored in localStorage under `user` key
- Format: `{ id, email, name, token }`
- Every API request includes `Authorization: Bearer <token>` header
- Backend middleware extracts user from token and attaches to `req.user`
- User IDs used for data isolation (users only see their own todos)

### CORS Configuration
Server allows `http://localhost:3000` and `http://127.0.0.1:3000` origins with credentials. Update `corsOptions` in `server.js` when changing client port or deploying.

### Password Security
- Passwords hashed with bcryptjs (10 salt rounds)
- Pre-save hook in User model: `this.password = await bcrypt.hash(this.password, 10)`
- Comparison method: `userSchema.methods.matchPassword = await bcrypt.compare(password, this.password)`
- Never return password field in responses (use `.select('-password')`)

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

### MongoDB Model Pattern
Models in `/server/models` use Mongoose schemas with:
- Pre-save hooks for password hashing
- Instance methods for custom logic (e.g., `matchPassword`)
- Validation rules and required fields
- Timestamps enabled by default

## Future Scaling Considerations

This codebase is designed for learning system design concepts. The `systemDesignTodo.txt` file outlines planned enhancements:
- Load balancing with Nginx
- Redis for caching and session management
- Message queues for cross-server communication
- Microservices architecture (auth/chat/user services)
- Database replication and sharding

When implementing these features, maintain backward compatibility with the current monolithic structure.

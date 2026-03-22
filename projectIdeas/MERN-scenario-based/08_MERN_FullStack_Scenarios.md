# MERN Full Stack - Scenario Based Interview Questions

> "Ye wale questions hain jahan React + Node + Express + MongoDB SAB ek saath involved hain.
> Interviewer poora flow puchta hai - frontend se backend se database tak"

---


## Scenario 1: Data Out of Sync (Stale Data)

**Q: User ne React frontend se ek todo add kiya. API success return karta hai.
But jab user page refresh karta hai toh naya todo dikhta nahi.
Doosre browser mein bhi nahi dikhta. Kya ho raha hai? Full stack mein kahan debug karoge?**

**Answer:**

Systematic debugging - layer by layer:

```
Frontend (React)        →  Backend (Express)       →  Database (MongoDB)
State update ho raha?      API mein save ho raha?      Document exist karta hai?
```

```js
// Step 1: Check MongoDB directly
// mongosh mein:
db.todos.find().sort({ createdAt: -1 }).limit(5)
// Agar yahan nahi hai -> backend mein save nahi hua

// Step 2: Check Express API
// Postman se POST /api/todos hit karo
// Response dekho - success aa raha but save nahi ho raha?

// COMMON BUG: await missing
// BAD:
app.post('/api/todos', protect, (req, res) => {
  const todo = new Todo({ text: req.body.text, user: req.user.id })
  todo.save()  // NOT awaited! Response goes before save completes
  res.status(201).json(todo)
})

// FIX:
app.post('/api/todos', protect, async (req, res) => {
  const todo = await Todo.create({ text: req.body.text, user: req.user.id })
  res.status(201).json(todo)
})


// COMMON BUG 2: Frontend state updated but not from server response
// BAD (React):
const addTodo = async (text) => {
  await api.post('/api/todos', { text })
  setTodos([...todos, { text }])  // local object, missing _id, createdAt!
  // On refresh: fetches from DB, IDs don't match, duplicates possible
}

// FIX:
const addTodo = async (text) => {
  const { data } = await api.post('/api/todos', { text })
  setTodos([...todos, data])  // use SERVER response (has _id, timestamps)
}


// COMMON BUG 3: GET endpoint filtering wrong
app.get('/api/todos', protect, async (req, res) => {
  const todos = await Todo.find({ userId: req.user.id })  // wrong field name!
  // Schema has 'user' not 'userId' -> returns empty array
  res.json(todos)
})

// FIX: Match schema field name
const todos = await Todo.find({ user: req.user.id })
```

**Debugging checklist:**
1. MongoDB mein data hai? -> `db.collection.find()`
2. API correct response de raha? -> Postman test
3. Frontend correct state update kar raha? -> React DevTools
4. Field names match hain? Schema vs Query vs Frontend


---


## Scenario 2: Authentication Flow Broken

**Q: User login karta hai, token milta hai, dashboard dikhta hai. But jab koi protected API
call karta hai toh 401 Unauthorized aata hai. Token toh hai localStorage mein. Kya problem hai?
Full flow trace karo.**

**Answer:**

```
Login Flow:
React Login Form → POST /api/auth/login → Express validates → JWT generated →
→ Response to React → Store token → Redirect to Dashboard →
→ GET /api/todos (with token) → 401 ERROR ← WHERE IS THE BREAK?
```

```js
// DEBUG LAYER BY LAYER:

// Layer 1: Check token in localStorage
console.log(localStorage.getItem('token'))
// Agar undefined -> login response mein token sahi key pe store nahi hua

// COMMON BUG: Key mismatch
// Login mein:
localStorage.setItem('user', JSON.stringify({ token: data.token }))

// Axios interceptor mein:
const token = localStorage.getItem('token')  // WRONG KEY! Should be 'user'

// FIX: Consistent key usage
const user = JSON.parse(localStorage.getItem('user'))
const token = user?.token


// Layer 2: Check Axios interceptor
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user'))
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`
    //                              ^^^^^^^ "Bearer " with space is REQUIRED
  }
  return config
})

// COMMON BUG: Missing "Bearer " prefix
config.headers.Authorization = token           // WRONG: no Bearer prefix
config.headers.Authorization = `Bearer${token}` // WRONG: no space
config.headers.Authorization = `Bearer ${token}` // CORRECT


// Layer 3: Check Express auth middleware
const protect = async (req, res, next) => {
  let token
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer')) {
    token = authHeader.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')

    if (!req.user) {
      return res.status(401).json({ error: 'User not found' })
    }

    next()
  } catch (err) {
    // COMMON BUG: JWT_SECRET different between login and verify
    // Login uses: jwt.sign(payload, 'mySecret123')
    // Middleware uses: jwt.verify(token, process.env.JWT_SECRET)
    // process.env.JWT_SECRET is undefined in dev! -> verify fails
    console.error('Token verify error:', err.message)
    return res.status(401).json({ error: 'Invalid token' })
  }
}


// Layer 4: Check CORS (credentials)
// Backend:
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,  // MUST be true if sending cookies/auth headers
}))

// Frontend (axios):
const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  withCredentials: true,  // MUST match backend credentials: true
})
```

**Most common causes (in order of frequency):**
1. Token key mismatch (localStorage key different)
2. Missing "Bearer " prefix in Authorization header
3. JWT_SECRET undefined in .env (works in login, fails in verify)
4. CORS credentials not enabled on both sides
5. Token expired (short expiry + no refresh mechanism)


---


## Scenario 3: Real-Time Feature Implementation

**Q: Chat feature add karna hai existing MERN app mein. User A message bheje toh
User B ko instantly dikhna chahiye bina page refresh ke. Backend mein Socket.io use karo.
But tumhara app already REST APIs use karta hai. Kaise integrate karoge without breaking existing code?**

**Answer:**

```js
// === BACKEND: Add Socket.io alongside Express ===

// server.js
const express = require('express')
const { createServer } = require('http')
const { Server } = require('socket.io')

const app = express()
const httpServer = createServer(app)  // wrap Express in http server

// Existing REST routes (UNCHANGED)
app.use('/api/auth', authRoutes)
app.use('/api/todos', todoRoutes)

// Add Socket.io on SAME server
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  }
})

// Socket.io auth middleware (reuse JWT)
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.id
    next()
  } catch (err) {
    next(new Error('Authentication failed'))
  }
})

// Socket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`)

  // Join personal room (for DMs)
  socket.join(socket.userId)

  // Join chat room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId)
  })

  // Send message (Socket + REST hybrid)
  socket.on('sendMessage', async (data) => {
    // Save to MongoDB (same as REST would do)
    const message = await Message.create({
      text: data.text,
      sender: socket.userId,
      room: data.roomId,
    })

    // Broadcast to room (real-time)
    io.to(data.roomId).emit('newMessage', message)
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`)
  })
})

// IMPORTANT: listen on httpServer, NOT app
httpServer.listen(5001)


// === FRONTEND: React Socket Hook ===

// hooks/useSocket.js
import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export function useSocket() {
  const socketRef = useRef(null)

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'))

    socketRef.current = io('http://localhost:5001', {
      auth: { token: user?.token },
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  return socketRef
}


// Chat Component
function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([])
  const socket = useSocket()

  useEffect(() => {
    // Load existing messages (REST API - normal fetch)
    api.get(`/api/messages/${roomId}`).then(res => setMessages(res.data))

    // Listen for new messages (Socket - real-time)
    socket.current?.emit('joinRoom', roomId)
    socket.current?.on('newMessage', (message) => {
      setMessages(prev => [...prev, message])
    })

    return () => {
      socket.current?.off('newMessage')
    }
  }, [roomId])

  const sendMessage = (text) => {
    // Send via Socket (real-time) instead of REST
    socket.current?.emit('sendMessage', { text, roomId })
  }

  return (
    <div>
      {messages.map(msg => <Message key={msg._id} data={msg} />)}
      <MessageInput onSend={sendMessage} />
    </div>
  )
}
```

**Key architecture decisions:**
- REST APIs for CRUD (existing, don't change)
- Socket.io for real-time events only (new messages, typing indicators, online status)
- Same JWT auth for both REST and Socket
- Same MongoDB models for both
- httpServer wraps Express app (both work on same port)


---


## Scenario 4: Image Upload Full Flow

**Q: User React se profile picture upload karta hai. Backend pe resize hona chahiye
(200x200 thumbnail). MongoDB mein URL store hona chahiye. Poora flow design karo -
frontend form se lekar database storage tak.**

**Answer:**

```js
// === FRONTEND: React Upload Component ===

function ProfileUpload() {
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e) => {
    const file = e.target.files[0]

    // Client-side validation
    if (!file.type.startsWith('image/')) {
      return toast.error('Only images allowed')
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('Max 5MB allowed')
    }

    // Preview
    setPreview(URL.createObjectURL(file))

    // Upload
    setUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)  // key must match multer field name

    try {
      const { data } = await api.put('/api/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          console.log(`Upload: ${Math.round(e.loaded / e.total * 100)}%`)
        },
      })
      toast.success('Photo updated!')
      // data.avatarUrl = processed image URL
    } catch (err) {
      toast.error('Upload failed')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <img src={preview || user.avatarUrl || '/default-avatar.png'} />
      <input type="file" accept="image/*" onChange={handleUpload} />
      {uploading && <Spinner />}
    </div>
  )
}


// === BACKEND: Express + Multer + Sharp ===

const multer = require('multer')
const sharp = require('sharp')
const path = require('path')
const crypto = require('crypto')

// Multer config - temp storage
const upload = multer({
  storage: multer.memoryStorage(),  // keep in memory for sharp processing
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only images allowed'), false)
    }
  },
})

// Route
router.put('/avatar', protect, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' })
  }

  // Generate unique filename
  const filename = `${req.user.id}-${crypto.randomBytes(8).toString('hex')}.webp`

  // Resize + convert to WebP with Sharp
  const outputPath = path.join(__dirname, '../../uploads/avatars', filename)

  await sharp(req.file.buffer)
    .resize(200, 200, { fit: 'cover' })  // crop to square
    .webp({ quality: 80 })               // convert to WebP
    .toFile(outputPath)

  // Save URL to MongoDB
  const avatarUrl = `/uploads/avatars/${filename}`

  // Delete old avatar file (cleanup)
  const user = await User.findById(req.user.id)
  if (user.avatarUrl && user.avatarUrl !== '/default-avatar.png') {
    const oldPath = path.join(__dirname, '../..', user.avatarUrl)
    fs.unlink(oldPath, () => {})  // delete old file, ignore errors
  }

  user.avatarUrl = avatarUrl
  await user.save()

  res.json({ avatarUrl })
})

// Serve static uploads
app.use('/uploads', express.static('uploads'))


// === MONGODB: User Schema ===
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: { type: String, select: false },
  avatarUrl: {
    type: String,
    default: '/default-avatar.png'
  },
}, { timestamps: true })
```

**Full flow:**
```
React (FormData) → Express (Multer receives) → Sharp (resize 200x200, WebP) →
→ Save to /uploads/ → Update MongoDB (avatarUrl) → Response to React → Show image
```


---


## Scenario 5: Pagination + Filtering + Sorting (Full Stack)

**Q: E-commerce products page hai. Frontend mein filters hain (category, price range),
search bar hai, sort options hain (price low-high, newest), aur infinite scroll pagination hai.
Poora full-stack flow design karo - React se MongoDB tak.**

**Answer:**

```js
// === FRONTEND: React Products Page ===

function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    minPrice: 0,
    maxPrice: 10000,
    sort: '-createdAt',  // newest first (default)
    cursor: null,
  })

  // Fetch products
  const fetchProducts = async (isLoadMore = false) => {
    setLoading(true)
    const params = new URLSearchParams()

    if (filters.search) params.set('search', filters.search)
    if (filters.category) params.set('category', filters.category)
    params.set('minPrice', filters.minPrice)
    params.set('maxPrice', filters.maxPrice)
    params.set('sort', filters.sort)
    params.set('limit', 20)
    if (isLoadMore && filters.cursor) params.set('cursor', filters.cursor)

    const { data } = await api.get(`/api/products?${params}`)

    if (isLoadMore) {
      setProducts(prev => [...prev, ...data.products])
    } else {
      setProducts(data.products)  // fresh search = replace
    }

    setHasMore(data.hasMore)
    setFilters(prev => ({ ...prev, cursor: data.nextCursor }))
    setLoading(false)
  }

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setFilters(prev => ({ ...prev, search: value, cursor: null }))
    }, 300),
    []
  )

  // Refetch when filters change (except cursor)
  useEffect(() => {
    fetchProducts(false)
  }, [filters.search, filters.category, filters.minPrice, filters.maxPrice, filters.sort])

  // Infinite scroll (Intersection Observer)
  const observerRef = useRef()
  const lastProductRef = useCallback((node) => {
    if (loading) return
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        fetchProducts(true)  // load more
      }
    })

    if (node) observerRef.current.observe(node)
  }, [loading, hasMore])

  return (
    <div>
      <SearchBar onChange={debouncedSearch} />
      <FilterPanel filters={filters} onChange={setFilters} />
      <SortDropdown value={filters.sort} onChange={(sort) =>
        setFilters(prev => ({ ...prev, sort, cursor: null }))} />

      <div className="products-grid">
        {products.map((product, i) => (
          <ProductCard
            key={product._id}
            ref={i === products.length - 1 ? lastProductRef : null}
            product={product}
          />
        ))}
      </div>
      {loading && <Spinner />}
    </div>
  )
}


// === BACKEND: Express API ===

router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, cursor, limit = 20 } = req.query

  // Build query
  const query = {}

  // Text search
  if (search) {
    query.$text = { $search: search }
  }

  // Category filter
  if (category) {
    query.category = category
  }

  // Price range
  query.price = {
    $gte: Number(minPrice) || 0,
    $lte: Number(maxPrice) || Infinity,
  }

  // Cursor-based pagination
  if (cursor) {
    const [cursorValue, cursorId] = Buffer.from(cursor, 'base64')
      .toString().split('_')

    // Sort-aware cursor
    const sortField = sort.replace('-', '')
    const sortDir = sort.startsWith('-') ? '$lt' : '$gt'

    query.$or = [
      { [sortField]: { [sortDir]: isNaN(cursorValue) ? cursorValue : Number(cursorValue) } },
      { [sortField]: cursorValue, _id: { $gt: cursorId } },
    ]
  }

  // Sort
  const sortObj = {}
  if (sort) {
    const field = sort.replace('-', '')
    sortObj[field] = sort.startsWith('-') ? -1 : 1
  }
  sortObj._id = 1  // tiebreaker

  // Execute
  const products = await Product.find(query)
    .sort(sortObj)
    .limit(Number(limit) + 1)  // fetch 1 extra to check hasMore
    .lean()

  const hasMore = products.length > Number(limit)
  if (hasMore) products.pop()  // remove extra

  // Generate next cursor
  let nextCursor = null
  if (hasMore && products.length > 0) {
    const lastProduct = products[products.length - 1]
    const sortField = (sort || '-createdAt').replace('-', '')
    const cursorValue = lastProduct[sortField]
    nextCursor = Buffer.from(`${cursorValue}_${lastProduct._id}`).toString('base64')
  }

  res.json({ products, hasMore, nextCursor })
})


// === MONGODB: Indexes ===

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  category: String,
  images: [String],
}, { timestamps: true })

// Indexes for search + filter + sort performance
productSchema.index({ '$**': 'text' })                    // text search
productSchema.index({ category: 1, price: 1 })            // filter
productSchema.index({ price: 1, _id: 1 })                 // sort by price + cursor
productSchema.index({ createdAt: -1, _id: 1 })            // sort by newest + cursor
```

**Full flow:**
```
React (filters/search/sort state) → API call with query params →
→ Express builds MongoDB query → Cursor-based pagination →
→ MongoDB uses compound indexes → Returns 20 products + nextCursor →
→ React renders + Intersection Observer detects scroll bottom →
→ Load more with cursor → Append to list
```


---


## Scenario 6: Optimistic UI + Rollback Across Stack

**Q: User todo complete mark karta hai (checkbox). UI turant update hona chahiye (fast feel).
But agar backend fail ho jaaye toh rollback karna hai. Aur doosre tab mein bhi sync hona chahiye.
Poora pattern implement karo.**

**Answer:**

```js
// === FRONTEND: React with Optimistic Updates ===

function TodoItem({ todo }) {
  const { updateTodo, rollback } = useTodos()

  const handleToggle = async () => {
    const previousState = todo.completed

    // Step 1: Optimistic update (instant UI change)
    updateTodo(todo._id, { completed: !todo.completed })

    try {
      // Step 2: Send to backend
      await api.put(`/api/todos/${todo._id}/toggle`)
    } catch (error) {
      // Step 3: Rollback on failure
      rollback(todo._id, { completed: previousState })
      toast.error('Failed to update. Rolled back.')
    }
  }

  return (
    <div className={todo.completed ? 'completed' : ''}>
      <input type="checkbox" checked={todo.completed} onChange={handleToggle} />
      <span>{todo.text}</span>
    </div>
  )
}

// TodoContext with optimistic update support
function TodoProvider({ children }) {
  const [todos, setTodos] = useState([])

  const updateTodo = (id, updates) => {
    setTodos(prev =>
      prev.map(todo => todo._id === id ? { ...todo, ...updates } : todo)
    )
  }

  const rollback = (id, previousData) => {
    setTodos(prev =>
      prev.map(todo => todo._id === id ? { ...todo, ...previousData } : todo)
    )
  }

  return (
    <TodoContext.Provider value={{ todos, setTodos, updateTodo, rollback }}>
      {children}
    </TodoContext.Provider>
  )
}


// === CROSS-TAB SYNC: BroadcastChannel API ===

// In TodoProvider:
useEffect(() => {
  const channel = new BroadcastChannel('todo-sync')

  channel.onmessage = (event) => {
    const { type, todoId, updates } = event.data
    if (type === 'TODO_UPDATED') {
      updateTodo(todoId, updates)
    }
  }

  return () => channel.close()
}, [])

// After successful API call:
const handleToggle = async () => {
  updateTodo(todo._id, { completed: !todo.completed })

  try {
    const { data } = await api.put(`/api/todos/${todo._id}/toggle`)

    // Sync to other tabs
    const channel = new BroadcastChannel('todo-sync')
    channel.postMessage({
      type: 'TODO_UPDATED',
      todoId: todo._id,
      updates: { completed: data.completed },
    })
    channel.close()
  } catch {
    rollback(todo._id, { completed: todo.completed })
  }
}


// === BACKEND: Express toggle endpoint ===

router.put('/:id/toggle', protect, async (req, res) => {
  const todo = await Todo.findOne({ _id: req.params.id, user: req.user.id })

  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' })
  }

  todo.completed = !todo.completed
  todo.completedAt = todo.completed ? new Date() : null
  await todo.save()

  res.json(todo)
})
```


---


## Scenario 7: Role-Based Access Control (Full Stack)

**Q: Tumhara app mein 3 roles hain: user, admin, superadmin. Admin users manage kar sake.
Superadmin admins bhi manage kar sake. Frontend mein buttons conditionally dikhne chahiye,
backend mein routes protected hone chahiye. Poora RBAC implement karo.**

**Answer:**

```js
// === MONGODB: User + Role Schema ===

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: { type: String, select: false },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
})


// === BACKEND: Middleware Chain ===

// 1. Auth middleware (who are you?)
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  req.user = await User.findById(decoded.id)
  next()
}

// 2. Role middleware (what can you do?)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Role '${req.user.role}' is not authorized for this action`
      })
    }
    next()
  }
}

// 3. Usage in routes
// Any logged in user
router.get('/api/todos', protect, getTodos)

// Only admin and superadmin
router.get('/api/admin/users', protect, authorize('admin', 'superadmin'), getUsers)
router.delete('/api/admin/users/:id', protect, authorize('admin', 'superadmin'), deleteUser)

// Only superadmin
router.put('/api/admin/users/:id/role', protect, authorize('superadmin'), changeUserRole)

// Prevent privilege escalation
router.put('/api/admin/users/:id/role', protect, authorize('superadmin'), async (req, res) => {
  const { role } = req.body

  // Superadmin can't demote themselves
  if (req.params.id === req.user.id.toString()) {
    return res.status(400).json({ error: 'Cannot change your own role' })
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
  res.json(user)
})


// === FRONTEND: React Role-Based UI ===

// AuthContext provides role info
function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const hasRole = (role) => user?.role === role
  const hasMinRole = (minRole) => {
    const hierarchy = { user: 0, admin: 1, superadmin: 2 }
    return hierarchy[user?.role] >= hierarchy[minRole]
  }

  return (
    <AuthContext.Provider value={{ user, hasRole, hasMinRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// Conditional UI rendering
function UserManagement() {
  const { hasMinRole } = useAuth()

  return (
    <div>
      <UserTable />

      {/* Only admin+ can see delete button */}
      {hasMinRole('admin') && <button>Delete User</button>}

      {/* Only superadmin can see role change dropdown */}
      {hasMinRole('superadmin') && <RoleChangeDropdown />}
    </div>
  )
}

// Protected Route component
function RoleRoute({ children, minRole }) {
  const { user, hasMinRole } = useAuth()

  if (!user) return <Navigate to="/login" />
  if (!hasMinRole(minRole)) return <Navigate to="/unauthorized" />
  return children
}

// App Routes
<Route path="/admin/*" element={
  <RoleRoute minRole="admin">
    <AdminLayout />
  </RoleRoute>
} />
```

**Key rule: Frontend checks are for UX only. Backend MUST enforce authorization.**
User can always bypass frontend (DevTools, API calls). Backend is the real gatekeeper.


---


## Scenario 8: Error Handling Across Full Stack

**Q: User form submit karta hai. Validation fail hoti hai backend pe.
Frontend mein field-level errors dikhne chahiye (e.g., "Email already exists" email field ke neeche).
Poora error flow design karo - consistent format, frontend se backend tak.**

**Answer:**

```js
// === BACKEND: Consistent Error Format ===

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors  // field-level errors
  }
}

// Validation middleware (Zod)
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)

  if (!result.success) {
    const fieldErrors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))

    throw new AppError('Validation failed', 400, fieldErrors)
  }

  req.body = result.data  // cleaned data
  next()
}

// Zod schema
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

// Route
router.post('/register', validate(registerSchema), async (req, res) => {
  const existingUser = await User.findOne({ email: req.body.email })
  if (existingUser) {
    throw new AppError('Validation failed', 409, [
      { field: 'email', message: 'Email already exists' }
    ])
  }

  const user = await User.create(req.body)
  res.status(201).json({ user, token: generateToken(user) })
})

// Global error handler - CONSISTENT format
app.use((err, req, res, next) => {
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry',
      errors: [{ field, message: `${field} already exists` }],
    })
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const errors = Object.entries(err.errors).map(([field, e]) => ({
      field,
      message: e.message,
    }))
    return res.status(400).json({ success: false, message: 'Validation failed', errors })
  }

  // Our AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    })
  }

  // Unknown error
  console.error(err)
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errors: [],
  })
})

// RESPONSE FORMAT (always same):
// {
//   "success": false,
//   "message": "Validation failed",
//   "errors": [
//     { "field": "email", "message": "Email already exists" },
//     { "field": "password", "message": "Password must be at least 6 characters" }
//   ]
// }


// === FRONTEND: React Form with Field Errors ===

function RegisterForm() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [generalError, setGeneralError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    setGeneralError('')

    try {
      const { data } = await api.post('/api/auth/register', formData)
      login(data)
    } catch (err) {
      const response = err.response?.data

      if (response?.errors?.length) {
        // Convert array to object keyed by field
        const errors = {}
        response.errors.forEach(e => { errors[e.field] = e.message })
        setFieldErrors(errors)
      } else {
        setGeneralError(response?.message || 'Something went wrong')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {generalError && <div className="error-banner">{generalError}</div>}

      <div>
        <input
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          className={fieldErrors.name ? 'input-error' : ''}
        />
        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
      </div>

      <div>
        <input
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
          className={fieldErrors.email ? 'input-error' : ''}
        />
        {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
      </div>

      <div>
        <input
          type="password"
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
          className={fieldErrors.password ? 'input-error' : ''}
        />
        {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
      </div>

      <button type="submit">Register</button>
    </form>
  )
}
```


---


## Scenario 9: Deploying MERN App to Production

**Q: Tumhara MERN app ready hai. Ab production mein deploy karna hai.
Frontend Vercel pe, Backend Railway/Render pe, Database MongoDB Atlas pe.
Kya kya configure karna padega? Kaunsi mistakes commonly hoti hain?**

**Answer:**

```
DEPLOYMENT ARCHITECTURE:
========================

Vercel (Frontend)          Railway/Render (Backend)         MongoDB Atlas
    React Build      →         Express API            →        Cloud DB
    Static files               Port from env                   Connection string
    REACT_APP_API_URL          CORS for Vercel domain          IP Whitelist
```

```js
// === Step 1: MongoDB Atlas Setup ===
// - Create cluster (free M0 tier)
// - Create database user (strong password)
// - Network Access: Add 0.0.0.0/0 (allow all IPs) for Railway/Render
//   (They have dynamic IPs - can't whitelist specific IP)
// - Get connection string


// === Step 2: Backend (Railway/Render) ===

// server.js - Production ready
const PORT = process.env.PORT || 5001  // Railway/Render provides PORT

// CORS - allow deployed frontend
app.use(cors({
  origin: [
    'http://localhost:3000',                    // local dev
    'https://your-app.vercel.app',             // production
    /\.vercel\.app$/,                           // preview deploys
  ],
  credentials: true,
}))

// Trust proxy (Railway/Render use reverse proxy)
app.set('trust proxy', 1)

// Serve frontend in production (if single server)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'))
  })
}

// Environment variables on Railway/Render:
// MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mydb
// JWT_SECRET=some-long-random-string-here
// NODE_ENV=production
// (PORT is auto-set by platform)


// === Step 3: Frontend (Vercel) ===

// .env.production (React)
// REACT_APP_API_URL=https://your-backend.railway.app/api

// api.js
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
})


// === COMMON MISTAKES ===

// Mistake 1: Hardcoded localhost in production
// BAD:
const api = axios.create({ baseURL: 'http://localhost:5001/api' })
// FIX: Use env variable

// Mistake 2: .env file pushed to git
// .gitignore MUST have: .env, .env.local, .env.production.local

// Mistake 3: CORS not updated for production domain
// Backend still has: origin: 'http://localhost:3000'
// FIX: Add production URL to CORS whitelist

// Mistake 4: MongoDB Atlas IP not whitelisted
// Error: "MongoServerError: connection refused"
// FIX: Network Access -> Allow 0.0.0.0/0

// Mistake 5: Build command wrong on Vercel
// Vercel settings:
//   Build Command: cd client && npm run build
//   Output Directory: client/build
//   Root Directory: / (or client/)

// Mistake 6: Mixed content (HTTP frontend calling HTTPS backend or vice versa)
// Browser blocks HTTP requests from HTTPS page
// FIX: Both must be HTTPS in production

// Mistake 7: process.env.PORT hardcoded
// BAD: app.listen(5001)
// FIX: app.listen(process.env.PORT || 5001)
```


---


## Scenario 10: Data Migration Without Downtime

**Q: Tumhara live app hai with 50K users. User schema mein change karna hai -
`name` field ko `firstName` + `lastName` mein split karna hai.
Frontend aur backend dono update karne hain. Bina downtime ke kaise karoge?**

**Answer:**

```js
// === STRATEGY: 3-Phase Migration ===
// Phase 1: Add new fields (backward compatible)
// Phase 2: Migrate data + update code
// Phase 3: Remove old field (cleanup)


// === Phase 1: Add new fields WITHOUT removing old ===

// Migration script (run once)
// scripts/migrate-names.js
async function migrateNames() {
  const users = await User.find({
    name: { $exists: true },
    firstName: { $exists: false },
  })

  console.log(`Migrating ${users.length} users...`)

  let migrated = 0
  for (const user of users) {
    const [firstName, ...rest] = user.name.split(' ')
    const lastName = rest.join(' ') || ''

    await User.updateOne(
      { _id: user._id },
      { $set: { firstName, lastName } }
      // NOT removing 'name' yet!
    )

    migrated++
    if (migrated % 1000 === 0) console.log(`${migrated}/${users.length}`)
  }

  console.log('Migration complete!')
}

// Schema (Phase 1): supports BOTH old and new
const userSchema = new mongoose.Schema({
  name: String,           // old field (keep for now)
  firstName: String,      // new field
  lastName: String,       // new field
  email: String,
})

// Virtual for backward compatibility
userSchema.virtual('fullName').get(function() {
  if (this.firstName) return `${this.firstName} ${this.lastName}`.trim()
  return this.name  // fallback to old field
})


// === Phase 2: Update backend + frontend code ===

// Backend: Accept both old and new format
router.put('/api/profile', protect, async (req, res) => {
  const update = {}

  // New format
  if (req.body.firstName !== undefined) {
    update.firstName = req.body.firstName
    update.lastName = req.body.lastName
    update.name = `${req.body.firstName} ${req.body.lastName}`.trim()
    // ^ keep old field in sync during transition
  }

  // Old format (backward compatible for old mobile app versions)
  if (req.body.name !== undefined && !req.body.firstName) {
    const [firstName, ...rest] = req.body.name.split(' ')
    update.name = req.body.name
    update.firstName = firstName
    update.lastName = rest.join(' ')
  }

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
  res.json(user)
})

// Frontend: Update form to use firstName/lastName
// (Deploy frontend changes - old API still works)


// === Phase 3: Cleanup (after confirming all users migrated) ===

// Verify migration complete
const unmigrated = await User.countDocuments({
  firstName: { $exists: false },
  name: { $exists: true },
})
console.log(`Unmigrated users: ${unmigrated}`)  // should be 0

// Remove old field
await User.updateMany(
  {},
  { $unset: { name: '' } }
)

// Update schema: remove 'name' field
```

**Timeline:**
```
Day 1: Deploy Phase 1 (add fields, run migration script) - zero downtime
Day 2: Deploy Phase 2 (update backend API + frontend forms) - zero downtime
Day 7: Verify all data migrated, deploy Phase 3 (remove old field) - zero downtime
```

**Key rule: NEVER remove a field and add new ones in the same deploy.
Always additive first, then cleanup later.**


---


## Scenario 11: Handling Concurrent Edits (Conflict Resolution)

**Q: Google Docs jaisa nahi but simple case: 2 users same todo edit kar rahe hain.
User A title change karta hai, User B description change karta hai - same time pe.
Last save wins toh ek ka kaam lost. Kaise handle karoge?**

**Answer:**

```js
// === STRATEGY: Optimistic Concurrency Control (Version Check) ===

// MongoDB Schema with version
const todoSchema = new mongoose.Schema({
  text: String,
  description: String,
  completed: Boolean,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  __v: Number,  // Mongoose version key (auto-managed)
}, { timestamps: true, optimisticConcurrency: true })
// optimisticConcurrency: true -> Mongoose checks __v on save


// === BACKEND: Version-aware update ===

router.put('/:id', protect, async (req, res) => {
  const { text, description, __v } = req.body
  // Client MUST send current __v (version they fetched)

  const todo = await Todo.findOne({ _id: req.params.id, user: req.user.id })

  if (!todo) {
    return res.status(404).json({ error: 'Not found' })
  }

  // Check version conflict
  if (todo.__v !== __v) {
    // Someone else updated since you fetched
    return res.status(409).json({
      error: 'Conflict: This item was modified by someone else',
      currentData: todo,  // send latest version so client can merge
      yourVersion: __v,
      currentVersion: todo.__v,
    })
  }

  // No conflict - update
  if (text !== undefined) todo.text = text
  if (description !== undefined) todo.description = description

  await todo.save()  // __v auto-increments
  res.json(todo)
})


// === FRONTEND: Handle conflict ===

const updateTodo = async (id, updates) => {
  try {
    const { data } = await api.put(`/api/todos/${id}`, {
      ...updates,
      __v: todo.__v,  // send version with every update
    })
    setTodo(data)  // update with server response (new __v)
  } catch (err) {
    if (err.response?.status === 409) {
      const { currentData } = err.response.data

      // Option 1: Auto-merge (if different fields changed)
      // Option 2: Show conflict to user
      const keepTheirs = window.confirm(
        'Someone else edited this. Load their changes? (Cancel to overwrite)'
      )

      if (keepTheirs) {
        setTodo(currentData)  // accept server version
      } else {
        // Force update with new version
        await api.put(`/api/todos/${id}`, {
          ...updates,
          __v: currentData.__v,  // use latest version
        })
      }
    }
  }
}
```


---


## Scenario 12: Environment-Specific Configuration

**Q: Tumhara app 3 environments mein chalega - development, staging, production.
Database alag, API URLs alag, features alag (staging mein debug mode on, production mein off).
Poora config system kaise set up karoge?**

**Answer:**

```js
// === BACKEND: Config Management ===

// config/index.js
const configs = {
  development: {
    port: 5001,
    mongoUri: 'mongodb://localhost:27017/myapp_dev',
    jwtSecret: 'dev-secret-not-for-production',
    corsOrigin: ['http://localhost:3000'],
    logLevel: 'debug',
    rateLimitMax: 1000,  // relaxed for dev
  },
  staging: {
    port: process.env.PORT,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: ['https://staging.myapp.com'],
    logLevel: 'info',
    rateLimitMax: 200,
  },
  production: {
    port: process.env.PORT,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: ['https://myapp.com', 'https://www.myapp.com'],
    logLevel: 'error',
    rateLimitMax: 100,
  },
}

const env = process.env.NODE_ENV || 'development'
const config = configs[env]

// Validate required env vars in staging/production
if (env !== 'development') {
  const required = ['MONGODB_URI', 'JWT_SECRET']
  const missing = required.filter(key => !process.env[key])
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`)
    process.exit(1)
  }
}

module.exports = config

// Usage in server.js
const config = require('./config')
app.listen(config.port)
mongoose.connect(config.mongoUri)
app.use(cors({ origin: config.corsOrigin }))


// === FRONTEND: Environment Config ===

// .env.development
// REACT_APP_API_URL=http://localhost:5001/api
// REACT_APP_ENV=development

// .env.staging
// REACT_APP_API_URL=https://api-staging.myapp.com/api
// REACT_APP_ENV=staging

// .env.production
// REACT_APP_API_URL=https://api.myapp.com/api
// REACT_APP_ENV=production

// Feature flags
const features = {
  development: { debugMode: true, mockPayments: true, showDevTools: true },
  staging:     { debugMode: true, mockPayments: true, showDevTools: false },
  production:  { debugMode: false, mockPayments: false, showDevTools: false },
}

export const featureFlags = features[process.env.REACT_APP_ENV || 'development']

// Usage in component:
{featureFlags.showDevTools && <DevToolsPanel />}
{featureFlags.debugMode && <DebugInfo query={query} />}
```

**File structure:**
```
project/
├── .env                 # local dev (gitignored)
├── .env.example         # template (committed)
├── client/
│   ├── .env.development
│   ├── .env.staging
│   └── .env.production
└── server/
    ├── config/
    │   └── index.js     # environment configs
    └── .env             # local dev (gitignored)
```


---


*Total: 12 MERN Full Stack Scenario Questions*
*Difficulty: Intermediate to Advanced*
*Covers: Auth flow, real-time, uploads, pagination, RBAC, deployment, migration, error handling, concurrency*
*Ye sab combined MERN questions hain - har answer mein React + Express + MongoDB teeno involved hain*

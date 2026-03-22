# Node.js + Express - Scenario Based Interview Questions

> "Backend mein kya hoga agar..." wale questions

---


## Scenario 1: Event Loop Blocking

**Q: Tumhara Node.js server hai jismein ek API endpoint CSV file parse karta hai (50MB).
Jab ek user is API ko hit karta hai, baaki sab users ke requests hang ho jaate hain.
Kya problem hai aur kaise fix karoge?**

**Answer:**

Problem: Node.js single-threaded hai. 50MB CSV parsing = CPU-intensive = event loop BLOCKED.
Jab tak parsing complete nahi hoti, koi bhi request process nahi hogi.

```js
// BAD: Blocks event loop
app.post('/api/parse-csv', (req, res) => {
  const data = fs.readFileSync('large.csv')     // blocks
  const parsed = parseCSV(data)                   // blocks (CPU heavy)
  res.json(parsed)
})


// FIX 1: Worker Thread (BEST for CPU-intensive)
const { Worker } = require('worker_threads')

app.post('/api/parse-csv', (req, res) => {
  const worker = new Worker('./workers/csvParser.js', {
    workerData: { filePath: 'large.csv' }
  })

  worker.on('message', (result) => res.json(result))
  worker.on('error', (err) => res.status(500).json({ error: err.message }))
})

// workers/csvParser.js
const { parentPort, workerData } = require('worker_threads')
const result = parseCSV(fs.readFileSync(workerData.filePath))
parentPort.postMessage(result)


// FIX 2: Streams (for file processing)
app.post('/api/parse-csv', (req, res) => {
  const results = []
  fs.createReadStream('large.csv')
    .pipe(csvParser())          // process chunk by chunk
    .on('data', (row) => results.push(row))
    .on('end', () => res.json(results))
})
// Streams process in chunks -> event loop stays free between chunks


// FIX 3: Bull Queue (background job)
const Queue = require('bull')
const csvQueue = new Queue('csv-processing')

app.post('/api/parse-csv', async (req, res) => {
  const job = await csvQueue.add({ filePath: 'large.csv' })
  res.json({ jobId: job.id, status: 'processing' })
})

// Client polls: GET /api/jobs/:id for status
```


---


## Scenario 2: Memory Leak in Production

**Q: Tumhara Node.js server 2-3 din baad crash ho jaata hai with "FATAL ERROR: CALL_AND_RETRY_LAST
Allocation failed - JavaScript heap out of memory". Restart karne pe theek ho jaata hai.
Kya ho raha hai? Kaise debug karoge?**

**Answer:**

Step 1 - Confirm memory leak:
```bash
# Monitor memory usage over time
node --max-old-space-size=4096 server.js

# In code: log memory usage
setInterval(() => {
  const used = process.memoryUsage()
  console.log(`Heap: ${Math.round(used.heapUsed / 1024 / 1024)} MB`)
}, 30000)
```

Step 2 - Common causes:

```js
// Cause 1: Global arrays/objects that keep growing
const cache = {}  // NEVER cleared
app.get('/api/data/:id', (req, res) => {
  cache[req.params.id] = fetchData(req.params.id)  // grows forever
  res.json(cache[req.params.id])
})

// FIX: Use LRU cache with max size
const LRU = require('lru-cache')
const cache = new LRU({ max: 500, ttl: 1000 * 60 * 5 })  // max 500 items, 5 min TTL


// Cause 2: Event listeners not removed
app.get('/api/stream', (req, res) => {
  emitter.on('data', handler)  // adds listener every request
  // Never removed! After 1000 requests = 1000 listeners
})

// FIX: Remove on connection close
app.get('/api/stream', (req, res) => {
  const handler = (data) => res.write(data)
  emitter.on('data', handler)
  req.on('close', () => emitter.off('data', handler))
})


// Cause 3: Closures holding references
function createHandler() {
  const hugeData = loadHugeDataset()  // 100MB
  return (req, res) => {
    // hugeData is captured in closure, never GC'd
    res.json(hugeData.filter(x => x.id === req.params.id))
  }
}


// Cause 4: Unresolved promises accumulating
async function processItems(items) {
  // BAD: all promises in memory at once
  const promises = items.map(item => heavyProcess(item))
  await Promise.all(promises)  // 10K items = 10K promises in memory

  // FIX: Process in batches
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100)
    await Promise.all(batch.map(item => heavyProcess(item)))
  }
}
```

Step 3 - Debug tools:
```bash
# Heap snapshot
node --inspect server.js
# Open chrome://inspect -> Take heap snapshot -> Compare snapshots

# clinic.js (amazing tool)
npx clinic doctor -- node server.js
# Gives visual report of event loop delay, memory, CPU
```


---


## Scenario 3: API Response Time Suddenly Slow

**Q: Tumhara ek API endpoint kal tak 50ms mein respond karta tha,
aaj 3 seconds le raha hai. Code nahi badla. Kya check karoge?**

**Answer:**

Systematic debugging approach:

```
Step 1: Is it ALL APIs or just ONE?
  - If ALL slow -> server/infra issue (DB, network, CPU)
  - If ONE slow -> that specific endpoint's logic

Step 2: Check database
  - db.currentOp() -> koi long running query toh nahi?
  - MongoDB slow query log enable karo
  - Check: kisi ne index drop toh nahi kiya?
  - Check: database size suddenly badha? (data growth)

Step 3: Check server resources
  - CPU usage: top / htop
  - Memory: free -m
  - Disk I/O: iostat
  - Network: is the DB on different server? Network latency?

Step 4: Add timing logs
```

```js
// Add middleware to log slow requests
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    if (duration > 1000) {  // log if > 1 second
      console.warn(`SLOW: ${req.method} ${req.path} - ${duration}ms`)
    }
  })
  next()
})

// Add granular timing inside route
app.get('/api/orders', async (req, res) => {
  console.time('db-query')
  const orders = await Order.find({ userId: req.user.id })
  console.timeEnd('db-query')         // "db-query: 2800ms" <- FOUND IT

  console.time('populate')
  await Order.populate(orders, 'items')
  console.timeEnd('populate')

  console.time('serialize')
  const result = orders.map(formatOrder)
  console.timeEnd('serialize')

  res.json(result)
})
```

```
Step 5: Common culprits
  - Missing index (data grew, now full collection scan)
  - N+1 query problem (loop mein DB calls)
  - External API slow (payment gateway, email service)
  - Connection pool exhausted (too many concurrent DB connections)
  - DNS resolution slow (if connecting to external services)
```


---


## Scenario 4: N+1 Query Problem

**Q: Tumhara orders API 100 orders return karta hai. Har order mein user info bhi chahiye.
API bahut slow hai. Database logs mein dekha toh 101 queries ja rahi hain ek request pe.
Kya ho raha hai?**

**Answer:**

Classic N+1 problem: 1 query for orders + 100 queries for each order's user

```js
// BAD: N+1 queries
app.get('/api/orders', async (req, res) => {
  const orders = await Order.find()  // Query 1: get 100 orders

  const result = await Promise.all(orders.map(async (order) => {
    const user = await User.findById(order.userId)  // Query 2-101!
    return { ...order.toObject(), user }
  }))

  res.json(result)
})
// Total: 101 queries!


// FIX 1: Mongoose populate (BEST)
const orders = await Order.find().populate('userId')
// Total: 2 queries (orders + users WHERE _id IN [...])


// FIX 2: Manual batch loading
const orders = await Order.find()
const userIds = [...new Set(orders.map(o => o.userId.toString()))]
const users = await User.find({ _id: { $in: userIds } })
const userMap = new Map(users.map(u => [u._id.toString(), u]))

const result = orders.map(order => ({
  ...order.toObject(),
  user: userMap.get(order.userId.toString())
}))
// Total: 2 queries (regardless of 100 or 10,000 orders)


// FIX 3: Aggregation with $lookup
const orders = await Order.aggregate([
  { $match: { status: 'active' } },
  { $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'user'
  }},
  { $unwind: '$user' }
])
// Total: 1 query (MongoDB does the join)
```


---


## Scenario 5: Handling 1000 Concurrent Requests

**Q: Tumhara Node.js server ek machine pe chal raha hai. Suddenly traffic 10x badhta hai -
1000 concurrent requests aa rahe hain. Server slow ho gaya, kuch requests timeout ho rahe hain.
Kya karoge? Server add karna abhi possible nahi hai.**

**Answer:**

Single machine optimization strategy:

```js
// Step 1: Cluster mode - use ALL CPU cores
// cluster.js
const cluster = require('cluster')
const numCPUs = require('os').cpus().length

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} - spawning ${numCPUs} workers`)
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, respawning...`)
    cluster.fork()  // auto-restart crashed workers
  })
} else {
  require('./server.js')  // each worker runs the server
}

// OR simply use PM2:
// pm2 start server.js -i max


// Step 2: Response caching (Redis)
const redis = require('redis')
const client = redis.createClient()

const cacheMiddleware = (ttl) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`
  const cached = await client.get(key)
  if (cached) {
    return res.json(JSON.parse(cached))  // serve from cache
  }
  // Override res.json to cache response
  const originalJson = res.json.bind(res)
  res.json = (data) => {
    client.setEx(key, ttl, JSON.stringify(data))
    originalJson(data)
  }
  next()
}

app.get('/api/products', cacheMiddleware(60), getProducts)  // 60 sec cache


// Step 3: Connection pooling (MongoDB)
mongoose.connect(uri, {
  maxPoolSize: 50,       // increase from default 5
  minPoolSize: 10,
  maxIdleTimeMS: 10000,
})


// Step 4: Compression
const compression = require('compression')
app.use(compression())  // gzip responses (70-80% size reduction)


// Step 5: Rate limiting (protect from abuse)
const rateLimit = require('express-rate-limit')
app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // 100 requests per minute per IP
}))


// Step 6: Response pagination (don't return 10K items)
app.get('/api/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = Math.min(parseInt(req.query.limit) || 20, 100)  // max 100

  const products = await Product.find()
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()  // .lean() = plain JS objects, skip Mongoose overhead

  res.json({ data: products, page, limit })
})
```


---


## Scenario 6: Unhandled Promise Rejection Crashing Server

**Q: Tumhara production server randomly crash ho jaata hai.
Logs mein "UnhandledPromiseRejectionWarning" dikh raha hai.
Kaise find aur fix karoge?**

**Answer:**

```js
// Step 1: Global handlers (safety net)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Log to Sentry/monitoring
  // Do NOT exit - just log and continue
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Log to monitoring
  // Graceful shutdown (this IS dangerous, should restart)
  process.exit(1)
})


// Step 2: Express async error handling
// BAD: async error not caught
app.get('/api/data', async (req, res) => {
  const data = await fetchExternalAPI()  // if this throws -> crash
  res.json(data)
})

// FIX: Wrap async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchExternalAPI()  // error -> caught -> error middleware
  res.json(data)
}))

// Express 5 handles this natively (no wrapper needed)


// Step 3: Global error middleware (MUST be last)
app.use((err, req, res, next) => {
  console.error('Error:', err.message)

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message })
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry' })
  }

  res.status(500).json({ error: 'Internal server error' })
})
```


---


## Scenario 7: File Upload - Large Files

**Q: Users ko 500MB video files upload karna hai. Normal multer setup mein
request timeout ho jaata hai aur memory full ho jaati hai. Kaise handle karoge?**

**Answer:**

```js
// BAD: Multer default = memory storage (file in RAM)
const upload = multer({ storage: multer.memoryStorage() })
// 500MB file = 500MB RAM consumed!


// FIX 1: Stream to disk
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads',
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 500 * 1024 * 1024 }  // 500MB limit
})


// FIX 2: Stream directly to S3 (BEST - no local disk needed)
const { Upload } = require('@aws-sdk/lib-storage')
const { S3Client } = require('@aws-sdk/client-s3')

app.post('/api/upload', (req, res) => {
  const s3Upload = new Upload({
    client: new S3Client({ region: 'ap-south-1' }),
    params: {
      Bucket: 'my-bucket',
      Key: `videos/${Date.now()}-${req.headers['x-filename']}`,
      Body: req,  // stream request body directly to S3
      ContentType: req.headers['content-type'],
    },
  })

  s3Upload.on('httpUploadProgress', (progress) => {
    console.log(`Uploaded: ${progress.loaded}/${progress.total}`)
  })

  s3Upload.done()
    .then(data => res.json({ url: data.Location }))
    .catch(err => res.status(500).json({ error: err.message }))
})


// FIX 3: Presigned URL (BEST for production)
// Server generates a presigned S3 URL -> Client uploads directly to S3
// Server never touches the file!

app.get('/api/upload-url', async (req, res) => {
  const command = new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: `videos/${Date.now()}-${req.query.filename}`,
    ContentType: req.query.contentType,
  })

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  res.json({ uploadUrl: url })
})

// Frontend:
// 1. GET /api/upload-url -> get presigned URL
// 2. PUT file directly to S3 URL (with progress tracking)
// Server = zero load, handles any file size
```


---


## Scenario 8: Graceful Shutdown

**Q: Tumhara server pe currently 50 active requests process ho rahe hain.
Tum naya deployment karna chahte ho. Agar server turant kill karo toh
50 users ka data corrupt ho sakta hai. Kaise handle karoge?**

**Answer:**

```js
const server = app.listen(3001)
let isShuttingDown = false

// Reject new connections during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close')
    return res.status(503).json({ error: 'Server is shutting down' })
  }
  next()
})

function gracefulShutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`)
  isShuttingDown = true

  // Step 1: Stop accepting new connections
  server.close(() => {
    console.log('All connections closed')

    // Step 2: Close database connections
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed')

      // Step 3: Close Redis
      redisClient.quit(() => {
        console.log('Redis connection closed')
        process.exit(0)
      })
    })
  })

  // Step 3: Force kill after 30 seconds (safety net)
  setTimeout(() => {
    console.error('Forced shutdown after 30s timeout')
    process.exit(1)
  }, 30000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
```


---


## Scenario 9: Rate Limiting Strategies

**Q: Tumhara login API hai. Koi attacker brute force kar raha hai - 1000 requests per second
different passwords try kar raha hai. Kaise rokoge?**

**Answer:**

```js
// Layer 1: IP-based rate limiting (express-rate-limit)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per window
  message: { error: 'Too many login attempts. Try after 15 minutes.' },
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
})
app.post('/api/auth/login', loginLimiter, loginController)


// Layer 2: Account-based lockout (Redis)
const loginAttempts = async (req, res, next) => {
  const key = `login_attempts:${req.body.email}`
  const attempts = await redis.incr(key)

  if (attempts === 1) {
    await redis.expire(key, 900)  // 15 min window
  }

  if (attempts > 5) {
    return res.status(429).json({
      error: 'Account locked for 15 minutes due to too many failed attempts'
    })
  }

  next()
}

// On successful login: clear attempts
const loginController = async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (user && await user.matchPassword(req.body.password)) {
    await redis.del(`login_attempts:${req.body.email}`)  // reset
    return res.json({ token: generateToken(user) })
  }
  res.status(401).json({ error: 'Invalid credentials' })
}


// Layer 3: Slow down responses (make brute force expensive)
const slowDown = require('express-slow-down')

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,        // after 3 requests
  delayMs: (hits) => hits * 500,  // add 500ms per request
  // 4th request: +500ms, 5th: +1000ms, 6th: +1500ms
})
app.post('/api/auth/login', speedLimiter, loginController)


// Layer 4: CAPTCHA after N failures
// After 3 failed attempts -> require CAPTCHA token
// Use Google reCAPTCHA or hCaptcha
```


---


## Scenario 10: Environment Variables Exposed

**Q: Tumne accidentally .env file commit kar di jismein database URI, JWT secret,
aur API keys thein. Push bhi ho gaya. Ab kya karoge?**

**Answer:**

```
IMMEDIATELY (next 5 minutes):
1. Rotate ALL exposed secrets:
   - Change MongoDB password
   - Generate new JWT secret (invalidates all existing tokens)
   - Revoke and regenerate all API keys
   - Change any third-party service passwords

2. Remove from git history:
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all

   OR use BFG Repo Cleaner (faster):
   bfg --delete-files .env
   git push --force

3. Add .env to .gitignore (if not already):
   echo ".env" >> .gitignore

PREVENTION:
- .gitignore mein .env hona chahiye DAY 1 se
- Use .env.example (with dummy values) for reference
- pre-commit hook: detect secrets before commit
  (use tools like git-secrets, detect-secrets, gitleaks)
- Use environment variables from hosting platform (Vercel, Heroku, AWS)
  not .env files in production
```


---


## Scenario 11: Middleware Ordering Bug

**Q: Tumne CORS middleware add kiya but frontend se request mein
"Access-Control-Allow-Origin" header nahi aa raha. Postman se kaam karta hai.
Kya problem hai?**

**Answer:**

```js
// BUG: Middleware order matters!
// CORS middleware MUST be before routes

// BAD: CORS after routes
app.get('/api/data', getDataController)
app.use(cors())  // too late! Routes already handled


// FIX: CORS BEFORE routes
app.use(cors({
  origin: ['http://localhost:3000', 'https://myapp.vercel.app'],
  credentials: true,     // for cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

app.use(express.json())    // body parser
app.use(morgan('dev'))     // logger

// THEN routes
app.use('/api/auth', authRoutes)
app.use('/api/todos', todoRoutes)

// LAST: error handler
app.use(errorHandler)


// Express middleware order (correct):
// 1. cors()
// 2. helmet() (security headers)
// 3. compression()
// 4. express.json() / express.urlencoded()
// 5. morgan (logging)
// 6. Custom middleware (auth, rate limiting)
// 7. Routes
// 8. 404 handler
// 9. Error handler (4 params: err, req, res, next)
```

Postman kaam karta hai kyunki Postman browser nahi hai - CORS sirf browsers enforce karte hain.


---


## Scenario 12: Database Connection Pool Exhausted

**Q: Tumhara server 5 min baad slow ho jaata hai. Logs mein "MongoServerError: connection pool
is exhausted" aa raha hai. Kya ho raha hai?**

**Answer:**

```js
// Problem: Connections open ho rahe hain but close nahi ho rahe

// Cause 1: Creating new connection per request
// BAD:
app.get('/api/data', async (req, res) => {
  const conn = await mongoose.createConnection(uri)  // NEW connection per request!
  const data = await conn.model('User').find()
  res.json(data)
  // Connection never closed!
})

// FIX: Single connection at startup (reuse)
mongoose.connect(uri, { maxPoolSize: 10 })
// All routes use the same connection pool


// Cause 2: Long-running queries holding connections
// FIX: Set query timeout
mongoose.connect(uri, {
  maxPoolSize: 20,
  socketTimeoutMS: 30000,     // 30 sec query timeout
  serverSelectionTimeoutMS: 5000,
})


// Cause 3: Not using .lean() for read-only queries
// Each Mongoose document has overhead, holds connection longer
const users = await User.find().lean()  // plain objects, faster


// Monitoring:
mongoose.connection.on('connected', () => console.log('DB connected'))
mongoose.connection.on('disconnected', () => console.log('DB disconnected'))

// Check pool status
const poolSize = mongoose.connection.client.s.options.maxPoolSize
console.log('Pool size:', poolSize)
```


---


## Scenario 13: Circular Dependency

**Q: Tumhara Node.js app start nahi ho raha. Require/import mein
undefined mil raha hai kuch modules mein. Koi error message clear nahi hai.
Kya check karoge?**

**Answer:**

Classic circular dependency: A requires B, B requires A -> one gets empty object

```js
// userService.js
const orderService = require('./orderService')  // loads orderService
module.exports = {
  getUser: (id) => { ... },
  getUserOrders: (id) => orderService.getOrdersByUser(id)
}

// orderService.js
const userService = require('./userService')  // userService = {} (empty! still loading)
module.exports = {
  getOrdersByUser: (userId) => { ... },
  getOrderWithUser: (id) => userService.getUser(id)  // ERROR: getUser is undefined
}


// FIX 1: Dependency injection
// orderService.js - don't require userService
module.exports = {
  getOrderWithUser: (id, userService) => {  // passed in, not required
    return userService.getUser(id)
  }
}


// FIX 2: Move shared logic to a third module
// userOrderService.js (depends on both)
const userService = require('./userService')
const orderService = require('./orderService')

module.exports = {
  getOrderWithUserDetails: async (orderId) => {
    const order = await orderService.getOrder(orderId)
    const user = await userService.getUser(order.userId)
    return { ...order, user }
  }
}


// FIX 3: Lazy require (inside function, not at top)
// orderService.js
module.exports = {
  getOrderWithUser: (id) => {
    const userService = require('./userService')  // loaded when function called
    return userService.getUser(id)                // not circular anymore
  }
}


// DETECT: Use madge tool
// npx madge --circular src/
// Shows all circular dependencies in your project
```


---


## Scenario 14: JWT Token Expired - User Experience

**Q: User login karta hai, JWT token milta hai (1 hour expiry). User 50 minutes
kaam karta hai, phir ek action karta hai - "Token expired, please login again".
User ka unsaved work lost. Kaise solve karoge?**

**Answer:**

```js
// Solution: Access Token + Refresh Token pattern

// LOGIN: Return both tokens
const login = async (req, res) => {
  const user = await authenticateUser(req.body)

  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }          // short-lived
  )

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }           // long-lived
  )

  // Store refresh token in httpOnly cookie (more secure)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })

  res.json({ accessToken })
}


// REFRESH ENDPOINT
app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' })

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET)
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )
    res.json({ accessToken: newAccessToken })
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})


// FRONTEND: Axios interceptor for auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { data } = await axios.post('/api/auth/refresh')
        localStorage.setItem('accessToken', data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return api(originalRequest)  // retry original request
      } catch (refreshError) {
        // Refresh also failed -> force logout
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
```

User ka experience: Token silently refresh hota hai, user ko pata bhi nahi chalta.


---


## Scenario 15: Zero Downtime Deployment

**Q: Tumhara production server 24/7 live hai. Users active hain.
Naya code deploy karna hai bina downtime ke. Kaise karoge?**

**Answer:**

```bash
# Strategy 1: PM2 reload (simplest)
pm2 start server.js -i max --name "api"
pm2 reload api  # gracefully restarts workers one-by-one

# How it works:
# 1. PM2 starts new worker with new code
# 2. New worker signals "ready"
# 3. PM2 sends SIGTERM to old worker
# 4. Old worker finishes current requests, then exits
# 5. Repeat for each worker
# Result: always at least 1 worker running = zero downtime


# Strategy 2: Blue-Green deployment
# Two identical environments: Blue (current) + Green (new)
# 1. Deploy new code to Green
# 2. Test Green
# 3. Switch load balancer from Blue -> Green
# 4. If something breaks -> switch back to Blue instantly


# Strategy 3: Rolling update (Docker/Kubernetes)
# In docker-compose.yml or k8s:
# 1. Start new containers with new image
# 2. Health check passes -> route traffic to new containers
# 3. Drain old containers (finish current requests)
# 4. Kill old containers
```

```js
// PM2 ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    wait_ready: true,         // wait for process.send('ready')
    listen_timeout: 10000,
    kill_timeout: 5000,       // time to finish current requests
  }]
}

// In server.js: signal PM2 when ready
server.listen(3001, () => {
  console.log('Server ready')
  process.send('ready')  // tell PM2 this worker is ready
})
```


---


*Total: 15 Node.js + Express Scenario Questions*
*Difficulty: Intermediate to Advanced*
*Covers: Event loop, memory, performance, security, deployment, debugging*

# Debugging Production - Scenario Based Interview Questions

> "Production mein kuch bhi ho sakta hai - ye questions test karte hain ki tum pressure mein kaise debug karte ho"


---


## Scenario 1: 502 Bad Gateway

**Q: Users report kar rahe hain ki app "502 Bad Gateway" dikha raha hai. Nginx + Node.js setup hai. Kya check karoge?**

**A:** 502 Bad Gateway ka matlab hai ki Nginx ne request forward ki Node.js server ko, lekin Node.js se koi response nahi aaya. Ye ek reverse proxy error hai - Nginx keh raha hai "mere peeche wala banda kaam nahi kar raha."

**Step 1: Sabse pehle Node.js process check karo - kya alive hai?**

```bash
# PM2 se check karo ki process chal raha hai ya nahi
pm2 status
pm2 list

# Agar PM2 nahi hai toh manually check karo
ps aux | grep node

# Kya port pe kuch listen kar raha hai?
lsof -i :3000
netstat -tlnp | grep 3000
```

**Step 2: PM2 logs check karo - crash ka reason milega**

```bash
# PM2 error logs
pm2 logs --err --lines 100

# Ya directly log file
tail -100 ~/.pm2/logs/app-error.log

# Agar process baar baar restart ho raha hai
pm2 describe app-name
# Dekho "restart time" aur "unstable restarts"
```

**Step 3: Nginx error logs check karo**

```bash
# Nginx error log - yahan exact error milega
tail -50 /var/log/nginx/error.log

# Common errors jo dikhenge:
# "connect() failed (111: Connection refused)" - Node process dead
# "upstream timed out (110: Connection timed out)" - Node response slow
# "no live upstreams" - sab backend servers dead
```

**Step 4: Nginx config verify karo - port mismatch toh nahi?**

```bash
# Nginx config check karo
cat /etc/nginx/sites-enabled/myapp

# Ye ensure karo ki upstream port match karta hai
```

```js
// Nginx config mein agar ye hai:
// proxy_pass http://localhost:3000;

// Toh Node.js mein bhi 3000 pe hi listen hona chahiye
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Common galti: .env mein PORT=5000 hai, Nginx mein 3000 likha hai
```

**Step 5: OOM Kill check karo - kya system ne process maar diya?**

```bash
# Check karo ki kernel ne OOM kill toh nahi kiya
dmesg | grep -i "out of memory"
dmesg | grep -i "killed process"

# Ya journal se check karo
journalctl -u myapp --since "1 hour ago" | grep -i "kill\|oom\|memory"
```

**Common Fixes:**

```bash
# Fix 1: Process restart karo
pm2 restart app-name

# Fix 2: Agar port conflict hai
kill $(lsof -t -i:3000)
pm2 restart app-name

# Fix 3: Nginx upstream timeout badhaao
# /etc/nginx/sites-enabled/myapp mein:
```

```js
// Nginx config fix for timeout
// proxy_connect_timeout 60s;
// proxy_send_timeout 60s;
// proxy_read_timeout 60s;

// Fix 4: Node.js mein graceful shutdown add karo
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log the error, then gracefully shutdown
  process.exit(1); // PM2 will restart
});
```

**Prevention:**

```bash
# PM2 ecosystem file banaao with auto-restart config
# ecosystem.config.js
```

```js
module.exports = {
  apps: [{
    name: 'myapp',
    script: './server.js',
    instances: 2,              // 2 instances for redundancy
    max_memory_restart: '500M', // Memory limit se pehle restart
    exp_backoff_restart_delay: 100,
    watch: false,
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```


---


## Scenario 2: Memory Keeps Growing

**Q: Server ki memory usage har ghante badh rahi hai. 24 hours baad server crash ho jaata hai. Kaise debug karoge?**

**A:** Ye classic memory leak hai. Memory badhti ja rahi hai aur garbage collector free nahi kar pa raha. Iska matlab koi reference hai jo hata nahi raha, toh GC usko reclaim nahi kar sakta.

**Step 1: Pehle confirm karo ki memory leak hai - track karo over time**

```js
// Simple memory tracking - apne server mein add karo
setInterval(() => {
  const used = process.memoryUsage();
  console.log({
    timestamp: new Date().toISOString(),
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,       // Total memory
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,  // Actual usage
    external: `${Math.round(used.external / 1024 / 1024)} MB`
  });
}, 60000); // Har 1 minute mein log karo

// Agar heapUsed continuously badh raha hai bina girne ke = MEMORY LEAK
```

**Step 2: Heap Snapshot lo aur compare karo**

```bash
# Node.js ko --inspect flag ke saath start karo
node --inspect server.js

# Ya PM2 ke saath
pm2 start server.js --node-args="--inspect"

# Chrome mein jaao: chrome://inspect
# "Open dedicated DevTools for Node" pe click karo
# Memory tab -> Take Heap Snapshot
# 5 min baad ek aur snapshot lo
# "Comparison" view mein dekho ki kya badh raha hai
```

**Step 3: clinic.js use karo - ye professional tool hai**

```bash
# Install karo
npm install -g clinic

# Heap profiling
clinic heapprofiler -- node server.js
# Load daalo apni API pe (artillery ya ab se)
# Ctrl+C karo - report generate hoga browser mein

# Doctor mode - overall health check
clinic doctor -- node server.js
```

**Step 4: Common memory leak sources dhundho**

```js
// LEAK 1: Global array jo bada hota jaata hai
// BAD - ye kabhi shrink nahi hoga
const requestLog = [];
app.use((req, res, next) => {
  requestLog.push({ url: req.url, time: Date.now() }); // Infinite growth!
  next();
});

// FIX - Size limit lagao ya external logging use karo
const requestLog = [];
const MAX_LOG_SIZE = 1000;
app.use((req, res, next) => {
  if (requestLog.length >= MAX_LOG_SIZE) {
    requestLog.splice(0, requestLog.length - MAX_LOG_SIZE / 2);
  }
  requestLog.push({ url: req.url, time: Date.now() });
  next();
});


// LEAK 2: Event listeners accumulate ho rahe hain
// BAD - har request pe naya listener add ho raha hai
app.get('/stream', (req, res) => {
  eventEmitter.on('data', (data) => { // Ye kabhi remove nahi hoga!
    res.write(data);
  });
});

// FIX - Cleanup karo jab connection band ho
app.get('/stream', (req, res) => {
  const handler = (data) => res.write(data);
  eventEmitter.on('data', handler);
  req.on('close', () => {
    eventEmitter.removeListener('data', handler); // Cleanup!
  });
});


// LEAK 3: Closures jo bade objects reference karte hain
// BAD
function processData() {
  const hugeData = getHugeDataFromDB(); // 100MB object
  return function reportGenerator() {
    // Sirf ek field chahiye but poora hugeData memory mein hai
    return hugeData.summary;
  };
}

// FIX - Sirf jo chahiye wo extract karo
function processData() {
  const hugeData = getHugeDataFromDB();
  const summary = hugeData.summary; // Extract only what you need
  return function reportGenerator() {
    return summary;
  };
}


// LEAK 4: Unclosed database connections / streams
// BAD
app.get('/export', async (req, res) => {
  const cursor = db.collection('users').find({});
  // Agar error aaya toh cursor open rahega
  cursor.forEach(doc => res.write(JSON.stringify(doc)));
});

// FIX
app.get('/export', async (req, res) => {
  const cursor = db.collection('users').find({});
  try {
    for await (const doc of cursor) {
      res.write(JSON.stringify(doc));
    }
  } finally {
    await cursor.close(); // Always close!
  }
});
```

**Step 5: Production mein safe fix deploy karo**

```js
// Temporary relief - PM2 auto restart on memory limit
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'myapp',
    script: './server.js',
    max_memory_restart: '512M', // 512MB pe auto restart
    node_args: '--max-old-space-size=512'
  }]
};
```

**Prevention:**

```js
// 1. Memory monitoring with alerts
const memoryThreshold = 400 * 1024 * 1024; // 400MB

setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  if (heapUsed > memoryThreshold) {
    // Alert bhejo - Slack, PagerDuty, etc.
    sendAlert(`Memory warning: ${Math.round(heapUsed / 1024 / 1024)}MB used`);
  }
}, 30000);

// 2. Load testing mein memory profile karo BEFORE deployment
// 3. Review mein closures aur global variables pe dhyan do
// 4. WeakMap / WeakRef use karo jahan possible ho
```


---


## Scenario 3: CPU 100% Spike

**Q: Suddenly CPU 100% pe aa gaya hai. API responses mein 30+ seconds lag rahe hain. Kaise diagnose karoge?**

**A:** CPU 100% matlab koi computation hai jo event loop block kar rahi hai. Node.js single threaded hai, toh ek heavy operation poori application ko rok deta hai.

**Step 1: Confirm karo ki Node.js hi CPU kha raha hai**

```bash
# Top se dekho ki kaunsa process hai
top -c
htop

# Specifically node process dhundho
ps aux | grep node | sort -k3 -rn | head -5

# CPU percentage per process
pidstat -p $(pgrep -f "node server") 1
```

**Step 2: Live profiling karo - production mein**

```bash
# Method 1: Built-in profiler
# Pehle running process ka PID lo
kill -USR1 $(pgrep -f "node server")
# Ye --inspect mode enable karega without restart
# Chrome DevTools connect karo aur CPU profile lo

# Method 2: Clinic.js flame graph
clinic flame -- node server.js
# Ab load reproduce karo
# Ctrl+C - flame graph dikhega

# Method 3: Node --prof flag (restart required)
node --prof server.js
# Traffic aane do
# Ctrl+C
node --prof-process isolate-0x*.log > processed.txt
# processed.txt mein dekho ki kaunsa function sabse zyada time le raha
```

**Step 3: Common CPU hog causes check karo**

```js
// CAUSE 1: Infinite loop ya accidental infinite recursion
// BAD
app.get('/process', (req, res) => {
  let result = [];
  let i = 0;
  while (i < data.length) {
    result.push(transform(data[i]));
    // OOPS: i++ bhool gaye -> infinite loop!
  }
  res.json(result);
});

// FIX: Always ensure loop termination
app.get('/process', (req, res) => {
  let result = [];
  for (let i = 0; i < data.length; i++) { // for loop safer hai
    result.push(transform(data[i]));
  }
  res.json(result);
});


// CAUSE 2: Catastrophic regex backtracking (ReDoS)
// BAD - ye regex evil hai
const emailRegex = /^([a-zA-Z0-9]+\.)*[a-zA-Z0-9]+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
// Agar koi ye input de: "aaaaaaaaaaaaaaaaaaaaaaaaa@" -> CPU hang!

// FIX: Safe regex use karo
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Ya validator library use karo
const validator = require('validator');
if (validator.isEmail(input)) { /* ... */ }


// CAUSE 3: Synchronous crypto operations on large data
// BAD
app.post('/hash', (req, res) => {
  const hash = crypto.pbkdf2Sync(
    req.body.password,
    salt,
    1000000,  // 1 million iterations - CPU murder!
    64,
    'sha512'
  );
  res.json({ hash: hash.toString('hex') });
});

// FIX: Async version use karo
app.post('/hash', async (req, res) => {
  const hash = await new Promise((resolve, reject) => {
    crypto.pbkdf2(req.body.password, salt, 100000, 64, 'sha512', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  res.json({ hash: hash.toString('hex') });
});


// CAUSE 4: JSON.parse / JSON.stringify on massive objects
// BAD
app.get('/export', async (req, res) => {
  const allUsers = await User.find({}); // 1 million users!
  res.json(allUsers); // JSON.stringify 1M objects -> CPU spike
});

// FIX: Streaming ya pagination
app.get('/export', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 100;
  const users = await User.find({})
    .skip((page - 1) * limit)
    .limit(limit)
    .lean(); // .lean() bhi faster hai
  res.json({ users, page, hasMore: users.length === limit });
});
```

**Step 4: Emergency fix agar abhi production mein hai**

```bash
# Option 1: Restart karo (temporary relief)
pm2 restart all

# Option 2: Cluster mode pe switch karo - ek process block hoga, baaki kaam karenge
pm2 start server.js -i max  # All CPU cores use karega

# Option 3: Agar specific endpoint hai toh usko temporarily disable karo
# Nginx level pe block karo
# location /problematic-endpoint {
#   return 503 "Temporarily unavailable";
# }
```

**Prevention:**

```js
// 1. Request timeout set karo
const timeout = require('connect-timeout');
app.use(timeout('10s'));

// 2. Worker threads use karo heavy computation ke liye
const { Worker } = require('worker_threads');

app.post('/heavy-task', (req, res) => {
  const worker = new Worker('./heavy-worker.js', {
    workerData: req.body
  });
  worker.on('message', (result) => res.json(result));
  worker.on('error', (err) => res.status(500).json({ error: err.message }));
});

// 3. Rate limiting lagao
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 60000, max: 100 }));
```


---


## Scenario 4: API Works Locally But Not in Production

**Q: Locally sab kaam karta hai. Production mein deploy kiya toh API 500 error de raha hai. Kya check karoge?**

**A:** "Works on my machine" sabse classic problem hai. Local aur production environment mein bahut differences hote hain. Systematic approach chahiye - ek ek possibility eliminate karo.

**Step 1: LOGS! Sabse pehle actual error dekho**

```bash
# PM2 logs
pm2 logs --err --lines 200

# Docker logs
docker logs container-name --tail 200

# Ya application log file
tail -200 /var/log/myapp/error.log

# Agar koi log nahi hai toh ye sabse badi problem hai
# Pehle proper error logging setup karo
```

**Step 2: Environment variables check karo - #1 cause**

```bash
# Production mein environment variables dekho
pm2 env 0  # PM2 process 0 ke env vars

# Docker mein
docker exec container-name env

# Common missing variables
# - DATABASE_URL / MONGODB_URI
# - JWT_SECRET
# - API_KEYS (third party services)
# - NODE_ENV (production vs development)
# - PORT
```

```js
// Best practice: App start hote hi sab env vars validate karo
// config/validateEnv.js
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'PORT',
  'REDIS_URL',
  'SMTP_HOST'
];

function validateEnv() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('FATAL: Missing environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1); // App start hi mat hone do
  }
  console.log('All environment variables validated successfully.');
}

module.exports = validateEnv;

// server.js mein sabse pehle call karo
require('./config/validateEnv')();
```

**Step 3: Database connection check karo**

```bash
# Production server se MongoDB connect ho raha hai?
# Agar MongoDB Atlas hai toh IP whitelist check karo
curl -v telnet://your-mongodb-host:27017

# Redis check
redis-cli -h your-redis-host -p 6379 ping
```

```js
// Mongoose connection with proper error handling
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => {
  console.error('MongoDB connection FAILED:', err.message);
  console.error('Connection string (masked):',
    process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@'));
  process.exit(1);
});
```

**Step 4: File path issues - Linux case sensitivity**

```js
// YE LOCAL (Mac) PE KAAM KAREGA, PRODUCTION (Linux) PE NAHI
const UserModel = require('./models/user'); // file hai User.js (capital U)

// Mac: case-insensitive filesystem -> 'user' se 'User.js' mil jaayega
// Linux: case-SENSITIVE filesystem -> 'user' se 'User.js' NAHI milega

// FIX: Exact case match karo ALWAYS
const UserModel = require('./models/User'); // Exact match!

// Aur static file paths bhi check karo
app.use(express.static('Public'));  // Folder naam "public" hai? -> FAIL on Linux
app.use(express.static('public')); // Correct
```

**Step 5: CORS config check karo**

```js
// Local mein ye kaam karta hai kyunki same origin hai
// Production mein frontend aur backend alag domains pe hain

// BAD - insecure but debugging ke liye temporarily
app.use(cors({ origin: '*' }));

// GOOD - production mein specific origins
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://myapp.com', 'https://www.myapp.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
};
app.use(cors(corsOptions));
```

**Step 6: node_modules differences**

```bash
# Local mein toh devDependencies bhi install hoti hain
# Production mein sirf dependencies install honi chahiye

# Check karo package.json mein koi dependency galat jagah toh nahi
npm ls --production  # Sirf production deps dikhayega

# Lock file committed hai? Ye MUST hai
git ls-files package-lock.json  # Ya yarn.lock
```

**Prevention Checklist:**

```js
// deployment-checklist.js - deploy se pehle run karo
const checks = {
  envVarsSet: () => {
    const required = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
    return required.every(key => process.env[key]);
  },
  dbConnectable: async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      await mongoose.connection.close();
      return true;
    } catch { return false; }
  },
  portAvailable: () => {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(); resolve(true); });
      server.listen(process.env.PORT);
    });
  }
};

// Run all checks before accepting traffic
async function preflightCheck() {
  for (const [name, check] of Object.entries(checks)) {
    const result = await check();
    console.log(`${result ? 'PASS' : 'FAIL'}: ${name}`);
    if (!result) process.exit(1);
  }
  console.log('All preflight checks passed. Starting server...');
}
```


---


## Scenario 5: Database Connection Drops

**Q: Random intervals pe "MongoNetworkError: connection timed out" aa raha hai. 5 min mein theek ho jaata hai apne aap. Kya ho raha hai?**

**A:** Intermittent connection drops ka matlab hai ki connection establish hai lekin beech mein kisi reason se toot jaata hai. Ye usually idle timeout ya network level ki problem hoti hai.

**Step 1: Mongoose connection events monitor karo**

```js
const mongoose = require('mongoose');

mongoose.connection.on('connected', () => {
  console.log(`[${new Date().toISOString()}] MongoDB connected`);
});

mongoose.connection.on('disconnected', () => {
  console.warn(`[${new Date().toISOString()}] MongoDB disconnected!`);
});

mongoose.connection.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] MongoDB error:`, err.message);
});

mongoose.connection.on('reconnected', () => {
  console.log(`[${new Date().toISOString()}] MongoDB reconnected`);
});

// Ye events log karke pattern samjho:
// Kya har 30 min pe disconnect hota hai? -> idle timeout
// Kya random times pe hota hai? -> network instability
// Kya heavy load pe hota hai? -> connection pool exhausted
```

**Step 2: Connection pool config optimize karo**

```js
// Default pool size 5 hai - production ke liye kam ho sakta hai
mongoose.connect(process.env.MONGODB_URI, {
  // Connection pool settings
  maxPoolSize: 20,          // Maximum connections (default: 5 se badhaao)
  minPoolSize: 5,           // Minimum connections ready rakhna
  maxIdleTimeMS: 30000,     // Idle connection 30s baad close karo

  // Timeouts
  serverSelectionTimeoutMS: 5000,  // Server select karne ka timeout
  socketTimeoutMS: 45000,          // Socket timeout
  connectTimeoutMS: 10000,         // Initial connection timeout

  // Keep-alive - ye IMPORTANT hai idle drops ke liye
  heartbeatFrequencyMS: 10000,     // Har 10s pe heartbeat

  // Auto reconnect (Mongoose 6+ mein by default on hai)
  retryWrites: true,
  retryReads: true,
});
```

**Step 3: MongoDB Atlas specific issues**

```bash
# Atlas mein IP Whitelist check karo
# Agar server ka IP change hota hai (auto-scaling) toh connection tootega

# Atlas idle timeout check karo
# Free tier (M0) mein 60 seconds ka idle timeout hota hai

# Network peering check karo agar same cloud provider ho
# VPC peering se latency kam hoti hai aur connection stable rehta hai
```

```js
// Atlas ke liye recommended connection string
const uri = `mongodb+srv://${user}:${pass}@cluster0.xxxxx.mongodb.net/${dbName}?retryWrites=true&w=majority`;

// Agar free tier pe ho toh keep-alive queries bhejo
// Ye idle timeout prevent karega
setInterval(async () => {
  try {
    await mongoose.connection.db.admin().ping();
  } catch (err) {
    console.error('DB ping failed:', err.message);
  }
}, 30000); // Har 30 seconds
```

**Step 4: Retry logic implement karo operations ke liye**

```js
// Wrapper function with retry for critical operations
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const isNetworkError = err.name === 'MongoNetworkError'
        || err.message.includes('timed out')
        || err.message.includes('ECONNRESET');

      if (isNetworkError && attempt < maxRetries) {
        console.warn(`DB operation failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
        await new Promise(r => setTimeout(r, delay * attempt)); // Exponential-ish backoff
        continue;
      }
      throw err; // Non-network error ya max retries reached
    }
  }
}

// Usage
app.get('/users', async (req, res) => {
  try {
    const users = await withRetry(() => User.find({}).lean());
    res.json(users);
  } catch (err) {
    res.status(503).json({ error: 'Database temporarily unavailable' });
  }
});
```

**Step 5: Firewall aur network level check karo**

```bash
# Server se MongoDB host reachable hai?
ping your-mongodb-host

# Port open hai?
nc -zv your-mongodb-host 27017

# Traceroute se network path dekho
traceroute your-mongodb-host

# Firewall rules check karo
sudo iptables -L -n | grep 27017

# Agar AWS pe ho toh Security Group check karo
# Outbound rule mein 27017 port allowed hona chahiye
```

**Prevention:**

```js
// 1. Health check endpoint banaao jo DB connectivity bhi check kare
app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (dbState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        db: 'disconnected',
        dbState
      });
    }
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'healthy', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// 2. Monitoring alert set karo - agar 5 disconnect events 10 min mein aayein toh alert
// 3. Connection pool metrics track karo
// 4. Separate read replicas use karo heavy read operations ke liye
```


---


## Scenario 6: Slow API - Finding the Bottleneck

**Q: Ek specific API endpoint 5 seconds le raha hai. Kaise find karoge ki bottleneck kahan hai - network, server, database, ya external API?**

**A:** Slow API debug karne ka golden rule hai: "Measure, don't guess." Har section ka time measure karo aur pinpoint karo ki time kahan ja raha hai.

**Step 1: Timing middleware banaao - overall picture**

```js
// middleware/timing.js
const timingMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  // Response finish hone pe time log karo
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    console.log({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });

    // Agar 2 seconds se zyada laga toh warn karo
    if (durationMs > 2000) {
      console.warn(`SLOW REQUEST: ${req.method} ${req.originalUrl} took ${durationMs.toFixed(0)}ms`);
    }
  });

  next();
};

app.use(timingMiddleware);
```

**Step 2: Route ke andar console.time se har section measure karo**

```js
app.get('/api/dashboard', async (req, res) => {
  console.time('total-dashboard');

  // Section 1: Authentication / Middleware
  console.time('auth-check');
  const user = await verifyToken(req.headers.authorization);
  console.timeEnd('auth-check');  // auth-check: 12ms

  // Section 2: Database query
  console.time('db-query');
  const orders = await Order.find({ userId: user._id })
    .populate('products')
    .sort({ createdAt: -1 })
    .limit(50);
  console.timeEnd('db-query');  // db-query: 3800ms  <-- YAHAN HAI BOTTLENECK!

  // Section 3: Data transformation
  console.time('data-transform');
  const summary = calculateDashboardStats(orders);
  console.timeEnd('data-transform');  // data-transform: 45ms

  // Section 4: External API call
  console.time('external-api');
  const exchangeRates = await fetch('https://api.rates.com/latest');
  console.timeEnd('external-api');  // external-api: 200ms

  console.timeEnd('total-dashboard');  // total-dashboard: 4100ms
  // Ab pata chal gaya: db-query 3800ms le raha hai!

  res.json({ orders, summary, exchangeRates });
});
```

**Step 3: Database query analyze karo - explain() use karo**

```js
// MongoDB explain() se query plan dekho
const explanation = await Order.find({ userId: user._id })
  .populate('products')
  .sort({ createdAt: -1 })
  .limit(50)
  .explain('executionStats');

console.log(JSON.stringify(explanation, null, 2));

// Dhyan do in fields pe:
// - totalDocsExamined: Kitne documents scan kiye? Bahut zyada = missing index
// - executionTimeMillis: Query time
// - stage: "COLLSCAN" = BAHUT BURA! Table scan ho raha hai
// - stage: "IXSCAN" = ACHA! Index use ho raha hai
```

```bash
# MongoDB shell mein direct check karo
mongo
> use mydb
> db.orders.find({ userId: ObjectId("...") }).explain("executionStats")
```

```js
// FIX: Index add karo!
// models/Order.js mein
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdAt: { type: Date, default: Date.now },
  // ...
});

// Compound index for the exact query pattern
orderSchema.index({ userId: 1, createdAt: -1 });

// Run karne ke baad query 3800ms se 15ms ho jaayegi!
```

**Step 4: Network bottleneck check karo**

```bash
# Browser Network tab se dekho:
# - DNS Lookup time
# - SSL Handshake time
# - TTFB (Time to First Byte) - ye server processing time hai
# - Content Download time

# curl se TTFB measure karo
curl -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s https://api.myapp.com/api/dashboard

# Agar TTFB high hai = server slow
# Agar Content Download high hai = response size bada hai (compression check karo)
```

**Step 5: APM tools se production monitoring**

```js
// New Relic integration (example)
// npm install newrelic
// newrelic.js config file banaao
// server.js ke TOP pe:
require('newrelic');

// Datadog APM
// npm install dd-trace
const tracer = require('dd-trace').init({
  service: 'myapp-api',
  env: 'production',
});

// Ye automatically measure karega:
// - Express route timing
// - MongoDB query timing
// - External HTTP call timing
// - Redis operation timing
// Sab kuch dashboard pe dikhega with flame graphs
```

**Prevention:**

```js
// 1. Har query pe index ensure karo
// 2. N+1 query problem avoid karo (populate wisely)
// 3. Response compression
const compression = require('compression');
app.use(compression());

// 4. Cache frequently accessed data
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 min TTL

app.get('/api/dashboard', async (req, res) => {
  const cacheKey = `dashboard-${req.user.id}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const data = await buildDashboard(req.user.id);
  cache.set(cacheKey, data);
  res.json(data);
});

// 5. Pagination MANDATORY for list endpoints
// 6. Select sirf required fields: User.find({}).select('name email')
```


---


## Scenario 7: Logs Mein Error But No Crash

**Q: Sentry/logs mein "TypeError: Cannot read property 'name' of undefined" dikh raha hai 100 times per hour. But app crash nahi ho raha. Users complain nahi kar rahe. Kya karoge?**

**A:** Ye sabse dangerous type ka bug hai - SILENT FAILURE. App crash nahi ho raha kyunki error kisi try-catch mein swallow ho raha hai ya async error hai jo unhandled hai. Users complain nahi kar rahe iska matlab ye NAHI ki unpe impact nahi ho raha - ho sakta hai ki subset of users affected hain aur unko pata nahi ki kya galat hai.

**Step 1: Error ko seriously lo - stack trace analyze karo**

```js
// Sentry mein ya logs mein poora stack trace dekho
// TypeError: Cannot read property 'name' of undefined
//     at formatUser (/app/src/utils/format.js:15:28)
//     at /app/src/routes/users.js:42:20
//     at Array.map (<anonymous>)
//     at getUsers (/app/src/routes/users.js:41:25)

// Ab pata hai:
// - File: /app/src/utils/format.js, line 15
// - Function: formatUser
// - Called from: routes/users.js line 42, inside a .map()
```

**Step 2: Error reproduce karo - kaunsa input cause kar raha hai?**

```js
// Sentry mein request data dekho - kaunsa endpoint, kaunsa user, kya params the

// Problematic code dhundho
// utils/format.js - Line 15
function formatUser(user) {
  return {
    fullName: user.name.first + ' ' + user.name.last,  // LINE 15 - user.name undefined!
    email: user.email,
  };
}

// routes/users.js - Line 41-42
async function getUsers(req, res) {
  const users = await User.find({ role: 'admin' });
  const formatted = users.map(user => formatUser(user)); // LINE 42
  res.json(formatted);
}

// Problem: Kuch users ke database mein 'name' field hi nahi hai
// Shayad purane users hain jab schema different tha
// Ya kisi ne direct DB update kiya aur name field delete ho gaya
```

**Step 3: Confirm karo ki kitne users affected hain**

```js
// Database mein check karo
const usersWithoutName = await User.countDocuments({
  $or: [
    { name: { $exists: false } },
    { name: null },
    { 'name.first': { $exists: false } }
  ]
});
console.log(`Users without name field: ${usersWithoutName}`);

// Ye 100/hour error rate se match karta hai?
// Agar 50 users bina name ke hain aur har user 2 baar visit karta hai = ~100/hour
```

**Step 4: Fix karo - defensive coding**

```js
// FIX 1: Optional chaining + nullish coalescing
function formatUser(user) {
  return {
    fullName: `${user?.name?.first ?? 'Unknown'} ${user?.name?.last ?? ''}`.trim(),
    email: user?.email ?? 'N/A',
  };
}

// FIX 2: Validation function banaao
function formatUser(user) {
  if (!user || !user.name) {
    console.warn('formatUser called with invalid user:', {
      userId: user?._id,
      hasName: !!user?.name,
    });
    return {
      fullName: 'Unknown User',
      email: user?.email ?? 'N/A',
    };
  }

  return {
    fullName: `${user.name.first} ${user.name.last}`,
    email: user.email,
  };
}

// FIX 3: Data migration - root cause fix karo
async function fixUsersWithoutName() {
  const result = await User.updateMany(
    { name: { $exists: false } },
    { $set: { name: { first: 'Unknown', last: '' } } }
  );
  console.log(`Fixed ${result.modifiedCount} users`);
}

// FIX 4: Schema validation add karo taaki future mein ye na ho
const userSchema = new mongoose.Schema({
  name: {
    first: { type: String, required: true, default: 'Unknown' },
    last: { type: String, default: '' }
  },
  email: { type: String, required: true }
});
```

**Step 5: Monitoring improve karo**

```js
// Error rate monitoring - alert set karo
// Sentry mein alert rule banaao:
// "If TypeError count > 50 in 1 hour -> Alert to Slack"

// Custom error tracking middleware
let errorCounts = {};

app.use((err, req, res, next) => {
  const errorKey = `${err.name}:${err.message}`;
  errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;

  // Agar same error 100 se zyada baar aaye toh escalate karo
  if (errorCounts[errorKey] === 100) {
    sendAlertToSlack({
      text: `Recurring error hit 100 occurrences: ${errorKey}`,
      route: req.originalUrl,
      method: req.method,
    });
  }

  // User ko graceful response do
  res.status(500).json({
    error: 'Something went wrong',
    requestId: req.id, // Request tracking ke liye
  });
});

// Har hour reset karo counts
setInterval(() => { errorCounts = {}; }, 3600000);
```

**Prevention:**

```js
// 1. TypeScript use karo - compile time pe hi catch hoga
interface UserName {
  first: string;
  last: string;
}
interface User {
  name: UserName;  // Required! Bhoolna possible nahi
  email: string;
}

// 2. Zod ya Joi se runtime validation
const userSchema = z.object({
  name: z.object({
    first: z.string(),
    last: z.string()
  }),
  email: z.string().email()
});

// 3. "No silent failures" policy
// Har catch block mein ya toh re-throw karo ya properly log karo
// NEVER write empty catch blocks:
// BAD: try { ... } catch(e) { }
// GOOD: try { ... } catch(e) { logger.error('Context:', e); }
```


---


## Scenario 8: CORS Error Only on Some Routes

**Q: GET requests kaam karte hain but POST/PUT pe CORS error aata hai. Kya ho raha hai?**

**A:** Ye ek bahut common confusion hai. GET simple request hoti hai, lekin POST/PUT ke saath agar custom headers ya Content-Type: application/json hai toh browser pehle ek **preflight OPTIONS request** bhejta hai. Agar server OPTIONS ka sahi response nahi deta, toh actual request block ho jaati hai.

**Step 1: Samjho ki preflight kya hai**

```js
// Browser ke andar ye hota hai:
//
// Step 1: Browser dekhta hai "ye POST hai JSON ke saath"
// Step 2: Browser pehle ek OPTIONS request bhejta hai (preflight)
//         OPTIONS /api/users
//         Origin: https://frontend.com
//         Access-Control-Request-Method: POST
//         Access-Control-Request-Headers: Content-Type, Authorization
//
// Step 3: Server ko respond karna chahiye:
//         Access-Control-Allow-Origin: https://frontend.com
//         Access-Control-Allow-Methods: POST, GET, PUT, DELETE
//         Access-Control-Allow-Headers: Content-Type, Authorization
//         Access-Control-Max-Age: 86400
//
// Step 4: Browser check karta hai - sab allowed hai?
//         Haan -> Actual POST request bhejta hai
//         Nahi -> CORS ERROR!

// Simple requests (no preflight needed):
// - GET, HEAD, POST (sirf form data ke saath)
// - Headers: Accept, Content-Language, Content-Type (only form-urlencoded/multipart/text)

// Preflight REQUIRED:
// - POST/PUT/DELETE with Content-Type: application/json
// - Custom headers like Authorization
// - PUT, DELETE methods
```

**Step 2: Browser DevTools mein confirm karo**

```bash
# Network tab mein dekho:
# 1. Pehle OPTIONS request dikhegi - status 204 ya 200 hona chahiye
# 2. Phir actual POST request dikhegi

# Agar OPTIONS request fail ho rahi hai -> Server OPTIONS handle nahi kar raha
# Agar OPTIONS succeed hai but POST fail -> Headers mismatch
```

**Step 3: Express CORS middleware sahi se lagao**

```js
// PROBLEM: cors middleware kisi route ke BAAD laga hai
// BAD - order matters!
app.use('/api', apiRoutes);
app.use(cors()); // Too late! Routes already registered without CORS

// FIX: cors middleware SABSE PEHLE lagao
const cors = require('cors');

// Sabse pehle, routes se pehle
app.use(cors({
  origin: ['https://frontend.com', 'https://www.frontend.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,  // Agar cookies bhej rahe ho
  maxAge: 86400,       // Preflight cache 24 hours (baar baar OPTIONS na bheje)
}));

// Ab routes define karo
app.use('/api', apiRoutes);
```

**Step 4: Manual CORS handling (agar middleware na use karo)**

```js
// Agar manually handle karna ho
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://frontend.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // IMPORTANT: OPTIONS request ka response yahan hi bhejo
  if (req.method === 'OPTIONS') {
    return res.status(204).send(); // 204 No Content
  }

  next();
});
```

**Step 5: Specific scenarios debug karo**

```js
// Scenario A: Sirf kuch routes pe CORS fail
// Check karo ki un routes pe koi middleware toh override nahi kar raha
app.post('/api/upload',
  uploadMiddleware, // Kya ye middleware headers override kar raha hai?
  (req, res) => { /* ... */ }
);

// Scenario B: credentials: true ke saath origin '*' nahi chalega
// BAD - browser reject karega
app.use(cors({ origin: '*', credentials: true })); // NAHI CHALEGA!

// FIX - specific origin chahiye credentials ke saath
app.use(cors({ origin: 'https://frontend.com', credentials: true }));

// Scenario C: Nginx bhi CORS headers add kar raha hai -> DUPLICATE headers
// Agar Nginx aur Express dono CORS headers bhejein toh error aata hai
// Solution: Ek jagah se hi handle karo - ya Nginx se ya Express se
```

**Step 6: Quick debugging command**

```bash
# Preflight request manually test karo
curl -X OPTIONS https://api.myapp.com/api/users \
  -H "Origin: https://frontend.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v 2>&1 | grep -i "access-control"

# Ye dikhana chahiye:
# Access-Control-Allow-Origin: https://frontend.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE
# Access-Control-Allow-Headers: Content-Type, Authorization
```

**Prevention:**

```js
// 1. CORS middleware hamesha sabse pehle lagao (after basic middleware like helmet)
// 2. Environment based origin config
const allowedOrigins = {
  development: ['http://localhost:3000', 'http://localhost:5173'],
  production: ['https://myapp.com', 'https://admin.myapp.com'],
  staging: ['https://staging.myapp.com']
};

app.use(cors({
  origin: (origin, callback) => {
    const origins = allowedOrigins[process.env.NODE_ENV] || [];
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`));
    }
  },
  credentials: true,
}));

// 3. API Gateway use karo (AWS API Gateway, Kong) - CORS wahan handle karo
// 4. Integration tests mein CORS bhi test karo
```


---


## Scenario 9: WebSocket Disconnections

**Q: Chat app mein users randomly disconnect ho jaate hain 30-60 seconds baad. Reconnect hota hai but messages miss ho jaate hain. Kya check karoge?**

**A:** WebSocket disconnections ka sabse common reason hai timeouts - koi intermediate layer (Nginx, Load Balancer, CDN) connection idle maanke band kar deta hai. Aur messages miss hone ka matlab hai ki delivery guarantee nahi hai architecture mein.

**Step 1: Identify karo ki disconnect kahan ho raha hai**

```js
// Client side pe Socket.io events monitor karo
const socket = io('https://api.myapp.com', {
  transports: ['websocket'], // Direct WebSocket, no polling fallback
});

socket.on('connect', () => {
  console.log(`[${new Date().toISOString()}] Connected: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
  console.warn(`[${new Date().toISOString()}] Disconnected: ${reason}`);
  // reason values:
  // "io server disconnect" - server ne disconnect kiya
  // "io client disconnect" - client ne disconnect kiya
  // "ping timeout" - server se pong nahi aaya
  // "transport close" - connection lost (network/proxy)
  // "transport error" - connection error
});

socket.on('connect_error', (err) => {
  console.error(`[${new Date().toISOString()}] Connection error:`, err.message);
});
```

**Step 2: Nginx proxy timeout fix karo - #1 cause**

```bash
# Nginx config mein WebSocket ke liye special settings chahiye
# /etc/nginx/sites-enabled/myapp
```

```js
// Nginx config (shown as reference):
//
// location /socket.io/ {
//     proxy_pass http://localhost:3000;
//     proxy_http_version 1.1;
//     proxy_set_header Upgrade $http_upgrade;
//     proxy_set_header Connection "upgrade";
//     proxy_set_header Host $host;
//     proxy_set_header X-Real-IP $remote_addr;
//
//     # YE IMPORTANT HAI - default 60s hai, badhaao
//     proxy_read_timeout 300s;    # 5 minutes
//     proxy_send_timeout 300s;
//     proxy_connect_timeout 60s;
// }
```

**Step 3: Ping/Pong heartbeat configure karo**

```js
// Server side - Socket.io config
const io = require('socket.io')(server, {
  pingTimeout: 60000,   // 60s wait for pong response
  pingInterval: 25000,  // Har 25s pe ping bhejo (keep-alive)
  // Nginx timeout 300s hai, toh 25s interval se connection alive rahega

  cors: {
    origin: 'https://myapp.com',
    credentials: true,
  },
  transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
});

// Custom heartbeat bhi add kar sakte ho
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Server side ping (Socket.io does this automatically, but custom bhi kar sakte ho)
  const heartbeat = setInterval(() => {
    socket.emit('ping-custom');
  }, 20000);

  socket.on('pong-custom', () => {
    // Client alive hai
  });

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
    console.log(`User disconnected: ${socket.id}`);
  });
});
```

**Step 4: Load Balancer sticky sessions configure karo**

```js
// Problem: Agar multiple Node.js instances hain (PM2 cluster / Docker containers)
// toh WebSocket handshake ek server pe hoti hai, lekin next request dusre server pe jaati hai
// Result: "Invalid session ID" error -> disconnect

// Fix 1: Nginx ip_hash for sticky sessions
//
// upstream backend {
//     ip_hash;  # Same client always goes to same server
//     server localhost:3001;
//     server localhost:3002;
//     server localhost:3003;
// }

// Fix 2: Redis adapter use karo - sab instances sync rehte hain
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Socket.io Redis adapter connected');
});

// Ab kisi bhi instance se emit karo, sab users ko milega
```

**Step 5: Message delivery guarantee - messages miss mat hone do**

```js
// Problem: User A message bhejta hai jab User B disconnected hai
// User B reconnect karta hai -> message miss!

// Solution: Message queue + acknowledgment pattern
// Server side
io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId;

  // Reconnect hone pe missed messages bhejo
  socket.on('request-missed-messages', async (lastMessageTimestamp) => {
    const missedMessages = await Message.find({
      recipientId: userId,
      createdAt: { $gt: new Date(lastMessageTimestamp) },
      delivered: false
    }).sort({ createdAt: 1 });

    missedMessages.forEach(msg => {
      socket.emit('chat-message', msg);
    });
  });

  // Message bhejne pe pehle DB mein save karo
  socket.on('send-message', async (data, ack) => {
    const message = await Message.create({
      senderId: userId,
      recipientId: data.to,
      content: data.content,
      delivered: false,
    });

    // Recipient online hai toh bhejo
    const recipientSocket = findSocketByUserId(data.to);
    if (recipientSocket) {
      recipientSocket.emit('chat-message', message, async () => {
        // Recipient ne acknowledge kiya -> delivered mark karo
        await Message.updateOne({ _id: message._id }, { delivered: true });
      });
    }

    // Sender ko confirm karo ki message saved hai
    ack({ status: 'sent', messageId: message._id });
  });
});

// Client side - reconnect hone pe missed messages maango
socket.on('connect', () => {
  const lastTimestamp = localStorage.getItem('lastMessageTimestamp');
  socket.emit('request-missed-messages', lastTimestamp || new Date(0).toISOString());
});
```

**Prevention:**

```js
// 1. Client-side reconnection config
const socket = io('https://api.myapp.com', {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 20000,
});

// 2. Connection quality monitoring
// 3. Graceful degradation - WebSocket fail toh long-polling use karo
// 4. Load test WebSocket connections separately
// 5. Monitor WebSocket connection count in production
```


---


## Scenario 10: Docker Container Keeps Restarting

**Q: Docker container start hota hai, 10 seconds baad restart ho jaata hai. Infinite loop mein hai. Kaise debug karoge?**

**A:** Container restart loop ka matlab hai ki container ke andar kuch fail ho raha hai repeatedly. Docker restart policy ki wajah se ye baar baar try karta hai. Sabse pehle logs dekho, phir systematically eliminate karo.

**Step 1: Container logs check karo - ye SABSE PEHLE**

```bash
# Container ke logs dekho
docker logs container-name
docker logs container-name --tail 100

# Agar container baar baar restart ho raha hai toh previous run ke logs
docker logs container-name --since 5m

# Follow mode mein dekho (live)
docker logs -f container-name

# Common errors jo dikhenge:
# "Error: Cannot find module 'express'" -> node_modules missing
# "Error: listen EADDRINUSE :::3000" -> Port already in use
# "MongoError: failed to connect" -> DB unreachable
# "SyntaxError" -> Code mein syntax error
# Killed -> OOM (Out of Memory)
```

**Step 2: Container state inspect karo**

```bash
# Container ka detailed info
docker inspect container-name

# Specifically exit code aur state dekho
docker inspect container-name --format='{{.State.ExitCode}}'
# Exit code 0 = normal exit
# Exit code 1 = application error
# Exit code 137 = OOM killed (128 + 9 = SIGKILL)
# Exit code 143 = SIGTERM (graceful shutdown)

# OOM kill specifically check karo
docker inspect container-name --format='{{.State.OOMKilled}}'
# true = Memory limit se zyada use kiya

# Docker events stream dekho
docker events --filter container=container-name --since 10m
```

**Step 3: Health check failing toh nahi?**

```bash
# Health check status
docker inspect container-name --format='{{.State.Health.Status}}'

# Health check logs
docker inspect container-name --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

```js
// Dockerfile mein health check
// HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
//   CMD curl -f http://localhost:3000/health || exit 1

// Server mein health endpoint banaao
app.get('/health', (req, res) => {
  // Sirf 200 mat bhejo - actually check karo
  const checks = {
    server: true,
    database: mongoose.connection.readyState === 1,
    memory: process.memoryUsage().heapUsed < 400 * 1024 * 1024,
  };

  const healthy = Object.values(checks).every(Boolean);
  res.status(healthy ? 200 : 503).json(checks);
});
```

**Step 4: Container mein shell se jaake debug karo**

```bash
# Container chal raha hai toh andar jaao
docker exec -it container-name sh
# Ya bash agar available ho
docker exec -it container-name bash

# Andar se manually check karo
node -e "console.log('Node works')"
node -e "require('express')" # Kya express installed hai?
env  # Environment variables dekho
ls -la /app/node_modules  # node_modules hai?
cat /app/.env  # .env file hai?

# Agar container start hi nahi ho raha toh override karo entrypoint
docker run -it --entrypoint sh container-image-name
# Ab manually commands run karo aur dekho kya fail hota hai
```

**Step 5: Common Docker restart causes aur fixes**

```bash
# CAUSE 1: node_modules missing ya corrupt
# Dockerfile mein check karo
```

```js
// Dockerfile - Correct way
// FROM node:18-alpine
// WORKDIR /app
// COPY package*.json ./
// RUN npm ci --only=production    # ci is better than install for Docker
// COPY . .
// EXPOSE 3000
// CMD ["node", "server.js"]

// GALTI: .dockerignore mein node_modules nahi hai
// toh local node_modules copy ho jaate hain (Mac binary -> Linux container = crash)
```

```bash
# .dockerignore file mein ye hona chahiye:
# node_modules
# .env
# .git
# npm-debug.log

# CAUSE 2: OOM Kill - memory limit kam hai
docker run -m 256m myapp  # Sirf 256MB? Node.js ke liye kam hai

# FIX: Memory badhaao
docker run -m 512m myapp

# CAUSE 3: Port conflict
docker run -p 3000:3000 myapp
# Kya host pe 3000 already use mein hai?
lsof -i :3000

# CAUSE 4: Missing environment variables
docker run -e MONGODB_URI=mongodb://... -e JWT_SECRET=... myapp

# Ya .env file mount karo
docker run --env-file .env.production myapp

# CAUSE 5: Entrypoint script error
# Agar custom entrypoint.sh hai toh check karo
docker run --entrypoint sh myapp -c "cat /app/entrypoint.sh"
# Line endings check karo (Windows CRLF -> Linux LF issue)
```

**Step 6: Docker Compose mein debugging**

```bash
# Saare containers ka status
docker compose ps

# Specific service ke logs
docker compose logs app --tail 50

# Rebuild karo (cache clear)
docker compose build --no-cache app
docker compose up -d app

# Dependencies check karo - kya DB container pehle ready hai?
```

```js
// docker-compose.yml mein dependency aur health check
// services:
//   app:
//     build: .
//     ports:
//       - "3000:3000"
//     depends_on:
//       mongodb:
//         condition: service_healthy   # DB healthy hone tak wait karo
//     environment:
//       - MONGODB_URI=mongodb://mongodb:27017/mydb
//     restart: unless-stopped
//     mem_limit: 512m
//
//   mongodb:
//     image: mongo:6
//     healthcheck:
//       test: echo 'db.runCommand("ping").ok' | mongosh --quiet
//       interval: 10s
//       timeout: 5s
//       retries: 5
```

**Prevention:**

```bash
# 1. Multi-stage build for smaller, more reliable images
# 2. Always use .dockerignore
# 3. Pin base image versions (node:18.17-alpine, not node:latest)
# 4. Health checks mandatory in Dockerfile
# 5. Resource limits set karo (memory, CPU)
# 6. CI/CD mein image test karo before deploying
# 7. Log aggregation (ELK, CloudWatch) taaki logs kabhi miss na ho
```


---


## Scenario 11: Deployment Broke Production

**Q: Naya code deploy kiya aur 5 min baad users ne report kiya ki app crash ho raha hai. Kya immediate action loge?**

**A:** RULE #1: **PEHLE ROLLBACK KARO, PHIR DEBUG KARO.** Jab tak users affected hain, tab tak debugging mat karo. Production mein live debugging karna sabse badi galti hai. Har minute users lose ho rahe hain, revenue loss ho raha hai, trust toot raha hai.

**Step 1: IMMEDIATE ROLLBACK - 1 minute ke andar**

```bash
# Method 1: Git revert + redeploy (safest)
git log --oneline -5  # Last 5 commits dekho
git revert HEAD --no-edit  # Last commit revert karo
git push origin main  # CI/CD trigger hoga

# Method 2: PM2 deploy revert
pm2 deploy production revert 1  # Previous version pe jaao

# Method 3: Docker rollback
# Previous image tag pe switch karo
docker pull myapp:v1.2.3  # Previous stable version
docker stop myapp-current
docker run -d --name myapp-rollback myapp:v1.2.3

# Docker Compose mein
# IMAGE_TAG=v1.2.3 docker compose up -d

# Method 4: Kubernetes rollback
# kubectl rollout undo deployment/myapp
# kubectl rollout status deployment/myapp

# Method 5: Cloud platform rollback
# AWS Elastic Beanstalk: eb deploy --version previous-label
# Heroku: heroku rollback v142
```

**Step 2: Verify karo ki rollback successful hai**

```bash
# Health check
curl -s https://api.myapp.com/health | jq .

# Quick smoke test
curl -s https://api.myapp.com/api/users?limit=1 | jq .status

# Error rate check karo monitoring dashboard pe
# Sentry mein error count girna chahiye

# PM2 status check
pm2 status  # Sab "online" dikhna chahiye, no restarts
```

**Step 3: Users ko communicate karo**

```js
// Status page update karo (StatusPage, Cachet, etc.)
// Slack/Discord mein announce karo
// Example message:

// "We experienced a brief service disruption between 2:15 PM - 2:25 PM IST.
//  The issue has been resolved. We are investigating the root cause."

// Internal Slack mein:
// "@here Production incident: Deploy v1.3.0 caused crashes.
//  Rolled back to v1.2.3 at 2:22 PM. All services restored.
//  Post-mortem scheduled for tomorrow 11 AM."
```

**Step 4: Ab safely debug karo - PRODUCTION SE DOOR REHKE**

```bash
# Problematic commit ko local mein ya staging mein debug karo
git log --oneline -10

# Diff dekho - kya change hua tha
git diff v1.2.3..v1.3.0

# Failed deploy ka code staging pe deploy karo
git checkout v1.3.0-branch
# Staging pe test karo with production-like data
```

```js
// Common deployment break causes:

// 1. Database migration issue
// Schema change tha but migration run nahi hua
// Ya migration backward incompatible thi

// 2. New dependency version incompatible
// package-lock.json commit nahi kiya tha
// npm install ne different version install kiya production mein

// 3. Environment variable missing
// Naya feature naya env var expect karta hai
// .env.example mein add kiya but production mein nahi

// 4. API contract break
// Backend endpoint change kiya but frontend purana code cached hai
// Solution: API versioning

// 5. Memory/CPU requirement increased
// New code zyada resources use karta hai
// Server ke resources sufficient nahi hain
```

**Step 5: Post-mortem karo - future mein repeat na ho**

```js
// Post-mortem template:
//
// ## Incident Report - 2024-01-15
//
// **Duration:** 2:15 PM - 2:25 PM IST (10 minutes)
// **Impact:** All users experienced 500 errors on dashboard API
// **Severity:** P1 (Complete feature outage)
//
// **Timeline:**
// - 2:10 PM: Deploy v1.3.0 triggered via CI/CD
// - 2:12 PM: Deployment complete
// - 2:15 PM: First user reports via support
// - 2:18 PM: On-call engineer alerted via PagerDuty
// - 2:20 PM: Rollback initiated
// - 2:22 PM: Rollback complete
// - 2:25 PM: All systems confirmed healthy
//
// **Root Cause:**
// New aggregation pipeline used a field that was renamed in the migration,
// but migration hadn't run on production yet.
//
// **Action Items:**
// 1. Add pre-deploy migration check in CI/CD
// 2. Add integration tests that run against staging before prod deploy
// 3. Implement canary deployment (5% traffic first)
// 4. Add automated rollback on error rate spike
```

**Prevention - Deployment Safety Net:**

```bash
# 1. Canary Deployment - pehle 5% users pe test karo
# 2. Blue-Green Deployment - purana environment ready rakhna
# 3. Feature flags - code deploy karo but feature off rakhna
# 4. Automated rollback trigger - agar error rate > threshold toh auto rollback
# 5. Staging environment MUST match production
# 6. Database migrations should be backward compatible
# 7. Smoke tests after every deployment
```

```js
// Automated rollback example with error rate monitoring
// deploy-monitor.js
async function monitorAfterDeploy(durationMinutes = 5) {
  const startTime = Date.now();
  const checkInterval = 30000; // Har 30s check karo

  const monitor = setInterval(async () => {
    const errorRate = await getErrorRateFromMetrics(); // Prometheus, Datadog, etc.
    const elapsed = (Date.now() - startTime) / 60000;

    console.log(`[${elapsed.toFixed(1)} min] Error rate: ${errorRate}%`);

    if (errorRate > 5) { // 5% se zyada error rate
      console.error('ERROR RATE TOO HIGH! Initiating rollback...');
      clearInterval(monitor);
      await executeRollback(); // Automated rollback
      await notifyTeam('Auto-rollback triggered due to high error rate');
    }

    if (elapsed >= durationMinutes) {
      console.log('Monitoring period complete. Deployment looks stable.');
      clearInterval(monitor);
    }
  }, checkInterval);
}
```


---


## Scenario 12: Third Party API Failing

**Q: Tumhara app payment gateway (Razorpay/Stripe) use karta hai. Gateway 50% requests mein timeout de raha hai. Users payment nahi kar pa rahe. Kya karoge?**

**A:** Third party API failures pe tumhara control nahi hai, lekin tumhara app gracefully handle kare ye tumhare control mein hai. Payment jaise critical flow mein extra caution chahiye - paise ka mamla hai, double charge ya lost payment bahut serious hai.

**Step 1: Confirm karo ki problem third party ki hai, tumhari nahi**

```bash
# Gateway ka status page check karo
# Razorpay: https://status.razorpay.com
# Stripe: https://status.stripe.com

# Direct API call test karo (bypass your app)
curl -w "Time: %{time_total}s\nHTTP Code: %{http_code}\n" \
  -X POST https://api.razorpay.com/v1/orders \
  -u rzp_key:rzp_secret \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"INR"}'

# Apne server se latency check karo
# Kya tumhare server aur gateway ke beech network issue hai?
traceroute api.razorpay.com
```

**Step 2: Circuit Breaker Pattern implement karo**

```js
// Circuit Breaker: Agar bahut zyada failures ho rahe hain toh API call karna band karo
// 3 states: CLOSED (normal), OPEN (blocked), HALF-OPEN (testing)

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000; // 30s
    this.state = 'CLOSED';       // Normal operation
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check karo ki reset timeout ho gaya hai
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        console.log('Circuit HALF-OPEN: Testing with one request...');
      } else {
        throw new Error('Circuit is OPEN - service unavailable. Try again later.');
      }
    }

    try {
      const result = await fn();

      // Success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        console.log('Circuit CLOSED: Service recovered.');
      }

      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(`Circuit OPEN: ${this.failureCount} failures. Blocking calls for ${this.resetTimeoutMs}ms`);
      }

      throw err;
    }
  }
}

// Usage
const paymentCircuit = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 60000, // 1 minute
});

app.post('/api/payment', async (req, res) => {
  try {
    const result = await paymentCircuit.execute(async () => {
      return await razorpay.orders.create({
        amount: req.body.amount,
        currency: 'INR',
      });
    });
    res.json(result);
  } catch (err) {
    if (err.message.includes('Circuit is OPEN')) {
      res.status(503).json({
        error: 'Payment service temporarily unavailable',
        message: 'Please try again in a few minutes',
        retryAfter: 60,
      });
    } else {
      res.status(500).json({ error: 'Payment failed. Please try again.' });
    }
  }
});
```

**Step 3: Retry with Exponential Backoff (BUT CAREFUL WITH PAYMENTS!)**

```js
// IMPORTANT: Payment ke saath retry karna DANGEROUS hai
// Double charge ho sakta hai!
// Solution: Idempotency Key use karo

async function retryWithBackoff(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;

      // Sirf timeout/network errors pe retry karo, 4xx pe nahi
      if (err.statusCode && err.statusCode < 500) throw err;

      const delay = baseDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // Random jitter
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay + jitter}ms...`);
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
}

// Payment ke saath IDEMPOTENCY KEY use karo
const { v4: uuidv4 } = require('uuid');

app.post('/api/payment/charge', async (req, res) => {
  // Idempotency key - same key se dobara call karne pe duplicate charge nahi hoga
  const idempotencyKey = req.body.idempotencyKey || uuidv4();

  try {
    const charge = await retryWithBackoff(async () => {
      return await stripe.charges.create(
        {
          amount: req.body.amount,
          currency: 'inr',
          source: req.body.token,
          description: `Order ${req.body.orderId}`,
        },
        {
          idempotencyKey: idempotencyKey,  // Stripe ka built-in support
        }
      );
    }, { maxRetries: 3, baseDelay: 2000 });

    res.json({ success: true, chargeId: charge.id });
  } catch (err) {
    // Payment queue mein daal do for later retry
    await PaymentQueue.create({
      userId: req.user.id,
      orderId: req.body.orderId,
      amount: req.body.amount,
      idempotencyKey,
      status: 'pending_retry',
      error: err.message,
    });

    res.status(202).json({
      success: false,
      message: 'Payment is being processed. We will notify you once confirmed.',
      referenceId: idempotencyKey,
    });
  }
});
```

**Step 4: Fallback strategy - user experience kharab mat hone do**

```js
// Option 1: Queue payment for later processing
const Bull = require('bull');
const paymentQueue = new Bull('payment-processing', process.env.REDIS_URL);

// Failed payment ko queue mein daalo
paymentQueue.add('retry-payment', {
  userId: user.id,
  orderId: order.id,
  amount: amount,
  idempotencyKey: idempotencyKey,
  attemptCount: 0,
}, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 60000,  // 1 min, 2 min, 4 min, 8 min, 16 min
  },
  removeOnComplete: true,
});

// Worker jo queue process kare
paymentQueue.process('retry-payment', async (job) => {
  const { amount, idempotencyKey } = job.data;
  const result = await stripe.charges.create(
    { amount, currency: 'inr', /* ... */ },
    { idempotencyKey }
  );

  // Success - user ko notify karo
  await notifyUser(job.data.userId, 'Payment successful!');
  await Order.updateOne(
    { _id: job.data.orderId },
    { status: 'paid', paymentId: result.id }
  );
});

// Option 2: User ko friendly message dikhao
// Frontend mein:
// "We're experiencing high demand. Your order is saved!
//  We'll process your payment shortly and send you a confirmation email."
```

**Step 5: Timeout config optimize karo**

```js
// Payment API calls ke liye appropriate timeout set karo
const axios = require('axios');

const paymentClient = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  timeout: 30000,  // 30 seconds - payment ke liye zyada timeout do
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
paymentClient.interceptors.request.use((config) => {
  config.metadata = { startTime: Date.now() };
  console.log(`Payment API call: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for timing
paymentClient.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`Payment API success: ${duration}ms`);
    return response;
  },
  (error) => {
    const duration = Date.now() - error.config?.metadata?.startTime;
    console.error(`Payment API failed: ${duration}ms - ${error.message}`);
    throw error;
  }
);
```

**Step 6: Monitoring specifically for third-party dependencies**

```js
// Track third-party API health separately
const thirdPartyMetrics = {
  razorpay: { total: 0, failures: 0, avgLatency: 0 },
  stripe: { total: 0, failures: 0, avgLatency: 0 },
};

function trackAPICall(service, duration, success) {
  const m = thirdPartyMetrics[service];
  m.total++;
  if (!success) m.failures++;
  m.avgLatency = (m.avgLatency * (m.total - 1) + duration) / m.total;

  const failureRate = (m.failures / m.total) * 100;
  if (failureRate > 10 && m.total > 20) {
    sendAlert(`${service} failure rate: ${failureRate.toFixed(1)}% (${m.failures}/${m.total})`);
  }
}

// Expose metrics endpoint
app.get('/api/metrics/third-party', (req, res) => {
  res.json(thirdPartyMetrics);
});
```

**Prevention:**

```js
// 1. Circuit Breaker for ALL third-party calls (not just payments)
// 2. Timeout for every external HTTP call - NEVER use default (infinite)
// 3. Idempotency keys for ALL payment operations
// 4. Separate monitoring dashboard for third-party API health
// 5. Webhook as primary, polling as fallback for payment status
// 6. Rate limiting on your end to not overwhelm the gateway
// 7. Always have a "degraded mode" plan:
//    - Payment down? Save order, process later
//    - Email service down? Queue emails
//    - SMS down? Show in-app notification
// 8. SLA monitoring - track if third-party meets their promised uptime
```


---


*Total: 12 Production Debugging Scenario Questions*

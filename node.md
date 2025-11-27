# Node.js Learning Notes

## What is Node.js

Node.js is a runtime environment that lets you run JavaScript outside the browser — mainly on the server.

nodeJS is singleThread, but for async it uses libuv which under the hood uses different thread to run parallary async
items

Libuv : Node.js ke andar ek C library hai jo async operations handle karti hai.

so in Nodejs, all asyncode lived in NodeJS APIs, and NodeJS APIs send these to LIBUV, ,den LIBUV classify THread pool and KERnel Io works.
den once complete, LIBUV sends only callbacks to callback queues, den from callback queues eventLoop checks, where it priotizes between Micro and macro , and send to callStack

**Resources:**

- https://www.youtube.com/watch?v=y0aTs56DJWk
- https://www.youtube.com/watch?v=QOfROjXytok

---

## Event Loop

**Resources:**

- https://www.youtube.com/watch?v=y0aTs56DJWk
- https://www.youtube.com/watch?v=QOfROjXytok

### EVENT LOOP EXPLAINED - BROWSER vs NODE.JS

#### Basic Concept

JavaScript is single-threaded, meaning it can only execute one thing at a time.
The Event Loop allows JavaScript to perform non-blocking operations by offloading
operations to the system kernel (or browser APIs) whenever possible.

**Event Loop** (JavaScript)

**- when we run a script, then js interperor runs it and if it founds any async code ,den webApis me full async code jaata , and webAPis after completion bas async function ka andar ka code jo ki callback hai usko task Quue me push kr deta .phir eventloop as per micro or macro task utha k call Stack me forward krta ...**

```
Event Loop ( NodeJs )

- so in Nodejs, all asyncode lived in NodeJS APIs, and NodeJS APIs send these to LIBUV, ,den LIBUV classify THread pool and KERnel Io works.
den once complete, LIBUV sends only callbacks to callback queues, den  from callback queues eventLoop checks, where it priotizes between Micro and macro , and send to callStack

```

---

## Middleware

It is a function that runs before the final route handler.

**Resources:**

- https://www.youtube.com/watch?v=zM9R6aioOuQ&t=604s
- https://www.youtube.com/watch?v=n2c0mf1sza4

---

## Streams

**Answer:** We use **streams** when we have to upload/process **large files** (> 10-50 MB) and **buffer** for smaller files (< 10 MB).

**Why:** So stream reads files in **chunks** (piece by piece), but buffer reads in **one go** (entire file at once).

**Resources:**

- https://www.youtube.com/watch?v=m118HulDXOk

---

## Worker Threads

## Ans: Worker Threads allow Node.js to run CPU-intensive tasks in separate threads.

When to use:
141 + - Image/video processing (resize, compress)
142 + - Password hashing (bcrypt)
143 + - Data encryption
144 + - PDF generation
145 + - Any heavy CPU computation

Tumne perfectly observe kiya blocking vs non-blocking ka difference! Let me explain kya hua:

---

🔴 WITHOUT Worker Thread (BLOCKING):

You clicked: Process WITHOUT Worker
Server: "Main thread par CPU task chal raha hai"
↓
You opened: Dashboard
↓
Server: "Sorry bro, main thread busy hai! Wait karo!"
↓
Dashboard: Loading... Loading... Loading... ⏳
↓
After 5-10 seconds:
Server: "Image processing done! Ab dashboard request handle kar sakta hun"
↓
Dashboard: ✅ Data loaded!

Kya hua:

- Main thread COMPLETELY FROZEN tha
- Event loop BLOCKED tha
- Koi bhi request (dashboard API) handle nahi ho saki
- Server = Single-threaded limitation

---

🟢 WITH Worker Thread (NON-BLOCKING):

You clicked: Process WITH Worker
Server: "Worker thread ko bhej diya CPU task!"
Main thread: "Main FREE hun! Aur requests handle kar sakta hun!"
↓
You opened: Dashboard
↓
Server: "Bilkul! Dashboard request instantly handle karta hun!"
↓
Dashboard: ✅ Data loaded IMMEDIATELY!
↓
Background mein:
Worker: "Main image process kar raha hun... done!"

Kya hua:

- Worker thread alag se CPU task kar raha tha
- Main thread FREE tha
- Event loop RESPONSIVE tha
- Dashboard API request turant handle hui
- Server = Multi-threaded power!

---

## Monolithic and Microservice Architecture

---

## BodyParser

bodyParser (express.json()):

- Frontend se JSON data ko readable format mein convert karta hai
- Bina iske req.body = undefined
- Iske saath req.body = actual data ✅

---

## FileSystem Module

FileSystem (fs) module:

- Node.js built-in module
- Files/folders ke saath kaam karne ke liye
- Read, write, delete, rename sab kar sakte ho
- const fs = require('fs'); se use karo

---

## WebSocket

**WebSocket kya hai?**

- Real-time, two-way communication between client and server
- Connection open rahta hai (persistent connection)

**Problem (Normal HTTP):**

- Client puchta rehta → "Kuch naya hai?" (polling - slow!)
- Server khud se data nahi bhej sakta

**Solution (WebSocket):**

- Connection open rahta → Server khud bhej deta! (instant!)
- Bidirectional: Client ↔ Server (both ways)

**Use cases:**

1. Chat apps (WhatsApp, Telegram)
2. Live notifications (Facebook, Instagram)
3. Live scores (Cricbuzz)
4. Stock prices (Zerodha)
5. Google Docs (real-time collaboration)
6. Multiplayer games (PUBG)

**Real-time chahiye = WebSocket use karo!**

---

## CallbackHell

---

## Require and Import Difference

---

## How to Connect MongoDB in Node

---

## Authentication and Authorization

---

## Uploading Large Files (1-2GB) to Server

How to handle large file uploads?

---

## Managing Multiple Roles in Single Table

How to manage multiple roles in a single table (like admin, superadmin, customersupport, merchants)?

---

## Optimizing Performance in Node.js

How to optimize performance to get faster responses?

### 1. Event Loop Optimization

- Avoid blocking the event loop with synchronous operations
- Use `setImmediate()` or `process.nextTick()` to break up CPU-intensive tasks
  - setImmediate we use to break loop, to freeup eventloop
  - if we use nextTick , it will run first then setImeeditate. means it has the highest priority
- Offload heavy computation to worker threads

### 2. Caching

- Use in-memory caching (Redis, Node-cache) for frequently accessed data
- Cache database queries and API responses
- Implement HTTP caching headers (ETag, Cache-Control)

  - Cache-Control: public, max-age=60 ← Humne set kiya, if agar user 60 sec, k pehle reload kiya then wo cache se utha k
    dega .
  - ETag = Data ka fingerprintKaise kaam karta hai:

    1st Request:
    Browser → Server: "Products de"
    Server → Browser: "Ye lo data + ETag: abc123"
    Browser: (data + etag store kar liya)

    2nd Request:
    Browser → Server: "Products de, mere paas ETag abc123 hai"
    Server: (check karta hai - data same hai?)
    → Same hai → "304 Not Modified" (data nahi bhejta)
    → Change hua → "200 OK" + naya data + naya ETag

### 3. Database Optimization

- Add indexes for frequently queried fields
- Use connection pooling
- Implement pagination for large datasets
- Use `.lean()` in Mongoose when you don't need document methods

### 4. Async Best Practices

- Use `Promise.all()` for parallel async operations
- Avoid async/await in loops - batch operations instead
- Stream large files instead of loading into memory

### 5. Memory Management

- Monitor memory usage with `process.memoryUsage()`
- Avoid memory leaks (unclosed connections, growing arrays)
- Use streams for large data processing

### 6. HTTP Optimization

- Enable gzip/brotli compression
- Use HTTP/2 when possible
- Implement request rate limiting
- Use a reverse proxy (Nginx) for static files

### 7. Clustering

```javascript
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Worker process - run your app
}
```

### 8. Profiling Tools

- `node --inspect` with Chrome DevTools
- `clinic.js` for performance diagnostics
- `0x` for flame graphs

---

## process.nextTick() vs setImmediate() vs setTimeout()

---

## Payment Gateway Integration

---

## Handling Internet Disconnection During Payment

How does the server know the internet is cut down while making a payment?

---

## Search, Pagination, Filter, Sort in Single API

---

## Creating a Basic Server in Node.js

Write basic code to create a server.

---

## MVC, MVVM (Different Architecture)

Monolithic: [ Ek bada dabba - sab kuch andar ]

MVC: [ Model ] ←→ [ Controller ] ←→ [ View ]

Microservices: [ Auth ] [ User ] [ Payment ] [ Order ]
↓ ↓ ↓ ↓
DB1 DB2 DB3 DB4

Layered: [ Controller ]
↓
[ Service ]
↓
[ Repository ]
↓
[ Database ]

---

## Google Login (Web and Mobile)

Single API for both web and mobile authentication.

---

## Creating Chat App (Socket.io)

---

## Securing Node.js Application

---

## Push Notification

---

## Managing Multiple Roles in Single Schema

How to manage multiple roles in a single schema (like admin, superadmin, customersupport, merchants)?

---

## Emails in Node.js

---

## Multi Image Upload in Node.js

---

## Uploading Large Movies (2-3GB)

---

## Password Encryption

How to encrypt passwords?

---

## Forgot Password Functionality Flow

How to implement forgot password functionality?

---

## Optimizing Search Query

# Node.js Learning Notes

## What is Node.js

Node.js is a runtime environment that lets you run JavaScript outside the browser — mainly on the server.

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

#### Browser Event Loop (JavaScript)

**- when we run a script, then js interperor runs it and if it founds any async code ,den webApis me full async code jaata , and webAPis after completion bas async function ka andar ka code jo ki callback hai usko task Quue me push kr deta .phir eventloop as per micro or macro task utha k call Stack me forward krta ...**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BROWSER EVENT LOOP (JavaScript)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌──────────────────┐                                                    │
│    │   Call Stack     │  ◄── Executes code line by line                    │
│    │                  │                                                     │
│    │  function foo()  │                                                     │
│    │  console.log()   │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             │ Sends async operations (setTimeout, fetch, events)           │
│             ▼                                                               │
│    ┌──────────────────┐                                                    │
│    │    Web APIs      │  ◄── Browser handles these (setTimeout,           │
│    │                  │      DOM events, AJAX, etc.)                       │
│    │  - setTimeout    │                                                     │
│    │  - fetch()       │                                                     │
│    │  - DOM events    │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             │ When complete, callbacks go to queues                        │
│             ▼                                                               │
│    ┌──────────────────────────────────────────┐                            │
│    │         Task Queue (Callback Queue)      │                            │
│    │  [callback1] [callback2] [callback3]     │ ◄── Macro tasks           │
│    └──────────────────────────────────────────┘     (setTimeout, events)  │
│                                                                             │
│    ┌──────────────────────────────────────────┐                            │
│    │         Microtask Queue                  │                            │
│    │  [promise1] [promise2]                   │ ◄── Promises, queueMicro  │
│    └──────────────────────────────────────────┘     (Higher Priority!)    │
│                                                                             │
│             │                                                               │
│             │  EVENT LOOP checks:                                          │
│             │  1. Is Call Stack empty?                                     │
│             │  2. Execute ALL Microtasks first                             │
│             │  3. Then take ONE Task from Task Queue                       │
│             │  4. Render UI (if needed)                                    │
│             │  5. Repeat                                                   │
│             │                                                               │
│             └─────────────────────────────────────────────┐                │
│                                                           │                │
│    ┌──────────────────┐                                  │                │
│    │   EVENT LOOP     │ ◄────────────────────────────────┘                │
│    │  (continuously   │                                                    │
│    │   monitoring)    │                                                    │
│    └──────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Execution Order in Browser

1. Execute synchronous code (Call Stack)
2. Execute ALL microtasks (Promises, queueMicrotask)
3. Execute ONE macrotask (setTimeout, setInterval, I/O)
4. Execute ALL microtasks again
5. Render (if needed)
6. Repeat from step 3

#### Node.js Architecture - Simple Explanation

**Bilkul JavaScript jaisa, bas thoda different!**

**When we run a Node.js script:**

1. **V8 Engine (Call Stack)** runs the code line by line
2. **Jab async code milta hai** (setTimeout, fs.readFile, http.get, etc.), then **Node.js APIs (C++ layer)** me pura async code (with callback) chala jata hai
3. **Node.js APIs** us kaam ko **LIBUV** ko de deta hai
4. **LIBUV** apne **Thread Pool** ya **Kernel** se kaam complete karwata hai
5. **Completion ke baad**, sirf **callback function** ko appropriate **Queue** me push kar deta hai
6. **Event Loop** continuously check karta hai - Call Stack empty hai kya?
7. **Agar Call Stack empty hai**, then Event Loop apne **6 phases ke according** queue se callbacks uthake **Call Stack me forward karta hai**

---

**Simple Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NODE.JS EVENT LOOP                                  │
└─────────────────────────────────────────────────────────────────────────────┘

so in Nodejs, all asyncode lived in NodeJS APIs, and NodeJS APIs send these to LIBUV, ,den LIBUV classify THread pool and KERnel Io works.
den once complete, LIBUV sends only callbacks to callback queues, den  from callback queues eventLoop checks, where it priotizes between Micro and macro , and send to callStack

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌──────────────────┐                                                    │
│    │   Call Stack     │  ◄── Your code executes here (V8 Engine)           │
│    │                  │                                                     │
│    │  main()          │                                                     │
│    │  console.log()   │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             │ Jab async code milta hai (setTimeout, fs, http)              │
│             ▼                                                               │
│    ┌──────────────────┐                                                    │
│    │   Node.js APIs   │  ◄── Pura async code yaha aata hai                 │
│    │   (C++ Bindings) │      (setTimeout, fs.readFile, http.get)           │
│    │                  │                                                     │
│    │  - setTimeout()  │                                                     │
│    │  - fs.readFile() │                                                     │
│    │  - http.get()    │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             │ Kaam LIBUV ko de diya                                        │
│             ▼                                                               │
│    ┌──────────────────────────────────────────┐                            │
│    │              LIBUV                       │                            │
│    │  (Background me kaam karta hai)          │                            │
│    │                                          │                            │
│    │  ┌────────────────┐  ┌────────────────┐ │                            │
│    │  │  Thread Pool   │  │  Kernel I/O    │ │                            │
│    │  │  (4 threads)   │  │  (OS level)    │ │                            │
│    │  │                │  │                │ │                            │
│    │  │ • File I/O     │  │ • Network I/O  │ │                            │
│    │  │ • DNS          │  │ • TCP/UDP      │ │                            │
│    │  │ • Crypto       │  │ • Sockets      │ │                            │
│    │  └────────────────┘  └────────────────┘ │                            │
│    │                                          │                            │
│    │  Kaam complete hone ke baad...          │                            │
│    └──────────────────┬───────────────────────┘                            │
│                       │                                                     │
│                       │ Sirf CALLBACK ko queue me push karo                │
│                       ▼                                                     │
│    ┌──────────────────────────────────────────┐                            │
│    │         CALLBACK QUEUES                  │                            │
│    │                                          │                            │
│    │  Timers Queue:    [setTimeout callback]  │                            │
│    │  Poll Queue:      [fs.readFile callback] │                            │
│    │  Check Queue:     [setImmediate callback]│                            │
│    │                                          │                            │
│    │  nextTick Queue:  [process.nextTick()]   │  ← Microtask (priority!)  │
│    │  Promise Queue:   [Promise callbacks]    │  ← Microtask (priority!)  │
│    └──────────────────────────────────────────┘                            │
│                       │                                                     │
│                       │                                                     │
│                       └─────────────────────────────────┐                  │
│                                                         │                  │
│    ┌──────────────────┐                                │                  │
│    │   EVENT LOOP     │ ◄──────────────────────────────┘                  │
│    │                  │                                                    │
│    │ Continuously:    │  1. Check Call Stack empty?                       │
│    │ - Microtasks     │  2. Process nextTick + Promise (microtasks)       │
│    │   first!         │  3. Pick callback from queue (phase wise)         │
│    │ - Then phases    │  4. Forward to Call Stack                         │
│    │   (6 phases)     │  5. Repeat...                                     │
│    └──────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Example:**

```javascript
console.log("1"); // SYNC
setTimeout(() => console.log("2"), 0); // ASYNC
fs.readFile("file.txt", () => {
  // ASYNC
  console.log("3");
});
Promise.resolve().then(() => console.log("4")); // ASYNC (Microtask)
console.log("5"); // SYNC
```

**Kya hoga:**

1. `console.log('1')` → Call Stack → Print: **1** ✓
2. `setTimeout()` → Node.js APIs → LIBUV → Timer start → **Callback** Timers Queue me
3. `fs.readFile()` → Node.js APIs → LIBUV Thread Pool → File read → **Callback** Poll Queue me
4. `Promise.then()` → **Callback** Promise Queue (Microtask) me
5. `console.log('5')` → Call Stack → Print: **5** ✓

**Call Stack empty! Ab Event Loop kaam karega:**

6. **Microtasks first** (highest priority) → Promise Queue → Print: **4** ✓
7. **Phase 1 (Timers)** → Timers Queue → Print: **2** ✓
8. **Phase 5 (Poll)** → Poll Queue → Print: **3** ✓

**Output:**

```
1
5
4  ← Microtask (Promise)
2  ← Timers phase
3  ← Poll phase
```

---

**Key Difference from Browser:**

| Browser (JS)          | Node.js                           |
| --------------------- | --------------------------------- |
| Web APIs handle async | Node.js APIs + LIBUV handle async |
| Task Queue (macro)    | 6 different phase queues          |
| Microtask Queue       | nextTick queue + Microtask queue  |
| Simple 2-queue system | Complex phase-based system        |

---

**Simple Summary:**

🔴 **Browser:** Async code → Web APIs → Task Queue → Event Loop → Call Stack

🔵 **Node.js:** Async code → Node APIs → LIBUV → Phase Queues → Event Loop → Call Stack

**Bas itna yaad rakho:**

- Async code **pura** Node APIs me jata hai
- LIBUV background me kaam karta hai
- Complete hone ke baad **sirf callback** queue me push hota hai
- Event Loop **phase wise** (6 phases) process karta hai
- **Microtasks (nextTick + Promise) sabse pehle!**

**Node.js Event Loop - 6 PHASES (each phase has its own queue):**

```
   ┌───────────────────────────┐
┌─>│         TIMERS            │  ← setTimeout(), setInterval()
│  └─────────────┬─────────────┘
│                │
│  ┌─────────────▼─────────────┐
│  │    PENDING CALLBACKS      │  ← I/O callbacks (TCP errors, etc.)
│  └─────────────┬─────────────┘
│                │
│  ┌─────────────▼─────────────┐
│  │      IDLE, PREPARE        │  ← Internal use only
│  └─────────────┬─────────────┘
│                │
│  ┌─────────────▼─────────────┐
│  │          POLL             │  ← Retrieve new I/O events
│  │  (Most important phase)   │     Execute I/O callbacks
│  └─────────────┬─────────────┘     (Can wait here for events)
│                │
│  ┌─────────────▼─────────────┐
│  │          CHECK            │  ← setImmediate() callbacks
│  └─────────────┬─────────────┘
│                │
│  ┌─────────────▼─────────────┐
│  │      CLOSE CALLBACKS      │  ← socket.on('close', ...)
│  └─────────────┬─────────────┘
│                │
└────────────────┘
     (Loop repeats)
```

#### Special Queues in Node.js (executed between phases)

```
┌──────────────────────────────────────────────────────────┐
│  process.nextTick()  ← HIGHEST PRIORITY (runs first)     │
│  Promise microtasks  ← Second priority                   │
└──────────────────────────────────────────────────────────┘
```

These execute AFTER each phase completes!

#### Key Differences: Browser vs Node.js

| BROWSER                       | NODE.JS                                 |
| ----------------------------- | --------------------------------------- |
| • Simple loop                 | • Complex 6-phase loop                  |
| • 2 queues:                   | • Multiple queues per phase             |
| &nbsp;&nbsp;- Task Queue      | • process.nextTick() (highest priority) |
| &nbsp;&nbsp;- Microtask Queue | • setImmediate() (check phase)          |
| • Uses Web APIs               | • Uses libuv (C library)                |
| • Handles UI rendering        | • No UI, handles I/O operations         |
| • setTimeout min: 4ms         | • setTimeout min: 1ms                   |

#### Example Code

```javascript
console.log("1 - Start");

setTimeout(() => {
  console.log("2 - setTimeout");
}, 0);

Promise.resolve().then(() => {
  console.log("3 - Promise");
});

process.nextTick(() => {
  // Node.js only
  console.log("4 - nextTick");
});

setImmediate(() => {
  // Node.js only
  console.log("5 - setImmediate");
});

console.log("6 - End");
```

#### Output in Node.js

```
1 - Start          ← Synchronous (Call Stack)
6 - End            ← Synchronous (Call Stack)
4 - nextTick       ← process.nextTick (HIGHEST priority)
3 - Promise        ← Microtask
2 - setTimeout     ← Timer phase (macrotask)
5 - setImmediate   ← Check phase
```

#### Output in Browser (no nextTick/setImmediate)

```
1 - Start          ← Synchronous
6 - End            ← Synchronous
3 - Promise        ← Microtask
2 - setTimeout     ← Macrotask
```

#### Priority Order (Node.js)

1. Synchronous code (Call Stack) ← HIGHEST
2. process.nextTick()
3. Promise microtasks
4. Timer phase (setTimeout, setInterval)
5. Pending callbacks
6. Poll phase (I/O)
7. Check phase (setImmediate)
8. Close callbacks ← LOWEST

#### Interview Tip

Remember: **"Next Tick Promise Timer Immediate"**

`process.nextTick()` → `Promise` → `setTimeout` → `setImmediate`

In Node.js, between each phase of the event loop:

1. ALL process.nextTick() callbacks execute
2. ALL Promise microtasks execute
3. Then move to next phase

⚠️ This is why nextTick can cause "starvation" if used recursively!

---

## Middleware

It is a function that runs before the final route handler.

**Resources:**

- https://www.youtube.com/watch?v=zM9R6aioOuQ&t=604s
- https://www.youtube.com/watch?v=n2c0mf1sza4

---

## Streams

**Resources:**

- https://www.youtube.com/watch?v=m118HulDXOk

---

## Worker Threads

---

## Monolithic and Microservice Architecture

---

## BodyParser

---

## FileSystem Module

---

## WebSocket

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

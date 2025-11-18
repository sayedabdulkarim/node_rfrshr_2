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

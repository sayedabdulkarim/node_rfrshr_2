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

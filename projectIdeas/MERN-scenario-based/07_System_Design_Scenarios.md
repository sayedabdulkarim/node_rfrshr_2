# System Design - Scenario Based Interview Questions

> "MERN interviews mein system design scenarios = scaling, caching, real-time, architecture decisions"


---


## Scenario 1: Scaling from 100 to 100K Users

**Q: Tumhara app abhi 100 users handle karta hai ek server pe. Company grow ho rahi hai, 6 months mein 100K users expected hain. Step by step kaise scale karoge?**

**A:** Yeh ek progressive scaling problem hai. Ek dum se sab kuch mat badlo -- step by step jao, har stage pe bottleneck identify karo aur solve karo.

### Stage 1: Optimize Current Setup (100-1K users)

Pehle existing server ko optimize karo bina kuch add kiye:

```
 Current Architecture (Single Server)
 =====================================

 [Users] ---> [Single Node.js Server + MongoDB on same machine]
```

```js
// 1. Database Indexes lagao - sabse bada impact
// Without index: Full collection scan (O(n))
// With index: B-tree lookup (O(log n))

// models/Product.js
const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  createdAt: { type: Date, default: Date.now }
});

// Compound index for common queries
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: 'text' }); // text search ke liye
productSchema.index({ createdAt: -1 }); // sorting ke liye

// 2. Response compression enable karo
const compression = require('compression');
app.use(compression()); // ~70% response size reduce

// 3. Query optimization - sirf needed fields fetch karo
// BAD: poora document fetch
const users = await User.find({ active: true });

// GOOD: sirf needed fields
const users = await User.find({ active: true })
  .select('name email avatar')
  .lean(); // plain JS objects, faster than Mongoose docs
```

### Stage 2: Vertical Scaling (1K-5K users)

Server ki capacity badhao -- zyada RAM, CPU:

```
 Vertical Scaling
 =================

 [Users] ---> [Bigger Server: 4 CPU, 16GB RAM]
                    |
              [MongoDB on separate server]
```

```js
// DB ko alag server pe move karo
// .env
MONGODB_URI=mongodb://db-server-ip:27017/myapp

// Node.js connection pool optimize karo
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 50,       // concurrent connections
  minPoolSize: 10,       // minimum ready connections
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
});
```

**Trade-off:** Vertical scaling ki limit hai -- ek point ke baad zyada RAM/CPU add nahi kar sakte. Cost bhi exponentially badhti hai.

### Stage 3: Horizontal Scaling with PM2 Cluster (5K-20K users)

Multiple Node.js instances chalo ek machine pe:

```
 Horizontal Scaling (Single Machine)
 =====================================

              [Load Balancer (Nginx)]
              /        |        \
     [Node:3001] [Node:3002] [Node:3003] [Node:3004]
              \        |        /
              [MongoDB Server]
```

```js
// ecosystem.config.js (PM2 config)
module.exports = {
  apps: [{
    name: 'myapp',
    script: './server.js',
    instances: 'max',    // CPU cores jitne instances
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Auto-restart on memory leak
    max_memory_restart: '1G',
  }]
};
```

```nginx
# nginx.conf - Load Balancer
upstream node_app {
    least_conn;  # sabse kam connections wale server ko bhejo
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    server 127.0.0.1:3004;
}

server {
    listen 80;
    location / {
        proxy_pass http://node_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### Stage 4: Add Redis Cache Layer (20K-50K users)

Database pe load kam karo caching se:

```
 With Redis Cache
 =================

 [Users] --> [Nginx LB] --> [Node Cluster]
                                  |
                           [Redis Cache] <-- Check here first
                                  |
                           [MongoDB] <-- Cache miss pe yahan jao
```

```js
const Redis = require('ioredis');
const redis = new Redis({
  host: 'redis-server',
  port: 6379,
  retryDelayOnFailover: 100,
});

// Cache-aside pattern
async function getProduct(productId) {
  const cacheKey = `product:${productId}`;

  // Step 1: Cache mein dekho
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // Cache HIT - DB call saved
  }

  // Step 2: Cache MISS - DB se fetch karo
  const product = await Product.findById(productId).lean();

  // Step 3: Cache mein store karo (1 hour TTL)
  await redis.setex(cacheKey, 3600, JSON.stringify(product));

  return product;
}

// Cache invalidation jab product update ho
async function updateProduct(productId, data) {
  await Product.findByIdAndUpdate(productId, data);
  await redis.del(`product:${productId}`); // Cache clear
}
```

### Stage 5: Database Replica Set (50K-80K users)

Read operations distribute karo:

```
 MongoDB Replica Set
 =====================

 [Node Cluster]
      |
      +--> [Primary]   <-- All WRITES go here
      |        |
      |    [Secondary 1] <-- READS can go here
      |        |
      |    [Secondary 2] <-- READS can go here too
```

```js
// MongoDB connection with replica set
mongoose.connect(
  'mongodb://primary:27017,secondary1:27017,secondary2:27017/myapp', {
    replicaSet: 'rs0',
    readPreference: 'secondaryPreferred', // reads secondary se
    w: 'majority',  // write concern
  }
);
```

### Stage 6: CDN for Static Assets (80K-100K users)

```
 Full Architecture at 100K Users
 ==================================

 [Users]
    |
    +--> [CloudFront CDN] --> Static assets (images, CSS, JS)
    |
    +--> [Nginx Load Balancer]
              |
    +--> [Node.js Cluster (Multiple Servers)]
              |
         [Redis Cache Cluster]
              |
         [MongoDB Replica Set]
              |
         [Bull Queue + Workers] --> Background jobs
```

### Stage 7: Message Queue for Async Tasks

```js
// Email, notifications, heavy processing queue mein daalo
const Queue = require('bull');
const emailQueue = new Queue('email', { redis: { host: 'redis-server' } });

// Producer: API route mein queue mein add karo
app.post('/api/register', async (req, res) => {
  const user = await User.create(req.body);

  // Email async bhejo -- user ko wait nahi karna padega
  await emailQueue.add('welcome-email', {
    to: user.email,
    name: user.name
  });

  res.status(201).json({ message: 'Registered!' });
});

// Consumer: Separate worker process
emailQueue.process('welcome-email', async (job) => {
  await sendEmail(job.data.to, 'Welcome!', `Hi ${job.data.name}...`);
});
```

**Key Trade-offs:**
| Stage | Cost | Complexity | Impact |
|-------|------|-----------|--------|
| Indexes + Optimization | Free | Low | High |
| Vertical Scaling | Medium | Low | Medium |
| PM2 Cluster | Free | Low | High |
| Redis Cache | Medium | Medium | Very High |
| DB Replica Set | High | Medium | High |
| CDN | Medium | Low | High |
| Message Queue | Medium | High | Medium |

> **Yaad rakho:** Premature optimization mat karo. Har stage pe metrics dekho (response time, CPU usage, DB queries), bottleneck identify karo, phir solve karo.


---


## Scenario 2: Real-Time Notification System

**Q: WhatsApp jaisa notification system design karo. User online hai toh instant push, offline hai toh store aur jab aaye toh deliver. Kaise banayoge?**

**A:** Isko design karne ke liye humein teen main components chahiye: Presence System (kaun online hai), Message Delivery (real-time + offline), aur Notification Service (push for mobile).

### Architecture Overview

```
 Real-Time Notification System
 ================================

 [Sender App]
      |
      v
 [API Server] --> [Message Service]
      |                  |
      |           +------+------+
      |           |             |
      v           v             v
 [Presence    [Redis       [MongoDB
  Service]    Pub/Sub]     Messages]
      |           |             |
      |           v             |
      |    [WebSocket          |
      |     Server]            |
      |        |               |
      |        v               v
      |   [Online Users]  [Offline Store]
      |                        |
      v                        v
 [Redis: user    [FCM/APNs Push
  online map]     Notification]
```

### Step 1: Presence System - Kaun Online Hai

```js
// presence.service.js
const Redis = require('ioredis');
const redis = new Redis();

class PresenceService {
  // Jab user connect ho (WebSocket open)
  async setOnline(userId, socketId) {
    await redis.hset('online_users', userId, JSON.stringify({
      socketId,
      lastSeen: Date.now(),
      status: 'online'
    }));
  }

  // Jab user disconnect ho
  async setOffline(userId) {
    await redis.hset('online_users', userId, JSON.stringify({
      status: 'offline',
      lastSeen: Date.now()
    }));
  }

  // Check if user online
  async isOnline(userId) {
    const data = await redis.hget('online_users', userId);
    if (!data) return false;
    const parsed = JSON.parse(data);
    return parsed.status === 'online';
  }

  // Heartbeat - har 30 sec user alive hai confirm
  async heartbeat(userId) {
    const data = await redis.hget('online_users', userId);
    if (data) {
      const parsed = JSON.parse(data);
      parsed.lastSeen = Date.now();
      await redis.hset('online_users', userId, JSON.stringify(parsed));
    }
  }
}

module.exports = new PresenceService();
```

### Step 2: WebSocket Server for Real-Time Delivery

```js
// websocket.server.js
const { Server } = require('socket.io');
const presenceService = require('./presence.service');
const notificationService = require('./notification.service');

function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingTimeout: 30000,
    pingInterval: 25000, // heartbeat automatically handle hota hai
  });

  // Auth middleware - token verify karo
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const user = await verifyToken(token);
      socket.userId = user._id;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;

    // User online mark karo
    await presenceService.setOnline(userId, socket.id);

    // Pending notifications deliver karo (jo offline the tab aaye)
    const pending = await notificationService.getPending(userId);
    if (pending.length > 0) {
      socket.emit('pending_notifications', pending);
      // Mark as delivered
      await notificationService.markDelivered(
        pending.map(n => n._id),
        userId
      );
    }

    // Real-time notification receive
    socket.on('notification:ack', async (notificationId) => {
      await notificationService.markRead(notificationId, userId);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      await presenceService.setOffline(userId);
    });
  });

  return io;
}
```

### Step 3: Notification Service - Store + Deliver

```js
// notification.service.js
const Notification = require('./models/Notification');
const presenceService = require('./presence.service');

class NotificationService {
  // Notification bhejo - online toh instant, offline toh store
  async send(recipientId, notification) {
    // Step 1: DB mein store karo (hamesha, chahe online ho ya offline)
    const doc = await Notification.create({
      recipient: recipientId,
      type: notification.type,       // 'message', 'like', 'follow'
      title: notification.title,
      body: notification.body,
      data: notification.data,       // extra payload
      status: 'sent',                // sent -> delivered -> read
      createdAt: new Date()
    });

    // Step 2: Check if user online hai
    const isOnline = await presenceService.isOnline(recipientId);

    if (isOnline) {
      // Online hai - WebSocket se instant push
      const socketData = await presenceService.getSocketId(recipientId);
      global.io.to(socketData.socketId).emit('new_notification', {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        body: doc.body,
        data: doc.data,
        createdAt: doc.createdAt
      });
      // Status update: delivered
      doc.status = 'delivered';
      doc.deliveredAt = new Date();
      await doc.save();
    } else {
      // Offline hai - Push notification bhejo (mobile)
      await this.sendPushNotification(recipientId, notification);
    }

    return doc;
  }

  // Pending notifications fetch (jab user reconnect kare)
  async getPending(userId) {
    return Notification.find({
      recipient: userId,
      status: { $in: ['sent'] } // delivered nahi hua
    }).sort({ createdAt: -1 }).limit(100);
  }

  // Delivery status tracking
  async markDelivered(notificationIds, userId) {
    await Notification.updateMany(
      { _id: { $in: notificationIds }, recipient: userId },
      { $set: { status: 'delivered', deliveredAt: new Date() } }
    );
  }

  async markRead(notificationId, userId) {
    await Notification.updateOne(
      { _id: notificationId, recipient: userId },
      { $set: { status: 'read', readAt: new Date() } }
    );
  }

  // Firebase Cloud Messaging for mobile push
  async sendPushNotification(userId, notification) {
    const user = await User.findById(userId).select('fcmTokens');
    if (!user || !user.fcmTokens.length) return;

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: user.fcmTokens, // multiple devices
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Push sent: ${response.successCount} success`);
    } catch (err) {
      console.error('Push failed:', err);
    }
  }
}

module.exports = new NotificationService();
```

### Step 4: Notification Schema with Status Tracking

```js
// models/Notification.js
const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: {
    type: String,
    enum: ['message', 'like', 'comment', 'follow', 'system'],
    required: true
  },
  title: String,
  body: String,
  data: mongoose.Schema.Types.Mixed, // flexible payload
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
    index: true
  },
  deliveredAt: Date,
  readAt: Date,
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound index for pending notifications query
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });

// Auto-delete old read notifications (30 days)
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 2592000 });
```

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| WebSocket only | Simple, real-time | Offline users miss notifications |
| Polling | Simple, no WS infra needed | Latency, wasted requests |
| WS + Push + Store | Complete solution | Complex, multiple systems manage |
| Redis Pub/Sub | Fast, scalable | No persistence, messages lost if no subscriber |

> **Key Decision:** Hamesha pehle DB mein store karo, phir deliver karo. Agar delivery fail ho, toh notification safe hai aur retry ho sakta hai.


---


## Scenario 3: Image Upload + Processing Pipeline

**Q: Instagram jaisa photo upload chahiye. User photo upload kare, multiple sizes generate hon (thumbnail, medium, large), CDN pe serve ho. Kaise design karoge?**

**A:** Direct server pe upload mat karo -- presigned URL se direct S3 pe upload, phir async processing pipeline se multiple sizes banao.

### Architecture Diagram

```
 Image Upload + Processing Pipeline
 ======================================

 [React App]
      |
      | 1. Request presigned URL
      v
 [API Server] --> generates S3 presigned URL
      |
      | 2. Return presigned URL
      v
 [React App]
      |
      | 3. Direct upload to S3 (bypasses our server!)
      v
 [S3 Bucket: originals/]
      |
      | 4. S3 Event Trigger
      v
 [Bull Queue / SQS]
      |
      | 5. Worker picks up job
      v
 [Image Worker]
      |
      | 6. Download, resize, upload processed
      +---> [S3: thumbnails/]   (150x150)
      +---> [S3: medium/]       (600x600)
      +---> [S3: large/]        (1200x1200)
      |
      | 7. Update DB with all URLs
      v
 [MongoDB: Image document updated]
      |
      | 8. All sizes served via CDN
      v
 [CloudFront CDN] --> Users get fast delivery
```

### Step 1: Presigned URL Generation

```js
// routes/upload.js
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
  region: 'ap-south-1',
  signatureVersion: 'v4'
});

router.post('/api/upload/presigned-url', auth, async (req, res) => {
  const { fileType, fileSize } = req.body;

  // Validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(fileType)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  if (fileSize > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({ error: 'File too large (max 10MB)' });
  }

  const imageId = uuidv4();
  const key = `originals/${req.user._id}/${imageId}`;

  // S3 presigned URL generate karo (5 min validity)
  const presignedUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType,
    Expires: 300, // 5 minutes
    Conditions: [
      ['content-length-range', 0, 10 * 1024 * 1024] // max 10MB
    ]
  });

  // DB mein placeholder create karo
  const image = await Image.create({
    _id: imageId,
    user: req.user._id,
    originalKey: key,
    status: 'uploading', // uploading -> processing -> ready -> failed
  });

  res.json({
    presignedUrl,
    imageId,
    key
  });
});
```

### Step 2: React Frontend - Direct S3 Upload

```js
// components/ImageUpload.jsx
import React, { useState } from 'react';
import axios from 'axios';

function ImageUpload() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');

  const handleUpload = async (file) => {
    try {
      setStatus('getting-url');

      // Step 1: Presigned URL lo server se
      const { data } = await axios.post('/api/upload/presigned-url', {
        fileType: file.type,
        fileSize: file.size
      });

      setStatus('uploading');

      // Step 2: Direct S3 pe upload (server bypass!)
      await axios.put(data.presignedUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / e.total);
          setProgress(pct);
        }
      });

      setStatus('processing');

      // Step 3: Server ko batao upload done
      await axios.post('/api/upload/confirm', {
        imageId: data.imageId
      });

      // Step 4: Poll for processing complete (ya WebSocket suno)
      pollForReady(data.imageId);

    } catch (err) {
      setStatus('error');
      console.error('Upload failed:', err);
    }
  };

  const pollForReady = async (imageId) => {
    const interval = setInterval(async () => {
      const { data } = await axios.get(`/api/images/${imageId}`);
      if (data.status === 'ready') {
        clearInterval(interval);
        setStatus('ready');
      } else if (data.status === 'failed') {
        clearInterval(interval);
        setStatus('error');
      }
    }, 2000); // har 2 sec check
  };

  return (
    <div>
      <input type="file" accept="image/*"
        onChange={(e) => handleUpload(e.target.files[0])} />
      {status === 'uploading' && <p>Uploading: {progress}%</p>}
      {status === 'processing' && <p>Processing image sizes...</p>}
      {status === 'ready' && <p>Upload complete!</p>}
    </div>
  );
}
```

### Step 3: Image Processing Worker

```js
// workers/image.worker.js
const Queue = require('bull');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const Image = require('../models/Image');

const s3 = new AWS.S3();
const imageQueue = new Queue('image-processing', process.env.REDIS_URL);

// Size configurations
const SIZES = {
  thumbnail: { width: 150, height: 150, fit: 'cover' },
  medium:    { width: 600, height: 600, fit: 'inside' },
  large:     { width: 1200, height: 1200, fit: 'inside' }
};

imageQueue.process('resize', 3, async (job) => { // 3 concurrent jobs
  const { imageId, originalKey, userId } = job.data;

  try {
    // Step 1: S3 se original download
    const original = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: originalKey
    }).promise();

    const imageBuffer = original.Body;
    const urls = {};

    // Step 2: Har size ke liye resize + upload
    for (const [sizeName, config] of Object.entries(SIZES)) {
      const resized = await sharp(imageBuffer)
        .resize(config.width, config.height, { fit: config.fit })
        .webp({ quality: 80 }) // WebP mein convert (smaller size)
        .toBuffer();

      const key = `${sizeName}/${userId}/${imageId}.webp`;

      await s3.putObject({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: resized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000' // 1 year cache
      }).promise();

      urls[sizeName] = `${process.env.CDN_URL}/${key}`;

      // Progress update
      job.progress(
        (Object.keys(urls).length / Object.keys(SIZES).length) * 100
      );
    }

    // Step 3: DB mein saari URLs update karo
    await Image.findByIdAndUpdate(imageId, {
      urls,
      status: 'ready',
      processedAt: new Date()
    });

    return { imageId, urls };

  } catch (err) {
    // Failed mark karo
    await Image.findByIdAndUpdate(imageId, { status: 'failed' });
    throw err; // Bull will retry
  }
});

// Upload confirm hone pe queue mein add karo
async function queueImageProcessing(imageId) {
  const image = await Image.findById(imageId);
  await imageQueue.add('resize', {
    imageId: image._id,
    originalKey: image.originalKey,
    userId: image.user.toString()
  }, {
    attempts: 3,              // 3 baar retry
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true
  });
}

module.exports = { imageQueue, queueImageProcessing };
```

### Step 4: Image Schema

```js
// models/Image.js
const imageSchema = new mongoose.Schema({
  _id: String, // UUID use kar rahe hain
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  originalKey: String,
  urls: {
    thumbnail: String,  // https://cdn.example.com/thumbnails/...
    medium: String,
    large: String,
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'failed'],
    default: 'uploading'
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    sizeBytes: Number,
  },
  processedAt: Date,
}, { timestamps: true });
```

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| Direct server upload | Simple | Server bandwidth wasted, blocks Node.js event loop |
| Presigned URL + S3 | Server bypass, scalable | Extra API call, S3 cost |
| On-the-fly resize (CDN) | No storage for sizes | CPU cost per request, slow first load |
| Pre-generate all sizes | Fast delivery | Storage cost, processing time |

> **Best Practice:** Presigned URL + async processing is the industry standard. Server pe image buffer kabhi mat rakhna -- memory spike aur event loop block hoga.


---


## Scenario 4: Search Feature at Scale

**Q: E-commerce app mein search feature chahiye. 1M products hain. User "blue running shoes under 2000" search kare toh relevant results aane chahiye. Kaise implement karoge?**

**A:** Search ek evolution hai -- start simple with MongoDB text index, phir scale hone pe Elasticsearch pe migrate karo. Dono approaches dikhata hoon.

### Architecture Diagram

```
 Search Architecture (Evolved)
 ================================

 Stage 1 (Simple):
 [User] --> [API] --> [MongoDB Text Index]

 Stage 2 (Advanced):
 [User] --> [API] --> [Elasticsearch Cluster]
                           |
                      [MongoDB] <-- Source of truth
                           |
                      [Sync Service] -- keeps ES in sync with Mongo
```

### Stage 1: MongoDB Text Index (0-100K products)

```js
// models/Product.js
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  brand: String,
  price: Number,
  color: [String],
  tags: [String],
  rating: Number,
  inStock: Boolean
});

// Compound text index - multiple fields pe search
productSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  tags: 'text'
}, {
  weights: {
    name: 10,          // name match = highest priority
    brand: 5,          // brand match = medium priority
    tags: 3,           // tags match
    description: 1     // description match = lowest
  },
  name: 'product_search_index'
});

// routes/search.js
router.get('/api/search', async (req, res) => {
  const { q, minPrice, maxPrice, category, color, sort, page = 1 } = req.query;
  const limit = 20;
  const skip = (page - 1) * limit;

  // Build query
  const query = {};

  // Text search
  if (q) {
    query.$text = { $search: q };
  }

  // Filters
  if (category) query.category = category;
  if (color) query.color = { $in: color.split(',') };
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  query.inStock = true;

  // Sorting
  let sortOption = {};
  if (q && sort === 'relevance') {
    sortOption = { score: { $meta: 'textScore' } };
  } else if (sort === 'price_asc') {
    sortOption = { price: 1 };
  } else if (sort === 'price_desc') {
    sortOption = { price: -1 };
  } else if (sort === 'rating') {
    sortOption = { rating: -1 };
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .select({ score: { $meta: 'textScore' } })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query)
  ]);

  res.json({
    products,
    pagination: {
      page: Number(page),
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
```

### Stage 2: Elasticsearch (100K+ products)

```js
// services/elasticsearch.js
const { Client } = require('@elastic/elasticsearch');

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

// Index mapping define karo
async function createProductIndex() {
  await esClient.indices.create({
    index: 'products',
    body: {
      settings: {
        analysis: {
          analyzer: {
            product_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'synonym_filter', 'edge_ngram_filter']
            }
          },
          filter: {
            synonym_filter: {
              type: 'synonym',
              synonyms: [
                'shoes,footwear,sneakers',
                'phone,mobile,smartphone',
                'laptop,notebook'
              ]
            },
            edge_ngram_filter: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 15
            }
          }
        }
      },
      mappings: {
        properties: {
          name:        { type: 'text', analyzer: 'product_analyzer', boost: 10 },
          description: { type: 'text', analyzer: 'standard' },
          category:    { type: 'keyword' },    // exact match for filters
          brand:       { type: 'keyword' },
          price:       { type: 'float' },
          color:       { type: 'keyword' },
          rating:      { type: 'float' },
          tags:        { type: 'keyword' },
          inStock:     { type: 'boolean' },
          suggest:     { type: 'completion' }  // autocomplete ke liye
        }
      }
    }
  });
}

// Advanced search with Elasticsearch
async function searchProducts({ query, filters, page = 1, limit = 20 }) {
  const must = [];
  const filter = [];

  // Main search query (typo tolerance = fuzziness)
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['name^10', 'brand^5', 'tags^3', 'description'],
        fuzziness: 'AUTO',    // typo tolerance!
        prefix_length: 2,     // pehle 2 characters exact match
        type: 'best_fields'
      }
    });
  }

  // Filters (exact match, cached by ES)
  if (filters.category) {
    filter.push({ term: { category: filters.category } });
  }
  if (filters.color) {
    filter.push({ terms: { color: filters.color } });
  }
  if (filters.minPrice || filters.maxPrice) {
    const range = {};
    if (filters.minPrice) range.gte = filters.minPrice;
    if (filters.maxPrice) range.lte = filters.maxPrice;
    filter.push({ range: { price: range } });
  }
  filter.push({ term: { inStock: true } });

  const result = await esClient.search({
    index: 'products',
    body: {
      from: (page - 1) * limit,
      size: limit,
      query: {
        bool: { must, filter }
      },
      // Facets/Aggregations for filter sidebar
      aggs: {
        categories: { terms: { field: 'category', size: 20 } },
        brands: { terms: { field: 'brand', size: 30 } },
        colors: { terms: { field: 'color', size: 15 } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { to: 500 },
              { from: 500, to: 1000 },
              { from: 1000, to: 2000 },
              { from: 2000, to: 5000 },
              { from: 5000 }
            ]
          }
        }
      }
    }
  });

  return {
    products: result.hits.hits.map(h => ({ ...h._source, _score: h._score })),
    total: result.hits.total.value,
    facets: {
      categories: result.aggregations.categories.buckets,
      brands: result.aggregations.brands.buckets,
      colors: result.aggregations.colors.buckets,
      priceRanges: result.aggregations.price_ranges.buckets,
    }
  };
}
```

### Step 3: Autocomplete / Suggestion

```js
// Autocomplete API
router.get('/api/search/suggest', async (req, res) => {
  const { q } = req.query;

  // Redis mein popular searches cache karo
  const cacheKey = `suggest:${q.toLowerCase().slice(0, 3)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const result = await esClient.search({
    index: 'products',
    body: {
      suggest: {
        product_suggest: {
          prefix: q,
          completion: {
            field: 'suggest',
            size: 8,
            fuzzy: { fuzziness: 1 }
          }
        }
      }
    }
  });

  const suggestions = result.suggest.product_suggest[0].options.map(opt => ({
    text: opt.text,
    score: opt._score
  }));

  // Cache 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(suggestions));

  res.json(suggestions);
});
```

### Step 4: MongoDB to Elasticsearch Sync

```js
// sync/product-sync.js
// MongoDB Change Streams se real-time sync

const pipeline = [
  { $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }
];

const changeStream = Product.watch(pipeline);

changeStream.on('change', async (change) => {
  switch (change.operationType) {
    case 'insert':
    case 'update':
    case 'replace':
      const product = await Product.findById(
        change.documentKey._id
      ).lean();
      if (product) {
        await esClient.index({
          index: 'products',
          id: product._id.toString(),
          body: {
            ...product,
            suggest: {
              input: [product.name, product.brand, ...product.tags]
            }
          }
        });
      }
      break;
    case 'delete':
      await esClient.delete({
        index: 'products',
        id: change.documentKey._id.toString()
      });
      break;
  }
});
```

**Trade-offs:**
| Feature | MongoDB Text Index | Elasticsearch |
|---------|-------------------|---------------|
| Setup | Simple (built-in) | Separate cluster needed |
| Typo tolerance | No | Yes (fuzziness) |
| Facets/Aggregations | Basic ($facet) | Advanced, fast |
| Autocomplete | Manual implementation | Built-in completion |
| Synonyms | No | Yes |
| Relevance tuning | Limited (weights) | Highly configurable |
| Cost | Free (same DB) | Extra infra cost |
| Scale | ~100K docs | Millions of docs |

> **Recommendation:** Start with MongoDB text index. Jab search experience improve karna ho ya 100K+ products hon, tab Elasticsearch add karo. Premature Elasticsearch mat lagao.


---


## Scenario 5: Chat System with Read Receipts

**Q: Group chat mein read receipts implement karo. 50 members ka group hai. Har message ke neeche dikhna chahiye "Seen by 34". Kaise efficiently karoge?**

**A:** Read receipts tricky hain kyunki naive approach mein 50 member group ka ek message padhne pe 50 WebSocket events fire hote hain. Efficient batching aur smart fan-out strategy zaroori hai.

### Architecture

```
 Chat + Read Receipt System
 =============================

 [User A reads msg]
      |
      v
 [WebSocket Server]
      |
      | 1. Store read receipt in DB
      v
 [Redis] <-- Buffer read receipts
      |
      | 2. Every 2 sec, batch flush
      v
 [MongoDB] <-- Persistent storage
      |
      | 3. Broadcast batched update
      v
 [WebSocket] --> [All group members online]
                  "Seen by 34" updated
```

### Step 1: Message Schema Design

```js
// models/Message.js
const messageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },

  // Read receipts -- IMPORTANT: Array approach vs separate collection
  // Array approach for groups < 100 members
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],

  // Quick count for display (denormalized)
  readCount: { type: Number, default: 0 },

  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deliveredCount: { type: Number, default: 0 },

}, { timestamps: true });

// Index for fetching group messages
messageSchema.index({ group: 1, createdAt: -1 });
// Index for checking if user already read
messageSchema.index({ _id: 1, 'readBy.user': 1 });
```

### Step 2: Read Receipt Batching Service

```js
// services/readReceipt.service.js
const Redis = require('ioredis');
const redis = new Redis();

class ReadReceiptService {
  constructor() {
    // Har 2 second batch flush karo
    this.flushInterval = setInterval(() => this.flushBatch(), 2000);
  }

  // User ne message padha -- immediately DB update mat karo,
  // Redis buffer mein daal do
  async markAsRead(userId, messageId, groupId) {
    const key = `readreceipt:${groupId}`;

    // Redis SET mein add karo (duplicates automatically handled)
    await redis.sadd(`${key}:${messageId}`, userId);

    // Track which messages have pending receipts
    await redis.sadd(`${key}:pending`, messageId);
  }

  // Batch mein DB update + broadcast
  async flushBatch() {
    // Saare groups ke pending receipts find karo
    const keys = await redis.keys('readreceipt:*:pending');

    for (const pendingKey of keys) {
      const groupId = pendingKey.split(':')[1];
      const messageIds = await redis.smembers(pendingKey);

      if (messageIds.length === 0) continue;

      const updates = [];

      for (const messageId of messageIds) {
        const readByKey = `readreceipt:${groupId}:${messageId}`;
        const userIds = await redis.smembers(readByKey);

        if (userIds.length === 0) continue;

        // Bulk DB update
        updates.push({
          updateOne: {
            filter: { _id: messageId },
            update: {
              $addToSet: {
                readBy: {
                  $each: userIds.map(uid => ({
                    user: uid,
                    readAt: new Date()
                  }))
                }
              },
              $inc: { readCount: userIds.length }
            }
          }
        });

        // Redis se clean karo
        await redis.del(readByKey);
      }

      // Single bulk operation -- bahut efficient!
      if (updates.length > 0) {
        await Message.bulkWrite(updates);
      }

      // Pending list clear karo
      await redis.del(pendingKey);

      // WebSocket broadcast -- ek event mein saare updates
      this.broadcastReadReceipts(groupId, messageIds);
    }
  }

  // Batched broadcast -- 50 individual events ki jagah 1 event
  broadcastReadReceipts(groupId, messageIds) {
    // Updated counts fetch karo
    Message.find({ _id: { $in: messageIds } })
      .select('_id readCount')
      .lean()
      .then(messages => {
        const updates = messages.map(m => ({
          messageId: m._id,
          readCount: m.readCount
        }));

        // Group room mein ek batched event bhejo
        global.io.to(`group:${groupId}`).emit('read_receipts_batch', {
          groupId,
          updates
        });
      });
  }

  // Detailed read receipt - "Seen by" list
  async getReadDetails(messageId) {
    const message = await Message.findById(messageId)
      .select('readBy')
      .populate('readBy.user', 'name avatar')
      .lean();

    return message.readBy;
  }
}

module.exports = new ReadReceiptService();
```

### Step 3: WebSocket Integration

```js
// websocket/chat.handler.js
const readReceiptService = require('../services/readReceipt.service');

function setupChatHandlers(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Group join
    socket.on('join_group', (groupId) => {
      socket.join(`group:${groupId}`);
    });

    // Message send
    socket.on('send_message', async (data) => {
      const { groupId, content, type } = data;

      const message = await Message.create({
        group: groupId,
        sender: userId,
        content,
        type,
        readBy: [{ user: userId, readAt: new Date() }], // sender ne khud padha
        readCount: 1
      });

      // Group mein broadcast
      io.to(`group:${groupId}`).emit('new_message', {
        _id: message._id,
        group: groupId,
        sender: { _id: userId, name: socket.userName },
        content,
        type,
        readCount: 1,
        createdAt: message.createdAt
      });
    });

    // Read receipt -- user ne messages dekhe
    // Client ek baar mein multiple messages "seen" bhejta hai
    socket.on('messages_read', async (data) => {
      const { groupId, messageIds } = data;

      // Batch mein Redis buffer mein daalo
      for (const msgId of messageIds) {
        await readReceiptService.markAsRead(userId, msgId, groupId);
      }
      // Actual DB write + broadcast 2 sec baad batch mein hoga
    });

    // Detailed "seen by" list request
    socket.on('get_read_details', async (messageId, callback) => {
      const details = await readReceiptService.getReadDetails(messageId);
      callback(details);
    });
  });
}
```

### Step 4: React Frontend

```js
// hooks/useReadReceipts.js
import { useEffect, useRef } from 'react';

function useReadReceipts(socket, groupId, visibleMessageIds) {
  const sentRef = useRef(new Set());

  useEffect(() => {
    // Jo messages screen pe visible hain aur read nahi bheja, unka read bhejo
    const unread = visibleMessageIds.filter(id => !sentRef.current.has(id));

    if (unread.length > 0) {
      socket.emit('messages_read', {
        groupId,
        messageIds: unread
      });
      unread.forEach(id => sentRef.current.add(id));
    }
  }, [visibleMessageIds, groupId, socket]);

  // Batched read receipt updates suno
  useEffect(() => {
    socket.on('read_receipts_batch', (data) => {
      // Redux/Zustand store mein update karo
      data.updates.forEach(({ messageId, readCount }) => {
        updateMessageReadCount(messageId, readCount);
      });
    });

    return () => socket.off('read_receipts_batch');
  }, [socket]);
}
```

**Large Group Optimization (500+ members):**

```js
// For very large groups, readBy array mat rakho
// Separate collection use karo

// models/ReadReceipt.js (for large groups)
const readReceiptSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, index: true },
  readAt: { type: Date, default: Date.now }
});

// Compound unique index -- duplicate prevent
readReceiptSchema.index({ message: 1, user: 1 }, { unique: true });

// Count query fast hoga with index
// const count = await ReadReceipt.countDocuments({ message: msgId });
```

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| readBy array in message | Simple, single query | Document grows, 16MB limit |
| Separate ReadReceipt collection | Scalable, no size limit | Extra joins/queries |
| Redis buffer + batch flush | Reduces DB writes by 90% | 2 sec delay in receipts |
| Individual events per read | Real-time accurate | 50 events per message = network flood |
| Batched events | Efficient network usage | Slight delay in UI update |

> **Rule of Thumb:** Groups < 100 members: readBy array works fine. Groups > 100: separate collection. Always batch WebSocket events.


---


## Scenario 6: Multi-Tenant SaaS Architecture

**Q: Ek SaaS product bana rahe ho jisme different companies (tenants) use karein. Har company ka data isolated hona chahiye. Database kaise design karoge?**

**A:** Multi-tenancy ke 3 main approaches hain. Har ek ka trade-off different hai. Company ke stage aur requirements ke hisaab se choose karo.

### Three Approaches Overview

```
 Multi-Tenant Database Strategies
 ===================================

 Approach 1: Shared DB, Shared Schema (tenantId column)
 +------------------------------------------+
 |  Database: myapp                          |
 |  +--------------------------------------+ |
 |  | users table                          | |
 |  | id | tenantId | name    | email      | |
 |  | 1  | T1       | Rahul   | r@a.com    | |
 |  | 2  | T2       | Priya   | p@b.com    | |
 |  | 3  | T1       | Amit    | a@a.com    | |
 |  +--------------------------------------+ |
 +------------------------------------------+

 Approach 2: Shared DB, Separate Schemas
 +------------------------------------------+
 |  Database: myapp                          |
 |  +----------------+ +------------------+ |
 |  | Schema: T1     | | Schema: T2       | |
 |  | users          | | users            | |
 |  | id|name|email  | | id|name |email   | |
 |  | 1 |Rahul|r@..  | | 1 |Priya|p@..   | |
 |  +----------------+ +------------------+ |
 +------------------------------------------+

 Approach 3: Separate Database per Tenant
 +------------------+  +------------------+
 |  Database: T1    |  |  Database: T2    |
 |  +------------+  |  |  +------------+  |
 |  | users      |  |  |  | users      |  |
 |  | id|name    |  |  |  | id|name    |  |
 |  +------------+  |  |  +------------+  |
 +------------------+  +------------------+
```

### Approach 1: Shared DB + tenantId (Most Common for MERN)

```js
// models/base.model.js
// Har model mein tenantId mandatory hai
function createTenantModel(name, schemaDefinition) {
  const schema = new mongoose.Schema({
    tenantId: {
      type: String,
      required: true,
      index: true,
      immutable: true // ek baar set, change nahi hoga
    },
    ...schemaDefinition
  }, { timestamps: true });

  // CRITICAL: Har query mein tenantId automatically add karo
  // Agar bhool gaye toh data leak!
  schema.pre(/^find/, function() {
    if (!this.getQuery().tenantId) {
      throw new Error('SECURITY: tenantId missing in query!');
    }
  });

  // Compound indexes with tenantId
  // Har query tenantId + kuch aur hoga
  schema.index({ tenantId: 1, createdAt: -1 });

  return mongoose.model(name, schema);
}

// Usage
const User = createTenantModel('User', {
  name: String,
  email: String,
  role: { type: String, enum: ['admin', 'member'] }
});

const Project = createTenantModel('Project', {
  name: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
```

### Tenant Isolation Middleware

```js
// middleware/tenant.middleware.js

// Option A: Tenant from JWT token
function tenantFromToken(req, res, next) {
  // JWT mein tenantId stored hai
  const { tenantId } = req.user; // set by auth middleware

  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context' });
  }

  // Request object pe attach karo
  req.tenantId = tenantId;

  // Mongoose query helper -- automatically tenantId inject
  req.tenantQuery = (model) => {
    return {
      find: (filter = {}) => model.find({ ...filter, tenantId }),
      findOne: (filter = {}) => model.findOne({ ...filter, tenantId }),
      create: (data) => model.create({ ...data, tenantId }),
      updateOne: (filter, update) =>
        model.updateOne({ ...filter, tenantId }, update),
      deleteOne: (filter) =>
        model.deleteOne({ ...filter, tenantId }),
      countDocuments: (filter = {}) =>
        model.countDocuments({ ...filter, tenantId }),
    };
  };

  next();
}

// Option B: Tenant from subdomain (acme.myapp.com)
function tenantFromSubdomain(req, res, next) {
  const host = req.headers.host;
  const subdomain = host.split('.')[0]; // 'acme' from 'acme.myapp.com'

  if (subdomain === 'www' || subdomain === 'app') {
    return res.status(400).json({ error: 'Invalid tenant' });
  }

  // Lookup tenant by subdomain
  Tenant.findOne({ subdomain })
    .then(tenant => {
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      req.tenantId = tenant._id.toString();
      next();
    })
    .catch(next);
}

module.exports = { tenantFromToken, tenantFromSubdomain };
```

### Routes with Tenant Isolation

```js
// routes/projects.js
const { tenantFromToken } = require('../middleware/tenant.middleware');

router.use(auth, tenantFromToken); // Har route pe tenant check

// GET /api/projects -- sirf apne tenant ke projects
router.get('/', async (req, res) => {
  const projects = await req.tenantQuery(Project).find({});
  // Internally: Project.find({ tenantId: 'T1' })
  // Tenant T2 ka data KABHI nahi aayega
  res.json(projects);
});

// POST /api/projects -- tenantId automatically set
router.post('/', async (req, res) => {
  const project = await req.tenantQuery(Project).create({
    name: req.body.name,
    members: [req.user._id]
  });
  // Internally: Project.create({ name: '...', tenantId: 'T1', members: [...] })
  res.status(201).json(project);
});

// DANGER: Without tenant middleware, ye sab tenants ka data return karega
// router.get('/admin/all', async (req, res) => {
//   const all = await Project.find({}); // NO tenantId filter!
//   // THIS IS A DATA BREACH
// });
```

### Approach 2: Separate DB per Tenant (Premium/Enterprise)

```js
// services/tenantDb.service.js
const connections = new Map();

async function getTenantConnection(tenantId) {
  // Connection pool mein check karo
  if (connections.has(tenantId)) {
    return connections.get(tenantId);
  }

  // Naya connection create karo
  const dbName = `tenant_${tenantId}`;
  const conn = await mongoose.createConnection(
    `mongodb://db-server:27017/${dbName}`, {
      maxPoolSize: 10,
      minPoolSize: 2
    }
  );

  // Models register karo is connection pe
  conn.model('User', userSchema);
  conn.model('Project', projectSchema);

  connections.set(tenantId, conn);
  return conn;
}

// Middleware for separate DB approach
async function tenantDbMiddleware(req, res, next) {
  const tenantId = req.user.tenantId;
  const conn = await getTenantConnection(tenantId);

  req.db = {
    User: conn.model('User'),
    Project: conn.model('Project'),
  };

  next();
}

// Usage in routes -- no tenantId filter needed!
router.get('/projects', tenantDbMiddleware, async (req, res) => {
  // Ye automatically sirf is tenant ka DB query karega
  const projects = await req.db.Project.find({});
  res.json(projects);
});
```

### Tenant Management

```js
// models/Tenant.js (master DB mein)
const tenantSchema = new mongoose.Schema({
  name: String,            // "Acme Corp"
  subdomain: { type: String, unique: true }, // "acme"
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  limits: {
    maxUsers: { type: Number, default: 5 },
    maxStorage: { type: Number, default: 1073741824 }, // 1GB in bytes
    maxProjects: { type: Number, default: 3 }
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Tenant limit check middleware
async function checkTenantLimits(req, res, next) {
  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant.isActive) {
    return res.status(403).json({ error: 'Tenant suspended' });
  }

  const userCount = await User.countDocuments({ tenantId: req.tenantId });
  if (userCount >= tenant.limits.maxUsers) {
    return res.status(403).json({
      error: 'User limit reached. Upgrade your plan.'
    });
  }

  next();
}
```

**Trade-offs Comparison:**
| Factor | Shared Schema | Separate Schema | Separate DB |
|--------|--------------|----------------|-------------|
| Data Isolation | Low (app-level) | Medium | High (DB-level) |
| Cost | Lowest | Medium | Highest |
| Complexity | Simple | Medium | High |
| Scaling | Harder at scale | Medium | Easy per-tenant |
| Cross-tenant query | Easy (analytics) | Harder | Very hard |
| Backup/Restore | All at once | Per schema | Per tenant |
| Compliance (GDPR) | Hard to delete | Medium | Easy to delete |
| Best for | Startups, SaaS MVPs | Mid-scale SaaS | Enterprise, regulated |

> **Recommendation:** 90% MERN SaaS apps ke liye Approach 1 (Shared DB + tenantId) kaafi hai. Jab compliance requirements aayein (healthcare, finance), tab Approach 3 consider karo.


---


## Scenario 7: Caching Strategy for Social Media Feed

**Q: Social media feed hai. 10M users hain. Har user ka personalized feed hai. Feed API har baar database se fetch karna expensive hai. Caching kaise karoge?**

**A:** Feed caching social media ka sabse challenging problem hai. Two main strategies hain: Fan-out on Write (push model) aur Fan-out on Read (pull model). Dono ko samjho, phir hybrid approach use karo.

### Architecture Overview

```
 Feed Caching Architecture (Hybrid)
 =====================================

 [User creates post]
      |
      v
 [API Server]
      |
      +---> [MongoDB: Posts collection] (source of truth)
      |
      +---> [Fan-out Service]
                 |
        +--------+--------+
        |                 |
   [Regular Users]    [Celebrity]
   Fan-out on WRITE   Fan-out on READ
        |                 |
        v                 v
   [Redis: each       [Merged at
    follower's         read time]
    feed updated]
```

### Fan-out on Write (Push Model)

```js
// services/feed.service.js - Fan-out on Write
const Redis = require('ioredis');
const redis = new Redis();

class FeedService {
  // Jab user post kare
  async onNewPost(post) {
    const { _id: postId, author, createdAt } = post;

    // Author ke followers list fetch karo
    const followers = await Follow.find({ following: author })
      .select('follower')
      .lean();

    const followerCount = followers.length;

    // Celebrity check: 100K+ followers = fan-out on read
    if (followerCount > 100000) {
      // Celebrity ki post ko special list mein daalo
      await redis.zadd('celebrity_posts', createdAt.getTime(), postId.toString());
      await redis.expire('celebrity_posts', 86400); // 24 hr
      return;
    }

    // Regular user: Fan-out on Write
    // Har follower ke feed mein add karo
    const pipeline = redis.pipeline();

    for (const { follower } of followers) {
      const feedKey = `feed:${follower}`;

      // Sorted Set: score = timestamp, value = postId
      pipeline.zadd(feedKey, createdAt.getTime(), postId.toString());

      // Feed max 500 posts rakho (purane hatao)
      pipeline.zremrangebyrank(feedKey, 0, -501);

      // TTL reset: 7 days
      pipeline.expire(feedKey, 604800);
    }

    await pipeline.exec(); // Single round trip mein sab execute
  }

  // User apna feed fetch kare
  async getFeed(userId, page = 1, limit = 20) {
    const feedKey = `feed:${userId}`;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Step 1: Redis se postIds fetch (already sorted by time)
    let postIds = await redis.zrevrange(feedKey, start, end);

    // Step 2: Celebrity posts merge karo (Fan-out on Read)
    if (page === 1) {
      const celebrityPostIds = await this.getCelebrityPostsForUser(userId);
      postIds = this.mergeSorted(postIds, celebrityPostIds).slice(0, limit);
    }

    // Step 3: Cache MISS check -- agar feed empty hai
    if (postIds.length === 0) {
      return this.buildFeedFromScratch(userId, page, limit);
    }

    // Step 4: Actual post data fetch (multi-get from Redis or DB)
    const posts = await this.getPostDetails(postIds);

    return posts;
  }

  // Cache miss: DB se feed build karo
  async buildFeedFromScratch(userId, page, limit) {
    // User ke following list
    const following = await Follow.find({ follower: userId })
      .select('following')
      .lean();

    const followingIds = following.map(f => f.following);

    // Latest posts fetch
    const posts = await Post.find({
      author: { $in: followingIds },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'name avatar')
      .lean();

    // Feed cache rebuild karo background mein
    this.rebuildFeedCache(userId, followingIds);

    return posts;
  }

  // Background: Redis feed cache rebuild
  async rebuildFeedCache(userId, followingIds) {
    const feedKey = `feed:${userId}`;
    const posts = await Post.find({
      author: { $in: followingIds },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .select('_id createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    if (posts.length === 0) return;

    const pipeline = redis.pipeline();
    for (const post of posts) {
      pipeline.zadd(feedKey, post.createdAt.getTime(), post._id.toString());
    }
    pipeline.expire(feedKey, 604800);
    await pipeline.exec();
  }
}
```

### Cache Invalidation Strategy

```js
// Kab cache invalidate karna hai
class CacheInvalidation {
  // Post delete hua
  async onPostDeleted(postId, authorId) {
    // Author ke sabhi followers ke feed se remove
    const followers = await Follow.find({ following: authorId })
      .select('follower').lean();

    const pipeline = redis.pipeline();
    for (const { follower } of followers) {
      pipeline.zrem(`feed:${follower}`, postId.toString());
    }
    await pipeline.exec();
  }

  // User unfollow kiya
  async onUnfollow(followerId, unfollowedId) {
    // Unfollowed user ke posts feed se hatao
    const posts = await Post.find({ author: unfollowedId })
      .select('_id').limit(500).lean();

    const pipeline = redis.pipeline();
    for (const post of posts) {
      pipeline.zrem(`feed:${followerId}`, post._id.toString());
    }
    await pipeline.exec();
  }

  // Post edit hua -- feed mein position same, content update
  async onPostUpdated(postId) {
    // Post detail cache invalidate karo, feed order change nahi hoga
    await redis.del(`post:${postId}`);
  }
}
```

### Cache Stampede Prevention

```js
// Cache stampede: 1000 users same time pe cache miss karein = 1000 DB queries
// Solution: Locking with single-flight pattern

async function getFeedWithLock(userId, page, limit) {
  const feedKey = `feed:${userId}`;
  const lockKey = `lock:${feedKey}`;

  // Try cache first
  let postIds = await redis.zrevrange(feedKey, 0, limit - 1);
  if (postIds.length > 0) return postIds;

  // Cache miss: lock le lo
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');

  if (lockAcquired) {
    // Hum first hain -- DB se fetch + cache set
    const posts = await buildFeedFromDB(userId);
    await cacheFeed(userId, posts);
    await redis.del(lockKey);
    return posts;
  } else {
    // Koi aur already build kar raha hai -- wait karo
    await sleep(100); // 100ms wait
    return getFeedWithLock(userId, page, limit); // retry
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### The Celebrity Problem

```js
// Problem: Virat Kohli ke 50M followers hain.
// Fan-out on Write = 50M Redis writes per post = too slow!

// Solution: Hybrid approach

async function onNewPost(post) {
  const followerCount = await Follow.countDocuments({
    following: post.author
  });

  if (followerCount > 100000) {
    // CELEBRITY: Fan-out on READ
    // Post sirf celebrity timeline mein store karo
    await redis.zadd(
      `timeline:${post.author}`,
      post.createdAt.getTime(),
      post._id.toString()
    );
    // Followers ke feed mein push NAHI karenge
    // Jab follower feed read kare, tab merge karenge
  } else {
    // REGULAR USER: Fan-out on WRITE
    await fanOutToFollowers(post);
  }
}

// Feed read time pe celebrity posts merge
async function getFeed(userId) {
  // 1. Pre-computed feed (from fan-out on write)
  const regularPosts = await redis.zrevrange(`feed:${userId}`, 0, 49);

  // 2. Celebrity posts (fan-out on read)
  const celebrities = await getCelebritiesFollowedBy(userId);
  let celebrityPosts = [];
  for (const celeb of celebrities) {
    const posts = await redis.zrevrange(`timeline:${celeb}`, 0, 9);
    celebrityPosts.push(...posts);
  }

  // 3. Merge + sort by timestamp
  const merged = mergeSortedFeeds(regularPosts, celebrityPosts);

  return merged.slice(0, 20); // top 20
}
```

**Trade-offs:**
| Strategy | Pros | Cons |
|----------|------|------|
| Fan-out on Write | Fast reads, O(1) | Slow writes for popular users, storage |
| Fan-out on Read | Fast writes, less storage | Slow reads, compute at read time |
| Hybrid | Best of both | Complex to implement |
| No cache (DB only) | Simple, consistent | Doesn't scale beyond 10K users |

> **Yaad rakho:** Twitter ne bhi exactly yeh hybrid approach use kiya. Regular users ke liye fan-out on write, celebrities ke liye fan-out on read.


---


## Scenario 8: Background Job Processing

**Q: User CSV upload karta hai with 50K rows. Har row process karni hai (validate, transform, save to DB). Synchronous karna impossible hai. Kaise handle karoge?**

**A:** Isko Bull/BullMQ queue ke saath handle karo -- job queue mein daalo, worker process kare, progress real-time client ko dikhai de.

### Architecture

```
 Background Job Processing Pipeline
 =====================================

 [React: Upload CSV]
      |
      | 1. Upload file
      v
 [API Server]
      |
      | 2. Parse CSV headers, validate format
      | 3. Create job in Bull queue
      | 4. Return jobId immediately (202 Accepted)
      v
 [Bull Queue (Redis)]
      |
      | 5. Worker picks up job
      v
 [Worker Process]
      |
      | 6. Process in chunks (500 rows at a time)
      |    - Validate each row
      |    - Transform data
      |    - Bulk insert to MongoDB
      |    - Update progress
      v
 [MongoDB]     [Redis: Job Progress]
                     |
                     | 7. SSE/WebSocket progress events
                     v
               [React: Progress Bar]
               "Processing: 35,000 / 50,000 (70%)"
```

### Step 1: CSV Upload API

```js
// routes/import.js
const Queue = require('bull');
const csv = require('csv-parser');
const multer = require('multer');
const { Readable } = require('stream');

const importQueue = new Queue('csv-import', process.env.REDIS_URL);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

router.post('/api/import/csv', auth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Step 1: CSV headers validate karo
  const expectedHeaders = ['name', 'email', 'phone', 'department', 'salary'];
  const firstLine = req.file.buffer.toString('utf8').split('\n')[0];
  const headers = firstLine.split(',').map(h => h.trim().toLowerCase());

  const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return res.status(400).json({
      error: `Missing columns: ${missingHeaders.join(', ')}`
    });
  }

  // Step 2: Row count estimate
  const rowCount = req.file.buffer.toString('utf8').split('\n').length - 1;

  // Step 3: Job record create karo
  const importJob = await ImportJob.create({
    user: req.user._id,
    fileName: req.file.originalname,
    totalRows: rowCount,
    processedRows: 0,
    failedRows: 0,
    status: 'queued', // queued -> processing -> completed -> failed
    errors: []
  });

  // Step 4: Bull queue mein add karo
  // CSV data S3/temp storage mein daalo (queue mein large data mat daalo)
  const tempKey = `imports/${importJob._id}.csv`;
  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: tempKey,
    Body: req.file.buffer
  }).promise();

  await importQueue.add('process-csv', {
    jobId: importJob._id.toString(),
    fileKey: tempKey,
    userId: req.user._id.toString()
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    timeout: 600000 // 10 min timeout
  });

  // Immediately response -- user ko wait nahi karna padega
  res.status(202).json({
    message: 'Import started',
    jobId: importJob._id,
    totalRows: rowCount,
    statusUrl: `/api/import/status/${importJob._id}`
  });
});
```

### Step 2: Worker Process (Separate Process)

```js
// workers/csv.worker.js
const Queue = require('bull');
const csv = require('csv-parser');
const { Readable } = require('stream');

const importQueue = new Queue('csv-import', process.env.REDIS_URL);

// Worker: 2 concurrent jobs max (memory manage karo)
importQueue.process('process-csv', 2, async (job) => {
  const { jobId, fileKey, userId } = job.data;

  // Step 1: File S3 se fetch karo
  const fileObj = await s3.getObject({
    Bucket: process.env.S3_BUCKET,
    Key: fileKey
  }).promise();

  const csvData = fileObj.Body.toString('utf8');

  // Step 2: CSV parse karo
  const rows = [];
  const stream = Readable.from(csvData);

  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  const totalRows = rows.length;
  let processedRows = 0;
  let failedRows = 0;
  const errors = [];
  const CHUNK_SIZE = 500;

  // Step 3: Chunks mein process karo
  for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const validDocs = [];

    // Validate each row in chunk
    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const rowNum = i + j + 2; // +2 for header + 0-index

      try {
        // Validation
        if (!row.email || !isValidEmail(row.email)) {
          throw new Error(`Invalid email: ${row.email}`);
        }
        if (!row.name || row.name.trim().length < 2) {
          throw new Error(`Invalid name: ${row.name}`);
        }
        if (row.salary && isNaN(Number(row.salary))) {
          throw new Error(`Invalid salary: ${row.salary}`);
        }

        // Transform
        validDocs.push({
          name: row.name.trim(),
          email: row.email.toLowerCase().trim(),
          phone: row.phone ? row.phone.trim() : null,
          department: row.department ? row.department.trim() : 'General',
          salary: row.salary ? Number(row.salary) : 0,
          importedBy: userId,
          importJobId: jobId
        });

      } catch (err) {
        failedRows++;
        errors.push({ row: rowNum, error: err.message });
      }
    }

    // Bulk insert valid docs (much faster than individual inserts)
    if (validDocs.length > 0) {
      try {
        await Employee.insertMany(validDocs, { ordered: false });
        processedRows += validDocs.length;
      } catch (bulkErr) {
        // Handle duplicate key errors etc.
        if (bulkErr.insertedDocs) {
          processedRows += bulkErr.insertedDocs.length;
        }
        const writeErrors = bulkErr.writeErrors || [];
        for (const we of writeErrors) {
          failedRows++;
          errors.push({ row: i + we.index + 2, error: we.errmsg });
        }
      }
    }

    // Progress update
    const progress = Math.round(((i + chunk.length) / totalRows) * 100);
    job.progress(progress);

    // DB mein bhi progress update karo (for API polling)
    await ImportJob.updateOne({ _id: jobId }, {
      processedRows,
      failedRows,
      status: 'processing',
      progress
    });
  }

  // Step 4: Job complete
  const finalStatus = failedRows === totalRows ? 'failed' : 'completed';

  await ImportJob.updateOne({ _id: jobId }, {
    processedRows,
    failedRows,
    status: finalStatus,
    errors: errors.slice(0, 100), // Max 100 errors store karo
    completedAt: new Date(),
    progress: 100
  });

  // Temp file delete karo
  await s3.deleteObject({
    Bucket: process.env.S3_BUCKET,
    Key: fileKey
  }).promise();

  return { processedRows, failedRows, totalRows };
});

// Failed jobs handler
importQueue.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);

  await ImportJob.updateOne({ _id: job.data.jobId }, {
    status: 'failed',
    errors: [{ row: 0, error: `Job failed: ${err.message}` }]
  });
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### Step 3: SSE Progress Updates (Server-Sent Events)

```js
// routes/import.js
// SSE endpoint for real-time progress
router.get('/api/import/progress/:jobId', auth, async (req, res) => {
  const { jobId } = req.params;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Har 1 second progress send karo
  const interval = setInterval(async () => {
    try {
      const job = await ImportJob.findById(jobId)
        .select('status progress processedRows failedRows totalRows')
        .lean();

      if (!job) {
        res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify(job)}\n\n`);

      // Job complete toh SSE band karo
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      console.error('SSE error:', err);
    }
  }, 1000);

  // Client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Simple polling endpoint (SSE ki jagah)
router.get('/api/import/status/:jobId', auth, async (req, res) => {
  const job = await ImportJob.findById(req.params.jobId).lean();
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});
```

### Step 4: React Progress Component

```js
// components/CSVImport.jsx
import React, { useState, useEffect } from 'react';

function CSVImport() {
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await axios.post('/api/import/csv', formData);
    setJobId(data.jobId);
  };

  // SSE se real-time progress suno
  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/import/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);

      if (data.status === 'completed' || data.status === 'failed') {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [jobId]);

  return (
    <div>
      <input type="file" accept=".csv"
        onChange={(e) => handleUpload(e.target.files[0])} />

      {progress && (
        <div>
          <div style={{
            width: '100%', backgroundColor: '#eee',
            borderRadius: 4, overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress.progress}%`,
              backgroundColor: progress.status === 'failed' ? 'red' : 'green',
              height: 24, transition: 'width 0.3s'
            }} />
          </div>
          <p>Status: {progress.status}</p>
          <p>Processed: {progress.processedRows} / {progress.totalRows}</p>
          <p>Failed: {progress.failedRows}</p>
        </div>
      )}
    </div>
  );
}
```

### Dead Letter Queue for Permanently Failed Jobs

```js
// DLQ: Jobs jo 3 retries ke baad bhi fail hain
const deadLetterQueue = new Queue('csv-import-dlq', process.env.REDIS_URL);

importQueue.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Max retries exhausted -- DLQ mein move karo
    await deadLetterQueue.add('failed-import', {
      originalJobData: job.data,
      error: err.message,
      failedAt: new Date(),
      attempts: job.attemptsMade
    });
    // Alert team
    await sendSlackAlert(`CSV Import permanently failed: ${job.data.jobId}`);
  }
});
```

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| Synchronous processing | Simple | Blocks server, timeout for large files |
| Bull Queue + Worker | Scalable, retries, progress | Extra infra (Redis), complexity |
| AWS Lambda/SQS | Serverless, auto-scale | Vendor lock-in, cold start |
| Streaming (no queue) | Low latency | No retry, hard to track progress |

> **Rule:** Agar koi task 5 seconds se zyada le sakta hai, toh queue mein daalo. User ko immediate response do aur background mein process karo.


---


## Scenario 9: API Gateway Pattern

**Q: Tumhare 5 microservices hain (auth, users, products, orders, payments). Frontend ko 5 different URLs hit karni padti hain. Single entry point kaise banayoge?**

**A:** API Gateway pattern use karo -- single entry point jo saare microservices ke saamne baithe aur routing, auth, rate limiting sab handle kare.

### Architecture Without vs With API Gateway

```
 WITHOUT API Gateway (Problem)
 ================================

 [React App]
    |
    +---> https://auth.api.com/login
    +---> https://users.api.com/profile
    +---> https://products.api.com/list
    +---> https://orders.api.com/create
    +---> https://payments.api.com/charge

    Problems:
    - 5 different CORS configs
    - Auth logic 5 jagah duplicate
    - Rate limiting 5 jagah
    - Frontend ko 5 URLs manage


 WITH API Gateway (Solution)
 ================================

 [React App]
    |
    | Single URL: https://api.myapp.com
    v
 +---------------------------------------+
 |          API GATEWAY                   |
 |  +------+  +--------+  +----------+   |
 |  | Auth |  | Rate   |  | Request  |   |
 |  | Check|  | Limit  |  | Router   |   |
 |  +------+  +--------+  +----------+   |
 |  +----------+  +-----------+           |
 |  | Logging  |  | Circuit   |           |
 |  |          |  | Breaker   |           |
 |  +----------+  +-----------+           |
 +---------------------------------------+
      |       |       |       |       |
      v       v       v       v       v
   [Auth]  [Users] [Products] [Orders] [Payments]
   :3001   :3002    :3003     :3004    :3005
```

### Approach 1: Nginx as Simple API Gateway

```nginx
# nginx.conf - Simple but powerful
upstream auth_service {
    server 127.0.0.1:3001;
    server 127.0.0.1:3001 backup;
}
upstream user_service {
    server 127.0.0.1:3002;
}
upstream product_service {
    server 127.0.0.1:3003;
}
upstream order_service {
    server 127.0.0.1:3004;
}
upstream payment_service {
    server 127.0.0.1:3005;
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

server {
    listen 443 ssl;
    server_name api.myapp.com;

    # SSL
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    # Global rate limit
    limit_req zone=api_limit burst=50 nodelay;

    # Route to Auth service
    location /api/auth/ {
        proxy_pass http://auth_service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Route to User service
    location /api/users/ {
        proxy_pass http://user_service/;
    }

    # Route to Product service
    location /api/products/ {
        proxy_pass http://product_service/;
    }

    # Route to Order service
    location /api/orders/ {
        proxy_pass http://order_service/;
    }

    # Route to Payment service
    location /api/payments/ {
        proxy_pass http://payment_service/;
    }

    # Health check
    location /health {
        return 200 'OK';
    }
}
```

### Approach 2: Express API Gateway (More Control)

```js
// gateway/server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const CircuitBreaker = require('opossum');

const app = express();

// ==================
// MIDDLEWARE LAYERS
// ==================

// Layer 1: Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  message: { error: 'Too many requests, try again later' }
});
app.use(globalLimiter);

// Stricter limit for auth endpoints (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts' }
});

// Layer 2: Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    }));
  });
  next();
});

// Layer 3: CORS (centralized)
const cors = require('cors');
app.use(cors({
  origin: ['https://myapp.com', 'https://admin.myapp.com'],
  credentials: true
}));

// Layer 4: Auth Middleware (gateway level)
const jwt = require('jsonwebtoken');

function gatewayAuth(req, res, next) {
  // Public routes skip auth
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/products'];
  if (publicPaths.some(p => req.path.startsWith(p) && req.method === 'GET')) {
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Downstream services ko user info header mein bhejo
    req.headers['x-user-id'] = decoded.userId;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-tenant-id'] = decoded.tenantId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.use(gatewayAuth);

// ==================
// SERVICE ROUTING
// ==================

// Service configuration
const SERVICES = {
  auth:     { target: 'http://localhost:3001', name: 'Auth Service' },
  users:    { target: 'http://localhost:3002', name: 'User Service' },
  products: { target: 'http://localhost:3003', name: 'Product Service' },
  orders:   { target: 'http://localhost:3004', name: 'Order Service' },
  payments: { target: 'http://localhost:3005', name: 'Payment Service' },
};

// Circuit Breaker for each service
const breakers = {};

function createCircuitBreaker(serviceKey) {
  const service = SERVICES[serviceKey];

  const breaker = new CircuitBreaker(
    async (req, res, next) => {
      // Proxy the request
      return new Promise((resolve, reject) => {
        const proxy = createProxyMiddleware({
          target: service.target,
          changeOrigin: true,
          pathRewrite: { [`^/api/${serviceKey}`]: '' },
          on: {
            proxyRes: (proxyRes) => resolve(proxyRes),
            error: (err) => reject(err)
          }
        });
        proxy(req, res, next);
      });
    },
    {
      timeout: 10000,       // 10 sec timeout
      errorThresholdPercentage: 50,  // 50% failure = circuit OPEN
      resetTimeout: 30000,  // 30 sec baad retry
      name: service.name
    }
  );

  breaker.on('open', () => {
    console.warn(`Circuit OPEN for ${service.name}`);
    // Alert bhejo
  });

  breaker.on('halfOpen', () => {
    console.log(`Circuit HALF-OPEN for ${service.name}, testing...`);
  });

  breaker.on('close', () => {
    console.log(`Circuit CLOSED for ${service.name}, recovered`);
  });

  breaker.fallback(() => {
    return { error: `${service.name} is temporarily unavailable` };
  });

  return breaker;
}

// Setup routes with circuit breakers
for (const [key, service] of Object.entries(SERVICES)) {
  const limiter = key === 'auth' ? authLimiter : globalLimiter;

  app.use(`/api/${key}`, limiter, createProxyMiddleware({
    target: service.target,
    changeOrigin: true,
    pathRewrite: { [`^/api/${key}`]: '' },
    on: {
      error: (err, req, res) => {
        console.error(`Proxy error for ${service.name}:`, err.message);
        res.status(502).json({
          error: `${service.name} unavailable`,
          service: key
        });
      }
    }
  }));
}

// ==================
// HEALTH CHECK
// ==================

app.get('/health', async (req, res) => {
  const checks = {};

  for (const [key, service] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${service.target}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      checks[key] = { status: response.ok ? 'healthy' : 'unhealthy' };
    } catch {
      checks[key] = { status: 'down' };
    }
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    gateway: 'healthy',
    services: checks,
    timestamp: new Date().toISOString()
  });
});

app.listen(8080, () => {
  console.log('API Gateway running on port 8080');
});
```

### Request/Response Transformation

```js
// Gateway pe response shape change kar sakte ho

// Example: Aggregate multiple services into one response
// /api/dashboard -> calls users + orders + products

router.get('/api/dashboard', gatewayAuth, async (req, res) => {
  const userId = req.headers['x-user-id'];

  try {
    // Parallel calls to multiple services
    const [profile, recentOrders, recommendations] = await Promise.allSettled([
      fetch(`http://localhost:3002/profile/${userId}`).then(r => r.json()),
      fetch(`http://localhost:3004/orders?userId=${userId}&limit=5`).then(r => r.json()),
      fetch(`http://localhost:3003/recommendations?userId=${userId}`).then(r => r.json()),
    ]);

    // Aggregate response
    res.json({
      profile: profile.status === 'fulfilled' ? profile.value : null,
      recentOrders: recentOrders.status === 'fulfilled' ? recentOrders.value : [],
      recommendations: recommendations.status === 'fulfilled' ? recommendations.value : [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Dashboard fetch failed' });
  }
});
```

**Trade-offs:**
| Gateway Type | Pros | Cons |
|-------------|------|------|
| Nginx | Fast, battle-tested, low memory | Limited custom logic |
| Express Gateway | Full Node.js control, custom logic | Slower than Nginx, another service to maintain |
| Kong / AWS API Gateway | Feature-rich, plugins | Cost, vendor lock-in, learning curve |
| No Gateway (direct) | Simple | CORS hell, auth duplication, no centralized logging |

> **Best Practice:** Start with Nginx for routing + rate limiting. Jab custom logic chahiye (request aggregation, transformation), tab Express gateway add karo Nginx ke peeche.


---


## Scenario 10: Database Failover and High Availability

**Q: Production database down ho gaya raat 2 baje. Users ko koi impact nahi hona chahiye. Kaise ensure karoge?**

**A:** MongoDB Replica Set use karo -- minimum 3 nodes, automatic failover, aur proper monitoring. Goal: zero downtime even when primary goes down.

### Replica Set Architecture

```
 MongoDB Replica Set (3 Nodes)
 ================================

                    [Application]
                    /     |     \
                   /      |      \
                  v       v       v
            +--------+--------+--------+
            |Primary | Secon- | Secon- |
            | Node   | dary 1 | dary 2 |
            |        |        |        |
            | ALL    | READ   | READ   |
            | WRITES | only   | only   |
            +--------+--------+--------+
                 |       ^       ^
                 |       |       |
                 +-------+-------+
                  Replication (oplog)


 When Primary Goes Down (Automatic Failover)
 =============================================

            +--------+--------+--------+
            | OLD    | NEW    | Secon- |
            |Primary | Primary| dary 2 |
            | (DOWN) | (was   |        |
            |   X    | Sec 1) | VOTE!  |
            +--------+--------+--------+
                        ^
                        |
                    Election happens
                    in ~10 seconds
                        |
                    [Application auto-reconnects]
```

### Step 1: MongoDB Replica Set Setup

```js
// docker-compose.yml for local development
// Production mein separate servers pe hoga

/*
version: '3.8'
services:
  mongo-primary:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    ports: ["27017:27017"]
    volumes: ["mongo-primary-data:/data/db"]

  mongo-secondary1:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    ports: ["27018:27017"]
    volumes: ["mongo-secondary1-data:/data/db"]

  mongo-secondary2:
    image: mongo:7
    command: mongod --replSet rs0 --bind_ip_all
    ports: ["27019:27017"]
    volumes: ["mongo-secondary2-data:/data/db"]
*/

// Initialize Replica Set (run once)
// mongosh pe:
/*
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo-primary:27017", priority: 10 },
    { _id: 1, host: "mongo-secondary1:27017", priority: 5 },
    { _id: 2, host: "mongo-secondary2:27017", priority: 5 }
  ]
});
*/
```

### Step 2: Application Connection (Failover-Ready)

```js
// config/database.js
const mongoose = require('mongoose');

// CRITICAL: Connection string mein SAARE nodes daal do
// Agar primary down ho, driver automatically secondary se connect karega
const MONGO_URI = [
  'mongodb://',
  'mongo-primary:27017,',      // primary
  'mongo-secondary1:27018,',   // secondary 1
  'mongo-secondary2:27019',    // secondary 2
  '/myapp',
  '?replicaSet=rs0'
].join('');

const connectionOptions = {
  // Write Concern: Majority nodes pe write confirm hone ke baad hi success
  // Agar primary crash ho write ke baad, data safe hai secondary pe
  w: 'majority',
  wtimeoutMS: 10000, // 10 sec write timeout

  // Read Preference: Reads kahan se karein
  readPreference: 'secondaryPreferred',
  // Options:
  // - 'primary'              : sirf primary (default, strongly consistent)
  // - 'primaryPreferred'     : primary try, fail toh secondary
  // - 'secondary'            : sirf secondary (eventual consistency)
  // - 'secondaryPreferred'   : secondary try, fail toh primary
  // - 'nearest'              : lowest latency node

  // Connection pool
  maxPoolSize: 50,
  minPoolSize: 10,

  // Timeouts for failover
  serverSelectionTimeoutMS: 15000,  // 15 sec: naya primary dhundne ka time
  heartbeatFrequencyMS: 10000,     // 10 sec: node health check
  socketTimeoutMS: 45000,

  // Auto reconnect settings
  retryWrites: true,   // failed writes automatically retry
  retryReads: true,    // failed reads automatically retry
};

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, connectionOptions);
    console.log('MongoDB Replica Set connected');

    // Connection events monitor karo
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected');
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected! Attempting reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB error:', err.message);
    });

    // Replica set member changes
    mongoose.connection.on('topologyChanged', (event) => {
      console.log('Topology changed:', JSON.stringify(event));
    });

  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }
}

module.exports = connectDB;
```

### Step 3: Write Concern and Read Preference in Queries

```js
// Different operations ke liye different consistency levels

// Financial transaction: STRONG consistency chahiye
async function processPayment(orderId, amount) {
  const session = await mongoose.startSession();
  session.startTransaction({
    readConcern: { level: 'majority' },   // read committed data only
    writeConcern: { w: 'majority', j: true }, // majority + journal
    readPreference: 'primary'              // primary se hi padho
  });

  try {
    const order = await Order.findById(orderId).session(session);

    // Deduct from wallet
    await Wallet.updateOne(
      { user: order.user, balance: { $gte: amount } },
      { $inc: { balance: -amount } }
    ).session(session);

    // Update order status
    await Order.updateOne(
      { _id: orderId },
      { $set: { status: 'paid', paidAt: new Date() } }
    ).session(session);

    await session.commitTransaction();
    return { success: true };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// Product listing: Eventual consistency chalega (fast reads)
async function getProducts(category) {
  return Product.find({ category })
    .read('secondaryPreferred') // secondary se padho, fast
    .lean();
}

// User profile: Strong consistency chahiye (recently updated)
async function getMyProfile(userId) {
  return User.findById(userId)
    .read('primary') // primary se padho, latest data
    .lean();
}
```

### Step 4: Monitoring and Alerting

```js
// monitoring/db-health.js
const mongoose = require('mongoose');

class DBHealthMonitor {
  constructor() {
    this.checkInterval = null;
  }

  start() {
    // Har 30 sec DB health check
    this.checkInterval = setInterval(() => this.check(), 30000);
  }

  async check() {
    try {
      const admin = mongoose.connection.db.admin();

      // Replica set status
      const replStatus = await admin.command({ replSetGetStatus: 1 });

      const members = replStatus.members.map(m => ({
        name: m.name,
        state: m.stateStr,  // PRIMARY, SECONDARY, ARBITER, DOWN
        health: m.health,   // 1 = healthy, 0 = down
        lag: m.optimeDate
          ? Date.now() - new Date(m.optimeDate).getTime()
          : null
      }));

      // Primary exist check
      const primary = members.find(m => m.state === 'PRIMARY');
      if (!primary) {
        await this.alert('CRITICAL: No PRIMARY node in replica set!');
      }

      // Health check
      const unhealthy = members.filter(m => m.health === 0);
      if (unhealthy.length > 0) {
        await this.alert(
          `WARNING: ${unhealthy.length} nodes down: ${unhealthy.map(m => m.name).join(', ')}`
        );
      }

      // Replication lag check (> 10 sec = warning)
      const lagging = members.filter(m =>
        m.lag && m.lag > 10000 && m.state === 'SECONDARY'
      );
      if (lagging.length > 0) {
        await this.alert(
          `WARNING: Replication lag detected: ${lagging.map(m => `${m.name}: ${m.lag}ms`).join(', ')}`
        );
      }

      console.log('DB Health:', JSON.stringify(members, null, 2));

    } catch (err) {
      await this.alert(`CRITICAL: DB health check failed: ${err.message}`);
    }
  }

  async alert(message) {
    console.error(`[DB ALERT] ${message}`);

    // Slack notification
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*Database Alert*\n${message}\nTime: ${new Date().toISOString()}`
      })
    }).catch(() => {}); // alert fail hone pe crash mat karo

    // PagerDuty (for critical alerts, 2 AM pe call aayegi)
    if (message.includes('CRITICAL')) {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: process.env.PAGERDUTY_KEY,
          event_action: 'trigger',
          payload: {
            summary: message,
            severity: 'critical',
            source: 'db-health-monitor'
          }
        })
      }).catch(() => {});
    }
  }
}

module.exports = new DBHealthMonitor();
```

### Step 5: Runbook for Manual Intervention

```js
/*
 DATABASE FAILOVER RUNBOOK
 ===========================

 RTO (Recovery Time Objective): < 30 seconds (automatic failover)
 RPO (Recovery Point Objective): 0 (with w:majority writes)

 SCENARIO 1: Primary goes down (auto-handled)
 -----------------------------------------------
 1. MongoDB driver detects primary down (~10 sec)
 2. Remaining secondaries hold election (~10 sec)
 3. New primary elected
 4. Application auto-reconnects
 5. Total downtime: ~10-20 seconds
 6. ACTION: Monitor, investigate why primary went down
    - Check server logs: journalctl -u mongod
    - Check disk space: df -h
    - Check memory: free -m
    - Restart old primary as secondary: systemctl start mongod

 SCENARIO 2: Two nodes down (CRITICAL)
 -----------------------------------------------
 1. If only 1 node left, no majority = NO WRITES possible
 2. Reads still work if readPreference is not 'primary'
 3. ACTION:
    a. Immediately bring up at least 1 more node
    b. If can't, reconfigure replica set:
       rs.reconfig({ members: [{ _id: 0, host: "surviving-node:27017" }] }, { force: true })
    c. This makes single node the primary (DANGEROUS, data loss possible)

 SCENARIO 3: Network partition (split brain prevention)
 -----------------------------------------------
 1. MongoDB uses majority voting: 3 nodes mein 2 ka agreement chahiye
 2. Minority side automatically steps down to secondary
 3. No split brain possible with odd number of nodes
 4. ACTION: Fix network, nodes will auto-recover

 SCENARIO 4: Data corruption
 -----------------------------------------------
 1. Stop the corrupted node
 2. Delete data directory
 3. Restart -- it will do initial sync from healthy secondary
 4. OR: Restore from backup
    mongorestore --uri="mongodb://primary:27017" --gzip --archive=backup.gz
*/
```

### Backup Strategy

```js
// scripts/backup.js
const { exec } = require('child_process');
const cron = require('node-cron');

// Daily backup at 3 AM
cron.schedule('0 3 * * *', async () => {
  const date = new Date().toISOString().split('T')[0];
  const backupPath = `/backups/myapp-${date}`;

  // mongodump secondary se karo (primary pe load mat daalo)
  const cmd = [
    'mongodump',
    '--uri="mongodb://mongo-secondary1:27018/myapp?readPreference=secondary"',
    `--out=${backupPath}`,
    '--gzip',
    '--oplog' // point-in-time recovery ke liye
  ].join(' ');

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('Backup failed:', stderr);
      // Alert bhejo
      return;
    }
    console.log(`Backup completed: ${backupPath}`);

    // S3 pe upload karo
    exec(`aws s3 sync ${backupPath} s3://myapp-backups/${date}/`, (err) => {
      if (err) console.error('S3 upload failed:', err);
      else console.log('Backup uploaded to S3');
    });
  });
});
```

**Trade-offs:**
| Configuration | Consistency | Availability | Performance |
|--------------|-------------|-------------|-------------|
| w:1 (default) | Low (data can be lost) | High | Fastest writes |
| w:majority | High (data safe) | Medium (needs majority up) | Slower writes |
| w:majority + j:true | Highest (journal + replicated) | Medium | Slowest writes |
| readPref: primary | Strong consistency | Lower (primary only) | Single node load |
| readPref: secondaryPreferred | Eventual consistency | Highest | Distributed load |

> **Production Checklist:**
> - Minimum 3 nodes (odd number for voting)
> - w:majority for important writes
> - secondaryPreferred for read-heavy workloads
> - Monitoring + alerts (PagerDuty for 2 AM calls)
> - Daily backups to S3 with oplog
> - Test failover quarterly (literally kill primary and watch)
> - Connection string mein SAARE nodes daal do


---


*Total: 10 System Design Scenario Questions*
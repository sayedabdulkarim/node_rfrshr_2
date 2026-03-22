# API Design - Scenario Based Interview Questions

> "API kaise design karna chahiye - ye interviews mein bahut puchha jaata hai"


---


## Scenario 1: RESTful URL Design

**Q: Social media app hai. Users, posts, comments, likes hain. API URLs kaise design karoge? Kuch team members `/getPostsByUser` use karna chahte hain. Sahi approach kya hai?**

**Answer:**

Dekho, REST APIs mein sabse important cheez hoti hai - **resource-based URLs**. Matlab URLs mein verbs nahi hone chahiye (jaise `getPostsByUser`), instead nouns hone chahiye jo represent karte hain tumhare resources ko. HTTP methods (GET, POST, PUT, DELETE) already bata dete hain ki action kya hoga.

### Bad vs Good URL Design

```js
// BAD - Verb-based URLs (ye galat hai)
GET    /getUsers
GET    /getPostsByUser/123
POST   /createPost
POST   /deletePost/456
GET    /fetchAllCommentsForPost/789
POST   /likeAPost
GET    /searchUsers?name=Rahul

// GOOD - Resource-based URLs (ye sahi hai)
GET    /users                    // sabhi users lao
GET    /users/123                // ek specific user lao
POST   /users                    // naya user banao
PUT    /users/123                // user update karo
DELETE /users/123                // user delete karo

GET    /users/123/posts          // user 123 ke saare posts
POST   /users/123/posts          // user 123 ke liye naya post
GET    /posts/456                // ek specific post
PUT    /posts/456                // post update karo
DELETE /posts/456                // post delete karo

GET    /posts/456/comments       // post 456 ke saare comments
POST   /posts/456/comments       // post 456 pe naya comment
DELETE /comments/789             // ek specific comment delete

POST   /posts/456/likes          // post ko like karo
DELETE /posts/456/likes          // like hatao (unlike)
```

### Express.js mein Implementation

```js
const express = require('express');
const router = express.Router();

// ============ USERS ============
router.get('/users', async (req, res) => {
  // Sabhi users lao with optional query params
  const { page, limit, sort } = req.query;
  const users = await User.find()
    .sort(sort || '-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit) || 20);

  res.json({ success: true, data: users });
});

router.get('/users/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
});

router.post('/users', async (req, res) => {
  const user = await User.create(req.body);
  // 201 - resource created successfully
  res.status(201).json({ success: true, data: user });
});

router.put('/users/:userId', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
  res.json({ success: true, data: user });
});

router.delete('/users/:userId', async (req, res) => {
  await User.findByIdAndDelete(req.params.userId);
  // 204 - deleted, no content to return
  res.status(204).send();
});

// ============ NESTED: User ke Posts ============
router.get('/users/:userId/posts', async (req, res) => {
  const posts = await Post.find({ author: req.params.userId })
    .populate('author', 'name avatar')
    .sort('-createdAt');
  res.json({ success: true, data: posts });
});

router.post('/users/:userId/posts', async (req, res) => {
  const post = await Post.create({
    ...req.body,
    author: req.params.userId
  });
  res.status(201).json({ success: true, data: post });
});

// ============ NESTED: Post ke Comments ============
router.get('/posts/:postId/comments', async (req, res) => {
  const comments = await Comment.find({ post: req.params.postId })
    .populate('author', 'name avatar');
  res.json({ success: true, data: comments });
});

router.post('/posts/:postId/comments', async (req, res) => {
  const comment = await Comment.create({
    ...req.body,
    post: req.params.postId,
    author: req.user._id // logged-in user from auth middleware
  });
  res.status(201).json({ success: true, data: comment });
});

// ============ LIKES (Toggle pattern) ============
router.post('/posts/:postId/likes', async (req, res) => {
  const existingLike = await Like.findOne({
    post: req.params.postId,
    user: req.user._id
  });

  if (existingLike) {
    // Already liked hai toh unlike karo
    await existingLike.deleteOne();
    return res.json({ success: true, liked: false });
  }

  await Like.create({ post: req.params.postId, user: req.user._id });
  res.status(201).json({ success: true, liked: true });
});

module.exports = router;
```

### Best Practices

```
1. Hamesha plural nouns use karo -> /users (not /user)
2. Nesting 2 levels se zyada mat karo -> /users/123/posts OK, /users/123/posts/456/comments/789 BAD
3. Kebab-case use karo -> /user-profiles (not /userProfiles)
4. Lowercase rakhho URLs -> /users (not /Users)
5. Trailing slash mat lagao -> /users (not /users/)
6. CRUD operations ke liye HTTP methods use karo, URL mein verb mat daalo
7. Filter/search ke liye query params use karo -> /users?role=admin&active=true
```

### Common Mistakes

```
- GET request mein body bhejne ki koshish karna (GET has no body in practice)
- POST har jagah use karna instead of PUT/PATCH/DELETE
- Singular vs plural mix karna (/user/123/post - inconsistent)
- 3-4 level deep nesting karna (hard to maintain)
- URL mein verb daalna jaise /getUser, /deletePost
```


---


## Scenario 2: Pagination Design

**Q: Feed API 10M posts return kar sakti hai. Pagination kaise implement karoge? Cursor-based vs Offset-based kab use karein?**

**Answer:**

Jab tumhare paas lakho ya crodo records hain, toh ek saath sab return karna impossible hai - memory bhi blast hogi aur user ka browser bhi hang ho jaayega. Pagination 2 tarike se hoti hai: **Offset-based** (traditional) aur **Cursor-based** (modern, better for large datasets).

### Approach 1: Offset-Based Pagination

Ye simple hai - "page 3 do, 20 items per page" jaisa concept.

```js
// GET /posts?page=2&limit=20

router.get('/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Count for metadata
  const totalDocs = await Post.countDocuments();
  const totalPages = Math.ceil(totalDocs / limit);

  const posts = await Post.find()
    .sort('-createdAt')
    .skip(skip)
    .limit(limit)
    .populate('author', 'name avatar');

  res.json({
    success: true,
    data: posts,
    pagination: {
      currentPage: page,
      totalPages,
      totalDocs,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
});
```

**Offset-based ke problems:**
- Page 50000 pe jaao toh DB ko 50000 * 20 = 10 lakh rows skip karne padte hain (SLOW)
- Jab naye items add hote hain beech mein, toh duplicate ya missing items aa sakte hain
- Large datasets mein performance bahut kharab hoti hai

### Approach 2: Cursor-Based Pagination (Recommended for feeds)

Ye kehta hai - "ye raha last item ka ID, iske baad ke 20 items do." Social media feeds ke liye perfect.

```js
// GET /posts?limit=20
// GET /posts?limit=20&cursor=507f1f77bcf86cd799439011

router.get('/posts', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor; // last item ka _id

  // Query build karo
  let query = {};
  if (cursor) {
    // Cursor ke baad ke items lao (purane items, kyunki feed latest first hai)
    query = { _id: { $lt: cursor } };
  }

  const posts = await Post.find(query)
    .sort('-_id')  // _id already contains timestamp in MongoDB
    .limit(limit + 1)  // ek extra lao to check if more exist
    .populate('author', 'name avatar');

  // Check ki aur items hain ya nahi
  const hasMore = posts.length > limit;
  if (hasMore) posts.pop(); // extra item hatao

  // Next cursor = last item ka ID
  const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

  res.json({
    success: true,
    data: posts,
    pagination: {
      limit,
      hasMore,
      nextCursor  // frontend ye next request mein bhejega
    }
  });
});
```

### Frontend se kaise call karein (React example)

```js
// Cursor-based pagination ka frontend usage
const [posts, setPosts] = useState([]);
const [cursor, setCursor] = useState(null);
const [hasMore, setHasMore] = useState(true);

const loadMore = async () => {
  const url = cursor
    ? `/api/posts?limit=20&cursor=${cursor}`
    : '/api/posts?limit=20';

  const res = await fetch(url);
  const json = await res.json();

  setPosts(prev => [...prev, ...json.data]);
  setCursor(json.pagination.nextCursor);
  setHasMore(json.pagination.hasMore);
};
```

### Response Format Comparison

```js
// Offset-based response
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 3,
    "totalPages": 500000,
    "totalDocs": 10000000,
    "limit": 20,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}

// Cursor-based response
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "507f1f77bcf86cd799439011"
  }
}
```

### Kab kya use karein?

```
Offset-Based:
  - Admin dashboards (page numbers dikhane hain)
  - Small datasets (10K se kam)
  - Random page access chahiye (seedha page 50 pe jaana)
  - Search results with total count

Cursor-Based:
  - Social media feeds (infinite scroll)
  - Real-time data (naye items add hote rehte hain)
  - Large datasets (lakho records)
  - Mobile apps (load more pattern)
  - Chat messages
```

### Common Mistakes

```
- limit=10000 allow kar dena (hamesha max limit lagao, jaise Math.min(limit, 100))
- Cursor mein plain text ID bhejne se data leak ho sakta hai - encoded cursor use karo for security
- countDocuments() har request pe call karna expensive hai large collections mein
- Sort order cursor ke saath consistent na rakhna (bugs aayenge)
```


---


## Scenario 3: API Versioning

**Q: Tumhara API v1 live hai with 1000+ clients. Breaking change karna hai response structure mein. Existing clients break nahi hone chahiye. Kaise handle karoge?**

**Answer:**

API versioning ek bahut important decision hai. Jab tumhara API production mein hai aur clients use kar rahe hain, toh tum seedha response structure change nahi kar sakte - sabka app toot jaayega. Toh tum ek naya version banaate ho, purana bhi chalte rehne dete ho, aur dheere dheere clients ko migrate karte ho.

### Approach 1: URL-based Versioning (Most Common)

Ye sabse popular approach hai - URL mein hi version number daal do.

```js
const express = require('express');
const app = express();

// ============ V1 Routes ============
const v1Router = express.Router();

v1Router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);

  // V1 response - flat structure
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt
  });
});

// ============ V2 Routes ============
const v2Router = express.Router();

v2Router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);

  // V2 response - nested structure with more info
  res.json({
    data: {
      id: user._id,
      profile: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio  // naya field V2 mein
      },
      metadata: {
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin  // naya field V2 mein
      }
    },
    apiVersion: 'v2'
  });
});

// Mount versioned routes
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Client calls:
// Old clients -> GET /api/v1/users/123 (still works)
// New clients -> GET /api/v2/users/123 (new structure)
```

### Approach 2: Header-based Versioning

Version information HTTP header mein bhejte hain. URL clean rahta hai.

```js
// Client sends: Accept: application/vnd.myapp.v2+json
// OR custom header: X-API-Version: 2

const versionMiddleware = (req, res, next) => {
  // Custom header se version lelo
  const version = req.headers['x-api-version'] || '1'; // default v1
  req.apiVersion = parseInt(version);
  next();
};

app.use(versionMiddleware);

app.get('/api/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);

  if (req.apiVersion === 1) {
    return res.json({
      id: user._id,
      name: user.name,
      email: user.email
    });
  }

  if (req.apiVersion === 2) {
    return res.json({
      data: {
        id: user._id,
        profile: { name: user.name, email: user.email, bio: user.bio },
        metadata: { createdAt: user.createdAt, updatedAt: user.updatedAt }
      }
    });
  }

  res.status(400).json({ error: `API version ${req.apiVersion} not supported` });
});
```

### Approach 3: Query Parameter Versioning

Simple but less clean.

```js
// GET /api/users/123?version=2

app.get('/api/users/:id', async (req, res) => {
  const version = parseInt(req.query.version) || 1;
  const user = await User.findById(req.params.id);

  const formatters = {
    1: (user) => ({ id: user._id, name: user.name, email: user.email }),
    2: (user) => ({
      data: {
        id: user._id,
        profile: { name: user.name, email: user.email },
        metadata: { createdAt: user.createdAt }
      }
    })
  };

  const formatter = formatters[version];
  if (!formatter) {
    return res.status(400).json({ error: 'Invalid version' });
  }

  res.json(formatter(user));
});
```

### Deprecation Strategy (Bahut Important)

```js
// Deprecation warning middleware for v1
const deprecationWarning = (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jan 2026 00:00:00 GMT'); // kab band hoga
  res.set('Link', '</api/v2>; rel="successor-version"');   // naya version ka link

  // Response mein bhi warning do
  res.locals.deprecationWarning = {
    message: 'API v1 is deprecated. Please migrate to v2 by Jan 2026.',
    migrationGuide: 'https://docs.myapp.com/migration/v1-to-v2',
    sunsetDate: '2026-01-01T00:00:00Z'
  };

  next();
};

// V1 pe warning middleware lagao
app.use('/api/v1', deprecationWarning, v1Router);
app.use('/api/v2', v2Router);

// V1 route mein warning include karo
v1Router.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    _deprecation: res.locals.deprecationWarning  // warning response mein
  });
});
```

### Best Practices

```
1. URL versioning sabse easy aur widely used hai - isse start karo
2. Sirf MAJOR breaking changes pe version badhao, minor additions backward-compatible rakhho
3. Minimum 6-12 months ka deprecation period do purane version ko
4. API changelog maintain karo - kya badla, kya naya aaya
5. SDKs aur client libraries ko bhi version ke saath update karo
6. Maximum 2-3 versions simultaneously support karo (v1, v2, v3 max)
7. Documentation mein clearly mention karo ki kaunsa version latest hai
```

### Common Mistakes

```
- Bina versioning ke breaking changes push karna (sabka app toot jaayega)
- Har choti change pe version badhana (v1, v2, v3... v47 kuch nahi samajh aayega)
- Purana version support band karna bina clients ko inform kiye
- Version-specific logic ko ek hi controller mein mix karna (messy code)
- Deprecation headers na bhejke suddenly API band karna
```


---


## Scenario 4: Error Handling Standards

**Q: Frontend developer complain kar raha hai ki kabhi string error aata hai, kabhi object, kabhi status code galat hai. Standard error format kya hona chahiye?**

**Answer:**

Ye bahut common problem hai. Agar error response consistent nahi hai toh frontend developer ko har API call ke liye alag error handling likhni padti hai. Solution hai - ek standard error format define karo aur ek central error middleware banao.

### Standard Error Response Format

```js
// HAMESHA ye format follow karo - har error mein
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",       // machine-readable code
    "message": "Email is required",    // human-readable message
    "status": 400,                     // HTTP status code
    "details": [                       // optional: specific field errors
      {
        "field": "email",
        "message": "Email field is required",
        "value": null
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "value": "123"
      }
    ],
    "timestamp": "2026-01-15T10:30:00.000Z",
    "requestId": "req_abc123xyz"       // debugging ke liye useful
  }
}
```

### Custom Error Class

```js
// utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // distinguish from programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Validation failed', 400, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError };
```

### Central Error Middleware

```js
// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';
  let details = err.details || null;

  // Mongoose Validation Error handle karo
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.keys(err.errors).map(field => ({
      field,
      message: err.errors[field].message,
      value: err.errors[field].value
    }));
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
    details = [{ field, message: `${field} '${err.keyValue[field]}' is already taken` }];
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }

  // Production mein internal errors ka detail mat bhejo
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
    details = null;
  }

  // Log the error
  console.error(`[${new Date().toISOString()}] ${errorCode}: ${err.message}`, {
    stack: err.stack,
    requestId: req.id,
    url: req.originalUrl,
    method: req.method
  });

  // Consistent response bhejo
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      status: statusCode,
      details,
      timestamp: new Date().toISOString(),
      requestId: req.id || null
    }
  });
};

module.exports = errorHandler;
```

### Routes mein kaise use karein

```js
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/AppError');

// asyncHandler - try/catch bar bar likhne ki zaroorat nahi
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');

  res.json({ success: true, data: user });
}));

router.post('/users', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Manual validation
  const errors = [];
  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  if (!password) errors.push({ field: 'password', message: 'Password is required' });
  if (password && password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) throw new ValidationError(errors);

  const user = await User.create({ email, password, name });
  res.status(201).json({ success: true, data: user });
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ForbiddenError('Only admins can delete users');
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new NotFoundError('User');

  res.status(204).send();
}));

// Error middleware register karo (sabse last mein)
app.use(errorHandler);
```

### HTTP Status Code Guide

```
400 Bad Request     -> Client ne galat data bheja (missing fields, wrong format)
401 Unauthorized    -> Login nahi kiya / token invalid hai
403 Forbidden       -> Login hai but permission nahi hai
404 Not Found       -> Resource exist nahi karta
409 Conflict        -> Duplicate entry (email already exists)
422 Unprocessable   -> Data format sahi hai but business logic fail (e.g., insufficient balance)
429 Too Many Req    -> Rate limit exceed ho gayi
500 Internal Error  -> Server side bug (ye client ko detail mat batao)
503 Service Unavail -> Server down hai / maintenance mein hai
```

### Common Mistakes

```
- 200 status ke saath error bhejne ka (res.json({ error: "failed" }) with 200 status)
- Kabhi string return karna, kabhi object (inconsistent format)
- Stack trace production mein client ko bhej dena (security risk)
- Generic "Something went wrong" har jagah (debugging impossible)
- 500 status har error ke liye use karna (even validation errors)
```


---


## Scenario 5: Bulk Operations

**Q: Admin ko 500 users ek saath delete karne hain. 500 individual DELETE requests too slow. Kaise design karoge?**

**Answer:**

Individual requests bhejne mein har request ka apna overhead hota hai - TCP connection, headers, authentication, etc. 500 requests ka matlab 500x overhead. Iske liye **Bulk Operations** API design karna padta hai jo ek hi request mein multiple operations handle kar sake.

### Synchronous Bulk Delete (Small batches ke liye)

```js
// DELETE /api/admin/users/bulk
// Body mein IDs bhejo

router.delete('/admin/users/bulk', asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  // Validation
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError([{
      field: 'userIds',
      message: 'userIds must be a non-empty array'
    }]);
  }

  // Max limit lagao - ek request mein zyada nahi
  if (userIds.length > 100) {
    throw new AppError(
      'Maximum 100 users can be deleted at once. Use async bulk endpoint for larger operations.',
      400,
      'BATCH_SIZE_EXCEEDED'
    );
  }

  const results = {
    success: [],
    failed: []
  };

  // Ek ek karke process karo with error handling
  for (const userId of userIds) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        results.failed.push({
          id: userId,
          error: 'User not found'
        });
        continue;
      }

      // Admin apne aap ko delete na kare
      if (userId === req.user._id.toString()) {
        results.failed.push({
          id: userId,
          error: 'Cannot delete yourself'
        });
        continue;
      }

      await user.deleteOne();
      results.success.push(userId);
    } catch (err) {
      results.failed.push({
        id: userId,
        error: err.message
      });
    }
  }

  // Partial success response
  const statusCode = results.failed.length === 0
    ? 200                               // sab success
    : results.success.length === 0
      ? 400                             // sab fail
      : 207;                            // partial success (Multi-Status)

  res.status(statusCode).json({
    success: true,
    message: `${results.success.length} deleted, ${results.failed.length} failed`,
    data: results
  });
}));
```

### Efficient Bulk Delete with MongoDB

```js
// Faster approach - DB level pe bulk operation
router.delete('/admin/users/bulk', asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError([{ field: 'userIds', message: 'userIds array required' }]);
  }

  if (userIds.length > 100) {
    throw new AppError('Max 100 per batch', 400, 'BATCH_SIZE_EXCEEDED');
  }

  // Filter out current admin
  const idsToDelete = userIds.filter(id => id !== req.user._id.toString());

  // Pehle check karo kaunse exist karte hain
  const existingUsers = await User.find(
    { _id: { $in: idsToDelete } },
    { _id: 1 }
  );
  const existingIds = existingUsers.map(u => u._id.toString());
  const notFoundIds = idsToDelete.filter(id => !existingIds.includes(id));

  // Bulk delete
  const deleteResult = await User.deleteMany({ _id: { $in: existingIds } });

  // Related data bhi clean karo
  await Promise.all([
    Post.deleteMany({ author: { $in: existingIds } }),
    Comment.deleteMany({ author: { $in: existingIds } }),
    Like.deleteMany({ user: { $in: existingIds } })
  ]);

  res.json({
    success: true,
    data: {
      requested: userIds.length,
      deleted: deleteResult.deletedCount,
      notFound: notFoundIds,
      skipped: userIds.length - idsToDelete.length  // admin self-delete attempt
    }
  });
}));
```

### Async Bulk Operations (Large datasets ke liye)

Jab 500+ items hain, toh synchronous response bahut slow hoga. Background job use karo.

```js
const Queue = require('bull');
const bulkDeleteQueue = new Queue('bulk-delete', process.env.REDIS_URL);

// Step 1: Job create karo aur immediately respond karo
router.post('/admin/users/bulk-delete', asyncHandler(async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError([{ field: 'userIds', message: 'userIds array required' }]);
  }

  // Job create karo
  const job = await bulkDeleteQueue.add({
    userIds,
    requestedBy: req.user._id,
    requestedAt: new Date()
  });

  // Turant response do with job ID
  res.status(202).json({  // 202 Accepted - processing shuru ho gayi
    success: true,
    message: `Bulk delete job queued for ${userIds.length} users`,
    data: {
      jobId: job.id,
      statusUrl: `/api/admin/jobs/${job.id}`,  // status check karne ka URL
      estimatedTime: `${Math.ceil(userIds.length / 50)} seconds`
    }
  });
}));

// Step 2: Background mein process karo
bulkDeleteQueue.process(async (job) => {
  const { userIds, requestedBy } = job.data;
  const results = { success: 0, failed: 0, errors: [] };
  const batchSize = 50;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    try {
      const result = await User.deleteMany({ _id: { $in: batch } });
      results.success += result.deletedCount;
      results.failed += batch.length - result.deletedCount;
    } catch (err) {
      results.failed += batch.length;
      results.errors.push({ batch: i / batchSize, error: err.message });
    }

    // Progress update karo
    await job.progress(Math.round(((i + batchSize) / userIds.length) * 100));
  }

  return results;
});

// Step 3: Job status check endpoint
router.get('/admin/jobs/:jobId', asyncHandler(async (req, res) => {
  const job = await bulkDeleteQueue.getJob(req.params.jobId);

  if (!job) {
    throw new NotFoundError('Job');
  }

  const state = await job.getState();

  res.json({
    success: true,
    data: {
      jobId: job.id,
      state,            // 'waiting', 'active', 'completed', 'failed'
      progress: job.progress(),
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
      createdAt: new Date(job.timestamp),
    }
  });
}));
```

### Best Practices

```
1. Hamesha batch size limit lagao (50-100 per sync request)
2. 100+ items ke liye async processing use karo with job queue
3. Partial success handle karo - kuch fail hue, kuch success (207 Multi-Status)
4. Related data cleanup mat bhulna (cascade delete)
5. Proper logging karo - kaun, kab, kitne records delete kiye
6. Rollback strategy socho - kya hoga agar beech mein fail ho jaaye
```

### Common Mistakes

```
- Koi limit na lagana - koi 1 lakh IDs bhej de toh server hang
- Partial failure handle na karna - all-or-nothing approach real world mein kaam nahi karta
- Sync mein bade bulk operations karna - request timeout ho jaayegi
- Related data cleanup bhulna - orphan records reh jaayenge
- Job status check endpoint na banana - client ko pata hi nahi chalega job complete hua ya nahi
```


---


## Scenario 6: File Upload API

**Q: User profile picture + post with multiple images upload karna hai. API kaise design karoge? Frontend ke liye simple hona chahiye.**

**Answer:**

File upload APIs mein do popular approaches hain: **Direct Upload** (multipart form data) aur **Presigned URL** (cloud storage pe direct upload). Dono ke apne use cases hain.

### Approach 1: Direct Upload with Multer (Simple, small files)

```js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);  // unique filename
  }
});

// File filter - sirf images allow karo
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, WebP, and GIF images are allowed', 400, 'INVALID_FILE_TYPE'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB max per file
    files: 10                     // max 10 files at once
  }
});

// ========== Profile Picture Upload (Single File) ==========
// PUT /api/users/me/avatar
router.put('/users/me/avatar',
  upload.single('avatar'),  // field name 'avatar'
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError([{ field: 'avatar', message: 'Please upload an image' }]);
    }

    // File info
    const avatarUrl = `/uploads/${req.file.filename}`;

    // User update karo
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    );

    res.json({
      success: true,
      data: {
        avatarUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  })
);

// ========== Post with Multiple Images ==========
// POST /api/posts
router.post('/posts',
  upload.array('images', 5),  // max 5 images, field name 'images'
  asyncHandler(async (req, res) => {
    const { title, content } = req.body; // text fields bhi aa sakte hain multipart mein

    const imageUrls = req.file
      ? [req.file]
      : (req.files || []).map(file => ({
          url: `/uploads/${file.filename}`,
          size: file.size,
          mimeType: file.mimetype,
          originalName: file.originalname
        }));

    const post = await Post.create({
      title,
      content,
      images: imageUrls.map(img => img.url),
      author: req.user._id
    });

    res.status(201).json({
      success: true,
      data: {
        post,
        uploadedImages: imageUrls
      }
    });
  })
);

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File size must be less than 5MB' }
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: { code: 'TOO_MANY_FILES', message: 'Maximum 10 files allowed' }
      });
    }
  }
  next(err);
});
```

### Approach 2: Presigned URL (Scalable, large files, S3/Cloud)

Server se URL lelo, phir client directly cloud storage pe upload kare. Server pe load nahi aata.

```js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Step 1: Presigned URL generate karo
// POST /api/uploads/presigned-url
router.post('/uploads/presigned-url', asyncHandler(async (req, res) => {
  const { fileName, fileType, purpose } = req.body;
  // purpose: 'avatar', 'post-image', 'document' etc.

  // Validation
  const allowedTypes = {
    'avatar': ['image/jpeg', 'image/png', 'image/webp'],
    'post-image': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'document': ['application/pdf', 'application/msword']
  };

  if (!allowedTypes[purpose]?.includes(fileType)) {
    throw new AppError(`File type ${fileType} not allowed for ${purpose}`, 400, 'INVALID_FILE_TYPE');
  }

  const ext = fileName.split('.').pop();
  const key = `${purpose}/${req.user._id}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: fileType,
    Metadata: {
      userId: req.user._id.toString(),
      purpose
    }
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min valid

  res.json({
    success: true,
    data: {
      uploadUrl: presignedUrl,      // iss URL pe PUT karo file
      fileKey: key,                  // ye key baad mein save karni hai
      expiresIn: 300,
      maxSize: '5MB'
    }
  });
}));

// Step 2: Upload confirm karo (frontend upload karne ke baad call karega)
// POST /api/uploads/confirm
router.post('/uploads/confirm', asyncHandler(async (req, res) => {
  const { fileKey, purpose, resourceId } = req.body;
  // resourceId: e.g., postId for post images

  // Verify file actually S3 pe hai
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: fileKey
    });
    await s3.send(command);
  } catch (err) {
    throw new AppError('File not found in storage. Upload may have failed.', 400, 'FILE_NOT_FOUND');
  }

  const fileUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${fileKey}`;

  // Purpose ke hisaab se update karo
  if (purpose === 'avatar') {
    await User.findByIdAndUpdate(req.user._id, { avatar: fileUrl });
  } else if (purpose === 'post-image') {
    await Post.findByIdAndUpdate(resourceId, { $push: { images: fileUrl } });
  }

  res.json({
    success: true,
    data: { fileUrl }
  });
}));
```

### Frontend se Upload kaise karein

```js
// Direct upload (Multer approach)
const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch('/api/users/me/avatar', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData  // Content-Type automatically set hoga
  });
  return res.json();
};

// Presigned URL approach
const uploadWithPresignedUrl = async (file, purpose) => {
  // Step 1: Get presigned URL
  const { data } = await fetch('/api/uploads/presigned-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      purpose
    })
  }).then(r => r.json());

  // Step 2: Upload directly to S3 (with progress tracking)
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        console.log(`Upload progress: ${percent}%`);
        // setProgress(percent) - React state update
      }
    };

    xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error('Upload failed'));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });

  // Step 3: Confirm upload
  const confirmed = await fetch('/api/uploads/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fileKey: data.fileKey, purpose })
  }).then(r => r.json());

  return confirmed;
};
```

### Best Practices

```
1. File type aur size validation DONO server side pe karo (client side bypass ho sakta hai)
2. Original filename kabhi use mat karo - UUID generate karo (security + uniqueness)
3. Large files (>5MB) ke liye presigned URLs use karo - server pe load nahi aayega
4. Image upload ke baad compression/resize karo (Sharp library se)
5. Virus/malware scanning add karo production mein
6. Old files cleanup karo (jab user naya avatar upload kare, purana delete karo)
```

### Common Mistakes

```
- File size limit na lagana (koi 2GB file upload kar dega)
- File type validation sirf extension se karna (rename karke bypass ho jaayega)
- Uploads folder publicly accessible rakhna bina auth ke
- Content-Type header manually set karna multipart ke liye (browser khud lagata hai)
- Error handling miss karna multer errors ke liye
```


---


## Scenario 7: Search + Filter + Sort API

**Q: Products API mein search (by name), filter (by category, price range, rating), sort (by price, popularity), aur pagination sab ek saath chahiye. Query parameters kaise design karoge?**

**Answer:**

Ye bahut common real-world scenario hai. Kisi bhi e-commerce ya listing app mein search + filter + sort + pagination sab ek saath kaam karna padta hai. Query parameters ka design clean aur predictable hona chahiye.

### URL Examples

```
// Basic search
GET /api/products?search=laptop

// Search + Category filter
GET /api/products?search=laptop&category=electronics

// Price range filter
GET /api/products?minPrice=10000&maxPrice=50000

// Multiple filters + sort
GET /api/products?category=electronics&minPrice=10000&maxPrice=50000&rating=4&sort=-price

// Everything combined
GET /api/products?search=laptop&category=electronics&brand=dell,hp,lenovo&minPrice=20000&maxPrice=80000&rating=4&inStock=true&sort=-price&page=1&limit=20

// Sort examples
GET /api/products?sort=price        // price low to high
GET /api/products?sort=-price       // price high to low (- prefix = descending)
GET /api/products?sort=-rating,price // rating high to low, then price low to high
```

### Complete Implementation

```js
// GET /api/products
router.get('/products', asyncHandler(async (req, res) => {
  const {
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    rating,
    inStock,
    sort,
    page = 1,
    limit = 20,
    fields        // response mein kaunse fields chahiye
  } = req.query;

  // ========== BUILD FILTER QUERY ==========
  const filter = {};

  // Text search
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },        // case-insensitive
      { description: { $regex: search, $options: 'i' } }
    ];
    // Better approach: MongoDB text index use karo
    // filter.$text = { $search: search };
  }

  // Category filter
  if (category) {
    filter.category = category;
  }

  // Brand filter (multiple brands comma-separated)
  if (brand) {
    filter.brand = { $in: brand.split(',') }; // "dell,hp,lenovo" -> ['dell','hp','lenovo']
  }

  // Price range filter
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  // Minimum rating filter
  if (rating) {
    filter.averageRating = { $gte: parseFloat(rating) };
  }

  // Stock filter
  if (inStock === 'true') {
    filter.stock = { $gt: 0 };
  }

  // ========== BUILD SORT ==========
  let sortObj = {};
  if (sort) {
    // "-price,rating" -> { price: -1, rating: 1 }
    sort.split(',').forEach(field => {
      if (field.startsWith('-')) {
        sortObj[field.substring(1)] = -1;  // descending
      } else {
        sortObj[field] = 1;  // ascending
      }
    });
  } else {
    sortObj = { createdAt: -1 }; // default: newest first
  }

  // ========== BUILD FIELD SELECTION ==========
  let selectFields = '';
  if (fields) {
    // "name,price,rating" -> "name price rating"
    selectFields = fields.split(',').join(' ');
  }

  // ========== PAGINATION ==========
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(parseInt(limit) || 20, 100); // max 100
  const skip = (pageNum - 1) * limitNum;

  // ========== EXECUTE QUERY ==========
  const [products, totalDocs] = await Promise.all([
    Product.find(filter)
      .select(selectFields)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean(),  // plain JS objects (faster, no Mongoose overhead)
    Product.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalDocs / limitNum);

  // ========== RESPONSE ==========
  res.json({
    success: true,
    data: products,
    pagination: {
      currentPage: pageNum,
      totalPages,
      totalDocs,
      limit: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    },
    filters: {
      applied: {
        search: search || null,
        category: category || null,
        brand: brand ? brand.split(',') : null,
        priceRange: (minPrice || maxPrice) ? { min: minPrice || null, max: maxPrice || null } : null,
        minRating: rating || null,
        inStock: inStock || null
      },
      sort: sort || '-createdAt'
    }
  });
}));
```

### Reusable Query Builder Class

```js
// utils/QueryBuilder.js - ye class baar baar use kar sakte ho kisi bhi model ke saath

class QueryBuilder {
  constructor(model, queryParams) {
    this.model = model;
    this.queryParams = queryParams;
    this.filter = {};
    this.sortObj = { createdAt: -1 };
    this.selectFields = '';
    this.pageNum = 1;
    this.limitNum = 20;
  }

  search(searchFields = []) {
    if (this.queryParams.search && searchFields.length > 0) {
      this.filter.$or = searchFields.map(field => ({
        [field]: { $regex: this.queryParams.search, $options: 'i' }
      }));
    }
    return this;
  }

  filterBy(allowedFilters = {}) {
    // allowedFilters = { category: 'exact', price: 'range', rating: 'gte', brand: 'in' }
    Object.entries(allowedFilters).forEach(([field, type]) => {
      const value = this.queryParams[field];
      if (!value) return;

      switch (type) {
        case 'exact':
          this.filter[field] = value;
          break;
        case 'in':
          this.filter[field] = { $in: value.split(',') };
          break;
        case 'gte':
          this.filter[field] = { $gte: parseFloat(value) };
          break;
        case 'range':
          this.filter[field] = {};
          if (this.queryParams[`min${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
            this.filter[field].$gte = parseFloat(this.queryParams[`min${field.charAt(0).toUpperCase() + field.slice(1)}`]);
          }
          if (this.queryParams[`max${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
            this.filter[field].$lte = parseFloat(this.queryParams[`max${field.charAt(0).toUpperCase() + field.slice(1)}`]);
          }
          if (Object.keys(this.filter[field]).length === 0) delete this.filter[field];
          break;
        case 'boolean':
          this.filter[field] = value === 'true';
          break;
      }
    });
    return this;
  }

  sort() {
    if (this.queryParams.sort) {
      const sortFields = {};
      this.queryParams.sort.split(',').forEach(field => {
        if (field.startsWith('-')) {
          sortFields[field.substring(1)] = -1;
        } else {
          sortFields[field] = 1;
        }
      });
      this.sortObj = sortFields;
    }
    return this;
  }

  select() {
    if (this.queryParams.fields) {
      this.selectFields = this.queryParams.fields.split(',').join(' ');
    }
    return this;
  }

  paginate() {
    this.pageNum = Math.max(1, parseInt(this.queryParams.page) || 1);
    this.limitNum = Math.min(parseInt(this.queryParams.limit) || 20, 100);
    return this;
  }

  async execute() {
    const skip = (this.pageNum - 1) * this.limitNum;

    const [data, totalDocs] = await Promise.all([
      this.model.find(this.filter)
        .select(this.selectFields)
        .sort(this.sortObj)
        .skip(skip)
        .limit(this.limitNum)
        .lean(),
      this.model.countDocuments(this.filter)
    ]);

    return {
      data,
      pagination: {
        currentPage: this.pageNum,
        totalPages: Math.ceil(totalDocs / this.limitNum),
        totalDocs,
        limit: this.limitNum,
        hasNextPage: this.pageNum < Math.ceil(totalDocs / this.limitNum),
        hasPrevPage: this.pageNum > 1
      }
    };
  }
}

module.exports = QueryBuilder;
```

### QueryBuilder ka Usage

```js
const QueryBuilder = require('../utils/QueryBuilder');

// Products API
router.get('/products', asyncHandler(async (req, res) => {
  const result = await new QueryBuilder(Product, req.query)
    .search(['name', 'description'])
    .filterBy({
      category: 'exact',
      brand: 'in',
      price: 'range',
      averageRating: 'gte'
    })
    .sort()
    .select()
    .paginate()
    .execute();

  res.json({ success: true, ...result });
}));

// Users API - same class, different model
router.get('/users', asyncHandler(async (req, res) => {
  const result = await new QueryBuilder(User, req.query)
    .search(['name', 'email'])
    .filterBy({
      role: 'exact',
      isActive: 'boolean'
    })
    .sort()
    .paginate()
    .execute();

  res.json({ success: true, ...result });
}));
```

### Best Practices

```
1. Query params ke names consistent rakho across all endpoints
2. Default sort hamesha define karo (warna results unpredictable)
3. limit pe max cap lagao (100) - koi ?limit=999999 bhej sakta hai
4. Allowed filters whitelist karo - arbitrary field names accept mat karo
5. MongoDB indexes banao frequently filtered fields pe (category, price, rating)
6. Response mein applied filters include karo - debugging mein help karega
7. Empty result pe bhi 200 return karo with empty array, 404 mat bhejo
```

### Common Mistakes

```
- Search ke liye regex without $options: 'i' (case sensitive ho jaayega)
- countDocuments bina filter ke call karna (wrong total count)
- Indexing na karna - 1M products pe bina index slow queries
- User input ko seedha MongoDB query mein daalna (NoSQL injection risk)
- limit=0 handle na karna (0 limit means no limit in MongoDB!)
```


---


## Scenario 8: Idempotency

**Q: Payment API hai. User ne "Pay" button double-click kar diya. 2 payments ho gaye. Kaise prevent karoge?**

**Answer:**

Ye bahut critical problem hai, especially financial transactions mein. Agar user ne "Pay" button pe 2 baar click kiya aur server pe 2 requests aayi, toh do baar paisa kat sakta hai. **Idempotency** ka matlab hai - same request ko 2 baar bhejne pe bhi result ek hi hona chahiye, side effect ek hi baar hona chahiye.

### Idempotency Key Concept

Client har request ke saath ek unique key bhejta hai. Server check karta hai - "ye key pehle aayi thi kya?" Agar haan, toh purana result return karta hai. Nahi, toh naya process karta hai.

```
Client:
  Request 1: POST /payments  +  Idempotency-Key: pay_abc123
  Request 2: POST /payments  +  Idempotency-Key: pay_abc123 (same key = double click)

Server:
  Request 1: Process payment, store result against key "pay_abc123", return result
  Request 2: Key "pay_abc123" already exists, return stored result WITHOUT processing again
```

### Implementation with Redis

```js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
const crypto = require('crypto');

// ========== Idempotency Middleware ==========
const idempotencyMiddleware = (options = {}) => {
  const {
    ttl = 86400,            // 24 hours tak key remember rakhho
    headerName = 'idempotency-key',
    required = false         // kya ye header mandatory hai
  } = options;

  return async (req, res, next) => {
    // Sirf non-idempotent methods ke liye (POST, PATCH)
    // GET, PUT, DELETE already idempotent hain by nature
    if (['GET', 'DELETE', 'PUT'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[headerName];

    if (!idempotencyKey) {
      if (required) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IDEMPOTENCY_KEY',
            message: `${headerName} header is required for this endpoint`
          }
        });
      }
      return next(); // optional hai toh bina key ke bhi chalega
    }

    // Redis mein key check karo
    const cacheKey = `idempotency:${req.user._id}:${idempotencyKey}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      // Pehle se processed hai - stored response return karo
      const cachedResponse = JSON.parse(cached);
      console.log(`Idempotent request detected: ${idempotencyKey}`);
      return res.status(cachedResponse.statusCode).json(cachedResponse.body);
    }

    // Lock lagao (race condition prevent karo - agar 2 requests exactly same time pe aayen)
    const lockKey = `lock:${cacheKey}`;
    const lockAcquired = await redis.set(lockKey, '1', 'EX', 10, 'NX'); // 10 sec lock

    if (!lockAcquired) {
      // Koi aur request already process kar rahi hai
      return res.status(409).json({
        success: false,
        error: {
          code: 'REQUEST_IN_PROGRESS',
          message: 'This request is already being processed. Please wait.'
        }
      });
    }

    // Response capture karo
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      // Response Redis mein store karo
      await redis.setex(cacheKey, ttl, JSON.stringify({
        statusCode: res.statusCode,
        body
      }));
      // Lock release karo
      await redis.del(lockKey);
      // Original response bhejo
      return originalJson(body);
    };

    next();
  };
};

module.exports = idempotencyMiddleware;
```

### Payment API mein Use

```js
const idempotencyMiddleware = require('../middleware/idempotency');

// Payment endpoint - idempotency REQUIRED
router.post('/payments',
  idempotencyMiddleware({ required: true, ttl: 86400 }),
  asyncHandler(async (req, res) => {
    const { amount, currency, recipientId, description } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      throw new ValidationError([{ field: 'amount', message: 'Valid amount required' }]);
    }

    // Check sufficient balance
    const sender = await User.findById(req.user._id);
    if (sender.balance < amount) {
      throw new AppError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE');
    }

    // Transaction with MongoDB session (atomic operation)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Sender se paisa katao
      await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { balance: -amount } },
        { session }
      );

      // Recipient ko paisa do
      await User.findByIdAndUpdate(
        recipientId,
        { $inc: { balance: amount } },
        { session }
      );

      // Transaction record banao
      const transaction = await Transaction.create([{
        sender: req.user._id,
        recipient: recipientId,
        amount,
        currency: currency || 'INR',
        description,
        status: 'completed',
        idempotencyKey: req.headers['idempotency-key']
      }], { session });

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        data: {
          transactionId: transaction[0]._id,
          amount,
          currency: currency || 'INR',
          status: 'completed',
          message: 'Payment successful'
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  })
);
```

### Frontend Implementation

```js
// utils/api.js
const { v4: uuidv4 } = require('uuid');

const makePayment = async (paymentData) => {
  // Har payment attempt ke liye ek unique key generate karo
  // IMPORTANT: Same payment attempt ke retry mein same key use karo
  const idempotencyKey = `pay_${uuidv4()}`;

  // Key ko localStorage mein save karo (retry ke liye)
  localStorage.setItem('lastPaymentKey', idempotencyKey);

  try {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey     // <-- ye important hai
      },
      body: JSON.stringify(paymentData)
    });

    return await response.json();
  } catch (error) {
    // Network error pe same key ke saath retry karo
    console.log('Retrying with same idempotency key...');
    // retry logic with same idempotencyKey
    throw error;
  }
};

// React component mein double-click prevention bhi lagao
const PayButton = () => {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (loading) return; // double click block
    setLoading(true);

    try {
      const result = await makePayment({ amount: 500, recipientId: '123' });
      alert('Payment done!');
    } catch (err) {
      alert('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handlePay} disabled={loading}>
      {loading ? 'Processing...' : 'Pay Now'}
    </button>
  );
};
```

### HTTP Methods aur Idempotency

```
GET     -> Idempotent by nature (sirf read karta hai)
PUT     -> Idempotent by nature (same data bhejne pe same result)
DELETE  -> Idempotent by nature (2 baar delete = same result)
POST    -> NOT idempotent (2 baar POST = 2 records ban sakte hain) <-- YAHAN CHAHIYE
PATCH   -> NOT idempotent (depends on operation)
```

### Best Practices

```
1. Payment/financial APIs mein idempotency key MANDATORY banao
2. Redis mein key ka TTL lagao (24 hours usually enough)
3. Race condition handle karo distributed lock se (2 requests same millisecond)
4. Client side bhi double-click prevention lagao (button disable)
5. Idempotency key user-specific banao (user A ki key user B pe apply na ho)
6. Failed requests ki key bhi store karo (taaki retry pe same error aaye, re-process na ho)
```

### Common Mistakes

```
- Sirf frontend pe double-click prevention lagana (API level pe bhi zaroori)
- Idempotency key globally unique na banana (collision ho sakti hai)
- Lock mechanism na lagana (2 concurrent requests slip ho sakti hain)
- Key TTL bahut kam rakhna (user ko retry ka time nahi milega)
- GET requests pe idempotency lagana (unnecessary overhead)
```


---


## Scenario 9: Rate Limiting Response

**Q: Tumhara API rate limited hai. Jab user limit exceed kare toh kya response dena chahiye? Client ko kaise pata chalega kitni requests bachi hain?**

**Answer:**

Rate limiting ka matlab hai - ek user ek time window mein sirf limited requests bhej sakta hai. Jaise free plan users ko 100 requests per minute, premium ko 1000. Jab limit exceed ho jaaye toh proper response aur headers bhejne chahiye taaki client samajh sake kya ho raha hai aur kab retry kare.

### Rate Limiting Implementation

```js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// ========== Sliding Window Rate Limiter ==========
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,   // 1 minute window
    max = 100,               // max 100 requests per window
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.user?._id || req.ip,  // user-based or IP-based
    skip = () => false       // kuch requests skip karna ho toh
  } = options;

  return async (req, res, next) => {
    // Skip check (e.g., health check endpoints)
    if (skip(req)) return next();

    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Redis sorted set use karo (sliding window)
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);        // purane entries hatao
    pipeline.zadd(key, now, `${now}:${Math.random()}`);    // naya request add karo
    pipeline.zcard(key);                                     // total count lo
    pipeline.pexpire(key, windowMs);                         // TTL set karo

    const results = await pipeline.exec();
    const requestCount = results[2][1]; // zcard ka result

    // Rate limit info headers set karo
    const remaining = Math.max(0, max - requestCount);
    const resetTime = Math.ceil((now + windowMs) / 1000); // Unix timestamp

    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Policy': `${max};w=${Math.ceil(windowMs / 1000)}`
    });

    // Limit exceed ho gayi
    if (requestCount > max) {
      const retryAfter = Math.ceil(windowMs / 1000); // seconds mein

      res.set('Retry-After', retryAfter.toString());

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          status: 429,
          retryAfter,
          limit: max,
          windowMs,
          resetAt: new Date(resetTime * 1000).toISOString()
        }
      });
    }

    next();
  };
};

module.exports = rateLimiter;
```

### Different Rate Limits for Different Endpoints/Plans

```js
const rateLimiter = require('../middleware/rateLimiter');

// ========== Global rate limit (sabke liye) ==========
app.use(rateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,               // 100 requests per minute
  keyPrefix: 'rl:global'
}));

// ========== Auth endpoints ke liye strict limit ==========
app.use('/api/auth/login', rateLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // sirf 5 login attempts
  keyPrefix: 'rl:login',
  keyGenerator: (req) => req.ip,  // IP based (user logged in nahi hai)
  message: 'Too many login attempts. Please try after 15 minutes.'
}));

app.use('/api/auth/forgot-password', rateLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,                     // sirf 3 password reset attempts
  keyPrefix: 'rl:pwd-reset',
  keyGenerator: (req) => req.body.email || req.ip
}));

// ========== Plan-based rate limiting ==========
const planBasedLimiter = rateLimiter({
  windowMs: 60 * 1000,
  keyPrefix: 'rl:api',
  max: 100,  // default, overridden below
  keyGenerator: (req) => req.user?._id || req.ip,
  // Dynamic limit based on user's plan
  skip: (req) => false
});

// Middleware to set dynamic limits
const dynamicRateLimit = async (req, res, next) => {
  const planLimits = {
    free: 60,        // 60 requests per minute
    basic: 300,      // 300 requests per minute
    pro: 1000,       // 1000 requests per minute
    enterprise: 5000  // 5000 requests per minute
  };

  const userPlan = req.user?.plan || 'free';
  const limit = planLimits[userPlan] || planLimits.free;

  // Custom rate limiter with user's plan limit
  const limiter = rateLimiter({
    windowMs: 60 * 1000,
    max: limit,
    keyPrefix: `rl:${userPlan}`,
    keyGenerator: (req) => req.user?._id || req.ip
  });

  limiter(req, res, next);
};

app.use('/api', dynamicRateLimit);
```

### Response Headers Explained

```
Jab user request bhejta hai, har response mein ye headers aate hain:

HTTP/1.1 200 OK
X-RateLimit-Limit: 100            -> Total kitni requests allow hain per window
X-RateLimit-Remaining: 73         -> Abhi kitni requests bachi hain
X-RateLimit-Reset: 1705312800     -> Kab limit reset hoga (Unix timestamp)
X-RateLimit-Policy: 100;w=60      -> 100 requests per 60 seconds

Jab limit exceed ho jaaye:

HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705312800
Retry-After: 45                    -> Kitne seconds baad retry karo
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "status": 429,
    "retryAfter": 45,
    "limit": 100,
    "resetAt": "2026-01-15T10:00:00.000Z"
  }
}
```

### Frontend mein Rate Limit Handle Karna

```js
// utils/apiClient.js
const apiClient = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers
    }
  });

  // Rate limit headers read karo
  const rateLimitInfo = {
    limit: parseInt(response.headers.get('X-RateLimit-Limit')),
    remaining: parseInt(response.headers.get('X-RateLimit-Remaining')),
    reset: parseInt(response.headers.get('X-RateLimit-Reset'))
  };

  // Remaining kam ho raha hai toh warning
  if (rateLimitInfo.remaining < 10) {
    console.warn(`Rate limit warning: Only ${rateLimitInfo.remaining} requests remaining`);
  }

  // 429 aaya toh auto-retry with backoff
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
    console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);

    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return apiClient(url, options); // retry
  }

  const data = await response.json();
  return { data, rateLimitInfo };
};

// Usage
const { data, rateLimitInfo } = await apiClient('/api/products');
console.log(`Requests remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`);
```

### Best Practices

```
1. Hamesha rate limit headers bhejo (even when not exceeded) - client ko awareness rahe
2. Retry-After header mandatory hai 429 response mein
3. Different endpoints ke liye different limits rakho (login = strict, read = lenient)
4. User plan ke basis pe dynamic limits lagao
5. IP + User ID dono pe rate limit lagao (unauthenticated + authenticated)
6. Sliding window algorithm use karo (fixed window se zyada fair)
7. Rate limit info ko API documentation mein clearly mention karo
```

### Common Mistakes

```
- Rate limit headers na bhejne se client ko pata nahi chalta kab retry kare
- Sirf IP based rate limiting - shared IPs (office, mobile network) pe problems
- Fixed window rate limiting - window boundary pe burst allow ho jaata hai
- 403 ya 400 bhejne ka instead of 429 (wrong status code)
- Rate limit bypass na karna internal services ke liye
- Error response mein retry information na dena
```


---


## Scenario 10: API Health Check + Status

**Q: DevOps team chahti hai ki ek endpoint ho jo bataye ki API healthy hai ya nahi - database connected hai, Redis up hai, disk space hai. Kaise design karoge?**

**Answer:**

Health check endpoints monitoring ke liye essential hain. Load balancers, Kubernetes, monitoring tools (Datadog, Grafana) - sab inhe use karte hain ye decide karne ke liye ki server traffic receive karne layak hai ya nahi. Usually do levels hote hain: basic health check (public) aur detailed health check (internal/admin only).

### Basic Health Check (Public - Load Balancer ke liye)

```js
// GET /health
// Ye endpoint load balancer use karega (har 10-30 seconds pe call hogi)
// Fast hona chahiye, sensitive info nahi honi chahiye

router.get('/health', (req, res) => {
  // Simple check - server respond kar raha hai
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),       // seconds mein kitne time se chal raha hai
    version: process.env.APP_VERSION || '1.0.0'
  });
});
```

### Detailed Health Check (Internal/Admin only)

```js
const mongoose = require('mongoose');
const Redis = require('ioredis');
const os = require('os');
const { execSync } = require('child_process');

const redis = new Redis(process.env.REDIS_URL);

// Helper: Individual service check with timeout
const checkService = async (name, checkFn, timeoutMs = 5000) => {
  const start = Date.now();

  try {
    await Promise.race([
      checkFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timed out')), timeoutMs)
      )
    ]);

    return {
      name,
      status: 'healthy',
      responseTime: `${Date.now() - start}ms`
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      responseTime: `${Date.now() - start}ms`,
      error: error.message
    };
  }
};

// GET /health/detailed
// Internal use only - auth required, sensitive info hai
router.get('/health/detailed', authMiddleware, adminOnly, asyncHandler(async (req, res) => {

  // Parallel mein saare checks karo
  const checks = await Promise.all([

    // 1. MongoDB Check
    checkService('mongodb', async () => {
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB not connected');
      }
      // Actual ping karo
      await mongoose.connection.db.admin().ping();
    }),

    // 2. Redis Check
    checkService('redis', async () => {
      const result = await redis.ping();
      if (result !== 'PONG') throw new Error('Redis ping failed');
    }),

    // 3. Disk Space Check
    checkService('disk', async () => {
      const diskInfo = execSync("df -h / | tail -1 | awk '{print $5}'")
        .toString().trim().replace('%', '');
      const usagePercent = parseInt(diskInfo);
      if (usagePercent > 90) {
        throw new Error(`Disk usage critical: ${usagePercent}%`);
      }
    }),

    // 4. Memory Check
    checkService('memory', async () => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      if (parseFloat(usedPercent) > 95) {
        throw new Error(`Memory usage critical: ${usedPercent}%`);
      }
    }),

    // 5. External API Check (e.g., payment gateway)
    checkService('payment-gateway', async () => {
      const response = await fetch('https://api.paymentgateway.com/health', {
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) throw new Error(`Payment gateway returned ${response.status}`);
    }, 5000)
  ]);

  // Overall status determine karo
  const unhealthyServices = checks.filter(c => c.status === 'unhealthy');
  const overallStatus = unhealthyServices.length === 0
    ? 'healthy'
    : unhealthyServices.length === checks.length
      ? 'unhealthy'
      : 'degraded';  // kuch healthy, kuch nahi

  // Memory details
  const memoryUsage = process.memoryUsage();

  const healthReport = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV,
    services: checks,
    system: {
      platform: os.platform(),
      nodeVersion: process.version,
      cpuCores: os.cpus().length,
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      processMemory: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
      },
      loadAverage: os.loadavg().map(l => l.toFixed(2))
    }
  };

  // Status code bhi health ke according
  const statusCode = overallStatus === 'healthy' ? 200 :
                     overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(healthReport);
}));
```

### Response Examples

```js
// GET /health (Basic - Public)
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "uptime": 86400,
  "version": "2.1.0"
}

// GET /health/detailed (Detailed - Admin Only)
{
  "status": "degraded",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "uptime": "24h 0m",
  "version": "2.1.0",
  "environment": "production",
  "services": [
    {
      "name": "mongodb",
      "status": "healthy",
      "responseTime": "3ms"
    },
    {
      "name": "redis",
      "status": "healthy",
      "responseTime": "1ms"
    },
    {
      "name": "disk",
      "status": "healthy",
      "responseTime": "15ms"
    },
    {
      "name": "memory",
      "status": "healthy",
      "responseTime": "0ms"
    },
    {
      "name": "payment-gateway",
      "status": "unhealthy",
      "responseTime": "5001ms",
      "error": "Health check timed out"
    }
  ],
  "system": {
    "platform": "linux",
    "nodeVersion": "v20.10.0",
    "cpuCores": 4,
    "totalMemory": "16.00 GB",
    "freeMemory": "8.50 GB",
    "processMemory": {
      "rss": "150.25 MB",
      "heapUsed": "95.30 MB",
      "heapTotal": "120.00 MB"
    },
    "loadAverage": ["1.25", "1.50", "1.10"]
  }
}
```

### Kubernetes Liveness + Readiness Probes

```js
// Liveness Probe - "Kya server zinda hai?"
// Agar ye fail kare toh Kubernetes pod restart karega
router.get('/health/live', (req, res) => {
  // Basic check - process respond kar raha hai
  res.status(200).json({ status: 'alive' });
});

// Readiness Probe - "Kya server traffic lene ke liye ready hai?"
// Agar ye fail kare toh Kubernetes traffic bhejne band karega (but restart nahi karega)
router.get('/health/ready', asyncHandler(async (req, res) => {
  // Check critical dependencies
  const isDbConnected = mongoose.connection.readyState === 1;
  const isRedisConnected = redis.status === 'ready';

  if (!isDbConnected || !isRedisConnected) {
    return res.status(503).json({
      status: 'not_ready',
      checks: {
        database: isDbConnected ? 'connected' : 'disconnected',
        redis: isRedisConnected ? 'connected' : 'disconnected'
      }
    });
  }

  res.status(200).json({ status: 'ready' });
}));
```

```yaml
# Kubernetes deployment mein aise use hoga:
# (Reference for DevOps team)

# livenessProbe:
#   httpGet:
#     path: /health/live
#     port: 3000
#   initialDelaySeconds: 10
#   periodSeconds: 15
#
# readinessProbe:
#   httpGet:
#     path: /health/ready
#     port: 3000
#   initialDelaySeconds: 5
#   periodSeconds: 10
```

### Startup Health Check Pattern

```js
// Server start hone se pehle check karo sab theek hai
const checkDependencies = async () => {
  console.log('Checking dependencies...');

  // MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1); // bina DB ke start mat karo
  }

  // Redis
  try {
    await redis.ping();
    console.log('Redis connected');
  } catch (err) {
    console.error('Redis connection failed:', err.message);
    process.exit(1);
  }

  console.log('All dependencies healthy. Starting server...');
};

// Server start karo
const startServer = async () => {
  await checkDependencies();

  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
};

startServer();
```

### Best Practices

```
1. /health (basic) pe authentication mat lagao - load balancer access kar sake
2. /health/detailed pe auth lagao - sensitive system info hai
3. Health check fast hona chahiye (<500ms) - slow check se monitoring tools confuse honge
4. External dependency check mein timeout lagao (5 sec max)
5. Database credentials, connection strings, API keys kabhi expose mat karo
6. "degraded" status use karo jab non-critical services down hoon (e.g., email service)
7. Liveness aur Readiness probes alag rakho (Kubernetes ke liye)
8. Health check endpoint pe rate limiting mat lagao
```

### Common Mistakes

```
- Health check mein sensitive info expose karna (DB host, passwords, internal IPs)
- Health check mein heavy operations karna (slow response, monitoring tools ko lagega ki server down hai)
- Sirf /health endpoint banana aur usme sab kuch daalna (basic aur detailed alag rakho)
- Health check pe authentication lagana (load balancer access nahi kar paayega)
- External service down hone pe apni API ko unhealthy mark karna (degraded use karo)
- Health check endpoint ka response cache karna (stale data milega)
```


---


*Total: 10 API Design Scenario Questions*

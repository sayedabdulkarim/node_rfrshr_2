# MongoDB - Scenario Based Interview Questions

> "Schema design, indexing, aggregation - ye sab interview mein situation-based puchha jaata hai"


---


## Scenario 1: Slow Query Detection

**Q: Tumhari API ek request pe 5 seconds le rahi hai response dene mein. Tumhe pata hai ki MongoDB query slow hai. Kaise find karoge problem aur kaise fix karoge?**

**Answer:**

Jab bhi MongoDB query slow ho, sabse pehle humein samajhna hota hai ki query internally kya kar rahi hai - kitne documents scan ho rahe hain, index use ho raha hai ya nahi, aur bottleneck kahan hai. Iske liye MongoDB humein kuch powerful tools deta hai.

### Step 1: `.explain()` se query analyze karo

```js
// Pehle dekhte hain query kya kar rahi hai internally
db.orders.find({ userId: "u123", status: "delivered" })
  .sort({ createdAt: -1 })
  .explain("executionStats");
```

```json
{
  "executionStats": {
    "totalDocsExamined": 5000000,
    "totalKeysExamined": 0,
    "nReturned": 25,
    "executionTimeMillis": 4800,
    "stage": "COLLSCAN"
  }
}
```

Yahan dekho - `COLLSCAN` aa raha hai matlab **koi index use nahi ho raha**, poori collection scan ho rahi hai. 50 lakh documents scan ho rahe hain sirf 25 return karne ke liye. Yahi problem hai.

### Step 2: Slow Query Profiler enable karo

```js
// Profiler on karo - 100ms se slow queries log hongi
db.setProfilingLevel(1, { slowms: 100 });

// Ab slow queries dekho
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty();
```

```json
{
  "op": "query",
  "ns": "mydb.orders",
  "millis": 4800,
  "planSummary": "COLLSCAN",
  "command": {
    "find": "orders",
    "filter": { "userId": "u123", "status": "delivered" }
  }
}
```

Profiler clearly bata raha hai kaunsi query slow hai, kitna time lagi, aur plan kya tha.

### Step 3: Compound Index banao

```js
// Compound index - userId (equality) + status (equality) + createdAt (sort)
db.orders.createIndex(
  { userId: 1, status: 1, createdAt: -1 },
  { name: "idx_user_status_date" }
);
```

### Step 4: Fix ke baad dobara explain() karo

```js
db.orders.find({ userId: "u123", status: "delivered" })
  .sort({ createdAt: -1 })
  .explain("executionStats");
```

```json
{
  "executionStats": {
    "totalDocsExamined": 25,
    "totalKeysExamined": 25,
    "nReturned": 25,
    "executionTimeMillis": 3,
    "stage": "IXSCAN"
  }
}
```

Ab dekho - `IXSCAN` aa raha hai, sirf 25 documents examine ho rahe hain, aur time 4800ms se **3ms** ho gaya!

### Step 5: Covered Query for maximum speed

```js
// Agar sirf indexed fields chahiye toh covered query use karo
// totalDocsExamined = 0 hoga!
db.orders.find(
  { userId: "u123", status: "delivered" },
  { userId: 1, status: 1, createdAt: 1, _id: 0 }  // projection sirf indexed fields
).sort({ createdAt: -1 });
```

Covered query mein MongoDB ko document fetch hi nahi karna padta - sab kuch index se mil jaata hai.

### Mongoose mein kaise karein:

```js
// Mongoose model mein index define karo
const orderSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  status: String,
  createdAt: { type: Date, default: Date.now }
});

// Compound index
orderSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Query with explain
const result = await Order.find({ userId: "u123", status: "delivered" })
  .sort({ createdAt: -1 })
  .explain("executionStats");

console.log(result[0].executionStats);
```

### Common Mistakes:
- **Bahut saare single-field indexes banana** instead of smart compound indexes
- **explain() check nahi karna** deployment se pehle
- **Profiler production mein level 2 pe chhod dena** (ye har query log karta hai, performance kill)
- **Index order galat rakhna** - ESR rule follow karo (Equality, Sort, Range)


---


## Scenario 2: Schema Design - Embed vs Reference

**Q: Ek e-commerce app bana rahe ho. Product ke reviews kahan store karoge - product document mein embed karoge ya alag collection mein reference rakhoge? Reasoning do.**

**Answer:**

Ye MongoDB ka sabse classic design decision hai. Dono approaches ke apne pros aur cons hain, aur answer depend karta hai **access pattern** pe.

### Option A: Embedding (Reviews inside Product)

```js
// Product document with embedded reviews
{
  _id: ObjectId("prod001"),
  name: "iPhone 15 Pro",
  price: 134900,
  category: "Electronics",
  reviews: [
    {
      userId: ObjectId("user01"),
      userName: "Rahul",
      rating: 5,
      comment: "Best phone ever! Camera is amazing.",
      createdAt: ISODate("2025-01-15")
    },
    {
      userId: ObjectId("user02"),
      userName: "Priya",
      rating: 4,
      comment: "Good but expensive",
      createdAt: ISODate("2025-01-20")
    }
  ],
  averageRating: 4.5,
  totalReviews: 2
}
```

**Pros:** Ek hi query mein product + reviews mil jaate hain (no join needed).
**Cons:** Document size badhta jayega. MongoDB ka **16MB document limit** hai.

### Option B: Referencing (Separate Collection)

```js
// Products Collection
{
  _id: ObjectId("prod001"),
  name: "iPhone 15 Pro",
  price: 134900,
  category: "Electronics",
  averageRating: 4.5,
  totalReviews: 5840
}

// Reviews Collection (alag)
{
  _id: ObjectId("rev001"),
  productId: ObjectId("prod001"),  // reference
  userId: ObjectId("user01"),
  userName: "Rahul",
  rating: 5,
  comment: "Best phone ever! Camera is amazing.",
  createdAt: ISODate("2025-01-15")
}
```

### Best Approach: Hybrid Pattern

Real-world mein **hybrid approach** best hota hai - recent reviews embed karo, baaki reference karo:

```js
// Product document with limited embedded reviews
{
  _id: ObjectId("prod001"),
  name: "iPhone 15 Pro",
  price: 134900,
  category: "Electronics",
  averageRating: 4.5,
  totalReviews: 5840,
  // Sirf top 5 recent reviews embed
  recentReviews: [
    {
      userId: ObjectId("user01"),
      userName: "Rahul",
      rating: 5,
      comment: "Best phone ever!",
      createdAt: ISODate("2025-01-20")
    }
    // ... max 5 reviews
  ]
}

// Baaki saare reviews alag collection mein
// Reviews Collection - full data yahan hai
{
  _id: ObjectId("rev001"),
  productId: ObjectId("prod001"),
  userId: ObjectId("user01"),
  userName: "Rahul",
  rating: 5,
  comment: "Best phone ever! Camera is amazing.",
  helpfulCount: 42,
  createdAt: ISODate("2025-01-20")
}
```

### Mongoose Implementation:

```js
// Product Schema - embedded recent reviews
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  recentReviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: String,
    rating: Number,
    comment: { type: String, maxlength: 200 },
    createdAt: { type: Date, default: Date.now }
  }]
});

// Review Schema - separate collection (full data)
const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: String,
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  helpfulCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ productId: 1, createdAt: -1 });

// Jab naya review aaye - dono jagah update karo
async function addReview(productId, reviewData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Review collection mein save
    const review = await Review.create([reviewData], { session });

    // 2. Product mein recentReviews update (max 5 rakho)
    await Product.findByIdAndUpdate(productId, {
      $inc: { totalReviews: 1 },
      $push: {
        recentReviews: {
          $each: [{
            userId: reviewData.userId,
            userName: reviewData.userName,
            rating: reviewData.rating,
            comment: reviewData.comment.substring(0, 200),
            createdAt: new Date()
          }],
          $sort: { createdAt: -1 },
          $slice: 5  // Sirf latest 5 rakho
        }
      }
    }, { session });

    // 3. Average rating recalculate
    const avgResult = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]).session(session);

    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(avgResult[0].avg * 10) / 10
    }, { session });

    await session.commitTransaction();
    return review[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Decision Framework:

| Factor | Embed | Reference |
|--------|-------|-----------|
| Data size per parent | Small/bounded | Large/unbounded |
| Read pattern | Always read together | Sometimes read separately |
| Write frequency | Rarely updated | Frequently updated |
| Data duplication | Acceptable | Not acceptable |
| 16MB limit risk | No risk | N/A |

### Common Mistakes:
- **Unbounded arrays embed karna** - reviews unlimited ho sakte hain, 16MB limit hit hogi
- **Sab kuch reference karna** - unnecessary joins slow karte hain
- **Data consistency ignore karna** - embedded + referenced dono jagah update karna padega
- **Access pattern analyze nahi karna** - pehle socho kaise data read/write hoga, phir design karo


---


## Scenario 3: Aggregation Pipeline Optimization

**Q: Tumhare e-commerce app mein sales report generate karna hai - monthly revenue, top selling products, aur region-wise breakdown chahiye. Ye sab ek single aggregation query mein kaise karoge?**

**Answer:**

MongoDB ka Aggregation Pipeline bahut powerful hai - SQL ke GROUP BY, JOIN, subqueries sab kuch ek pipeline mein ho sakta hai. Lekin optimization zaroori hai warna large datasets pe slow ho jayega.

### Sample Data Structure:

```js
// Orders Collection
{
  _id: ObjectId("ord001"),
  customerId: ObjectId("cust01"),
  products: [
    { productId: ObjectId("p01"), name: "iPhone 15", quantity: 1, price: 134900 },
    { productId: ObjectId("p02"), name: "AirPods Pro", quantity: 2, price: 24900 }
  ],
  totalAmount: 184700,
  region: "North",
  status: "delivered",
  createdAt: ISODate("2025-03-15T10:30:00Z")
}
```

### Optimized Aggregation Pipeline:

```js
const salesReport = await db.orders.aggregate([

  // STAGE 1: $match SABSE PEHLE - filter early, kam data process ho
  {
    $match: {
      status: "delivered",
      createdAt: {
        $gte: ISODate("2025-01-01"),
        $lt: ISODate("2026-01-01")
      }
    }
  },

  // STAGE 2: $facet - multiple reports ek saath parallel mein
  {
    $facet: {

      // Report 1: Monthly Revenue
      monthlyRevenue: [
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            totalRevenue: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: "$totalAmount" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            month: {
              $concat: [
                { $toString: "$_id.year" }, "-",
                {
                  $cond: {
                    if: { $lt: ["$_id.month", 10] },
                    then: { $concat: ["0", { $toString: "$_id.month" }] },
                    else: { $toString: "$_id.month" }
                  }
                }
              ]
            },
            totalRevenue: { $round: ["$totalRevenue", 2] },
            orderCount: 1,
            avgOrderValue: { $round: ["$avgOrderValue", 2] }
          }
        }
      ],

      // Report 2: Top 10 Products
      topProducts: [
        { $unwind: "$products" },
        {
          $group: {
            _id: "$products.productId",
            productName: { $first: "$products.name" },
            totalQuantitySold: { $sum: "$products.quantity" },
            totalRevenue: {
              $sum: { $multiply: ["$products.quantity", "$products.price"] }
            }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            productName: 1,
            totalQuantitySold: 1,
            totalRevenue: 1
          }
        }
      ],

      // Report 3: Region-wise Breakdown
      regionBreakdown: [
        {
          $group: {
            _id: "$region",
            totalRevenue: { $sum: "$totalAmount" },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: "$totalAmount" }
          }
        },
        { $sort: { totalRevenue: -1 } },
        {
          $project: {
            _id: 0,
            region: "$_id",
            totalRevenue: { $round: ["$totalRevenue", 2] },
            orderCount: 1,
            avgOrderValue: { $round: ["$avgOrderValue", 2] }
          }
        }
      ]
    }
  }
]);
```

### Output kaisa dikhega:

```json
{
  "monthlyRevenue": [
    {
      "month": "2025-01",
      "totalRevenue": 15234500,
      "orderCount": 1250,
      "avgOrderValue": 12187.6
    },
    {
      "month": "2025-02",
      "totalRevenue": 18456200,
      "orderCount": 1480,
      "avgOrderValue": 12470.41
    }
  ],
  "topProducts": [
    {
      "productId": "p01",
      "productName": "iPhone 15",
      "totalQuantitySold": 3200,
      "totalRevenue": 43168000
    }
  ],
  "regionBreakdown": [
    {
      "region": "North",
      "totalRevenue": 25600000,
      "orderCount": 4500,
      "avgOrderValue": 5688.89
    }
  ]
}
```

### Mongoose mein Implementation:

```js
// Route: GET /api/reports/sales?year=2025
const getSalesReport = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year + 1}-01-01`);

    const report = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $facet: {
          monthlyRevenue: [
            {
              $group: {
                _id: { $month: "$createdAt" },
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          topProducts: [
            { $unwind: "$products" },
            {
              $group: {
                _id: "$products.productId",
                name: { $first: "$products.name" },
                sold: { $sum: "$products.quantity" },
                revenue: { $sum: { $multiply: ["$products.quantity", "$products.price"] } }
              }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
          ],
          regionBreakdown: [
            {
              $group: {
                _id: "$region",
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 }
              }
            },
            { $sort: { revenue: -1 } }
          ],
          summary: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalAmount" },
                totalOrders: { $sum: 1 },
                avgOrderValue: { $avg: "$totalAmount" }
              }
            }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      year,
      data: report[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Pipeline Optimization Tips:

```js
// BAD - $match baad mein hai, pehle saare documents process honge
[
  { $unwind: "$products" },
  { $group: { ... } },
  { $match: { status: "delivered" } }  // TOO LATE!
]

// GOOD - $match pehle, kam data aage jayega
[
  { $match: { status: "delivered" } },  // Filter FIRST
  { $unwind: "$products" },
  { $group: { ... } }
]

// IMPORTANT: $match first stage mein hoga toh index use hoga!
// Baad ke stages mein $match index use NAHI karta
```

### Common Mistakes:
- **$match ko baad mein likhna** - $match hamesha pehle aana chahiye for index usage
- **$unwind bina zaroorat ke karna** - $unwind document count multiply karta hai
- **$facet mein bahut heavy operations** - $facet memory mein run hota hai, 100MB limit hai
- **allowDiskUse: true bhool jaana** - large datasets ke liye zaroori hai warna memory error aayega

```js
// Large datasets ke liye allowDiskUse enable karo
Order.aggregate([...pipeline]).option({ allowDiskUse: true });
```


---


## Scenario 4: Index Strategy

**Q: Tumhare paas Users collection hai jismein 10 million documents hain. App mein teen tarah ki queries hoti hain: name se search, city se filter, aur createdAt se sort. Kitne aur kaunse indexes banayoge? Reasoning do.**

**Answer:**

Index strategy MongoDB performance ka backbone hai. Galat indexes se query slow hogi, bahut zyada indexes se write slow hogi. Balance chahiye.

### Pehle samajhte hain queries:

```js
// Query 1: Name se search + createdAt sort
db.users.find({ name: /rahul/i }).sort({ createdAt: -1 });

// Query 2: City filter + createdAt sort
db.users.find({ city: "Mumbai" }).sort({ createdAt: -1 });

// Query 3: City + status filter + createdAt sort
db.users.find({ city: "Delhi", status: "active" }).sort({ createdAt: -1 });

// Query 4: Exact name + city
db.users.find({ name: "Rahul Sharma", city: "Mumbai" });
```

### ESR Rule (Equality, Sort, Range):

Index fields ka order bahut matter karta hai. **ESR Rule** follow karo:

1. **E - Equality** fields pehle (exact match: `city: "Mumbai"`)
2. **S - Sort** fields beech mein (sort: `createdAt: -1`)
3. **R - Range** fields last mein (range: `age: { $gt: 18 }`)

### Recommended Indexes:

```js
// Index 1: City (equality) + createdAt (sort)
// Covers Query 2, partially Query 3
db.users.createIndex(
  { city: 1, createdAt: -1 },
  { name: "idx_city_date" }
);

// Index 2: City + Status (equality) + createdAt (sort)
// Covers Query 3 perfectly
db.users.createIndex(
  { city: 1, status: 1, createdAt: -1 },
  { name: "idx_city_status_date" }
);

// Index 3: Name text search ke liye
// Regex search ke liye normal index kaam nahi karta (prefix regex chhodke)
db.users.createIndex(
  { name: "text" },
  { name: "idx_name_text" }
);

// Index 4: Name (equality) + City (equality)
// Covers Query 4
db.users.createIndex(
  { name: 1, city: 1 },
  { name: "idx_name_city" }
);
```

### Har Index ka explain() check karo:

```js
// Query 2 check karo
db.users.find({ city: "Mumbai" }).sort({ createdAt: -1 }).explain("executionStats");
```

```json
{
  "executionStats": {
    "nReturned": 50,
    "totalKeysExamined": 50,
    "totalDocsExamined": 50,
    "executionTimeMillis": 2,
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",
        "indexName": "idx_city_date",
        "direction": "forward"
      }
    }
  }
}
```

Perfect! `totalKeysExamined === nReturned` matlab index efficiently use ho raha hai.

### Covered Query Example:

```js
// Covered query - documents fetch hi nahi karne padte
db.users.find(
  { city: "Mumbai" },
  { city: 1, createdAt: 1, _id: 0 }  // sirf indexed fields project karo
).sort({ createdAt: -1 }).explain("executionStats");

// totalDocsExamined: 0 hoga - fastest possible query!
```

### Mongoose Schema mein Indexes:

```js
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },  // unique: true automatically index banata hai
  city: String,
  status: { type: String, enum: ["active", "inactive", "banned"], default: "active" },
  age: Number,
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes
userSchema.index({ city: 1, createdAt: -1 });
userSchema.index({ city: 1, status: 1, createdAt: -1 });
userSchema.index({ name: 1, city: 1 });
userSchema.index({ name: "text" });

// Startup pe indexes verify karo
mongoose.connection.on("open", async () => {
  const indexes = await mongoose.connection.db.collection("users").indexes();
  console.log("Current indexes:", indexes.map(i => i.name));
});
```

### Index Monitoring:

```js
// Kaunse indexes use ho rahe hain, kaunse nahi
db.users.aggregate([{ $indexStats: {} }]);
```

```json
[
  {
    "name": "idx_city_date",
    "accesses": { "ops": 145000, "since": ISODate("2025-01-01") }
  },
  {
    "name": "idx_name_city",
    "accesses": { "ops": 3, "since": ISODate("2025-01-01") }  // Almost unused!
  }
]
```

Agar koi index barely use ho raha hai toh **drop karo** - unused indexes sirf write performance slow karte hain.

### Common Mistakes:
- **Har field pe alag index banana** - compound index ek hi kaafi hota hai multiple queries ke liye
- **ESR rule ignore karna** - index field order galat hoga toh index partially use hoga ya nahi hoga
- **Index direction matter karta hai** sort mein - `{ createdAt: -1 }` aur `{ createdAt: 1 }` alag hain compound index mein
- **Regex queries ke liye normal index expect karna** - `/rahul/i` jaise regex pe normal index kaam nahi karta, text index ya prefix regex chahiye
- **Write performance ignore karna** - har index write slow karta hai, 10M documents pe 5+ indexes carefully evaluate karo


---


## Scenario 5: Data Migration - SQL to MongoDB

**Q: Company ka existing MySQL database hai jismein 50+ tables hain, foreign keys hain, joins hain. Ab MongoDB mein migrate karna hai. Kaise approach karoge? Schema kaise design hoga?**

**Answer:**

SQL to MongoDB migration sirf data copy karna nahi hai - **schema redesign** karna padta hai kyunki relational aur document model fundamentally different hain. Sochna padta hai ki data kaise access hota hai aur uske hisaab se denormalize karna hota hai.

### Step 1: Existing SQL Schema Analyze karo

```sql
-- MySQL Tables
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10,2),
    status ENUM('pending','shipped','delivered'),
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(200),
    price DECIMAL(10,2),
    category_id INT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(100)
);
```

### Step 2: Access Patterns identify karo

Pehle socho app mein data kaise read hota hai:

```
Pattern 1: User profile page -> user info + recent orders
Pattern 2: Order detail page -> order + items + product names
Pattern 3: Product listing -> products + category name
Pattern 4: Admin dashboard -> orders with user names
```

### Step 3: MongoDB Schema Design (Denormalized)

```js
// Users Collection - orders embed nahi karenge (unbounded)
{
  _id: ObjectId("..."),
  mysqlId: 1,               // purana ID reference ke liye rakho
  name: "Rahul Sharma",
  email: "rahul@email.com",
  orderCount: 15,
  totalSpent: 45000
}

// Orders Collection - items EMBED karenge (bounded, always read together)
{
  _id: ObjectId("..."),
  mysqlId: 101,
  userId: ObjectId("..."),
  userName: "Rahul Sharma",    // Denormalized! JOIN avoid karne ke liye
  items: [                     // order_items EMBEDDED - hamesha saath read hoti hain
    {
      productId: ObjectId("..."),
      productName: "iPhone 15",  // Denormalized product name
      quantity: 1,
      price: 134900
    },
    {
      productId: ObjectId("..."),
      productName: "AirPods Pro",
      quantity: 2,
      price: 24900
    }
  ],
  totalAmount: 184700,
  status: "delivered",
  createdAt: ISODate("2025-03-15")
}

// Products Collection - category EMBED (small, rarely changes)
{
  _id: ObjectId("..."),
  mysqlId: 501,
  name: "iPhone 15",
  price: 134900,
  category: {                // category embedded - small aur stable data
    id: ObjectId("..."),
    name: "Electronics"
  },
  specifications: {          // SQL mein alag table hoti, yahan embed
    color: "Blue",
    storage: "256GB",
    ram: "8GB"
  }
}
```

### Step 4: Migration Script

```js
// migration.js - Node.js script
const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");

async function migrate() {
  // Connections
  const sqlConn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "ecommerce"
  });

  const mongoClient = new MongoClient("mongodb://localhost:27017");
  await mongoClient.connect();
  const mongodb = mongoClient.db("ecommerce_new");

  console.log("Connected to both databases");

  // Step 1: Migrate Categories first (dependency)
  console.log("Migrating categories...");
  const [categories] = await sqlConn.execute("SELECT * FROM categories");
  const categoryMap = {};  // mysql_id -> mongodb ObjectId mapping

  for (const cat of categories) {
    const result = await mongodb.collection("categories").insertOne({
      mysqlId: cat.id,
      name: cat.name
    });
    categoryMap[cat.id] = { _id: result.insertedId, name: cat.name };
  }

  // Step 2: Migrate Products with embedded category
  console.log("Migrating products...");
  const [products] = await sqlConn.execute("SELECT * FROM products");
  const productMap = {};

  // Batch insert for performance
  const productDocs = products.map(p => {
    const doc = {
      mysqlId: p.id,
      name: p.name,
      price: parseFloat(p.price),
      category: categoryMap[p.category_id] || null
    };
    return doc;
  });

  const productResult = await mongodb.collection("products").insertMany(productDocs);
  // Build product map for order items
  productDocs.forEach((doc, idx) => {
    const insertedId = productResult.insertedIds[idx];
    productMap[doc.mysqlId] = { _id: insertedId, name: doc.name };
  });

  // Step 3: Migrate Users
  console.log("Migrating users...");
  const [users] = await sqlConn.execute("SELECT * FROM users");
  const userMap = {};

  const userDocs = users.map(u => ({
    mysqlId: u.id,
    name: u.name,
    email: u.email,
    orderCount: 0,
    totalSpent: 0
  }));

  const userResult = await mongodb.collection("users").insertMany(userDocs);
  userDocs.forEach((doc, idx) => {
    userMap[doc.mysqlId] = { _id: userResult.insertedIds[idx], name: doc.name };
  });

  // Step 4: Migrate Orders with embedded items (BATCH processing)
  console.log("Migrating orders...");
  const BATCH_SIZE = 1000;
  const [orderCount] = await sqlConn.execute("SELECT COUNT(*) as count FROM orders");
  const total = orderCount[0].count;

  for (let offset = 0; offset < total; offset += BATCH_SIZE) {
    const [orders] = await sqlConn.execute(
      "SELECT * FROM orders ORDER BY id LIMIT ? OFFSET ?",
      [BATCH_SIZE, offset]
    );

    const orderDocs = [];
    for (const order of orders) {
      // Har order ke items fetch karo
      const [items] = await sqlConn.execute(
        "SELECT * FROM order_items WHERE order_id = ?",
        [order.id]
      );

      const user = userMap[order.user_id];
      orderDocs.push({
        mysqlId: order.id,
        userId: user?._id,
        userName: user?.name,
        items: items.map(item => ({
          productId: productMap[item.product_id]?._id,
          productName: productMap[item.product_id]?.name,
          quantity: item.quantity,
          price: parseFloat(item.price)
        })),
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        createdAt: new Date(order.created_at)
      });
    }

    await mongodb.collection("orders").insertMany(orderDocs);
    console.log(`Migrated ${Math.min(offset + BATCH_SIZE, total)}/${total} orders`);
  }

  // Step 5: Update user stats
  console.log("Updating user statistics...");
  await mongodb.collection("orders").aggregate([
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" }
      }
    },
    {
      $merge: {
        into: "users",
        on: "_id",
        whenMatched: [{
          $set: { orderCount: "$$new.orderCount", totalSpent: "$$new.totalSpent" }
        }]
      }
    }
  ]).toArray();

  // Step 6: Create indexes
  console.log("Creating indexes...");
  await mongodb.collection("users").createIndex({ email: 1 }, { unique: true });
  await mongodb.collection("orders").createIndex({ userId: 1, createdAt: -1 });
  await mongodb.collection("orders").createIndex({ status: 1, createdAt: -1 });
  await mongodb.collection("products").createIndex({ "category.name": 1 });

  console.log("Migration complete!");

  await sqlConn.end();
  await mongoClient.close();
}

migrate().catch(console.error);
```

### Denormalization Decision Guide:

| SQL Pattern | MongoDB Approach | Reason |
|-------------|-----------------|--------|
| 1:1 relationship | Embed | Always read together |
| 1:Few (bounded) | Embed | Array bounded hai |
| 1:Many (unbounded) | Reference | Array bahut bada ho sakta hai |
| Many:Many | Reference (both sides) | Dono taraf unbounded |
| Lookup table (categories) | Embed | Small, rarely changes |
| Frequently joined | Denormalize (copy data) | JOIN avoid karo |

### Common Mistakes:
- **SQL schema directly copy karna** - normalized schema MongoDB mein slow hota hai
- **Sab kuch ek document mein embed karna** - 16MB limit yaad rakho
- **mysqlId nahi rakhna** - migration ke baad verification ke liye zaroori hai
- **Batch processing nahi karna** - 10 lakh rows ek baar mein insert karoge toh memory issue
- **Indexes migration ke baad banana** - bulk insert pehle, index baad mein (faster)


---


## Scenario 6: Handling Concurrent Updates

**Q: Tumhare e-commerce app mein flash sale ho rahi hai. Ek product ka stock 50 hai aur 100 users simultaneously buy kar rahe hain. Overselling kaise rokoge? Matlab stock negative mein nahi jaana chahiye.**

**Answer:**

Ye concurrency problem hai - classic race condition. Agar do users same time pe stock check karein (stock = 1), dono ko milega "available", dono buy kar lenge, aur stock -1 ho jayega. MongoDB mein isko handle karne ke multiple approaches hain.

### Problem - Race Condition:

```js
// BAD APPROACH - Race condition!
async function buyProduct(productId, quantity) {
  // Step 1: Stock check
  const product = await Product.findById(productId);

  // Dono users yahan 50 dekhenge
  if (product.stock >= quantity) {
    // Step 2: Stock reduce
    // Dono users yahan pahunch jayenge!
    product.stock -= quantity;
    await product.save();
    // Stock galat ho jayega
  }
}
```

Yahan **read aur write ke beech mein gap** hai - isi gap mein doosra user bhi read kar leta hai.

### Solution 1: Atomic Update with $inc (Best for Simple Cases)

```js
// GOOD - Atomic operation, race condition nahi hogi
async function buyProduct(productId, quantity) {
  const result = await Product.findOneAndUpdate(
    {
      _id: productId,
      stock: { $gte: quantity }  // Condition: stock sufficient hona chahiye
    },
    {
      $inc: { stock: -quantity }  // Atomic decrement
    },
    {
      new: true,       // Updated document return karo
      runValidators: true
    }
  );

  if (!result) {
    throw new Error("Out of stock! Product available nahi hai.");
  }

  return result;
}
```

Ye kaam karta hai kyunki `findOneAndUpdate` **atomic** hai - read + condition check + write sab ek hi operation mein hota hai. Koi doosra operation beech mein nahi aa sakta.

### Solution 2: Optimistic Concurrency with Version Key

```js
// Mongoose ka built-in __v (version key) use karo
const productSchema = new mongoose.Schema({
  name: String,
  stock: { type: Number, min: 0 },
  price: Number
}, {
  optimisticConcurrency: true  // Ye enable karo
});

// Ab save() pe version check hoga automatically
async function buyProductOptimistic(productId, quantity) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const product = await Product.findById(productId);

      if (product.stock < quantity) {
        throw new Error("Out of stock!");
      }

      product.stock -= quantity;
      await product.save();  // Ye internally __v check karega

      // Agar kisi ne beech mein update kiya, VersionError aayega
      return product;

    } catch (error) {
      if (error.name === "VersionError" && attempt < MAX_RETRIES) {
        console.log(`Retry attempt ${attempt} - concurrent modification detected`);
        continue;  // Retry karo fresh data ke saath
      }
      throw error;
    }
  }
}
```

### Solution 3: MongoDB Transactions (Complex Operations)

Jab ek se zyada collections update karni hon (stock reduce + order create):

```js
async function purchaseWithTransaction(userId, productId, quantity) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Stock atomically reduce karo
    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        stock: { $gte: quantity }
      },
      {
        $inc: { stock: -quantity }
      },
      { new: true, session }
    );

    if (!product) {
      throw new Error("Insufficient stock!");
    }

    // Step 2: Order create karo
    const order = await Order.create([{
      userId,
      productId,
      productName: product.name,
      quantity,
      unitPrice: product.price,
      totalAmount: product.price * quantity,
      status: "confirmed",
      createdAt: new Date()
    }], { session });

    // Step 3: User ki order history update
    await User.findByIdAndUpdate(userId, {
      $push: { orderIds: order[0]._id },
      $inc: { totalOrders: 1 }
    }, { session });

    // Sab successful - commit
    await session.commitTransaction();

    return {
      success: true,
      orderId: order[0]._id,
      remainingStock: product.stock
    };

  } catch (error) {
    // Kuch bhi fail - sab rollback
    await session.abortTransaction();

    if (error.message === "Insufficient stock!") {
      return { success: false, message: "Product out of stock!" };
    }
    throw error;

  } finally {
    session.endSession();
  }
}
```

### Solution 4: Flash Sale with Redis Queue (Production Grade)

Bahut high traffic ke liye MongoDB ke saath Redis use karo:

```js
const Redis = require("ioredis");
const redis = new Redis();

// Flash sale start hone se pehle stock Redis mein load karo
async function initFlashSale(productId, stock) {
  await redis.set(`flash:stock:${productId}`, stock);
  console.log(`Flash sale initialized: ${stock} units`);
}

// Purchase attempt
async function flashSalePurchase(userId, productId, quantity) {
  // Step 1: Redis mein atomically stock decrement (SUPER FAST)
  const remainingStock = await redis.decrby(`flash:stock:${productId}`, quantity);

  if (remainingStock < 0) {
    // Stock nahi hai - rollback Redis counter
    await redis.incrby(`flash:stock:${productId}`, quantity);
    return { success: false, message: "Sold out!" };
  }

  // Step 2: Redis mein reserve ho gaya, ab MongoDB mein order create karo
  try {
    const result = await purchaseWithTransaction(userId, productId, quantity);
    return result;
  } catch (error) {
    // MongoDB fail - Redis stock wapas karo
    await redis.incrby(`flash:stock:${productId}`, quantity);
    throw error;
  }
}
```

### Common Mistakes:
- **Read-then-write pattern use karna** bina atomic operations ke - classic race condition
- **Transactions har jagah use karna** - single document operations ke liye atomic update kaafi hai, transaction overkill hai
- **Retry logic nahi likhna** - optimistic concurrency mein retry zaroori hai
- **Stock validation sirf frontend pe karna** - backend pe bhi zaroori hai, frontend pe sirf UX ke liye karo
- **Session pass karna bhool jaana** transaction mein - bina session ke operations transaction ka hissa nahi hote


---


## Scenario 7: MongoDB Replica Set Failure

**Q: Tumhara production mein 3-node replica set hai (1 Primary + 2 Secondary). Primary node down ho gaya. Kya hoga application ke saath? Aur agar ek secondary bhi down ho jaaye?**

**Answer:**

Replica Set MongoDB ka high availability mechanism hai. Ye samajhna zaroori hai ki failure scenarios mein kya hota hai aur application ko kaise configure karna chahiye.

### Normal State: 3-Node Replica Set

```
+------------------+     +------------------+     +------------------+
|    PRIMARY       |     |   SECONDARY 1    |     |   SECONDARY 2    |
|   (Read/Write)   |<--->|   (Read only)    |<--->|   (Read only)    |
|   Node A         |     |   Node B         |     |   Node C         |
+------------------+     +------------------+     +------------------+
       |                        |                        |
       +--- Replication ------->+--- Replication -------->+
```

### Scenario A: Primary Down Ho Gaya

```
+------------------+     +------------------+     +------------------+
|    PRIMARY       |     |   SECONDARY 1    |     |   SECONDARY 2    |
|   Node A         |     |   Node B         |     |   Node C         |
|   [X] DOWN!      |     |   Voting...      |     |   Voting...      |
+------------------+     +------------------+     +------------------+
```

**Kya hota hai:**

1. **Election Process** shuru hota hai (~10-12 seconds)
2. Remaining secondaries **vote** karte hain
3. Ek secondary **new Primary** ban jaata hai
4. Application **automatically reconnect** ho jaata hai (driver handle karta hai)

```
+------------------+     +------------------+     +------------------+
|    OLD PRIMARY   |     |   NEW PRIMARY    |     |   SECONDARY      |
|   Node A         |     |   Node B         |     |   Node C         |
|   [X] DOWN       |     |   [Elected!]     |     |   [Active]       |
+------------------+     +------------------+     +------------------+
```

### Application side pe kya karna chahiye:

```js
// Connection string with replica set
const mongoose = require("mongoose");

// GOOD - Replica set aware connection
mongoose.connect("mongodb://nodeA:27017,nodeB:27017,nodeC:27017/mydb", {
  replicaSet: "myReplicaSet",
  retryWrites: true,         // Write failure pe auto retry
  retryReads: true,          // Read failure pe auto retry
  w: "majority",             // Write concern - majority nodes pe write ho
  readPreference: "primaryPreferred",  // Primary prefer karo, down ho toh secondary se padho
  serverSelectionTimeoutMS: 5000,      // 5 sec mein server nahi mila toh error
  heartbeatFrequencyMS: 10000          // Har 10 sec mein health check
});

mongoose.connection.on("connected", () => console.log("MongoDB connected"));
mongoose.connection.on("disconnected", () => console.log("MongoDB disconnected - will retry"));
mongoose.connection.on("error", (err) => console.error("MongoDB error:", err));
```

### Read Preferences explained:

```js
// Different read preferences
const Order = mongoose.model("Order", orderSchema);

// 1. primary - sirf primary se padho (default, strongly consistent)
Order.find({ status: "pending" }).read("primary");

// 2. primaryPreferred - primary try karo, down ho toh secondary
Order.find({ status: "pending" }).read("primaryPreferred");

// 3. secondary - sirf secondary se padho (slightly stale data possible)
// Analytics/reports ke liye use karo - primary ka load kam hoga
Order.find({ status: "delivered" }).read("secondary");

// 4. secondaryPreferred - secondary try karo, down ho toh primary
Order.find({ status: "delivered" }).read("secondaryPreferred");

// 5. nearest - sabse kam latency wale node se padho
Order.find({ status: "delivered" }).read("nearest");
```

### Write Concern options:

```js
// Write concern - kitne nodes pe write confirm hona chahiye
// w: 1 -> sirf primary pe write hona kaafi (fast but risky)
await Order.create(orderData, { w: 1 });

// w: "majority" -> majority nodes pe write confirm (safe, recommended)
await Order.create(orderData, { w: "majority" });

// w: "majority" + j: true -> majority + journaled (safest)
await Order.create(orderData, { w: "majority", j: true });
```

### Scenario B: Primary + 1 Secondary Down (2 out of 3 down)

```
+------------------+     +------------------+     +------------------+
|    PRIMARY       |     |   SECONDARY 1    |     |   SECONDARY 2    |
|   Node A         |     |   Node B         |     |   Node C         |
|   [X] DOWN       |     |   [X] DOWN       |     |   [ALIVE]        |
+------------------+     +------------------+     +------------------+
```

**Kya hota hai:**
- **Election NAHI ho sakta** - majority chahiye (2 out of 3), sirf 1 alive hai
- Surviving node **secondary hi rahega** - primary nahi ban sakta
- **WRITES BAND** ho jayenge completely
- **READS** sirf tab kaam karenge agar readPreference = "secondary" ya "secondaryPreferred"

```js
// Agar majority down ho jaaye - graceful degradation
mongoose.connect(uri, {
  readPreference: "secondaryPreferred",  // At least reads toh chalu rahein
  serverSelectionTimeoutMS: 5000
});

// Application mein handle karo
async function getOrders(userId) {
  try {
    return await Order.find({ userId }).read("secondaryPreferred");
  } catch (error) {
    if (error.name === "MongoServerSelectionError") {
      // Database completely down
      console.error("Database unavailable - serving from cache");
      return getCachedOrders(userId);  // Redis cache se serve karo
    }
    throw error;
  }
}

// Write operations ke liye retry with queue
async function createOrder(orderData) {
  try {
    return await Order.create(orderData);
  } catch (error) {
    if (error.message.includes("not primary") ||
        error.name === "MongoServerSelectionError") {
      // Queue mein daal do, baad mein process hoga
      await messageQueue.publish("pending-orders", orderData);
      return { status: "queued", message: "Order queued, will be processed shortly" };
    }
    throw error;
  }
}
```

### Replica Set Health Monitoring:

```js
// mongosh mein replica set status check karo
rs.status();
```

```json
{
  "set": "myReplicaSet",
  "members": [
    {
      "name": "nodeA:27017",
      "state": 1,
      "stateStr": "PRIMARY",
      "health": 1,
      "uptime": 864000
    },
    {
      "name": "nodeB:27017",
      "state": 2,
      "stateStr": "SECONDARY",
      "health": 1,
      "syncSourceHost": "nodeA:27017",
      "secondsBehindPrimary": 0
    },
    {
      "name": "nodeC:27017",
      "state": 2,
      "stateStr": "SECONDARY",
      "health": 1,
      "syncSourceHost": "nodeA:27017",
      "secondsBehindPrimary": 2
    }
  ]
}
```

### Common Mistakes:
- **Single node connection string dena** replica set ke bajaay - failover kaam nahi karega
- **Write concern w:0 use karna** production mein - data loss ho sakta hai
- **readPreference samajhna nahi** - analytics queries primary pe marke uska load badhana
- **Election time (~12 sec) handle nahi karna** - application mein retry logic zaroori hai
- **Replica lag monitor nahi karna** - secondary bahut peeche reh gaya toh stale data milega


---


## Scenario 8: Text Search vs Regex

**Q: Tumhare e-commerce app mein product search feature chahiye. User type karta hai "blue running shoes". Regex use karein ya Text Index? Kya difference hai aur kaunsa better hai?**

**Answer:**

Product search ek common requirement hai aur MongoDB mein multiple approaches hain. Har approach ka apna use case hai. Samajhte hain.

### Approach 1: $regex (Simple but Slow)

```js
// Regex search - basic approach
db.products.find({
  name: { $regex: "blue running shoes", $options: "i" }
});
// Ye "blue running shoes" exact substring dhundhega
// "blue running shoes for men" match karega
// "blue shoes for running" MATCH NAHI karega (order matter karta hai)

// Multiple words ko OR karna ho toh:
db.products.find({
  name: { $regex: "blue|running|shoes", $options: "i" }
});
// Ye "blue", "running", ya "shoes" mein se koi bhi match karega
// But relevance scoring NAHI milega - kaunsa result better hai pata nahi chalega
```

### Problem with Regex:

```js
// Regex ke saath explain dekho
db.products.find({ name: { $regex: "shoes", $options: "i" } }).explain("executionStats");
```

```json
{
  "executionStats": {
    "totalDocsExamined": 500000,
    "executionTimeMillis": 2300,
    "stage": "COLLSCAN"
  }
}
```

**COLLSCAN!** Regex (especially with `$options: "i"`) index use nahi kar pata (prefix regex chhodke). 5 lakh documents scan - bahut slow.

### Approach 2: Text Index (Better)

```js
// Step 1: Text index banao
db.products.createIndex({
  name: "text",
  description: "text",
  tags: "text"
}, {
  weights: {
    name: 10,          // Name match ko zyada priority
    tags: 5,           // Tags ko medium priority
    description: 1     // Description ko kam priority
  },
  name: "idx_product_search"
});

// Step 2: $text se search karo
db.products.find(
  { $text: { $search: "blue running shoes" } },
  { score: { $meta: "textScore" } }       // Relevance score bhi laao
).sort(
  { score: { $meta: "textScore" } }       // Best match pehle
).limit(20);
```

### Text Search kaise kaam karta hai:

```js
// "blue running shoes" automatically teen words mein split hota hai
// MongoDB dhundhta hai documents jismein "blue" OR "running" OR "shoes" ho
// Jo document mein zyada words match, uska score zyada

// Exact phrase search - quotes mein likho
db.products.find({
  $text: { $search: '"running shoes"' }  // exact phrase
});

// Kuch words include, kuch exclude
db.products.find({
  $text: { $search: 'running shoes -kids' }  // "kids" exclude karo
});

// Language specific stemming
db.products.find({
  $text: { $search: "running" }
  // Ye "run", "runs", "running" sab match karega!
});
```

### Mongoose Implementation:

```js
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  tags: [String],
  price: Number,
  category: String,
  brand: String
});

// Text index with weights
productSchema.index(
  { name: "text", description: "text", tags: "text" },
  { weights: { name: 10, tags: 5, description: 1 } }
);

const Product = mongoose.model("Product", productSchema);

// Search API
async function searchProducts(query, filters = {}) {
  const searchQuery = {
    $text: { $search: query }
  };

  // Additional filters add karo
  if (filters.category) searchQuery.category = filters.category;
  if (filters.minPrice || filters.maxPrice) {
    searchQuery.price = {};
    if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
    if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
  }

  const results = await Product.find(
    searchQuery,
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(20);

  return results;
}

// Route
app.get("/api/products/search", async (req, res) => {
  const { q, category, minPrice, maxPrice } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Search query too short" });
  }

  const results = await searchProducts(q, { category, minPrice, maxPrice });
  res.json({ results, count: results.length });
});
```

### Approach 3: Atlas Search (Production Grade)

Agar advanced search chahiye (fuzzy matching, autocomplete, facets) toh Atlas Search best hai:

```js
// Atlas Search index definition (Atlas UI mein ya API se create karo)
// Collection: products
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "description": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "category": {
        "type": "stringFacet"
      },
      "price": {
        "type": "number"
      }
    }
  }
}

// Aggregation pipeline mein $search use karo
const results = await Product.aggregate([
  {
    $search: {
      index: "product_search",  // Atlas Search index name
      compound: {
        should: [
          {
            text: {
              query: "blue running shoes",
              path: "name",
              score: { boost: { value: 5 } },  // Name match ko boost
              fuzzy: { maxEdits: 1 }            // Typo tolerance!
            }
          },
          {
            text: {
              query: "blue running shoes",
              path: "description",
              fuzzy: { maxEdits: 1 }
            }
          }
        ]
      },
      highlight: {
        path: ["name", "description"]  // Matched text highlight karo
      }
    }
  },
  {
    $project: {
      name: 1,
      price: 1,
      category: 1,
      score: { $meta: "searchScore" },
      highlights: { $meta: "searchHighlights" }
    }
  },
  { $limit: 20 }
]);
```

### Comparison Table:

| Feature | $regex | $text | Atlas Search |
|---------|--------|-------|-------------|
| Setup | None | Create text index | Atlas required |
| Speed (500K docs) | ~2-3 sec | ~50ms | ~20ms |
| Relevance scoring | No | Basic | Advanced |
| Fuzzy matching | Manual regex | No | Yes |
| Autocomplete | No | No | Yes |
| Faceted search | No | No | Yes |
| Stemming | No | Yes | Yes |
| Highlighting | No | No | Yes |
| Index use | No (mostly) | Yes | Yes |

### Common Mistakes:
- **Production mein $regex use karna** large collections pe - bahut slow hai
- **Ek collection mein ek hi text index** ho sakta hai - ye limit yaad rakho
- **Text index ke weights tune nahi karna** - default mein sab equal hota hai
- **$text aur $regex ek saath use karna** - ek query mein dono nahi chalte
- **Partial word search expect karna** $text se - "sho" se "shoes" nahi milega, Atlas Search ka autocomplete chahiye


---


## Scenario 9: TTL Index for Auto Expiry

**Q: Tumhare app mein OTP verification hai. Har OTP 5 minute baad automatically delete hona chahiye. Kaise karoge? Manual cron job lagayoge ya koi better way hai?**

**Answer:**

MongoDB mein **TTL (Time-To-Live) Index** hai jo automatically documents expire kar deta hai specified time ke baad. Cron job ki zaroorat nahi!

### TTL Index kya hai:

TTL Index ek special index hota hai jo ek date field pe banta hai. MongoDB ka background thread regularly check karta hai aur expired documents automatically delete kar deta hai.

### Basic Implementation:

```js
// mongosh mein
// Step 1: OTPs collection pe TTL index banao
db.otps.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 300 }  // 300 seconds = 5 minutes
);

// Step 2: OTP document insert karo
db.otps.insertOne({
  phone: "+91-9876543210",
  otp: "456789",
  purpose: "login",
  createdAt: new Date()  // Ye field pe TTL kaam karega
});

// 5 minutes baad ye document AUTOMATICALLY delete ho jayega!
```

### Mongoose Implementation:

```js
const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ["login", "signup", "reset-password", "verify-email"],
    default: "login"
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3  // Max 3 wrong attempts
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL Index - 5 min baad auto delete
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

// Ek user ka ek hi OTP active rahe
otpSchema.index({ phone: 1, purpose: 1 }, { unique: true });

const OTP = mongoose.model("OTP", otpSchema);
```

### Complete OTP Flow:

```js
const crypto = require("crypto");

// OTP Generate karo
async function generateOTP(phone, purpose = "login") {
  // 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Hash OTP before storing (security best practice)
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  // Upsert - agar puraana OTP hai toh replace karo
  await OTP.findOneAndUpdate(
    { phone, purpose },
    {
      otp: hashedOtp,
      attempts: 0,
      createdAt: new Date()  // Reset TTL timer
    },
    { upsert: true, new: true }
  );

  // OTP bhejo (SMS/Email service)
  await sendSMS(phone, `Your OTP is: ${otp}. Valid for 5 minutes.`);

  return { success: true, message: "OTP sent successfully" };
}

// OTP Verify karo
async function verifyOTP(phone, userOtp, purpose = "login") {
  const hashedOtp = crypto.createHash("sha256").update(userOtp).digest("hex");

  const otpDoc = await OTP.findOne({ phone, purpose });

  // Check 1: OTP exists? (ya expire ho gaya)
  if (!otpDoc) {
    return { success: false, message: "OTP expired ya invalid. Naya OTP request karo." };
  }

  // Check 2: Too many attempts?
  if (otpDoc.attempts >= 3) {
    // Delete this OTP - user ko naya request karna padega
    await OTP.deleteOne({ _id: otpDoc._id });
    return { success: false, message: "Too many wrong attempts. Naya OTP request karo." };
  }

  // Check 3: OTP match?
  if (otpDoc.otp !== hashedOtp) {
    // Increment attempt counter
    await OTP.updateOne({ _id: otpDoc._id }, { $inc: { attempts: 1 } });
    return {
      success: false,
      message: `Wrong OTP. ${2 - otpDoc.attempts} attempts remaining.`
    };
  }

  // Success! OTP delete karo
  await OTP.deleteOne({ _id: otpDoc._id });
  return { success: true, message: "OTP verified successfully!" };
}

// Routes
app.post("/api/otp/send", async (req, res) => {
  const { phone, purpose } = req.body;
  const result = await generateOTP(phone, purpose);
  res.json(result);
});

app.post("/api/otp/verify", async (req, res) => {
  const { phone, otp, purpose } = req.body;
  const result = await verifyOTP(phone, otp, purpose);
  res.status(result.success ? 200 : 400).json(result);
});
```

### Other TTL Use Cases:

```js
// 1. Session Management - 24 hours expiry
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  token: String,
  deviceInfo: String,
  createdAt: { type: Date, default: Date.now }
});
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24 hours

// 2. Password Reset Tokens - 1 hour expiry
const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  token: String,
  createdAt: { type: Date, default: Date.now }
});
resetTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // 1 hour

// 3. Temporary Upload Links - 15 min expiry
const tempUploadSchema = new mongoose.Schema({
  uploadUrl: String,
  fileKey: String,
  createdAt: { type: Date, default: Date.now }
});
tempUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 }); // 15 min

// 4. Rate Limiting - 1 min window
const rateLimitSchema = new mongoose.Schema({
  ip: String,
  endpoint: String,
  count: { type: Number, default: 1 },
  windowStart: { type: Date, default: Date.now }
});
rateLimitSchema.index({ windowStart: 1 }, { expireAfterSeconds: 60 }); // 1 min window
```

### Custom Expiry per Document (expireAt Pattern):

```js
// Har document ka apna expiry time ho sakta hai
const notificationSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  message: String,
  type: String,
  expireAt: { type: Date, required: true }  // Custom expiry per document
});

// expireAfterSeconds: 0 matlab expireAt field ki exact date pe expire hoga
notificationSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// Ab har notification ka alag expiry time set karo
await Notification.create({
  userId: "user01",
  message: "Flash sale in 2 hours!",
  type: "promo",
  expireAt: new Date(Date.now() + 2 * 60 * 60 * 1000)  // 2 hours baad expire
});

await Notification.create({
  userId: "user02",
  message: "Your order shipped!",
  type: "order",
  expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days baad expire
});
```

### Common Mistakes:
- **TTL field Date type nahi hona** - TTL sirf Date fields pe kaam karta hai, String/Number pe nahi
- **Exact time pe delete expect karna** - MongoDB ka background thread har ~60 seconds mein run hota hai, thoda delay ho sakta hai
- **Existing index pe TTL add karna** - pehle purana index drop karna padega, directly modify nahi hota
- **TTL aur compound index mix karna** - TTL index sirf single field pe kaam karta hai
- **OTP plain text store karna** - hamesha hash karke store karo security ke liye


---


## Scenario 10: Pagination at Scale

**Q: Tumhari app mein 10 million documents hain. Pagination implement ki hai `skip()` + `limit()` se. Pehle kuch pages fast hain but page 5000 pe bahut slow ho gaya. Kaise fix karoge?**

**Answer:**

`skip()` MongoDB mein internally documents count karke skip karta hai - page 5000 pe 50,000 documents scan karke skip karega. Ye O(n) operation hai aur bahut slow hota hai large offsets pe.

### Problem: skip() Slow Hai

```js
// Page 1 - Fast (skip 0 documents)
db.posts.find().sort({ createdAt: -1 }).skip(0).limit(10);
// Time: ~5ms

// Page 100 - Slow-ish (skip 990 documents)
db.posts.find().sort({ createdAt: -1 }).skip(990).limit(10);
// Time: ~100ms

// Page 5000 - VERY SLOW (skip 49,990 documents!)
db.posts.find().sort({ createdAt: -1 }).skip(49990).limit(10);
// Time: ~4500ms - MongoDB ko 49,990 documents scan karke skip karne padte hain!
```

```js
// Explain se dekhte hain
db.posts.find().sort({ createdAt: -1 }).skip(49990).limit(10).explain("executionStats");
```

```json
{
  "executionStats": {
    "totalDocsExamined": 50000,
    "nReturned": 10,
    "executionTimeMillis": 4500
  }
}
```

50,000 documents examine kiye sirf 10 return karne ke liye!

### Solution 1: Cursor-Based Pagination (Recommended)

Skip ke bajaay, **last document ka cursor** (usually `_id` ya sorted field) use karo:

```js
// Concept: "Is document ke BAAD wale documents do"
// Instead of: "49,990 skip karke 10 do"

// Page 1 - Normal
const page1 = await db.posts
  .find()
  .sort({ createdAt: -1 })
  .limit(10);

// Last document ka createdAt note karo
const lastDoc = page1[page1.length - 1];
// lastDoc.createdAt = ISODate("2025-03-15T10:30:00Z")
// lastDoc._id = ObjectId("abc123")

// Page 2 - Cursor use karo (NO SKIP!)
const page2 = await db.posts
  .find({
    $or: [
      { createdAt: { $lt: lastDoc.createdAt } },
      {
        createdAt: lastDoc.createdAt,
        _id: { $lt: lastDoc._id }  // Same timestamp ke liye tiebreaker
      }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(10);
// Time: ~5ms - HAR page pe constant time!
```

### Mongoose Implementation:

```js
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Index zaroori hai cursor pagination ke liye
postSchema.index({ createdAt: -1, _id: -1 });

const Post = mongoose.model("Post", postSchema);

// Cursor-based pagination function
async function getPosts({ cursor, limit = 10, direction = "next" }) {
  const query = {};
  const pageLimit = Math.min(limit, 50); // Max 50 per page

  if (cursor) {
    // Cursor decode karo (base64 encoded hai)
    const { createdAt, id } = JSON.parse(
      Buffer.from(cursor, "base64").toString("utf-8")
    );

    if (direction === "next") {
      // Next page - older posts
      query.$or = [
        { createdAt: { $lt: new Date(createdAt) } },
        { createdAt: new Date(createdAt), _id: { $lt: id } }
      ];
    } else {
      // Previous page - newer posts
      query.$or = [
        { createdAt: { $gt: new Date(createdAt) } },
        { createdAt: new Date(createdAt), _id: { $gt: id } }
      ];
    }
  }

  // 1 extra fetch to check if more pages exist
  const posts = await Post.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageLimit + 1)
    .lean();

  const hasMore = posts.length > pageLimit;
  if (hasMore) posts.pop(); // Extra document remove karo

  // Cursors generate karo
  const nextCursor = posts.length > 0
    ? Buffer.from(JSON.stringify({
        createdAt: posts[posts.length - 1].createdAt,
        id: posts[posts.length - 1]._id
      })).toString("base64")
    : null;

  const prevCursor = posts.length > 0
    ? Buffer.from(JSON.stringify({
        createdAt: posts[0].createdAt,
        id: posts[0]._id
      })).toString("base64")
    : null;

  return {
    data: posts,
    pagination: {
      hasNextPage: hasMore,
      nextCursor: hasMore ? nextCursor : null,
      prevCursor: cursor ? prevCursor : null
    }
  };
}

// API Route
app.get("/api/posts", async (req, res) => {
  const { cursor, limit, direction } = req.query;

  const result = await getPosts({
    cursor,
    limit: parseInt(limit) || 10,
    direction: direction || "next"
  });

  res.json(result);
});
```

### API Response:

```json
{
  "data": [
    { "_id": "post100", "title": "Post 100", "createdAt": "2025-03-15T10:00:00Z" },
    { "_id": "post99", "title": "Post 99", "createdAt": "2025-03-15T09:00:00Z" }
  ],
  "pagination": {
    "hasNextPage": true,
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTAzLTE1VDA5OjAwIiwiaWQiOiJwb3N0OTkifQ==",
    "prevCursor": "eyJjcmVhdGVkQXQiOiIyMDI1LTAzLTE1VDEwOjAwIiwiaWQiOiJwb3N0MTAwIn0="
  }
}
```

### Frontend Usage:

```js
// React component - infinite scroll
function PostFeed() {
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    const url = nextCursor
      ? `/api/posts?cursor=${nextCursor}&limit=10`
      : `/api/posts?limit=10`;

    const res = await fetch(url);
    const data = await res.json();

    setPosts(prev => [...prev, ...data.data]);
    setNextCursor(data.pagination.nextCursor);
    setLoading(false);
  };

  return (
    <div>
      {posts.map(post => <PostCard key={post._id} post={post} />)}
      {nextCursor && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

### Solution 2: Hybrid (Offset for Small Pages, Cursor for Large)

```js
// Agar page number bhi chahiye (UI requirement)
async function getPostsHybrid({ page = 1, limit = 10, cursor }) {
  const pageLimit = Math.min(limit, 50);

  // Page 100 tak offset fine hai
  if (!cursor && page <= 100) {
    const skip = (page - 1) * pageLimit;
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit + 1)
      .lean();

    const hasMore = posts.length > pageLimit;
    if (hasMore) posts.pop();

    return {
      data: posts,
      page,
      hasNextPage: hasMore
    };
  }

  // Page 100+ ke liye cursor-based use karo
  return getPosts({ cursor, limit: pageLimit });
}
```

### Performance Comparison:

| Page | skip() + limit() | Cursor-based |
|------|-------------------|--------------|
| 1 | ~5ms | ~5ms |
| 100 | ~100ms | ~5ms |
| 1000 | ~800ms | ~5ms |
| 5000 | ~4500ms | ~5ms |
| 10000 | ~9000ms | ~5ms |

Cursor-based pagination **O(1)** hai - har page same speed se aata hai!

### Common Mistakes:
- **skip() ko large datasets pe use karna** - linear degradation hota hai
- **Cursor mein sirf _id use karna** sort field ke bina - wrong order aayega
- **Tiebreaker field bhool jaana** - same timestamp wale documents miss ho sakte hain
- **Total count query har request pe marna** - `countDocuments()` bhi slow hota hai 10M docs pe, cache karo
- **Cursor ko plain text mein expose karna** - base64 encode karo at minimum


---


## Scenario 11: Mongoose Virtuals vs Stored Fields

**Q: User ka full name chahiye jo firstName + lastName se banta hai. Database mein ek alag `fullName` field store karein ya runtime pe compute karein? Mongoose mein kaise karoge?**

**Answer:**

Ye ek common design decision hai - store karna ya compute karna. Mongoose mein **Virtual Fields** iska elegant solution hai. Lekin kab virtual use karein aur kab store karein, ye samajhna zaroori hai.

### Option A: Virtual Field (Computed at Runtime)

```js
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  dateOfBirth: Date
});

// Virtual field - database mein store nahi hota
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Setter bhi define kar sakte ho
userSchema.virtual("fullName").set(function (fullName) {
  const parts = fullName.split(" ");
  this.firstName = parts[0];
  this.lastName = parts.slice(1).join(" ");
});

// Age virtual - date of birth se calculate
userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

// IMPORTANT: Virtuals by default JSON mein nahi aate
// Ye settings enable karo:
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

const User = mongoose.model("User", userSchema);
```

### Usage:

```js
const user = await User.create({
  firstName: "Rahul",
  lastName: "Sharma",
  email: "rahul@email.com",
  dateOfBirth: new Date("1995-06-15")
});

console.log(user.fullName);  // "Rahul Sharma"
console.log(user.age);       // 30 (computed from DOB)

// Setter use karo
user.fullName = "Amit Kumar Verma";
console.log(user.firstName);  // "Amit"
console.log(user.lastName);   // "Kumar Verma"

// API response mein virtuals aayenge
res.json(user);
// {
//   "_id": "...",
//   "firstName": "Rahul",
//   "lastName": "Sharma",
//   "email": "rahul@email.com",
//   "fullName": "Rahul Sharma",   <-- virtual
//   "age": 30                      <-- virtual
// }
```

### Option B: Stored Field (Pre-computed)

Kab store karna chahiye? Jab us field pe **query, sort, ya index** karna ho:

```js
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  fullName: { type: String, index: true },  // Stored + Indexed
  email: { type: String, required: true, unique: true }
});

// Pre-save hook se auto-generate karo
userSchema.pre("save", function (next) {
  if (this.isModified("firstName") || this.isModified("lastName")) {
    this.fullName = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// findOneAndUpdate ke liye bhi handle karo
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.firstName || update.lastName || update.$set?.firstName || update.$set?.lastName) {
    const firstName = update.firstName || update.$set?.firstName;
    const lastName = update.lastName || update.$set?.lastName;
    if (firstName && lastName) {
      this.set({ fullName: `${firstName} ${lastName}` });
    }
  }
  next();
});
```

### Virtual Populate - References ke liye:

```js
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String
});

// Virtual populate - User ke orders (stored nahi, runtime pe fetch)
userSchema.virtual("orders", {
  ref: "Order",           // Order model se
  localField: "_id",      // User._id
  foreignField: "userId", // Order.userId se match
  options: {
    sort: { createdAt: -1 },
    limit: 10
  }
});

// Virtual populate - post count
userSchema.virtual("postCount", {
  ref: "Post",
  localField: "_id",
  foreignField: "author",
  count: true  // Sirf count chahiye, documents nahi
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

// Usage mein populate karna padega
const user = await User.findById(userId)
  .populate("orders")      // orders virtual populate
  .populate("postCount");  // postCount virtual

console.log(user.orders);     // [{ orderId: ..., amount: ... }, ...]
console.log(user.postCount);  // 42
```

### Transform - Response Customize karo:

```js
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  role: { type: String, default: "user" },
  loginAttempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// toJSON transform - sensitive fields remove karo, virtuals add karo
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    // Sensitive fields remove
    delete ret.password;
    delete ret.loginAttempts;
    delete ret.__v;

    // _id ko id bana do
    ret.id = ret._id;
    delete ret._id;

    return ret;
  }
});

// Ab API response clean hoga:
// {
//   "id": "abc123",
//   "firstName": "Rahul",
//   "lastName": "Sharma",
//   "fullName": "Rahul Sharma",    <-- virtual added
//   "email": "rahul@email.com",
//   "role": "user",
//   "createdAt": "2025-01-15T..."
//   // password, loginAttempts, __v REMOVED
// }
```

### Decision Guide:

| Criteria | Virtual (Compute) | Stored Field |
|----------|-------------------|--------------|
| Query/filter by this field? | No | Yes |
| Sort by this field? | No | Yes |
| Index needed? | No | Yes |
| Derived from other fields? | Yes | Yes (with hooks) |
| Always up-to-date? | Yes (always) | Needs sync |
| Performance (read heavy) | CPU cost per read | Disk cost per write |
| Text search needed? | No | Yes |

### Common Mistakes:
- **Virtual pe query karna** - `User.find({ fullName: "Rahul Sharma" })` kaam nahi karega, virtual database mein exist nahi karta
- **toJSON/toObject mein virtuals enable nahi karna** - API response mein virtual fields nahi aayenge
- **Arrow function use karna** virtual getter mein - `this` kaam nahi karega, regular function use karo
- **Stored field ko sync mein nahi rakhna** - firstName update hua but fullName nahi, inconsistency
- **Heavy computation virtual mein rakhna** - har read pe run hoga, agar expensive hai toh store karo


---


## Scenario 12: Backup and Disaster Recovery

**Q: Kisi ne galti se production database ka critical collection drop kar diya ya saara data delete kar diya. Kaise recover karoge? Aur future mein aisa dobara na ho, kya precautions loge?**

**Answer:**

Data loss production mein nightmare hai. Recovery possible hai lekin **pehle se backup strategy** honi chahiye. Samajhte hain recovery approaches aur prevention strategies.

### Immediate Response: Kya karna hai jab data delete ho jaaye

```
1. PANIC MAT KARO - sochke action lo
2. Application ko READ-ONLY mode mein daalo (aur writes band karo)
3. Assess karo - kya delete hua, kab hua, kitna data affected hai
4. Recovery approach decide karo based on available backups
```

### Recovery Approach 1: mongodump / mongorestore

Agar regular backups le rahe the (humein lena chahiye tha!):

```bash
# Backup lena (ye pehle se scheduled hona chahiye)
# Full database backup
mongodump --uri="mongodb://user:password@host:27017/mydb" \
  --out=/backups/$(date +%Y%m%d_%H%M%S) \
  --gzip

# Specific collection backup
mongodump --uri="mongodb://user:password@host:27017/mydb" \
  --collection=orders \
  --out=/backups/orders_backup \
  --gzip

# Restore karo jab zaroorat ho
# Full database restore
mongorestore --uri="mongodb://user:password@host:27017/mydb" \
  --gzip \
  --drop \
  /backups/20250315_120000/

# Specific collection restore
mongorestore --uri="mongodb://user:password@host:27017/mydb" \
  --collection=orders \
  --gzip \
  /backups/orders_backup/mydb/orders.bson.gz

# Alag database mein restore karke verify karo (safer)
mongorestore --uri="mongodb://user:password@host:27017/mydb_recovery" \
  --gzip \
  /backups/20250315_120000/
```

### Automated Backup Script:

```js
// backup-script.js - Cron job se daily run karo
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const BACKUP_CONFIG = {
  uri: process.env.MONGO_URI,
  backupDir: "/backups/mongodb",
  retainDays: 30,  // 30 din purane backups delete karo
  databases: ["mydb"]
};

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_CONFIG.backupDir, timestamp);

  console.log(`Starting backup: ${timestamp}`);

  return new Promise((resolve, reject) => {
    const cmd = `mongodump --uri="${BACKUP_CONFIG.uri}" --out="${backupPath}" --gzip`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error("Backup failed:", error.message);
        // Alert bhejo - Slack/Email
        sendAlert(`MongoDB Backup FAILED: ${error.message}`);
        reject(error);
        return;
      }

      console.log("Backup successful:", backupPath);
      // Backup size check
      const size = getDirectorySize(backupPath);
      console.log(`Backup size: ${(size / 1024 / 1024).toFixed(2)} MB`);

      resolve(backupPath);
    });
  });
}

function cleanOldBackups() {
  const backupDir = BACKUP_CONFIG.backupDir;
  const retainMs = BACKUP_CONFIG.retainDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const dirs = fs.readdirSync(backupDir);
  dirs.forEach(dir => {
    const dirPath = path.join(backupDir, dir);
    const stat = fs.statSync(dirPath);
    if (now - stat.mtimeMs > retainMs) {
      fs.rmSync(dirPath, { recursive: true });
      console.log(`Deleted old backup: ${dir}`);
    }
  });
}

// Run
(async () => {
  await createBackup();
  cleanOldBackups();
})();
```

```bash
# Cron job setup (daily 2 AM)
# crontab -e
0 2 * * * /usr/bin/node /scripts/backup-script.js >> /var/log/mongo-backup.log 2>&1
```

### Recovery Approach 2: Point-in-Time Recovery (Oplog)

Replica set mein oplog har operation record karta hai. Isse specific point tak recover kar sakte ho:

```bash
# Step 1: Latest backup restore karo
mongorestore --uri="mongodb://host:27017/mydb" \
  --gzip /backups/20250315_020000/

# Step 2: Oplog replay karo - specific timestamp tak
# (Jab tak data sahi tha, us timestamp tak)
mongorestore --uri="mongodb://host:27017/mydb" \
  --oplogReplay \
  --oplogLimit="1678886400:1" \
  /backups/oplog/
```

```js
// Oplog check karo - kab kya hua
// mongosh mein
use local;
db.oplog.rs.find({
  ns: "mydb.orders",
  op: "d",  // delete operations
  ts: { $gte: Timestamp(1678886000, 1) }
}).sort({ ts: -1 }).limit(5);

// Ye dikhayega kab delete hua
// {
//   "ts": Timestamp(1678886345, 1),
//   "op": "d",                          // d = delete
//   "ns": "mydb.orders",
//   "o": { "_id": ObjectId("...") }     // deleted document
// }
```

### Recovery Approach 3: MongoDB Atlas Backup (Cloud)

Atlas use kar rahe ho toh backup built-in hai:

```bash
# Atlas CLI se restore
# Continuous backup se point-in-time restore
atlas backups restores start pointInTime \
  --clusterName myCluster \
  --pointInTimeUTCSeconds 1678886000 \
  --targetClusterName myCluster-recovery \
  --targetProjectId <project-id>

# Snapshot se restore
atlas backups restores start automated \
  --clusterName myCluster \
  --snapshotId <snapshot-id> \
  --targetClusterName myCluster-recovery \
  --targetProjectId <project-id>
```

### Prevention Strategies:

#### 1. Access Control (RBAC)

```js
// mongosh mein
// Read-only user banao developers ke liye
db.createUser({
  user: "developer",
  pwd: "securePassword",
  roles: [
    { role: "read", db: "mydb" }  // Sirf read, write nahi
  ]
});

// Application user - specific permissions
db.createUser({
  user: "app_user",
  pwd: "appSecurePassword",
  roles: [
    { role: "readWrite", db: "mydb" }  // Read + Write, but not admin
    // drop, createIndex etc nahi kar sakta
  ]
});

// Admin - sirf trusted people
db.createUser({
  user: "admin",
  pwd: "superSecurePassword",
  roles: [
    { role: "dbAdmin", db: "mydb" }
  ]
});
```

#### 2. Soft Delete Pattern

```js
// HARD delete mat karo - soft delete use karo
const orderSchema = new mongoose.Schema({
  // ... other fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
});

// Middleware - queries mein automatically deleted filter karo
orderSchema.pre(/^find/, function (next) {
  // Agar explicitly deleted documents maange nahi toh filter karo
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

// Soft delete method
orderSchema.methods.softDelete = async function (deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  return this.save();
};

// Restore method
orderSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  return this.save();
};

// Usage
// Delete
await order.softDelete(adminUserId);

// Restore
await order.restore();

// Deleted documents dekhne ke liye explicitly query karo
const deletedOrders = await Order.find({ isDeleted: true });
```

#### 3. Audit Logging

```js
// Har important operation log karo
const auditLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["create", "update", "delete", "drop"], required: true },
  collection: { type: String, required: true },
  documentId: mongoose.Schema.Types.ObjectId,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  previousData: mongoose.Schema.Types.Mixed,  // Purana data rakho
  newData: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ collection: 1, documentId: 1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

// Middleware - automatic audit logging
function addAuditHooks(schema, collectionName) {
  // Delete pe purana data save karo
  schema.pre("findOneAndDelete", async function (next) {
    const doc = await this.model.findOne(this.getQuery());
    this._deletedDoc = doc;
    next();
  });

  schema.post("findOneAndDelete", async function (doc) {
    await AuditLog.create({
      action: "delete",
      collection: collectionName,
      documentId: doc._id,
      previousData: this._deletedDoc?.toObject(),
      userId: this.getOptions().userId  // Pass userId in options
    });
  });
}

// Usage
addAuditHooks(orderSchema, "orders");

// Delete ke saath userId pass karo
await Order.findOneAndDelete(
  { _id: orderId },
  { userId: req.user._id }  // Audit ke liye
);
```

#### 4. Drop Protection

```js
// Application level pe drop operation block karo
mongoose.connection.on("open", () => {
  const originalDrop = mongoose.connection.db.dropCollection;

  // Override dropCollection
  mongoose.connection.db.dropCollection = async function (name) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `BLOCKED: Cannot drop collection "${name}" in production! ` +
        `Use admin console with proper authorization.`
      );
    }
    return originalDrop.call(this, name);
  };
});
```

### Backup Strategy Summary:

```
Daily:    Full mongodump (gzip compressed)
Hourly:   Oplog backup (incremental)
Realtime: Replica set (automatic replication)

Retention:
- Daily backups: 30 days
- Weekly backups: 6 months
- Monthly backups: 2 years

Testing:
- Monthly restore drill (backup kaam karta hai ya nahi)
- Document recovery procedure
```

### Common Mistakes:
- **Backup lena hi bhool jaana** - sabse bada mistake, automated backup setup karo DAY 1 pe
- **Backup verify nahi karna** - backup corrupt bhi ho sakta hai, monthly restore test karo
- **Production mein everyone ko admin access dena** - principle of least privilege follow karo
- **Hard delete use karna** - soft delete se recovery aasan hoti hai
- **Backup aur database same server pe rakhna** - server crash hua toh backup bhi gaya, offsite/cloud backup rakho
- **Oplog size small rakhna** - oplog chota hai toh point-in-time recovery window bhi chhota hoga


---


*Total: 12 MongoDB Scenario Questions*

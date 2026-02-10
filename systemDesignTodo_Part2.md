=====================================
SYSTEM DESIGN LEARNING ROADMAP - PART 2
(REVISED & COMPLETE EDITION)
=====================================

This builds on top of Part 1 (systemDesignTodo.txt).
Adds: Missing topics, estimation skills, interview framework,
practice problems, mock interview strategy, and extra resources.

PROJECT: Same Real-Time Chat Application with Distributed Architecture
Tech Stack: MERN + Redis + Nginx + RabbitMQ/Kafka (optional)

=====================================
TIMELINE: 12 WEEKS (Realistic)
=====================================

Week 1-2  : Fundamentals + Estimation + Basic App
Week 3    : Scaling + Load Balancing + CDN
Week 4    : Data Layer (Caching + DB Scaling)
Week 5    : Communication Patterns + Async
Week 6    : Security + Reliability + Monitoring
Week 7-10 : Practice 10 System Design Problems
Week 11-12: Mock Interviews + Polish + Documentation

=====================================
PHASE 1: FUNDAMENTALS + ESTIMATION (Week 1-2)
=====================================

NEW - Topics Missing from Part 1:
---------------------------------
- How the Internet Works (DNS, IP, TCP/IP)
- HTTP/HTTPS, TCP vs UDP (move from Phase 6 to here)
- REST API Design Principles (move from Phase 6 to here)
- Domain Name System (DNS) Resolution
- Back-of-the-Envelope Estimation (CRITICAL - see below)

Back-of-Envelope Estimation (MUST LEARN):
------------------------------------------
This is asked in EVERY system design interview. Practice these:

  1. Traffic Estimation
     - DAU (Daily Active Users) -> QPS (Queries Per Second)
     - Formula: QPS = DAU x (avg queries per user) / 86400
     - Peak QPS = QPS x 2 (or 3 for spiky traffic)

  2. Storage Estimation
     - Per message size (e.g., 100 bytes text + metadata)
     - Messages per day x 365 days x 5 years = total storage
     - Example: 10M users x 40 msgs/day x 100 bytes = 40GB/day

  3. Bandwidth Estimation
     - Incoming: data written per second
     - Outgoing: data read per second (usually higher)

  4. Memory/Cache Estimation
     - 80/20 rule: cache 20% of daily traffic
     - Example: 40GB/day x 0.2 = 8GB cache needed

  Practice Problems:
  - Estimate storage for WhatsApp (1B users, 100 msgs/day)
  - Estimate QPS for Twitter (500M users, 10 tweets/day)
  - Estimate bandwidth for YouTube (1B videos watched/day)

Interview Framework (RESHADED):
-------------------------------
Use this structure in EVERY system design interview:

  R - Requirements (Functional + Non-Functional)
  E - Estimation (Traffic, Storage, Bandwidth, Memory)
  S - Storage Schema (Database design)
  H - High-Level Design (Draw the architecture diagram)
  A - API Design (Define endpoints)
  D - Detailed Design (Deep dive into components)
  E - Evaluate (Bottlenecks, trade-offs, scaling)
  D - Distinctive (What makes your design unique)

  Time split in 45 min interview:
  - Requirements & Estimation: 5-7 min
  - High-Level Design: 10-15 min
  - Detailed Design: 15-20 min
  - Trade-offs & Scaling: 5-10 min

Project Step (same as Part 1):
------------------------------
>> Create basic MERN chat app (single server)
   - User login/registration
   - Send/receive messages (Socket.io)
   - MongoDB for storage
   - Basic Express API

=====================================
PHASE 2: SCALING LAYER (Week 3)
=====================================

NEW - Topics Missing from Part 1:
---------------------------------
- Consistent Hashing
    - Why simple modulo hashing fails when servers change
    - Hash ring concept
    - Virtual nodes for even distribution
    - Used in: DB sharding, Load balancing, CDNs

- CDN (Content Delivery Network)
    - Push CDN vs Pull CDN
    - Edge servers & PoPs (Points of Presence)
    - Cache-Control headers
    - When to use: static assets, images, videos, JS/CSS bundles

- DNS Load Balancing
    - Round-robin DNS
    - GeoDNS (route by location)

Existing Topics from Part 1:
----------------------------
- Load Balancing (Round Robin, Least Connections, IP Hash)
- Reverse Proxy vs Forward Proxy
- Sticky Sessions
- Health Checks
- Redundancy & Replication

Project Step:
-------------
>> Add Nginx Load Balancer
   - Run 3 Node.js instances (ports: 3001, 3002, 3003)
   - Configure Nginx to distribute traffic
   - Test load distribution
   - Handle WebSocket sticky sessions
   - NEW: Implement consistent hashing concept in code

=====================================
PHASE 3: DATA LAYER (Week 4)
=====================================

NEW - Topics Missing from Part 1:
---------------------------------
- SQL vs NoSQL - When to Use What (Interview Favorite!)
    | Factor       | SQL (PostgreSQL)       | NoSQL (MongoDB)        |
    |-------------|------------------------|------------------------|
    | Schema      | Fixed, structured      | Flexible, dynamic      |
    | Joins       | Efficient              | Expensive/manual       |
    | Scaling     | Vertical (mostly)      | Horizontal (easy)      |
    | ACID        | Strong                 | Eventual consistency   |
    | Best For    | Transactions, banking  | Social, real-time      |

- Blob/Object Storage (S3-like)
    - When to use: images, videos, files, backups
    - Never store blobs in your database
    - Pre-signed URLs for secure access

- Database Partitioning Strategies
    - Horizontal Partitioning (Sharding)
    - Vertical Partitioning
    - Directory-based Partitioning

Existing Topics (Caching + DB from Part 1):
-------------------------------------------
- Caching: LRU, LFU, Write-Through, Write-Back
- Cache Invalidation strategies
- Distributed Caching
- Database Indexing (B-Tree, Hash)
- Normalization vs Denormalization
- Database Replication (Master-Slave, Master-Master)
- Database Sharding

Project Step:
-------------
>> Add Redis + Optimize MongoDB
   - Store sessions in Redis
   - Cache recent messages
   - Create proper indexes
   - Setup MongoDB replica set locally
   - NEW: Document SQL vs NoSQL decision for chat app

=====================================
PHASE 4: COMMUNICATION & ASYNC (Week 5)
=====================================

NEW - Topics Missing from Part 1:
---------------------------------
- Event-Driven Architecture
    - Event Sourcing
    - CQRS (Command Query Responsibility Segregation)

- Kafka vs RabbitMQ Trade-offs
    | Factor      | RabbitMQ             | Kafka                  |
    |------------|----------------------|------------------------|
    | Model      | Message Queue        | Event Streaming        |
    | Ordering   | Per-queue            | Per-partition           |
    | Throughput | Moderate             | Very High              |
    | Best For   | Task queues          | Event streaming, logs  |

- gRPC (basics)
    - When REST is not enough
    - Binary protocol (faster than JSON)
    - Used for internal service-to-service communication

Existing Topics from Part 1:
----------------------------
- Sync vs Async Communication
- Message Queues
- Pub/Sub Pattern
- WebSockets vs HTTP
- Long Polling vs SSE

Project Step (same as Part 1):
------------------------------
>> Add Message Queue (RabbitMQ or Redis Pub/Sub)
   - Cross-server real-time updates
   - Offline message delivery
   - Message persistence

=====================================
PHASE 5: SECURITY + RELIABILITY (Week 6)
=====================================

NEW - Topics Missing from Part 1:
---------------------------------
- Rate Limiting Algorithms (Interview Favorite!)
    1. Token Bucket - allows burst traffic
    2. Leaky Bucket - smooths traffic
    3. Fixed Window Counter - simple but edge-case issues
    4. Sliding Window Log - accurate but memory heavy
    5. Sliding Window Counter - best balance

- Circuit Breaker Pattern
    - Prevents cascading failures
    - States: Closed -> Open -> Half-Open
    - Used in microservices communication

- Monitoring & Observability
    - Metrics: Prometheus + Grafana
    - Logging: ELK Stack (Elasticsearch, Logstash, Kibana)
    - Tracing: Distributed tracing (Jaeger)
    - The 4 Golden Signals: Latency, Traffic, Errors, Saturation

- Heartbeat & Health Checks
    - How services detect if peers are alive
    - Gossip Protocol basics

- Leader Election (basics)
    - Why needed in distributed systems
    - Bully Algorithm, Raft consensus (basics)

Existing Topics from Part 1:
----------------------------
- Authentication (JWT, OAuth 2.0)
- Session Management
- Input Validation & Sanitization

Project Step:
-------------
>> Implement auth + reliability patterns
   - JWT + Refresh token
   - OAuth (Google/GitHub)
   - NEW: Implement Token Bucket rate limiter from scratch
   - NEW: Add basic health check endpoint
   - NEW: Add request logging with correlation IDs

=====================================
PHASE 6: PRACTICE SYSTEM DESIGNS (Week 7-10)
=====================================
*** MOST IMPORTANT PHASE - DO NOT SKIP ***

For each problem below:
  1. Set a 45-minute timer
  2. Use the RESHADED framework
  3. Draw diagram on paper or Excalidraw (excalidraw.com)
  4. Speak your answer OUT LOUD (record yourself)
  5. Then watch/read the solution and compare

Problem 1: Design URL Shortener (like bit.ly)
----------------------------------------------
Key concepts: Hashing, Base62 encoding, read-heavy system,
              database choice, cache layer, analytics
Difficulty: Easy (Start here)

Problem 2: Design Pastebin
---------------------------
Key concepts: Object storage, expiration, unique key generation,
              cleanup jobs
Difficulty: Easy

Problem 3: Design WhatsApp / Chat System
-----------------------------------------
Key concepts: WebSockets, presence, message delivery guarantees,
              group chat fan-out, end-to-end encryption
Difficulty: Medium
NOTE: Tera project iske liye directly kaam aayega!

Problem 4: Design Twitter / Instagram Feed
-------------------------------------------
Key concepts: Fan-out on write vs read, timeline generation,
              celebrity problem, caching, ranking algorithm
Difficulty: Medium

Problem 5: Design YouTube / Netflix
-------------------------------------
Key concepts: Video transcoding pipeline, CDN, adaptive bitrate,
              recommendation system, storage (huge scale)
Difficulty: Medium-Hard

Problem 6: Design Uber / Ola
------------------------------
Key concepts: Location tracking, geospatial indexing (QuadTree/Geohash),
              matching algorithm, ETA calculation, real-time updates
Difficulty: Medium-Hard

Problem 7: Design Notification System
--------------------------------------
Key concepts: Push vs Pull, priority queues, rate limiting,
              multiple channels (SMS, email, push), retry logic
Difficulty: Medium

Problem 8: Design Rate Limiter
-------------------------------
Key concepts: Token bucket, sliding window, distributed rate limiting,
              Redis-based implementation
Difficulty: Medium
NOTE: Tu Phase 5 mein implement bhi karega

Problem 9: Design Web Crawler
------------------------------
Key concepts: BFS, URL frontier, politeness policy, dedup,
              distributed crawling, DNS resolution
Difficulty: Hard

Problem 10: Design Search Autocomplete / Typeahead
---------------------------------------------------
Key concepts: Trie data structure, ranking, caching,
              data collection pipeline, sampling
Difficulty: Hard

Weekly Schedule:
- Week 7:  Problems 1, 2, 3 (Easy + your project)
- Week 8:  Problems 4, 5 (Medium - high frequency)
- Week 9:  Problems 6, 7, 8 (Medium - diverse patterns)
- Week 10: Problems 9, 10 + revisit weak ones

=====================================
PHASE 7: MOCK INTERVIEWS + POLISH (Week 11-12)
=====================================

Mock Interview Strategy:
------------------------
- Target: 8-10 mock interviews before real ones
- Platforms:
    - Pramp (pramp.com) - FREE peer mock interviews
    - Interviewing.io - practice with real engineers
    - Friends/Peers - best for comfort
- Record yourself and rewatch
- Focus on: clear communication, structured thinking, trade-off discussion

Week 11:
--------
- 4 mock interviews (pick 4 problems from Phase 6)
- Document your chat app architecture properly
- Create system design diagram (use Excalidraw)
- Write trade-off document

Week 12:
--------
- 4 more mock interviews
- Revisit weak topics
- Final review of all concepts
- Confidence building - you've built a real system!

Documentation to Create:
-------------------------
- docs/system-architecture.md (full diagram + explanation)
- docs/scaling-strategy.md (how to scale from 1K to 1M users)
- docs/trade-offs.md (every decision and why)
- docs/estimation-examples.md (5 estimation calculations)

=====================================
CONCEPTS COVERED (COMPLETE CHECKLIST)
=====================================

From Part 1 (already covered):
- [x] Scalability (Horizontal & Vertical)
- [x] High Availability
- [x] Load Balancing
- [x] Caching Strategies
- [x] Database Optimization
- [x] Replication & Redundancy
- [x] Distributed Systems
- [x] Microservices Architecture
- [x] Message Queues
- [x] Session Management
- [x] Authentication & Authorization
- [x] API Design
- [x] Real-time Communication (WebSockets)
- [x] Proxy Servers
- [x] CAP Theorem
- [x] Docker Setup

NEW in Part 2 (added):
- [ ] Back-of-Envelope Estimation (CRITICAL)
- [ ] Interview Framework (RESHADED)
- [ ] DNS & How Internet Works
- [ ] Consistent Hashing
- [ ] CDN (Content Delivery Network)
- [ ] SQL vs NoSQL Trade-offs (deep)
- [ ] Blob/Object Storage
- [ ] Database Partitioning Strategies
- [ ] Rate Limiting Algorithms (5 types)
- [ ] Circuit Breaker Pattern
- [ ] Monitoring & Observability
- [ ] Heartbeat & Gossip Protocol
- [ ] Leader Election (basics)
- [ ] Event-Driven Architecture
- [ ] Kafka vs RabbitMQ comparison
- [ ] gRPC basics
- [ ] 10 System Design Practice Problems
- [ ] Mock Interview Strategy

=====================================
RESOURCES (COMPLETE LIST)
=====================================

FREE Resources:
---------------
1. Engineering Digest - System Design in Hindi (from Part 1)
   https://www.youtube.com/watch?v=1_8a8-__6ts&list=PLA3GkZPtsafZdyC5iucNM_uhqGJ5yFNUM

2. Tech Interview Handbook - System Design
   https://www.techinterviewhandbook.org/system-design/

3. Hello Interview - System Design in a Hurry
   https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction

4. System Design Handbook 2026
   https://www.systemdesignhandbook.com/guides/system-design-interview/

5. Excalidraw (for drawing diagrams)
   https://excalidraw.com

6. Pramp (free mock interviews)
   https://www.pramp.com

7. Design Gurus - System Design Roadmap
   https://www.designgurus.io/path/system-design-interview-playbook

8. DEV Community - System Design for Freshers 2026
   https://dev.to/avinash201199/system-design-roadmap-for-freshers-2026

Paid (Worth the Investment):
----------------------------
1. Alex Xu - "System Design Interview" Vol 1 & 2
   (THE bible - har serious candidate ke paas honi chahiye)

2. Grokking System Design Interview (Educative.io)
   https://www.educative.io/courses/grokking-the-system-design-interview

YouTube Channels (FREE):
------------------------
- Engineering Digest (Hindi)
- Gaurav Sen (Hindi + English)
- ByteByteGo (Alex Xu's channel)
- System Design Fight Club
- Tushar Roy
- Tech Dummies

==============================
GOLDEN RULES FOR INTERVIEW DAY
==============================

1. NEVER jump into solution - always clarify requirements first

   -> Interviewer ek broad question dega like "Design WhatsApp".
      Seedha architecture mat banao. Pehle puchho:
      "Kitne users handle karne hain? Group chat chahiye? Media support?
       Read-heavy hai ya write-heavy?"
      Ye dikhata hai ki tu production mein sochta hai, na ki classroom mein.


2. ALWAYS do estimation - even if interviewer doesn't ask

   -> Bina estimation ke design banana = andhe mein teer maarna.
      Bol: "Agar 10M DAU hain, toh QPS = 10M x 40 msgs / 86400 = ~4600 QPS.
      Peak pe 2x = ~9200 QPS. Iske liye humein multiple servers chahiye."
      Ye ek line tujhe 50% candidates se alag kar deti hai.


3. START with high-level design, then go deep

   -> Pehle ek simple diagram banao: Client -> Load Balancer -> Server -> DB.
      Bas itna. Fir interviewer bolega "isko scale karo" ya "caching add karo"
      tab deep dive karo. Agar shuru se hi Kafka, Redis, Sharding sab daal diya
      toh confuse lagega, organized nahi.


4. DISCUSS trade-offs - there is no perfect design

   -> Har decision ke 2 sides hain. Bol:
      "Maine NoSQL isliye choose kiya kyunki chat messages unstructured hain
       aur horizontal scaling easy hai. But iska downside ye hai ki complex
       queries aur joins mushkil honge."
      Interviewer PERFECT answer nahi dhundh raha - wo dekhna chahta hai
      ki tu pros AND cons dono samajhta hai.


5. THINK out loud - interviewer wants to see your thought process

   -> Chup rehke 2 min sochna = RED FLAG.
      Instead bolo: "Main soch raha hun ki WebSocket use karun ya Long Polling...
      WebSocket better hai real-time ke liye but connection maintain karna padega.
      Humare scale pe WebSocket with sticky sessions chalega."
      Interviewer ko tumhara BRAIN dikhna chahiye, sirf answer nahi.


6. DRAW diagrams - visual > verbal

   -> 5 min bolke samjhane se accha ek diagram draw karo.
      Boxes banao (Client, Server, DB, Cache, Queue), arrows lagao, labels do.
      Use Excalidraw (online) ya whiteboard (onsite).
      Interviewer tumhare diagram pe hi follow-up questions puche ga.
      Bina diagram ke interview = bina map ke safar.


7. MENTION monitoring & error handling - shows production mindset

   -> Jab design almost complete ho, bol:
      "Main yahan Prometheus + Grafana lagaunga metrics ke liye,
       error rates track karunga, aur alerts set karunga if latency > 500ms."
      Ye dikhata hai tu sirf happy path nahi sochta, tu real production
      systems sochta hai. Bahut kam candidates ye karte hain = instant plus point.


8. BE HONEST if you don't know something - then reason through it

   -> Agar interviewer puchhe "Gossip Protocol kaise kaam karta hai?"
      aur tujhe nahi pata, toh MAT bol "haan pata hai" aur galat explain karo.
      Instead bol: "Maine deeply study nahi kiya, but meri understanding se
      ye peer-to-peer protocol hai jahan nodes randomly info share karte hain
      eventually consistent state achieve karne ke liye."
      Honest + reasoning > fake confidence. Interviewer turant pakad leta hai.


9. KEEP it simple first, then optimize

   -> Pehle ek single server + single DB wala design banao.
      Fir bolo: "Ab isko scale karte hain - load balancer add karte hain,
      DB replicate karte hain, cache layer lagate hain."
      Over-engineering from day 1 = RED FLAG.
      Simple -> Working -> Optimized. Ye approach dikhata hai
      ki tu real-world mein bhi incremental build karta hai.


10. TIME yourself - don't spend 20 min on requirements

    -> 45 min ka interview hai. Budget:
       - Requirements + Estimation: 5-7 min (MAX)
       - High-Level Design: 10-15 min
       - Deep Dive (components): 15-20 min
       - Trade-offs + Scaling: 5-10 min
       Agar requirements mein 20 min laga diye, toh design ke liye
       time hi nahi bachega. Practice mein timer lagao - habit ban jayegi.

=====================================
NOTES
=====================================

- Part 1 ka project + Part 2 ke additions = complete preparation
- Estimation practice har din karo (5-10 min)
- Har week 2 system design problems solve karo (Phase 6 se)
- Mock interviews mein fumble hona normal hai - keep practicing
- Alex Xu ki book mein diagrams dekho, apne haath se draw karo
- Interview mein confidence > perfection
- Tera chat app project = real talking point in interviews

=====================================
END - PART 2
=====================================

Total Timeline: 12 weeks (realistic)
Cost: Rs 0 (free resources) to Rs 2000 (Alex Xu book)
Goal: Crack system design rounds for MERN/React roles

# CodePostMortem - AI Incident Analyzer

> Real-time server crash analysis + AI-powered root cause detection + mobile alerts with fix suggestions

---

## The Problem

Server crash hota hai -> developer logs padhta hai -> Google karta hai -> 30 min waste.
Kya agar AI automatically log padhe, root cause bataye, aur fix suggest kare within seconds?

---

## What It Does

1. Your servers stream logs to CodePostMortem (via WebSocket)
2. Error aata hai -> AI instantly:
   - Reads the full error chain
   - Identifies root cause
   - Suggests exact fix with code snippet
   - Classifies severity (P0/P1/P2/P3)
3. Mobile push notification with AI-generated summary
4. Dashboard shows real-time incident timeline
5. Historical pattern detection: "ye same error 3 din pehle bhi aaya tha"

---

## Tech Stack

```
Frontend:      React + TailwindCSS (Real-time Dashboard)
Mobile:        React Native (Alert App with push notifications)
Backend:       Node.js + Express
WebSocket:     Socket.io (real-time log streaming)
Database:      MongoDB (incident history, error patterns)
AI:            Claude API / GPT-4 (log analysis + fix generation)
Queue:         Redis Pub/Sub (real-time error propagation)
Push:          Firebase Cloud Messaging (mobile alerts)
```

---

## Features Breakdown

### Dashboard (React Web)
- Live log stream (like a terminal in browser)
- Error timeline with severity color coding
- AI Analysis panel: root cause + suggested fix
- Historical incidents list with search/filter
- Stats: errors/hour, most common errors, MTTR (Mean Time To Resolve)

### Mobile App (React Native)
- Push notification: "P0 Alert: Database connection pool exhausted"
- Tap to expand: full AI analysis
- Quick actions: "Mark Resolved", "Escalate", "Snooze"
- Incident history on the go

### AI Analysis Engine (Node.js Backend)
- Log parsing: extracts error type, stack trace, timestamp
- Context gathering: recent code changes (GitHub API), related logs
- AI prompt: sends structured context to LLM
- Output: root cause, fix suggestion, severity, affected services
- Pattern matching: compares with past incidents

---

## Architecture

```
Your Servers ──(logs)──> Node.js Backend ──> AI Analysis Engine
                              │                      │
                              │                  Claude API
                              │                      │
                              ├──(WebSocket)──> React Dashboard
                              │
                              ├──(Push)──> React Native App
                              │
                              └──(Store)──> MongoDB (history)
```

---

## API Endpoints

```
POST   /api/logs/ingest          - Receive log streams
GET    /api/incidents             - List all incidents
GET    /api/incidents/:id         - Get incident detail + AI analysis
POST   /api/incidents/:id/resolve - Mark resolved
GET    /api/incidents/stats       - Dashboard stats
GET    /api/patterns              - Historical error patterns
POST   /api/analyze               - Manual log paste -> AI analysis
```

---

## AI Prompt Strategy

```
Input to AI:
  - Error message + full stack trace
  - Last 50 log lines before error
  - Recent git commits (if GitHub connected)
  - Server environment (Node version, OS, memory)
  - Past similar incidents (from MongoDB)

Output from AI (structured JSON):
  {
    "severity": "P1",
    "rootCause": "MongoDB connection pool exhausted due to...",
    "suggestedFix": "// Add connection pool limit\nmongoose.connect(uri, { maxPoolSize: 10 })",
    "affectedServices": ["user-service", "auth-service"],
    "similarPastIncidents": ["INC-234", "INC-189"],
    "preventionTip": "Add connection pool monitoring alert at 80% usage"
  }
```

---

## Why This Is Unique

- 99% of GenAI projects = chatbots. This = production monitoring tool
- Combines: Real-time streaming + AI reasoning + Mobile push
- Demonstrates: WebSocket, Redis Pub/Sub, AI structured output, React Native
- Interview story: "Maine ek tool banaya jo server crash hone pe AI se fix suggest karta hai"
- Shows SENIOR-LEVEL thinking (production mindset, not just CRUD)

---

## Build Order

```
Week 1: Basic Node.js log receiver + MongoDB storage
Week 2: AI integration (Claude API) + analysis engine
Week 3: React dashboard (real-time with Socket.io)
Week 4: React Native app + push notifications
Week 5: Historical patterns + polish + deploy
```

---

## Monetization Potential

- Free tier: 1 server, 100 incidents/month
- Pro: unlimited servers, Slack/Discord integration, custom alerts
- Team: multi-user, incident assignment, SLA tracking

---

*Category: Full Stack + AI + Mobile + DevOps*
*Difficulty: Advanced*
*Resume Impact: Very High - shows production-level thinking*

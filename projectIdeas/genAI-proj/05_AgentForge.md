# AgentForge - Visual AI Agent Builder (No-Code)

> Drag-and-drop interface to build AI agent workflows -> Connect LLM + tools + logic -> Deploy as API

---

## The Problem

AI agents banana = code likhna padta hai. LangChain seekho, prompts likho, tools connect karo.
Non-technical founders, PMs, aur junior devs ke liye ye mushkil hai.
Kya agar Zapier/n8n jaisa drag-drop builder ho specifically for AI agents?

---

## What It Does

1. Visual canvas (React Flow) - drag blocks and connect them
2. Block types:
   - LLM Block (Claude / GPT / Gemini - user chooses)
   - Tool Block (Send Email, Slack, GitHub, DB Query, Web Scrape)
   - Logic Block (If/Else, Loop, Switch)
   - Input Block (User prompt, Webhook trigger, Scheduled)
   - Output Block (API response, Email, Slack message, File)
3. Connect blocks with arrows = define workflow
4. Test run in playground
5. One-click deploy as REST API endpoint
6. Template library for common agents

---

## Tech Stack

```
Frontend:      React + TailwindCSS
Visual Builder: React Flow (drag-drop canvas)
Backend:       Node.js + Express
Database:      MongoDB (workflow definitions, execution logs, users)
AI:            Multiple LLM APIs (Claude, GPT, Gemini)
Queue:         BullMQ (async agent execution)
Runtime:       vm2 / isolated-vm (sandboxed code execution)
Auth:          JWT + OAuth (for tool integrations)
```

---

## Features Breakdown

### Visual Builder Canvas
- Drag blocks from sidebar onto canvas
- Connect blocks with arrows (data flows through arrows)
- Click block -> configure in right panel
- Mini-map for complex workflows
- Undo/Redo support
- Save as template

### Block Types

#### LLM Blocks
- Select model: Claude Sonnet / GPT-4o / Gemini Pro
- System prompt (editable)
- Temperature, max tokens controls
- Input: receives data from previous block
- Output: LLM response text or structured JSON
- Memory toggle: remember conversation across runs

#### Tool Blocks
- Send Email (via SendGrid/Nodemailer)
- Post to Slack (webhook)
- Create GitHub Issue
- Query MongoDB/PostgreSQL
- Web Scrape (URL -> content)
- HTTP Request (custom API call)
- File Read/Write
- Google Sheets (read/write rows)

#### Logic Blocks
- If/Else: route based on condition
- Loop: repeat N times or until condition
- Switch: multiple branches
- Delay: wait N seconds
- Transform: modify data (JavaScript expression)

#### Input Blocks
- Manual: user types prompt in playground
- Webhook: trigger via HTTP POST
- Schedule: cron-based (every hour, daily, etc.)
- Event: GitHub webhook, Slack event, email received

#### Output Blocks
- API Response: return JSON
- Send Email: formatted result
- Slack Message: post to channel
- Save to DB: store result
- Generate File: CSV, PDF, JSON

### Execution & Testing
- Playground: test workflow with sample input
- Step-by-step execution view (see each block's input/output)
- Execution logs: full history of all runs
- Error handling: retry failed blocks, fallback paths

### Deployment
- One-click deploy as REST API
- Auto-generated API docs (Swagger)
- API key authentication
- Rate limiting per endpoint
- Usage dashboard: calls/day, tokens used, cost

### Template Library
- Customer Support Agent (email -> classify -> respond/escalate)
- Code Review Agent (GitHub PR -> analyze -> comment)
- Content Writer Agent (topic -> research -> draft -> edit)
- Data Extractor Agent (URL -> scrape -> structure -> save)
- Meeting Summary Agent (audio -> transcribe -> summarize -> email)

---

## Architecture

```
React Frontend (Visual Builder)
       │
       │ Save workflow JSON
       ▼
Node.js Backend
       │
       ├── Workflow Engine
       │     │
       │     ├── Block Executor (runs each block)
       │     │     ├── LLM Executor (calls AI APIs)
       │     │     ├── Tool Executor (emails, Slack, etc.)
       │     │     └── Logic Executor (if/else, loops)
       │     │
       │     └── Flow Controller (manages block order, data passing)
       │
       ├── BullMQ (async execution queue)
       │
       ├── MongoDB (workflows, logs, users)
       │
       └── Deployed Endpoints (Express routes per workflow)
```

---

## Workflow JSON Schema (stored in MongoDB)

```json
{
  "name": "Customer Support Agent",
  "trigger": "webhook",
  "blocks": [
    {
      "id": "input-1",
      "type": "input",
      "config": { "source": "webhook", "field": "message" }
    },
    {
      "id": "llm-1",
      "type": "llm",
      "config": {
        "model": "claude-sonnet",
        "systemPrompt": "Classify this support email as: billing, technical, general",
        "outputFormat": "json"
      },
      "input": "input-1"
    },
    {
      "id": "switch-1",
      "type": "switch",
      "config": { "field": "category" },
      "branches": {
        "billing": "llm-2",
        "technical": "llm-3",
        "general": "llm-4"
      },
      "input": "llm-1"
    }
  ],
  "connections": [
    { "from": "input-1", "to": "llm-1" },
    { "from": "llm-1", "to": "switch-1" }
  ]
}
```

---

## API Endpoints

```
# Workflow Management
POST   /api/workflows              - Create workflow
GET    /api/workflows              - List user's workflows
GET    /api/workflows/:id          - Get workflow detail
PUT    /api/workflows/:id          - Update workflow
DELETE /api/workflows/:id          - Delete workflow

# Execution
POST   /api/workflows/:id/run      - Run workflow (playground)
GET    /api/workflows/:id/logs      - Execution logs
GET    /api/executions/:id          - Get execution detail (step-by-step)

# Deployment
POST   /api/workflows/:id/deploy   - Deploy as API endpoint
DELETE /api/workflows/:id/deploy   - Undeploy
GET    /api/deployed/:slug          - Deployed endpoint (public)

# Templates
GET    /api/templates               - List templates
POST   /api/templates/:id/clone     - Clone template to my workflows
```

---

## Why This Is Unique

- 2026 = "Year of the Agent" but building agents requires coding
- You're building a PLATFORM, not a project - shows product thinking
- Visual builder with React Flow = very impressive live demo
- Multi-model support = not locked to one AI provider
- Actually deployable as API = real-world usable
- Interview: "I built a no-code platform to create and deploy AI agents visually"

---

## Build Order

```
Week 1: React Flow canvas + basic block types (LLM, Input, Output)
Week 2: Block configuration panel + workflow save/load (MongoDB)
Week 3: Execution engine - run workflow step by step
Week 4: Tool blocks (email, Slack, HTTP, DB) + logic blocks
Week 5: Deploy as API endpoint + playground testing
Week 6: Templates + execution logs + polish + demo
```

---

*Category: Full Stack + AI Platform + Visual Builder*
*Difficulty: Very Advanced*
*Resume Impact: Extreme - shows platform-level architecture thinking*

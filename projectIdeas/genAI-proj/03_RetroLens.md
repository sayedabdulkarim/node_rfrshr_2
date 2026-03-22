# RetroLens - AI Codebase Time-Travel Debugger

> Connect any GitHub repo -> AI understands your entire codebase -> Ask questions, trace data flows, predict impact of changes

---

## The Problem

Naye project pe join kiya -> "ye codebase kaise kaam karta hai?" -> 2 hafte lagta hai samajhne mein.
PR review karna hai -> "is change se aur kya break ho sakta hai?" -> Koi nahi jaanta.

---

## What It Does

1. Connect your GitHub repo
2. AI indexes entire codebase (RAG with embeddings)
3. Now ask ANYTHING:
   - "How does authentication work in this project?"
   - "What happens when a user clicks 'Place Order'? Trace the full flow"
   - "If I change the User schema, what all will break?"
   - "What changed between v1.2 and v1.3 that could affect payments?"
   - "Explain this PR in simple language"
4. Visual dependency graph: click any function -> see what calls it and what it calls
5. Impact analysis before making changes

---

## Tech Stack

```
Frontend:      React + TailwindCSS
Visualization: React Flow (dependency graph / call graph)
Backend:       Node.js + Express
Database:      MongoDB (codebase snapshots, chat history)
Vector DB:     Pinecone / ChromaDB / Weaviate (code embeddings)
AI:            Claude API (code understanding + Q&A)
Embeddings:    OpenAI text-embedding-3-small
Integration:   GitHub API (repo access, commits, PRs, diffs)
```

---

## Features Breakdown

### Repo Connection
- OAuth with GitHub -> select repo
- AI scans all files: code, configs, package.json, README
- Creates embeddings for each function/class/file
- Builds dependency graph from imports/requires
- Stores in vector DB for semantic search

### Chat Interface (Ask Anything)
- "How does auth work?" -> AI traces through middleware, routes, models
- "Trace: user login to database" -> shows step-by-step data flow
- "What does this function do?" -> paste code, get explanation
- Context-aware: remembers previous questions in session

### Visual Dependency Graph
- Interactive graph (React Flow)
- Nodes = files/functions/classes
- Edges = imports/calls/dependencies
- Click any node -> see code + AI explanation
- Highlight path: "Show me login flow" -> lights up related nodes

### Impact Analysis (Killer Feature)
- Select any file/function -> "What if I change this?"
- AI traces all dependents and shows:
  - Direct dependents (imports this file)
  - Indirect dependents (uses something that uses this)
  - Test files that cover this code
  - Potential breaking changes
- Color coded: red=will break, yellow=might affect, green=safe

### Git Time-Travel
- Select any two commits/tags/branches
- AI explains: "Between v1.2 and v1.3, these 14 files changed..."
- For each change: what was modified and WHY (AI infers intent from diff)
- "Did any of these changes affect the payment flow?" -> AI answers

### PR Review Mode
- Paste PR URL or select from list
- AI generates:
  - Plain English summary of what this PR does
  - Risk assessment (what could break)
  - Code quality notes
  - Suggested improvements

---

## Architecture

```
GitHub Repo ──(GitHub API)──> Node.js Backend
                                    │
                              ┌─────┴─────┐
                              │            │
                        Code Parser    Embedding Engine
                        (AST/Regex)    (OpenAI Embeddings)
                              │            │
                              │      Vector DB (Pinecone)
                              │            │
                              └─────┬──────┘
                                    │
                              Claude API
                              (Q&A + Analysis)
                                    │
                              React Frontend
                              (Chat + Graph + Impact View)
```

---

## API Endpoints

```
POST   /api/repos/connect        - Connect GitHub repo (OAuth)
POST   /api/repos/:id/index      - Index/re-index codebase
GET    /api/repos/:id/status      - Indexing progress
POST   /api/chat                  - Ask question about codebase
GET    /api/graph/:repoId         - Get dependency graph data
POST   /api/impact                - Impact analysis for a change
GET    /api/commits/:repoId       - List commits for comparison
POST   /api/compare               - Compare two commits with AI
POST   /api/pr/review             - AI review of a PR
```

---

## RAG Pipeline

```
1. INDEXING (one-time per repo):
   - Clone repo -> parse all files
   - Split into chunks (function-level, not arbitrary)
   - Generate embeddings for each chunk
   - Store: chunk text + embedding + file path + function name + metadata
   - Build import/dependency graph from AST

2. QUERY (every question):
   - User question -> generate embedding
   - Vector search -> find top 10 relevant code chunks
   - Include: dependency context (what imports this, what this imports)
   - Include: git history for these files (recent changes)
   - Send to Claude: question + relevant code + context
   - Claude responds with answer + file references
```

---

## Why This Is Unique

- RAG over documents = common. RAG over CODE with git awareness = rare
- Visual dependency graph (React Flow) = impressive in demo
- Impact analysis = something even senior devs wish they had
- Shows: RAG, embeddings, vector DB, GitHub API, graph visualization
- Tu already MCP blog likha hai - this aligns with AI + code tooling narrative
- Interview: "I built a tool that understands any codebase and can predict what breaks"

---

## Build Order

```
Week 1: GitHub OAuth + repo cloning + file parser
Week 2: Embedding generation + vector DB setup + RAG pipeline
Week 3: Chat interface + AI Q&A with code context
Week 4: React Flow dependency graph + impact analysis
Week 5: Git comparison + PR review mode + polish
Week 6: Deploy + demo video
```

---

*Category: Full Stack + AI (RAG) + Developer Tool*
*Difficulty: Advanced*
*Resume Impact: Very High - shows senior-level codebase understanding*

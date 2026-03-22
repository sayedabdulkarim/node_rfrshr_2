# DrawMind - AI-Powered Diagram Generator (draw.io format)

> Chat with AI -> Describe your system -> Get a proper draw.io diagram instantly -> Edit via chat -> Manage multiple diagrams

---

## The Problem

Diagram banana = time consuming. draw.io khole, boxes banao, arrows lagao, align karo, labels do.
Ek system design diagram mein 30-60 min lag jaate hain.
Aur agar kisi ne review ke baad bola "ye change karo" -> phir se 20 min.

Kya agar chat mein bolo aur diagram ban jaaye? Aur yaad bhi rahe context?

---

## What It Does

1. User opens app -> sidebar shows "My Diagrams" (like a file manager)
2. Click "New Diagram" -> chat window opens
3. User describes: "Create a system design for a food delivery app with React frontend, Node.js backend, MongoDB, Redis cache, and Nginx load balancer"
4. AI generates a proper draw.io XML diagram instantly
5. Diagram renders live in the preview panel
6. User can:
   - "Add Kafka message queue between order service and notification service"
   - "Change MongoDB to PostgreSQL"
   - "Add a CDN before the frontend"
   - "Make the user service talk to payment gateway"
7. AI remembers full context - every edit builds on previous state
8. Export as .drawio file (opens directly in draw.io/diagrams.net)
9. Sidebar manages multiple diagrams per project

---

## Tech Stack

```
Frontend:      React + TailwindCSS
Diagram Render: mxGraph library (same engine as draw.io) OR
                iframe embed of diagrams.net viewer
Sidebar:       React (file-tree style diagram manager)
Chat:          React (chat interface with message history)
Backend:       Node.js + Express
Database:      MongoDB (diagrams, chat history, user projects)
AI:            Claude API (generates draw.io XML from descriptions)
Auth:          JWT (user accounts, private diagrams)
Export:        .drawio XML file download
```

---

## UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  DrawMind                                    [User] [+]  │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  SIDEBAR   │              DIAGRAM PREVIEW                │
│            │                                             │
│  My Projects│         (Live rendered diagram)            │
│  ├── Food App│                                           │
│  │   ├── System Design  │    ┌─────┐     ┌──────┐      │
│  │   ├── DB Schema      │    │React│────>│Nginx │      │
│  │   └── API Flow       │    └─────┘     └──┬───┘      │
│  ├── Chat App           │                   │           │
│  │   └── Architecture   │              ┌────┴────┐      │
│  └── E-commerce         │              │Node x3  │      │
│      ├── Microservices  │              └────┬────┘      │
│      └── Data Flow      │                   │           │
│                         │         ┌─────┐ ┌─┴───┐      │
│  [+ New Project]        │         │Redis│ │Mongo│      │
│  [+ New Diagram]        │         └─────┘ └─────┘      │
│                         │                               │
│─────────────────────────┤───────────────────────────────│
│                         │                               │
│   CHAT PANEL            │   DIAGRAM CONTROLS            │
│                         │   [Export .drawio] [PNG] [SVG] │
│   You: Create a system  │   [Zoom +] [Zoom -] [Fit]    │
│   design for food       │   [Undo] [Redo]              │
│   delivery app...       │                               │
│                         │                               │
│   AI: Here's your       │                               │
│   diagram with React    │                               │
│   frontend, Nginx LB... │                               │
│                         │                               │
│   You: Add Kafka between│                               │
│   order and notification│                               │
│                         │                               │
│   AI: Added Kafka queue.│                               │
│   Updated connections.  │                               │
│                         │                               │
│   [Type message...]     │                               │
│                         │                               │
└──────────────────────────┴──────────────────────────────┘
```

---

## Features Breakdown

### Sidebar - Diagram Manager
- Projects (folders) -> Diagrams (files) hierarchy
- Create / Rename / Delete projects and diagrams
- Drag to reorder
- Search across all diagrams
- Last modified timestamp
- Quick preview on hover
- Duplicate diagram option

### Chat Panel - AI Interaction
- Natural language input
- AI generates/updates diagram based on description
- Full conversation history per diagram
- AI remembers ALL previous context (crucial feature)
- Suggested prompts: "Add caching layer", "Show data flow", "Add auth service"
- Image upload: user uploads a photo/sketch -> AI converts to proper diagram

### Diagram Preview - Live Render
- Real-time rendering of draw.io XML
- Zoom in/out, pan, fit to screen
- Click any element to highlight (future: click to edit)
- Auto-layout: AI arranges elements cleanly
- Multiple diagram types supported (see below)

### Export Options
- .drawio file (opens in draw.io desktop/web)
- .png (high resolution)
- .svg (vector, scalable)
- .pdf (for documentation)
- Copy XML to clipboard

### Memory & Context (Killer Feature)
- AI remembers every change made to a diagram
- Conversation history stored in MongoDB per diagram
- User can say "undo last 2 changes" -> AI reverts
- User can say "go back to the version before I added Kafka" -> AI understands
- Context carries over: "now add the same caching pattern to the other service"

---

## Supported Diagram Types

```
1. System Architecture    - boxes, arrows, services, databases
2. Database ER Diagrams   - entities, relationships, fields
3. API Flow Diagrams      - request/response flow between services
4. Sequence Diagrams      - step-by-step interaction between components
5. Flowcharts             - decision trees, process flows
6. Network Diagrams       - servers, firewalls, load balancers
7. Microservices Map      - service mesh with communication patterns
8. Data Flow Diagrams     - how data moves through the system
```

---

## Architecture

```
React Frontend
  ├── Sidebar (project/diagram tree)
  ├── Chat Panel (AI conversation)
  └── Diagram Viewer (mxGraph renderer)
       │
       │ (sends: user message + diagram history)
       ▼
Node.js Backend
  ├── AI Service
  │     ├── Claude API (generates draw.io XML)
  │     ├── Context Manager (maintains conversation + diagram state)
  │     └── XML Validator (ensures valid draw.io format)
  │
  ├── Diagram Service
  │     ├── CRUD operations
  │     ├── Version history
  │     └── Export (drawio/png/svg/pdf)
  │
  ├── Project Service
  │     ├── Project CRUD
  │     └── User access control
  │
  └── MongoDB
        ├── users collection
        ├── projects collection
        ├── diagrams collection (stores XML + metadata)
        └── conversations collection (chat history per diagram)
```

---

## API Endpoints

```
# Auth
POST   /api/auth/register         - Create account
POST   /api/auth/login             - Login

# Projects
GET    /api/projects               - List user's projects
POST   /api/projects               - Create project
PUT    /api/projects/:id           - Rename project
DELETE /api/projects/:id           - Delete project

# Diagrams
GET    /api/projects/:pid/diagrams       - List diagrams in project
POST   /api/projects/:pid/diagrams       - Create new diagram
GET    /api/diagrams/:id                  - Get diagram (XML + metadata)
PUT    /api/diagrams/:id                  - Update diagram
DELETE /api/diagrams/:id                  - Delete diagram
GET    /api/diagrams/:id/versions         - Version history
GET    /api/diagrams/:id/export/:format   - Export (drawio/png/svg/pdf)

# AI Chat
POST   /api/diagrams/:id/chat            - Send message (generates/updates diagram)
GET    /api/diagrams/:id/chat             - Get conversation history
POST   /api/diagrams/:id/chat/undo        - Undo last AI change
POST   /api/diagrams/:id/chat/upload      - Upload image -> AI converts to diagram
```

---

## AI Prompt Strategy

```
System Prompt:
  "You are a diagram generator. You output valid draw.io XML format.
   You maintain context of the current diagram and update it based on
   user requests. Always output complete, valid mxGraphModel XML."

Input to AI (every message):
  {
    "currentDiagramXML": "<mxGraphModel>...current state...</mxGraphModel>",
    "conversationHistory": [...previous messages...],
    "userMessage": "Add Kafka between order service and notification service",
    "diagramType": "system-architecture"
  }

Output from AI (structured):
  {
    "updatedXML": "<mxGraphModel>...updated diagram...</mxGraphModel>",
    "changesSummary": "Added Kafka message queue between Order Service and Notification Service. Connected with async arrows.",
    "elementsAdded": ["Kafka Queue"],
    "elementsModified": ["Order Service -> Notification Service connection"],
    "suggestedNextSteps": [
      "Add dead letter queue for failed messages",
      "Add consumer group for notification service",
      "Add monitoring for queue depth"
    ]
  }
```

---

## draw.io XML Example (what AI generates)

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>

    <!-- React Frontend -->
    <mxCell id="2" value="React Frontend"
      style="rounded=1;whiteSpace=wrap;fillColor=#dae8fc;strokeColor=#6c8ebf;"
      vertex="1" parent="1">
      <mxGeometry x="200" y="40" width="160" height="60" as="geometry"/>
    </mxCell>

    <!-- Nginx Load Balancer -->
    <mxCell id="3" value="Nginx LB"
      style="shape=hexagon;whiteSpace=wrap;fillColor=#fff2cc;strokeColor=#d6b656;"
      vertex="1" parent="1">
      <mxGeometry x="200" y="160" width="160" height="60" as="geometry"/>
    </mxCell>

    <!-- Arrow: React -> Nginx -->
    <mxCell id="10" style="edgeStyle=orthogonalEdgeStyle;"
      edge="1" source="2" target="3" parent="1"/>

    <!-- Node.js Servers -->
    <mxCell id="4" value="Node.js x3"
      style="rounded=1;whiteSpace=wrap;fillColor=#d5e8d4;strokeColor=#82b366;"
      vertex="1" parent="1">
      <mxGeometry x="200" y="280" width="160" height="60" as="geometry"/>
    </mxCell>

    <!-- MongoDB -->
    <mxCell id="5" value="MongoDB"
      style="shape=cylinder3;whiteSpace=wrap;fillColor=#f8cecc;strokeColor=#b85450;"
      vertex="1" parent="1">
      <mxGeometry x="100" y="400" width="120" height="80" as="geometry"/>
    </mxCell>

    <!-- Redis -->
    <mxCell id="6" value="Redis Cache"
      style="shape=cylinder3;whiteSpace=wrap;fillColor=#e1d5e7;strokeColor=#9673a6;"
      vertex="1" parent="1">
      <mxGeometry x="340" y="400" width="120" height="80" as="geometry"/>
    </mxCell>

  </root>
</mxGraphModel>
```

---

## Image Upload -> Diagram Conversion

User can upload:
- Hand-drawn sketch on paper (photo)
- Whiteboard diagram photo
- Screenshot of existing diagram
- Rough wireframe

AI (Vision API) analyzes the image and generates:
- Proper draw.io diagram matching the sketch
- Clean layout with proper shapes and arrows
- Labels extracted from handwriting/text in image

This is a KILLER feature - interview whiteboard drawing -> instant proper diagram

---

## Why This Is Unique

- draw.io is used by MILLIONS but has ZERO AI integration
- Nobody is building AI -> draw.io XML generator
- Memory/context across edits = not a one-shot generator
- Multi-diagram management (sidebar) = real product, not toy
- Image-to-diagram = whiteboard photo to proper diagram
- Export as .drawio = actually usable in real workflow
- System design interview prep tool (draw diagrams by describing)
- Interview: "I built an AI tool that generates draw.io diagrams from natural language with full context memory"

---

## Build Order

```
Week 1: draw.io XML format research + AI prompt engineering
        - Understand mxGraphModel XML structure
        - Get Claude to generate valid XML consistently
        - Test with simple diagrams (3-4 boxes + arrows)

Week 2: React frontend - chat panel + diagram viewer
        - mxGraph library setup for rendering
        - Basic chat interface
        - Send message -> get diagram -> render

Week 3: Sidebar + multi-diagram management
        - Projects/Diagrams tree structure
        - MongoDB CRUD for projects and diagrams
        - Switch between diagrams

Week 4: Context memory + iterative editing
        - Store conversation history per diagram
        - AI receives current XML + history with each message
        - Undo/redo via chat
        - Version history

Week 5: Image upload + export options
        - Vision API for image -> diagram conversion
        - Export: .drawio, .png, .svg, .pdf
        - Polish UI

Week 6: Templates + testing + deploy
        - Pre-built templates (MERN architecture, microservices, etc.)
        - Edge cases and error handling
        - Deploy + demo video
```

---

## Template Library (Pre-built Starting Points)

```
1. MERN Stack Architecture
2. Microservices with API Gateway
3. Event-Driven Architecture (Kafka)
4. CI/CD Pipeline
5. AWS Architecture (EC2, S3, RDS, CloudFront)
6. Database ER Diagram (E-commerce)
7. Authentication Flow (JWT + OAuth)
8. Real-time Chat Architecture (Socket.io)
9. Kubernetes Cluster Setup
10. Mobile App Backend Architecture
```

User clicks template -> diagram loads -> user modifies via chat

---

## Monetization Potential

- Free: 5 diagrams, basic export
- Pro ($5/mo): unlimited diagrams, PNG/SVG/PDF export, image upload
- Team ($15/mo): shared projects, collaboration, team templates

---

*Category: Full Stack + AI + Developer Tool + Productivity*
*Difficulty: Advanced*
*Resume Impact: Very High - solves a real pain point for every developer*

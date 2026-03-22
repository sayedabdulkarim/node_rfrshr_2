# Disposable Email Service - Build from Scratch

> Personal project for ~100 users | Cost: ~₹80/year (domain only)

---

## Overview

A temporary/disposable email service like SharkLasers where users can:
- Get instant random email addresses
- Receive emails in real-time
- Emails auto-delete after 1 hour
- No registration required

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      USER BROWSER                        │
│                   (Vanilla JS / React)                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                        │
│                     (Port 3000)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ REST API    │  │ Socket.io    │  │ Cleanup Cron   │  │
│  │ /api/inbox  │  │ Real-time    │  │ Delete old     │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    SMTP SERVER                           │
│                     (Port 25)                            │
│         Receives emails → Parses → Saves to DB           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     MONGODB                              │
│              Collection: emails                          │
│  { to, from, subject, body, html, createdAt }           │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| SMTP Server | `smtp-server` package |
| Email Parser | `mailparser` package |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Cron Jobs | node-cron |
| Frontend | Vanilla JS or React |

---

## Folder Structure

```
tempmail/
├── server/
│   ├── index.js              # Main entry point
│   ├── config/
│   │   └── db.js             # MongoDB connection
│   ├── smtp/
│   │   └── smtpServer.js     # SMTP server logic
│   ├── routes/
│   │   └── inbox.js          # API routes
│   ├── models/
│   │   └── Email.js          # MongoDB schema
│   ├── socket/
│   │   └── socketHandler.js  # Real-time logic
│   └── jobs/
│       └── cleanup.js        # Cron job for deletion
├── client/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── package.json
├── .env
└── README.md
```

---

## Database Schema

```javascript
// models/Email.js
{
  _id: ObjectId,
  to: String,                    // "abc123@tempbox.xyz"
  username: String,              // "abc123" (extracted)
  from: String,                  // "someone@gmail.com"
  subject: String,
  text: String,                  // Plain text body
  html: String,                  // HTML body
  attachments: Array,
  createdAt: Date,               // For auto-deletion
  read: Boolean                  // Default: false
}
```

---

## Core Features to Build

### 1. SMTP Server (Receive Emails)
- Listen on port 25
- Parse incoming emails
- Extract username from "to" field
- Save to MongoDB
- Emit socket event for real-time update

### 2. REST API
```
GET  /api/inbox/:username     → Get all emails for user
GET  /api/email/:id           → Get single email
DELETE /api/email/:id         → Delete email
POST /api/generate            → Generate random email
```

### 3. Real-time Updates (Socket.io)
- User connects → Joins room (username)
- New email → Emit to that room
- Instant inbox refresh

### 4. Auto Cleanup (Cron Job)
- Run every 5 minutes
- Delete emails older than 1 hour

### 5. Frontend
- Generate random email on load
- Copy email button
- Real-time inbox display
- View email content
- Refresh button
- Auto-refresh countdown

---

## NPM Packages

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "smtp-server": "^3.13.0",
    "mailparser": "^3.6.5",
    "socket.io": "^4.7.2",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## Environment Variables (.env)

```env
PORT=3000
SMTP_PORT=25
MONGODB_URI=mongodb://localhost:27017/tempmail
DOMAIN=tempbox.xyz
EMAIL_EXPIRY_HOURS=1
```

---

## Implementation Steps

### Phase 1: Setup
- [ ] Initialize Node.js project
- [ ] Install dependencies
- [ ] Setup folder structure
- [ ] Configure MongoDB connection
- [ ] Setup Express server

### Phase 2: SMTP Server
- [ ] Create SMTP server with `smtp-server`
- [ ] Parse emails with `mailparser`
- [ ] Extract username from recipient
- [ ] Save emails to MongoDB

### Phase 3: REST API
- [ ] GET /api/inbox/:username
- [ ] GET /api/email/:id
- [ ] DELETE /api/email/:id
- [ ] POST /api/generate

### Phase 4: Real-time
- [ ] Setup Socket.io
- [ ] Room-based connections
- [ ] Emit on new email
- [ ] Client-side socket handling

### Phase 5: Cleanup Job
- [ ] Setup node-cron
- [ ] Delete old emails every 5 mins

### Phase 6: Frontend
- [ ] HTML structure
- [ ] CSS styling
- [ ] JavaScript logic
- [ ] Socket.io client
- [ ] Copy to clipboard

### Phase 7: Deployment
- [ ] Buy domain (.xyz ~₹80)
- [ ] Setup Oracle Cloud VPS (FREE)
- [ ] Configure DNS (A + MX records)
- [ ] Install Node.js, MongoDB
- [ ] Setup PM2
- [ ] Setup Nginx + SSL

---

## DNS Configuration

```
Type     Host    Value                    TTL
──────────────────────────────────────────────
A        @       YOUR_SERVER_IP           Auto
A        mail    YOUR_SERVER_IP           Auto
MX       @       mail.tempbox.xyz         10
TXT      @       v=spf1 mx ~all           Auto
```

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Domain (.xyz) | ₹80/year |
| Oracle Cloud VPS | FREE forever |
| MongoDB (local) | FREE |
| SSL (Let's Encrypt) | FREE |
| **Total** | **₹80/year** |

---

## Security Considerations

- [ ] Rate limiting (prevent spam)
- [ ] Input sanitization
- [ ] No authentication needed (by design)
- [ ] HTTPS only
- [ ] Sanitize HTML in emails (XSS prevention)

---

## Future Enhancements

- [ ] Multiple domain support
- [ ] Custom email aliases
- [ ] Email forwarding
- [ ] Attachment support
- [ ] Dark mode UI
- [ ] Mobile responsive

---

## References

- [smtp-server npm](https://www.npmjs.com/package/smtp-server)
- [mailparser npm](https://www.npmjs.com/package/mailparser)
- [Socket.io docs](https://socket.io/docs/v4/)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)

---

## Quick Start Commands

```bash
# Initialize project
mkdir tempmail && cd tempmail
npm init -y

# Install dependencies
npm install express mongoose smtp-server mailparser socket.io node-cron dotenv cors

# Install dev dependencies
npm install -D nodemon

# Run development
npm run dev
```

---

**Created by: Sayed Abdul Karim**

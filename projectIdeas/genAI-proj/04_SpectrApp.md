# SpectrApp - AI-Powered Accessibility Auditor (Mobile)

> Point your phone camera at any app screen -> AI instantly detects accessibility issues + suggests fixes

---

## The Problem

Accessibility testing = boring, manual, time consuming.
Companies legally required hain (ADA, WCAG) but koi test nahi karta kyunki tools mushkil hain.
Kya agar phone ka camera point karo aur AI bata de kya galat hai?

---

## What It Does

1. Open React Native app -> point camera at any app/website screen
2. Capture screenshot
3. AI (Vision API) analyzes and detects:
   - Color contrast violations (WCAG AA/AAA)
   - Touch targets too small (< 44x44 px)
   - Font size too small for readability
   - Missing visual hierarchy
   - Potential missing alt text patterns
4. Shows annotated screenshot with issues highlighted
5. For each issue: severity + WCAG rule + exact CSS fix
6. Generate PDF audit report
7. Track improvement over time

---

## Tech Stack

```
Mobile:        React Native (Camera + Image Capture)
Backend:       Node.js + Express
AI:            Claude Vision API / GPT-4 Vision (screenshot analysis)
Database:      MongoDB (audit history, reports, user projects)
Storage:       AWS S3 / Cloudinary (screenshots)
Output:        PDF generation (audit reports)
```

---

## Features Breakdown

### Camera Capture Screen
- Live camera view with capture button
- Gallery import option (for existing screenshots)
- Batch mode: upload folder of screenshots
- URL mode: enter website URL -> auto-screenshot via Puppeteer

### AI Analysis Results
- Annotated screenshot: red boxes on problem areas
- Issue list with severity badges (Critical / Major / Minor)
- Each issue shows:
  - What's wrong: "Color contrast ratio 2.1:1 (minimum 4.5:1)"
  - WCAG rule: "WCAG 2.1 - 1.4.3 Contrast (Minimum)"
  - Fix: "Change text color from #999 to #595959"
- Overall score: "Accessibility Score: 62/100"

### Audit History
- All past scans organized by project/app
- Trend chart: score improving over time
- Compare: before vs after screenshots
- Filter by issue type, severity

### PDF Report Generator
- Professional PDF report with:
  - Executive summary (score + critical issues count)
  - Annotated screenshots
  - Issue-by-issue breakdown
  - Recommended fixes with code
  - WCAG compliance checklist
- Shareable with stakeholders/clients

### URL Scanner (Web Mode)
- Enter any website URL
- Backend takes screenshots at different breakpoints (mobile/tablet/desktop)
- AI analyzes all screenshots
- Checks actual HTML for alt text, ARIA labels, semantic HTML
- Deeper analysis than camera mode

---

## Architecture

```
React Native App                    Node.js Backend
     │                                    │
     ├── Camera Capture ──(upload)──> Image Processing
     │                                    │
     ├── URL Input ──────────────> Puppeteer Screenshot
     │                                    │
     │                              Claude Vision API
     │                              (Accessibility Analysis)
     │                                    │
     │                              ┌─────┴─────┐
     │                              │            │
     │ <──(results)──── Analysis    │     MongoDB
     │                  Engine      │   (History)
     │                              │            │
     │ <──(download)─── PDF         │      S3
     │                  Generator   │  (Screenshots)
```

---

## API Endpoints

```
POST   /api/scan/image           - Upload screenshot for analysis
POST   /api/scan/url             - Scan website URL
GET    /api/scans                - List all scans
GET    /api/scans/:id            - Get scan detail + issues
GET    /api/scans/:id/report     - Download PDF report
GET    /api/projects             - List projects
GET    /api/projects/:id/trends  - Accessibility score over time
POST   /api/projects             - Create new project
```

---

## AI Prompt Strategy

```
Input to Claude Vision API:
  - Screenshot image
  - Context: "Analyze this mobile app screenshot for accessibility issues"

Expected Output (structured JSON):
  {
    "overallScore": 62,
    "issues": [
      {
        "type": "color-contrast",
        "severity": "critical",
        "location": { "x": 120, "y": 340, "width": 200, "height": 30 },
        "description": "Text '#999' on background '#fff' has contrast ratio 2.8:1",
        "wcagRule": "WCAG 2.1 - 1.4.3 Contrast (Minimum)",
        "requiredRatio": "4.5:1",
        "fix": "Change text color to #595959 for 7:1 ratio"
      },
      {
        "type": "touch-target",
        "severity": "major",
        "location": { "x": 300, "y": 50, "width": 24, "height": 24 },
        "description": "Close button is 24x24px, below minimum 44x44px",
        "wcagRule": "WCAG 2.1 - 2.5.5 Target Size",
        "fix": "Increase tap area to minimum 44x44px with padding"
      }
    ],
    "positives": [
      "Good font size hierarchy",
      "Sufficient spacing between interactive elements"
    ]
  }
```

---

## Why This Is Unique

- NOBODY is doing: AI + mobile camera + accessibility auditing
- Uses Claude/GPT VISION API (multimodal) - cutting-edge AI skill
- Real social impact: helps make apps usable for disabled users
- Legal business value: companies NEED this for ADA/WCAG compliance
- Can scan ANY app (not just web) - point camera at iOS, Android, anything
- Interview: "Maine ek mobile app banaya jo camera se kisi bhi app ki accessibility check karta hai"

---

## Build Order

```
Week 1: React Native camera capture + image upload
Week 2: Node.js backend + Claude Vision API integration
Week 3: Analysis engine + annotated screenshot overlay
Week 4: Audit history + trend tracking + MongoDB
Week 5: PDF report generator + URL scanner mode
Week 6: Polish + deploy + demo video
```

---

*Category: Mobile (React Native) + AI (Vision) + Social Impact*
*Difficulty: Advanced*
*Resume Impact: Very High - unique + multimodal AI + social good story*

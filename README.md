# 🌙 Night Shift Command Center

An eye-friendly, telemetry-rich command center dashboard engineered for overnight operations, daily ticket triage, SLA monitoring, and morning handover reporting.

---

## ✨ Features

- **Eye-Comfort Design**: Specifically styled with **Twilight Slate** dark mode (low-contrast, soft borders, zero harsh neon burns) and a circadian **Calm Light** toggle for morning handovers.
- **Tickets Overview**: Influx tracking across *Received*, *Resolved & Closed*, *Waiting Final*, *Pending Client*, *Open*, and *Passed Handover*.
- **Visual Telemetry**: Integrated Chart.js doughnut chart breaking down real-time triage stages.
- **SLA & Resolution Attainment**: Visual progress gauges calculating effective resolution %, non-closed pass %, and overall SLA attainment %.
- **AI Operations Copilot**: Metrics on AI-assisted volumes, zero-touch resolutions, accuracy rate %, human corrections, and failures.
- **Go-Live & Production Releases**: Tracking deployments conducted, linked tickets, on-call fixes (without tickets), and critical Sev-1 escalations.
- **Handover Pass Analysis**: Root cause reasons for passed tickets with cross-team dependencies and resolution feasibility (Yes / No).
- **Knowledge & Continual Improvement**: Tracking KB gaps identified, new KB articles created, training actions, and repeat bug patterns.
- **Engineering Roster**: Night shift engineer contributions, resolved ticket counts, resolution efficiency %, and assigned operational roles.
- **Multi-Day Shift Persistence**: Stores all historical shifts in browser `localStorage`, with date stepping (Previous/Next Day), calendar jump, and a searchable Shift History Archive.
- **Spreadsheet & Notes Ingestion Hub**:
  - **Excel Drag & Drop**: Ingests `.xlsx`, `.xls`, or `.csv` files automatically using SheetJS.
  - **Structured Text / Shift Notes Parser**: Ingests pipe tables or key-value text logs.
  - **Dedicated Pass Analysis Ingestion**: Update handover reasons and dependencies without modifying ticket counts.
  - **Template Generation**: One-click download of a pre-formatted Excel template.
- **Instant Handover Generation**: Formats and copies a complete markdown summary to the clipboard ready for Slack, Microsoft Teams, or email handoff.

---

## 🚀 Running Locally

### Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run preview
```

---

## 📁 Project Architecture

```
night-shift-command-center/
├── package.json              # Scripts and dependencies (Vite, Chart.js, SheetJS)
├── vite.config.js            # Vite configuration
├── index.html                # Semantic HTML5 dashboard shell
├── src/
│   ├── css/
│   │   ├── tokens.css        # Eye-friendly design tokens (Dark & Light)
│   │   ├── base.css          # Typography, minimal scrollbars, and resets
│   │   ├── components.css    # Cards, pills, buttons, tables, modals, toasts
│   │   └── dashboard.css     # Layout grids, progress rings, and chart container
│   └── js/
│       ├── state.js          # Multi-day shift store & localStorage sync
│       ├── metrics.js        # KPI formulas & calculations
│       ├── charts.js         # Chart.js telemetry visualizations
│       ├── parser.js         # Excel workbook & text notes ingestion
│       ├── export.js         # Excel template export & clipboard handover generator
│       ├── ui.js             # DOM controller, modal managers, & toasts
│       └── app.js            # Application bootstrapper
└── README.md
```

---

## 📋 Daily Spreadsheet Format

The command center accepts spreadsheets generated from the built-in **Template** button with sections:
- **TICKETS**: Received, Resolved & Closed, Waiting Final Response, Pending Client Response, Open, Passed
- **RESOLUTION**: Resolution %, Pass %, SLA %
- **AI**: AI Assisted, AI Accuracy, AI Resolution, Zero Touch, Human Correction, AI Failures
- **GO-LIVE**: Go-Lives, Tickets, On-Call Fixes, Critical, Resolved, Passed
- **KNOWLEDGE**: KB Gaps, KB Created, Training, Repeat Issues
- **TEAM**: Engineer, Tickets Resolved, Resolution %, Role

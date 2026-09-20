/* ==========================================================================
   State Management & Multi-Day Persistence
   ========================================================================== */

const STORAGE_KEY = "night_shift_cmd_center_store_v2";
const THEME_KEY = "night_shift_theme_v2";

export function getDefaultShiftRecord(dateKey = "2026-09-20", leadName = "Aarjan Shrestha") {
  return {
    meta: {
      date: dateKey,
      lead: leadName,
      lastUpdated: "Standard Roster Seed",
      status: "Shift Logged"
    },
    tickets: {
      received: 69,
      resolvedClosed: 11,
      waitingFinal: 6,
      pendingClient: 35,
      open: 10,
      nightToDay: 7,
      nightToDayVerify: 4,
      nightToDayExternal: 3,
      passed: 17
    },
    resolution: {
      resolutionPct: 24.6, // (11 + 6) / 69
      passPct: 84.1,       // (69 - 11) / 69
      slaPct: 91.2
    },
    ai: {
      assisted: 56,
      accuracy: 92.9,
      resolution: 10,
      zeroTouch: 4,
      humanCorrection: 3,
      failures: 1
    },
    goLive: {
      count: 3,
      tickets: 7,
      onCallFixes: 2,
      critical: 4,
      resolved: 0,
      passed: 2
    },
    passAnalysis: {
      whyPassed: [
        { reason: "Awaiting Client Database Approval", count: 3, team: "Client DevOps" },
        { reason: "Vendor 3rd-party API Outage", count: 2, team: "Payment Gateway" },
        { reason: "Daylight Architecture Review Required", count: 2, team: "Core Engineering" }
      ],
      couldResolveYes: 2,
      couldResolveNo: 5,
      teamDependency: "Cloud DevOps & DBA"
    },
    knowledge: {
      gaps: 2,
      created: 2,
      training: 1,
      repeatIssues: 5,
      notes: [
        "KB-849: Redis cluster memory eviction threshold runbook updated.",
        "Identified repeat issue: Payment gateway timeout spike during 02:00 batch cycle."
      ]
    },
    team: [
      { name: "Sagun Basnet", resolved: 10, resolution: 90, tag: "Lead Tier-2" },
      { name: "Aarjan Shrestha", resolved: 9, resolution: 89, tag: "Senior Triage" },
      { name: "Nima Lama", resolved: 7, resolution: 71, tag: "Core Specialist" },
      { name: "Sujan Dahal", resolved: 4, resolution: 75, tag: "Senior Support" }
    ]
  };
}

class ShiftStateStore {
  constructor() {
    this.shifts = {};
    this.activeDate = "2026-09-20";
    this.theme = "dark";
    this.subscribers = [];
    this.init();
  }

  init() {
    // 1. Load Theme
    try {
      if (typeof localStorage !== 'undefined') {
        const savedTheme = localStorage.getItem(THEME_KEY);
        this.theme = savedTheme === "light" ? "light" : "dark";
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute("data-theme", this.theme);
      }
    } catch (e) {
      this.theme = "dark";
    }

    // 2. Load Shifts from LocalStorage
    let loaded = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) loaded = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Storage read error", e);
    }

    if (loaded && typeof loaded === 'object' && Object.keys(loaded).length > 0) {
      this.shifts = loaded;
      const sortedDates = Object.keys(this.shifts).sort().reverse();
      this.activeDate = sortedDates[0] || "2026-09-20";
    } else {
      // Seed Demo Shifts
      const today = "2026-09-20";
      const yest = "2026-09-19";

      this.shifts[today] = getDefaultShiftRecord(today, "Aarjan Shrestha");

      const yestShift = getDefaultShiftRecord(yest, "Sagun Basnet");
      yestShift.tickets = { received: 58, resolvedClosed: 20, waitingFinal: 8, pendingClient: 22, open: 4, nightToDay: 3, nightToDayVerify: 2, nightToDayExternal: 1, passed: 4 };
      yestShift.resolution = { resolutionPct: 48.3, passPct: 65.5, slaPct: 96.0 };
      yestShift.ai.assisted = 45;
      yestShift.ai.accuracy = 94.0;
      yestShift.goLive.onCallFixes = 3;
      yestShift.meta.lastUpdated = "Historical Handover Log";
      this.shifts[yest] = yestShift;

      this.activeDate = today;
      this.persist();
    }
  }

  persist() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shifts));
      }
    } catch (e) {
      console.warn("Storage write error", e);
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(fn => fn !== callback);
    };
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.getActiveShift(), this));
  }

  getActiveShift() {
    if (!this.shifts[this.activeDate]) {
      this.shifts[this.activeDate] = getDefaultShiftRecord(this.activeDate, "Unassigned Lead");
      this.shifts[this.activeDate].meta.lastUpdated = "New Shift Draft";
      this.persist();
    }
    return this.shifts[this.activeDate];
  }

  setActiveDate(newDate) {
    if (!newDate) return;
    this.activeDate = newDate;
    if (!this.shifts[newDate]) {
      this.shifts[newDate] = getDefaultShiftRecord(newDate, "Unassigned Lead");
      this.shifts[newDate].meta.lastUpdated = "New Shift Draft";
      this.persist();
    }
    this.notify();
  }

  stepDate(delta) {
    const dates = Object.keys(this.shifts).sort();
    const curIdx = dates.indexOf(this.activeDate);

    if (curIdx !== -1) {
      const nextIdx = curIdx + delta;
      if (nextIdx >= 0 && nextIdx < dates.length) {
        this.setActiveDate(dates[nextIdx]);
        return;
      }
    }

    // Step calendar day if not found in list
    const d = new Date(this.activeDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const newDateStr = d.toISOString().split('T')[0];
    this.setActiveDate(newDateStr);
  }

  updateActiveShift(updatedData) {
    this.shifts[this.activeDate] = updatedData;
    this.persist();
    this.notify();
  }

  saveShift(dateKey, shiftRecord) {
    this.shifts[dateKey] = shiftRecord;
    this.persist();
    if (this.activeDate === dateKey) {
      this.notify();
    }
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", this.theme);
    try {
      localStorage.setItem(THEME_KEY, this.theme);
    } catch (e) { }
    this.notify();
  }

  resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.shifts = {};
    this.init();
    this.notify();
  }
}

export const store = new ShiftStateStore();

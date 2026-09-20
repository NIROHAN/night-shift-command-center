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

import {
  getStoredCloudConfig,
  saveStoredCloudConfig,
  getStoredLastSync,
  parseUrlCloudConfig,
  fetchShiftsFromCloud,
  pushShiftToCloud,
  pushAllShiftsToCloud,
  testCloudConnection
} from './cloudStore.js';

class ShiftStateStore {
  constructor() {
    this.shifts = {};
    this.activeDate = "2026-09-20";
    this.theme = "dark";
    this.subscribers = [];
    this.cloudConfig = getStoredCloudConfig();
    this.syncStatus = {
      state: this.cloudConfig.provider !== 'none' ? 'idle' : 'local_only',
      message: this.cloudConfig.provider !== 'none' ? 'Ready to sync' : 'Local Storage Only',
      lastSync: getStoredLastSync(),
      provider: this.cloudConfig.provider
    };
    this.init();
  }

  init() {
    // 1. Check for Cloud Config in URL invite link
    const urlConfig = parseUrlCloudConfig();
    if (urlConfig) {
      this.cloudConfig = urlConfig;
      this.syncStatus.provider = urlConfig.provider;
    }

    // 2. Load Theme
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

    // 3. Load Shifts from LocalStorage (Instant local-first cache)
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

    // 4. Background Cloud Hydration (pull latest shifts shared by team)
    if (this.cloudConfig && this.cloudConfig.provider !== 'none') {
      this.syncFromCloud(false);
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

  async syncFromCloud(forceNotification = true) {
    if (!this.cloudConfig || this.cloudConfig.provider === 'none') {
      this.syncStatus = {
        state: 'local_only',
        message: 'Local Storage Only',
        lastSync: getStoredLastSync(),
        provider: 'none'
      };
      if (forceNotification) this.notify();
      return { success: false, message: 'Cloud sync not configured' };
    }

    this.syncStatus.state = 'syncing';
    this.syncStatus.message = 'Syncing with cloud...';
    this.notify();

    const result = await fetchShiftsFromCloud(this.cloudConfig);
    if (result.success && result.shifts) {
      const remoteDates = Object.keys(result.shifts);
      if (remoteDates.length > 0) {
        // Merge remote shifts into local storage
        this.shifts = { ...this.shifts, ...result.shifts };
        this.persist();

        const sorted = Object.keys(this.shifts).sort().reverse();
        if (!this.shifts[this.activeDate] && sorted.length > 0) {
          this.activeDate = sorted[0];
        }
      }

      this.syncStatus = {
        state: 'synced',
        message: 'Live Cloud Synced',
        lastSync: result.lastSync,
        provider: result.provider
      };
      this.notify();
      return { success: true, count: remoteDates.length, lastSync: result.lastSync };
    } else {
      this.syncStatus = {
        state: 'error',
        message: result.error || result.message || 'Cloud sync failed',
        lastSync: getStoredLastSync(),
        provider: this.cloudConfig.provider
      };
      this.notify();
      return { success: false, error: this.syncStatus.message };
    }
  }

  setCloudConfig(newConfig) {
    this.cloudConfig = newConfig;
    saveStoredCloudConfig(newConfig);
    this.syncStatus.provider = newConfig.provider;
    if (newConfig.provider !== 'none') {
      return this.syncFromCloud(true);
    } else {
      this.syncStatus = {
        state: 'local_only',
        message: 'Local Storage Only',
        lastSync: null,
        provider: 'none'
      };
      this.notify();
      return Promise.resolve({ success: true });
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

    // Async push to cloud
    if (this.cloudConfig && this.cloudConfig.provider !== 'none') {
      pushShiftToCloud(this.activeDate, updatedData, this.shifts).then(res => {
        if (res.success) {
          this.syncStatus.state = 'synced';
          this.syncStatus.lastSync = res.lastSync;
          this.notify();
        }
      });
    }
  }

  saveShift(dateKey, shiftRecord) {
    this.shifts[dateKey] = shiftRecord;
    this.persist();
    if (this.activeDate === dateKey) {
      this.notify();
    }

    // Async push to cloud
    if (this.cloudConfig && this.cloudConfig.provider !== 'none') {
      pushShiftToCloud(dateKey, shiftRecord, this.shifts).then(res => {
        if (res.success) {
          this.syncStatus.state = 'synced';
          this.syncStatus.lastSync = res.lastSync;
          this.notify();
        }
      });
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

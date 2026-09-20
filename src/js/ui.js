/* ==========================================================================
   UI Controller: DOM Rendering, Modals, Toasts & Event Handlers
   ========================================================================== */

import { calculateMetrics } from './metrics.js';
import { updateTicketChart } from './charts.js';
import { parseExcelBuffer, parseNotesText, parsePassAnalysisText } from './parser.js';
import { downloadExcelTemplate, copyHandoverToClipboard } from './export.js';

function safeSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-dot"></span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

export function renderDashboard(shift, store) {
  const m = calculateMetrics(shift);

  // 1. Meta Banner & Date Pickers
  const datePicker = document.getElementById('shiftDatePicker');
  if (datePicker) datePicker.value = shift.meta.date;

  safeSetText('metaShiftDate', shift.meta.date);
  safeSetText('metaShiftLead', shift.meta.lead);
  safeSetText('lastImportTimestamp', shift.meta.lastUpdated);
  safeSetText('passTabTargetDate', shift.meta.date);

  const totalDays = Object.keys(store.shifts).length;
  safeSetText('totalDaysCount', `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`);
  safeSetText('historyBadgeCount', totalDays);

  // 2. Tickets Overview
  safeSetText('valReceived', m.received);
  safeSetText('valResolvedClosed', m.resolvedClosed);
  safeSetText('valWaitingFinal', m.waitingFinal);
  safeSetText('valPendingClient', m.pendingClient);
  safeSetText('valOpen', m.open);
  safeSetText('valNightToDay', m.nightToDay);
  safeSetText('valPassed', m.passed);

  safeSetText('valResolvedClosedRatio', `${m.resolvedClosedRatio}%`);
  safeSetText('valNightToDayRatio', `${m.nightToDayRatio}%`);
  safeSetText('valPassedRatio', `${m.passedRatio}%`);
  safeSetText('ticketResolutionRate', `Effective Resolution Rate: ${m.resolutionPct}%`);

  // Night to Day Status Section Breakdown
  safeSetText('n2dTotalCount', m.nightToDay);
  safeSetText('n2dVerifyCount', m.nightToDayVerify);
  safeSetText('n2dExternalCount', m.nightToDayExternal);

  // Update Doughnut Chart
  updateTicketChart(shift.tickets);

  // 3. Resolution & SLA Attainment
  safeSetText('rateResolution', `${m.resolutionPct}%`);
  safeSetText('ratePass', `${m.passPct}%`);
  safeSetText('rateSLA', `${m.slaPct}%`);

  safeSetText('badgeResolution', `${Math.round(m.resolutionPct)}%`);
  safeSetText('badgePass', `${Math.round(m.passPct)}%`);
  safeSetText('badgeSLA', `${Math.round(m.slaPct)}%`);

  const barRes = document.getElementById('barResolution');
  if (barRes) barRes.style.width = `${Math.min(100, Math.max(0, m.resolutionPct))}%`;

  const barPass = document.getElementById('barPass');
  if (barPass) barPass.style.width = `${Math.min(100, Math.max(0, m.passPct))}%`;

  const barSLA = document.getElementById('barSLA');
  if (barSLA) barSLA.style.width = `${Math.min(100, Math.max(0, m.slaPct))}%`;

  // 4. AI Telemetry
  safeSetText('aiAssisted', shift.ai.assisted);
  safeSetText('aiAccuracy', `${m.aiAccuracy}%`);
  safeSetText('aiResolution', shift.ai.resolution);
  safeSetText('aiZeroTouch', shift.ai.zeroTouch);
  safeSetText('aiHumanCorrection', shift.ai.humanCorrection);
  safeSetText('aiFailures', shift.ai.failures);
  safeSetText('aiAdoptionBadge', `AI Coverage: ${m.aiCoverage}%`);

  // 5. Go-Live Tracker
  const gl = shift.goLive;
  safeSetText('glCount', gl.count || 0);
  safeSetText('glTickets', gl.tickets || 0);
  safeSetText('glOnCall', gl.onCallFixes || 0);
  safeSetText('glCritical', gl.critical || 0);
  safeSetText('glResolved', gl.resolved || 0);
  safeSetText('glPassed', gl.passed || 0);

  const glBadge = document.getElementById('goliveStatusBadge');
  if (glBadge) {
    if (m.glCritical > 0) {
      glBadge.textContent = `${m.glCritical} Critical Escalated`;
      glBadge.className = "pill pill-danger";
    } else {
      glBadge.textContent = "All Systems Nominal";
      glBadge.className = "pill pill-success";
    }
  }

  // 6. Handover Pass Analysis
  safeSetText('passCountHeader', `${m.passed} Tickets Passed`);
  safeSetText('passCouldResolveYes', shift.passAnalysis.couldResolveYes || 0);
  safeSetText('passCouldResolveNo', shift.passAnalysis.couldResolveNo || 0);
  safeSetText('passPrimaryDependency', shift.passAnalysis.teamDependency || "None");

  const passContainer = document.getElementById('passAnalysisContainer');
  if (passContainer) {
    passContainer.innerHTML = '';
    (shift.passAnalysis.whyPassed || []).forEach(item => {
      const row = document.createElement('div');
      row.className = "pass-reason-row";
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-warning);"></span>
          <span style="color: var(--text-primary);">${item.reason}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="pill pill-primary" style="font-size: 0.65rem;">${item.team}</span>
          <span class="pill pill-warning">${item.count}</span>
        </div>
      `;
      passContainer.appendChild(row);
    });
  }

  // 7. Knowledge & Lessons Learned
  safeSetText('kbGaps', shift.knowledge.gaps);
  safeSetText('kbCreated', shift.knowledge.created);
  safeSetText('kbTraining', shift.knowledge.training);
  safeSetText('kbRepeat', shift.knowledge.repeatIssues);

  const kbList = document.getElementById('kbNotesList');
  if (kbList) {
    kbList.innerHTML = '';
    (shift.knowledge.notes || []).forEach(note => {
      const li = document.createElement('li');
      li.className = "knowledge-item";
      li.innerHTML = `<span class="knowledge-item-bullet">•</span><span>${note}</span>`;
      kbList.appendChild(li);
    });
  }

  // 8. Team Roster Table
  safeSetText('teamActiveCount', `${(shift.team || []).length} Engineers Active`);
  const tbody = document.getElementById('teamTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    (shift.team || []).forEach(eng => {
      const initials = eng.name.split(' ').map(n => n[0]).join('');
      const resolvedCount = eng.resolved !== undefined ? eng.resolved : (eng.tickets || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span class="avatar-initials">${initials}</span>
          <span style="font-weight: 600;">${eng.name}</span>
        </td>
        <td class="font-mono" style="color: var(--accent-success); font-weight: 700;">${resolvedCount}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="font-mono" style="font-weight: 600; width: 38px;">${eng.resolution}%</span>
            <div class="progress-bar-container" style="margin: 0; width: 80px;">
              <div class="progress-bar-fill fill-primary" style="width: ${eng.resolution}%"></div>
            </div>
          </div>
        </td>
        <td style="text-align: right;">
          <span class="pill" style="background-color: var(--bg-subtle); color: var(--text-secondary); border-color: var(--border-subtle);">
            ${eng.tag || 'Engineer'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

export function renderHistoryList(store) {
  const container = document.getElementById('historyCardsContainer');
  if (!container) return;

  const searchInput = document.getElementById('archiveSearchInput');
  const query = (searchInput?.value || "").toLowerCase().trim();
  const dates = Object.keys(store.shifts).sort().reverse();

  safeSetText('archiveCountDisplay', `${dates.length} Days`);
  container.innerHTML = '';

  const filtered = dates.filter(d => {
    const s = store.shifts[d];
    return d.toLowerCase().includes(query) || (s?.meta?.lead || "").toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 2.5rem; color: var(--text-muted); font-size: 0.85rem;">No matching shift records found.</div>`;
    return;
  }

  filtered.forEach(d => {
    const item = store.shifts[d];
    const isActive = d === store.activeDate;
    const row = document.createElement('div');
    row.className = `history-row ${isActive ? 'active' : ''}`;

    const dateObj = new Date(d + 'T00:00:00');
    const month = dateObj.toLocaleString('default', { month: 'short' });
    const day = d.split('-')[2];

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <div class="date-badge-box">
          <span class="month">${month}</span>
          <span class="day">${day}</span>
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong class="font-mono" style="font-size: 0.9rem;">${d}</strong>
            ${isActive ? '<span class="pill pill-primary">ACTIVE</span>' : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Lead: <span style="color: var(--text-primary); font-weight: 500;">${item.meta?.lead || 'N/A'}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 1.25rem; font-family: var(--font-mono); font-size: 0.75rem;">
        <div style="text-align: center;">
          <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Received</div>
          <div style="font-weight: 700;">${item.tickets.received}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Resolved</div>
          <div style="font-weight: 700; color: var(--accent-success);">${item.tickets.resolvedClosed !== undefined ? item.tickets.resolvedClosed : item.tickets.resolved}</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">SLA</div>
          <div style="font-weight: 700; color: var(--accent-primary);">${item.resolution.slaPct}%</div>
        </div>
      </div>
    `;

    row.onclick = () => {
      store.setActiveDate(d);
      closeModal('historyModal');
      showToast(`Switched view to shift on ${d}`, 'info');
    };

    container.appendChild(row);
  });
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

export function setupEventListeners(store) {
  // Theme Toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.onclick = () => {
      store.toggleTheme();
      showToast(`Switched to ${store.theme === 'dark' ? 'Twilight Dark' : 'Eye-Comfort Light'} theme`, 'info');
    };
  }

  // Date Stepping
  document.getElementById('prevDayBtn')?.addEventListener('click', () => store.stepDate(-1));
  document.getElementById('nextDayBtn')?.addEventListener('click', () => store.stepDate(1));
  document.getElementById('shiftDatePicker')?.addEventListener('change', (e) => {
    if (e.target.value) store.setActiveDate(e.target.value);
  });

  // History Modal
  document.getElementById('openHistoryBtn')?.addEventListener('click', () => {
    renderHistoryList(store);
    openModal('historyModal');
  });
  document.getElementById('closeHistoryBtn')?.addEventListener('click', () => closeModal('historyModal'));
  document.getElementById('closeHistoryFooterBtn')?.addEventListener('click', () => closeModal('historyModal'));
  document.getElementById('archiveSearchInput')?.addEventListener('input', () => renderHistoryList(store));

  // Import Modal
  document.getElementById('openImportBtn')?.addEventListener('click', () => {
    const targetDateInput = document.getElementById('importTargetDate');
    if (targetDateInput) targetDateInput.value = store.activeDate;
    safeSetText('passTabTargetDate', store.activeDate);
    populateN2DInputs(store.getActiveShift(), store.activeDate);
    openModal('importModal');
  });
  document.getElementById('closeImportBtn')?.addEventListener('click', () => closeModal('importModal'));
  document.getElementById('cancelImportBtn')?.addEventListener('click', () => closeModal('importModal'));

  // Quick Open Pass Import
  document.getElementById('openPassImportBtn')?.addEventListener('click', () => {
    const targetDateInput = document.getElementById('importTargetDate');
    if (targetDateInput) targetDateInput.value = store.activeDate;
    safeSetText('passTabTargetDate', store.activeDate);
    openModal('importModal');
    switchImportTab('pass');
  });

  // Quick Open Night to Day Triage
  document.getElementById('openN2DImportBtn')?.addEventListener('click', () => {
    const targetDateInput = document.getElementById('importTargetDate');
    if (targetDateInput) targetDateInput.value = store.activeDate;
    safeSetText('passTabTargetDate', store.activeDate);
    populateN2DInputs(store.getActiveShift(), store.activeDate);
    openModal('importModal');
    switchImportTab('n2d');
  });

  // Tab Switching inside Import Modal
  const tabs = ['excel', 'notes', 'pass', 'n2d'];
  tabs.forEach(tab => {
    document.getElementById(`tabBtn_${tab}`)?.addEventListener('click', () => {
      if (tab === 'n2d') {
        populateN2DInputs(store.getActiveShift(), store.activeDate);
      }
      switchImportTab(tab);
    });
  });

  // Live auto-calculation for Night to Day inputs
  const inputTotal = document.getElementById('n2dInputTotal');
  const inputVerify = document.getElementById('n2dInputVerify');
  const inputExternal = document.getElementById('n2dInputExternal');
  const updateN2DTotalFromSubs = () => {
    const v = parseInt(inputVerify?.value || '0', 10) || 0;
    const x = parseInt(inputExternal?.value || '0', 10) || 0;
    if (inputTotal) inputTotal.value = v + x;
  };
  inputVerify?.addEventListener('input', updateN2DTotalFromSubs);
  inputExternal?.addEventListener('input', updateN2DTotalFromSubs);

  inputTotal?.addEventListener('input', () => {
    const tot = parseInt(inputTotal?.value || '0', 10) || 0;
    const v = Math.ceil(tot * 0.6);
    const x = Math.max(0, tot - v);
    if (inputVerify) inputVerify.value = v;
    if (inputExternal) inputExternal.value = x;
  });

  // Reset to Factory Demo
  document.getElementById('resetFactoryDemoBtn')?.addEventListener('click', () => {
    if (confirm("Reset all recorded shifts to initial seed data?")) {
      store.resetToDefault();
      closeModal('importModal');
      showToast("Reset shift records to sample dataset", "info");
    }
  });

  // Export & Handover Buttons
  document.getElementById('downloadTemplateBtn')?.addEventListener('click', () => {
    downloadExcelTemplate(store.getActiveShift());
    showToast(`Excel template downloaded for ${store.activeDate}`, 'success');
  });

  document.getElementById('copyHandoverBtn')?.addEventListener('click', async () => {
    const success = await copyHandoverToClipboard(store.getActiveShift());
    if (success) {
      showToast("Handover summary copied to clipboard! Ready to paste into Slack/Teams", "success");
    } else {
      showToast("Could not copy to clipboard. Please check browser permissions.", "error");
    }
  });

  // Sample Text Loaders
  document.getElementById('loadSampleNotesBtn')?.addEventListener('click', () => {
    const sample = `NIGHT SHIFT COMMAND CENTER
Shift Date: ${store.activeDate}
Shift Lead: Aarjan Shrestha

TICKETS
Received | Resolved & Closed | Waiting Final Response | Pending Client Response | Open | Night to Day | Passed
69 | 11 | 6 | 35 | 10 | 5 | 7

RESOLUTION
Resolution % | Pass % | SLA %
24.6% | 84.1% | 91.2%

AI
AI Assisted: 56
AI Accuracy: 92.9%
AI Resolution: 10
Zero Touch: 4
Human Correction: 3
AI Failures: 1

GO-LIVE
Go-Lives | Tickets | Critical | Resolved | Passed
3 | 7 | 4 | 0 | 2

KNOWLEDGE
KB Gaps: 2
KB Created: 2
Training: 1
Repeat Issues: 5

TEAM
Engineer | Tickets Resolved | Resolution % | Role
Sagun Basnet | 10 | 90% | Lead Tier-2
Aarjan Shrestha | 9 | 89% | Senior Triage
Nima Lama | 7 | 71% | Core Specialist
Sujan Dahal | 4 | 75% | Senior Support`;

    const txt = document.getElementById('notesImportText');
    if (txt) txt.value = sample;
    showToast("Loaded sample shift notes into editor", "info");
  });

  document.getElementById('loadSamplePassBtn')?.addEventListener('click', () => {
    const sample = `Reason | Count | Team Dependency
Awaiting Client Database Approval | 3 | Client DevOps
Vendor 3rd-party API Outage | 2 | Payment Gateway
Daylight Architecture Review Required | 2 | Core Engineering

Could Resolve: Yes: 2 | No: 5
Primary Dependency: Cloud DevOps & DBA`;

    const txt = document.getElementById('passAnalysisImportText');
    if (txt) txt.value = sample;
    showToast("Loaded sample Pass Analysis data into editor", "info");
  });

  // Process Ingestion (Apply & Save)
  document.getElementById('processImportBtn')?.addEventListener('click', () => {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'excel';

    if (activeTab === 'pass') {
      const text = document.getElementById('passAnalysisImportText')?.value?.trim() || '';
      if (!text) {
        showToast("Please enter or paste pass notes first", "error");
        return;
      }
      const updated = parsePassAnalysisText(text, store.getActiveShift());
      store.updateActiveShift(updated);
      closeModal('importModal');
      showToast(`Handover Pass analysis updated for ${store.activeDate}!`, "success");
      return;
    }

    if (activeTab === 'n2d') {
      const totalVal = parseInt(document.getElementById('n2dInputTotal')?.value, 10);
      const verifyVal = parseInt(document.getElementById('n2dInputVerify')?.value, 10);
      const externalVal = parseInt(document.getElementById('n2dInputExternal')?.value, 10);
      const notesVal = document.getElementById('n2dInputNotes')?.value?.trim() || '';

      const n2dTotal = !isNaN(totalVal) ? Math.max(0, totalVal) : 0;
      const n2dVerify = !isNaN(verifyVal) ? Math.max(0, verifyVal) : Math.ceil(n2dTotal * 0.6);
      const n2dExternal = !isNaN(externalVal) ? Math.max(0, externalVal) : Math.max(0, n2dTotal - n2dVerify);

      const curShift = store.getActiveShift();
      curShift.tickets.nightToDay = n2dTotal;
      curShift.tickets.nightToDayVerify = n2dVerify;
      curShift.tickets.nightToDayExternal = n2dExternal;

      // Crucial rule: In case of passed, it is open tickets plus Night to Day ticket
      const openTickets = Number(curShift.tickets.open) || 0;
      curShift.tickets.passed = openTickets + n2dTotal;

      if (notesVal) {
        if (!curShift.knowledge) curShift.knowledge = {};
        if (!curShift.knowledge.notes) curShift.knowledge.notes = [];
        curShift.knowledge.notes.unshift(`[Night to Day Triage] ${notesVal}`);
      }

      curShift.meta.lastUpdated = `Triage updated @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      store.updateActiveShift(curShift);
      closeModal('importModal');
      showToast(`Night to Day triage updated! Passed = ${curShift.tickets.passed} (Open: ${openTickets} + N2D: ${n2dTotal})`, "success");
      return;
    }

    if (activeTab === 'notes') {
      const text = document.getElementById('notesImportText')?.value?.trim() || '';
      if (!text) {
        showToast("Please enter shift notes text first", "error");
        return;
      }
      const targetDate = document.getElementById('importTargetDate')?.value || store.activeDate;
      const { parsedDate, shiftData } = parseNotesText(text, targetDate, store.shifts[targetDate]);
      store.saveShift(parsedDate, shiftData);
      store.setActiveDate(parsedDate);
      closeModal('importModal');
      showToast(`Shift log applied & saved for ${parsedDate}!`, "success");
      return;
    }

    // Excel Tab
    const fileInput = document.getElementById('excelFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showToast("Please select or drop an Excel (.xlsx / .csv) file first", "error");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { parsedDate, shiftData } = parseExcelBuffer(e.target.result, file.name, store.activeDate, store.getActiveShift());
        store.saveShift(parsedDate, shiftData);
        store.setActiveDate(parsedDate);
        closeModal('importModal');
        showToast(`Imported ${file.name} for ${parsedDate}!`, "success");
      } catch (err) {
        console.error(err);
        showToast("Failed to parse Excel spreadsheet. Ensure valid format.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // Dropzone drag-and-drop
  const dropzone = document.getElementById('excelDropzone');
  const fileInput = document.getElementById('excelFileInput');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const fileNameEl = document.getElementById('selectedExcelName');
        if (fileNameEl) fileNameEl.textContent = `Selected: ${fileInput.files[0].name}`;
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        const fileNameEl = document.getElementById('selectedExcelName');
        if (fileNameEl) fileNameEl.textContent = `Selected: ${files[0].name}`;
      }
    });
  }

  // Quick Edit Shift Lead
  const leadEl = document.getElementById('metaShiftLead');
  if (leadEl) {
    leadEl.addEventListener('click', () => {
      const current = store.getActiveShift().meta.lead;
      const newLead = prompt("Enter Shift Lead Name:", current);
      if (newLead && newLead.trim() && newLead !== current) {
        const cur = store.getActiveShift();
        cur.meta.lead = newLead.trim();
        cur.meta.lastUpdated = `Lead edited @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        store.updateActiveShift(cur);
        showToast(`Shift lead updated to ${newLead.trim()}`, "success");
      }
    });
  }
}

function populateN2DInputs(shift, targetDate) {
  safeSetText('n2dTabTargetDate', targetDate);
  const inputTotal = document.getElementById('n2dInputTotal');
  const inputVerify = document.getElementById('n2dInputVerify');
  const inputExternal = document.getElementById('n2dInputExternal');
  if (inputTotal && shift?.tickets) inputTotal.value = shift.tickets.nightToDay ?? 7;
  if (inputVerify && shift?.tickets) inputVerify.value = shift.tickets.nightToDayVerify ?? 4;
  if (inputExternal && shift?.tickets) inputExternal.value = shift.tickets.nightToDayExternal ?? 3;
}

function switchImportTab(tabName) {
  const tabs = ['excel', 'notes', 'pass', 'n2d'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn_${t}`);
    const content = document.getElementById(`tabContent_${t}`);
    if (t === tabName) {
      btn?.classList.add('active');
      if (content) content.style.display = t === 'excel' ? 'block' : 'flex';
    } else {
      btn?.classList.remove('active');
      if (content) content.style.display = 'none';
    }
  });
}

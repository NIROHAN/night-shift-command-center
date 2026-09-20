/* ==========================================================================
   Export & Handover Generation Utilities
   ========================================================================== */

import * as XLSX from 'xlsx';

export function downloadExcelTemplate(shift) {
  const dateKey = shift.meta?.date || "2026-09-20";
  const leadName = shift.meta?.lead || "Aarjan Shrestha";

  const sheetData = [
    ["NIGHT SHIFT COMMAND CENTER - DAILY SHIFT LOG"],
    ["Shift Date", dateKey],
    ["Shift Lead", leadName],
    [],
    ["TICKETS"],
    ["Metric", "Count"],
    ["Received", shift.tickets.received],
    ["Resolved & Closed", shift.tickets.resolvedClosed !== undefined ? shift.tickets.resolvedClosed : shift.tickets.resolved],
    ["Waiting Final Response", shift.tickets.waitingFinal || 0],
    ["Pending Client Response", shift.tickets.pendingClient || 0],
    ["Open", shift.tickets.open || 0],
    ["Night to Day", shift.tickets.nightToDay || 0],
    ["Passed", shift.tickets.passed || 0],
    [],
    ["RESOLUTION"],
    ["Metric", "Percentage"],
    ["Resolution %", shift.resolution.resolutionPct],
    ["Pass %", shift.resolution.passPct],
    ["SLA %", shift.resolution.slaPct],
    [],
    ["AI"],
    ["Metric", "Value"],
    ["AI Assisted", shift.ai.assisted],
    ["AI Accuracy", shift.ai.accuracy],
    ["AI Resolution", shift.ai.resolution],
    ["Zero Touch", shift.ai.zeroTouch],
    ["Human Correction", shift.ai.humanCorrection],
    ["AI Failures", shift.ai.failures],
    [],
    ["GO-LIVE"],
    ["Metric", "Value"],
    ["Go-Lives", shift.goLive.count],
    ["Tickets", shift.goLive.tickets],
    ["On-Call Fixes", shift.goLive.onCallFixes || 0],
    ["Critical", shift.goLive.critical],
    ["Resolved", shift.goLive.resolved || 0],
    ["Passed", shift.goLive.passed || 0],
    [],
    ["KNOWLEDGE"],
    ["Metric", "Count"],
    ["KB Gaps", shift.knowledge.gaps],
    ["KB Created", shift.knowledge.created],
    ["Training", shift.knowledge.training],
    ["Repeat Issues", shift.knowledge.repeatIssues],
    [],
    ["TEAM"],
    ["Engineer", "Tickets Resolved", "Resolution %", "Role"],
    ...(shift.team || []).map(eng => [
      eng.name,
      eng.resolved !== undefined ? eng.resolved : (eng.tickets || 0),
      eng.resolution,
      eng.tag || "Engineer"
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Shift_Data");
  XLSX.writeFile(wb, `Night_Shift_Log_${dateKey}.xlsx`);
}

export function generateHandoverText(shift) {
  const t = shift.tickets;
  const r = shift.resolution;
  const ai = shift.ai;
  const gl = shift.goLive;
  const pass = shift.passAnalysis || {};

  return `*NIGHT SHIFT COMMAND CENTER HANDOVER*
📅 Shift Date: ${shift.meta.date} | 👤 Shift Lead: ${shift.meta.lead}
--------------------------------------------------
🎫 TICKETS OVERVIEW:
• Influx / Received: ${t.received}
• Resolved & Closed: ${t.resolvedClosed !== undefined ? t.resolvedClosed : t.resolved}
• Waiting Final Response: ${t.waitingFinal || 0}
• Pending Client: ${t.pendingClient !== undefined ? t.pendingClient : t.pending}
• Active Open: ${t.open || 0}
• Night to Day (Day Verify/External): ${t.nightToDay || 0}
• Passed to Next Shift: ${t.passed}

📊 RESOLUTION & SLA:
• Resolution Rate: ${r.resolutionPct}% (Closed + Resolved + Waiting Final)
• Handover Pass Rate: ${r.passPct}% (Active passed tickets)
• SLA Attainment: ${r.slaPct}%

🤖 AI OPS & COPILOT:
• AI Assisted: ${ai.assisted} | Accuracy: ${ai.accuracy}%
• Zero-Touch Resolutions: ${ai.zeroTouch} | Failures: ${ai.failures}

🚀 GO-LIVE & RELEASES:
• Go-Lives Conducted: ${gl.count} | Linked Tickets: ${gl.tickets}
• On-Call Fixes: ${gl.onCallFixes || 0} | Sev-1 Critical: ${gl.critical}

🔄 HANDOVER PASS ANALYSIS:
• Could Resolve: Yes (${pass.couldResolveYes || 0}) / No (${pass.couldResolveNo || 0})
• Top Dependency: ${pass.teamDependency || 'None'}
--------------------------------------------------`;
}

export async function copyHandoverToClipboard(shift) {
  const text = generateHandoverText(shift);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, using fallback", err);
    }
  }

  // Fallback
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    console.error('Copy fallback failed', err);
  }
  document.body.removeChild(textarea);
  return success;
}

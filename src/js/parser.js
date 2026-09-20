/* ==========================================================================
   Data Ingestion Parsers: Excel, Notes, and Pass Analysis
   ========================================================================== */

import * as XLSX from 'xlsx';
import { getDefaultShiftRecord } from './state.js';

export function parseExcelBuffer(arrayBuffer, filename, activeDateKey, baseRecord) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let parsedDate = activeDateKey;
  const targetShift = JSON.parse(JSON.stringify(baseRecord || getDefaultShiftRecord(parsedDate)));

  let currentSection = "";
  const newTeam = [];

  rawRows.forEach(row => {
    if (!row || row.length === 0) return;
    const firstCol = String(row[0] || "").trim().toUpperCase();

    if (firstCol.includes("TICKETS")) { currentSection = "TICKETS"; return; }
    if (firstCol.includes("RESOLUTION")) { currentSection = "RESOLUTION"; return; }
    if (firstCol.includes("PASS ANALYSIS") || firstCol.includes("HANDOVER PASS")) { currentSection = "PASS"; return; }
    if (firstCol.includes("AI")) { currentSection = "AI"; return; }
    if (firstCol.includes("GO-LIVE")) { currentSection = "GOLIVE"; return; }
    if (firstCol.includes("KNOWLEDGE")) { currentSection = "KNOWLEDGE"; return; }
    if (firstCol.includes("TEAM")) { currentSection = "TEAM"; return; }

    const key = String(row[0] || "").trim().toLowerCase();
    const val = row[1];

    if (key.includes("shift date") || key === "date") {
      const rawDate = String(val).trim();
      if (rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsedDate = rawDate;
      }
    }

    if (key.includes("shift lead") || key === "lead") {
      targetShift.meta.lead = String(val).trim() || targetShift.meta.lead;
    }

    // Tickets
    if (key.includes("received")) targetShift.tickets.received = Number(val) || targetShift.tickets.received;
    if (key.includes("resolved & closed") || key.includes("resolved") || key.includes("closed")) {
      targetShift.tickets.resolvedClosed = Number(val) !== undefined ? Number(val) : targetShift.tickets.resolvedClosed;
    }
    if (key.includes("waiting final")) targetShift.tickets.waitingFinal = Number(val) || 0;
    if (key.includes("pending client") || key.includes("pending")) targetShift.tickets.pendingClient = Number(val) || 0;
    if (key.includes("open")) targetShift.tickets.open = Number(val) || 0;
    if (key.includes("night to day") || key.includes("night-to-day") || key.includes("night 2 day")) {
      if (key.includes("verify") || key.includes("verification")) {
        targetShift.tickets.nightToDayVerify = Number(val) || 0;
      } else if (key.includes("other") || key.includes("external")) {
        targetShift.tickets.nightToDayExternal = Number(val) || 0;
      } else {
        targetShift.tickets.nightToDay = Number(val) || 0;
      }
    }
    if (key.includes("passed") && currentSection === "TICKETS") targetShift.tickets.passed = Number(val) || 0;

    // Resolution & SLA
    if (key.includes("resolution %") || key === "resolution") targetShift.resolution.resolutionPct = parseFloat(val) || targetShift.resolution.resolutionPct;
    if (key.includes("pass %")) targetShift.resolution.passPct = parseFloat(val) || targetShift.resolution.passPct;
    if (key.includes("sla %") || key === "sla") targetShift.resolution.slaPct = parseFloat(val) || targetShift.resolution.slaPct;

    // AI
    if (key.includes("ai assisted")) targetShift.ai.assisted = Number(val) || targetShift.ai.assisted;
    if (key.includes("ai accuracy")) targetShift.ai.accuracy = parseFloat(val) || targetShift.ai.accuracy;
    if (key.includes("ai resolution")) targetShift.ai.resolution = Number(val) || targetShift.ai.resolution;
    if (key.includes("zero touch")) targetShift.ai.zeroTouch = Number(val) || targetShift.ai.zeroTouch;
    if (key.includes("human correction")) targetShift.ai.humanCorrection = Number(val) || targetShift.ai.humanCorrection;
    if (key.includes("ai failures")) targetShift.ai.failures = Number(val) || targetShift.ai.failures;

    // Go-Live
    if (key.includes("go-lives") || key === "go lives") targetShift.goLive.count = Number(val) !== undefined ? Number(val) : targetShift.goLive.count;
    if (key.includes("tickets") && currentSection === "GOLIVE") targetShift.goLive.tickets = Number(val) || 0;
    if (key.includes("on call") || key.includes("on-call")) targetShift.goLive.onCallFixes = Number(val) || 0;
    if (key.includes("critical")) targetShift.goLive.critical = Number(val) || 0;
    if (key.includes("resolved") && currentSection === "GOLIVE") targetShift.goLive.resolved = Number(val) || 0;
    if (key.includes("passed") && currentSection === "GOLIVE") targetShift.goLive.passed = Number(val) || 0;

    // Knowledge
    if (key.includes("kb gaps")) targetShift.knowledge.gaps = Number(val) || targetShift.knowledge.gaps;
    if (key.includes("kb created")) targetShift.knowledge.created = Number(val) || targetShift.knowledge.created;
    if (key.includes("training")) targetShift.knowledge.training = Number(val) || targetShift.knowledge.training;
    if (key.includes("repeat issues")) targetShift.knowledge.repeatIssues = Number(val) || targetShift.knowledge.repeatIssues;

    // Team
    if (currentSection === "TEAM" && row.length >= 2 && !key.includes("engineer")) {
      const engName = String(row[0]).trim();
      if (engName && engName.length > 1) {
        newTeam.push({
          name: engName,
          resolved: Number(row[1]) || 0,
          resolution: parseFloat(row[2]) || 0,
          tag: row[3] ? String(row[3]) : "Engineer"
        });
      }
    }
  });

  if (newTeam.length > 0) {
    targetShift.team = newTeam;
  }

  // Enforce rule: Passed = Open Active + Night to Day
  targetShift.tickets.passed = (Number(targetShift.tickets.open) || 0) + (Number(targetShift.tickets.nightToDay) || 0);

  targetShift.meta.date = parsedDate;
  targetShift.meta.lastUpdated = `Excel: ${filename}`;

  return { parsedDate, shiftData: targetShift };
}

export function parseNotesText(text, specifiedDate, baseRecord) {
  let parsedDate = specifiedDate || baseRecord?.meta?.date || "2026-09-20";
  const targetShift = JSON.parse(JSON.stringify(baseRecord || getDefaultShiftRecord(parsedDate)));
  const lines = text.split('\n');
  let currentSection = "";
  const newTeam = [];

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;

    const cleanHeading = line.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanHeading === "TICKETS") { currentSection = "TICKETS"; return; }
    if (cleanHeading === "RESOLUTION") { currentSection = "RESOLUTION"; return; }
    if (cleanHeading === "PASSANALYSIS" || cleanHeading === "PASS") { currentSection = "PASS"; return; }
    if (cleanHeading === "AI") { currentSection = "AI"; return; }
    if (cleanHeading === "GOLIVE" || cleanHeading === "GOLIVES") { currentSection = "GOLIVE"; return; }
    if (cleanHeading === "KNOWLEDGE") { currentSection = "KNOWLEDGE"; return; }
    if (cleanHeading === "TEAM") { currentSection = "TEAM"; return; }

    // Pipe-delimited row parsing
    if (line.includes('|') && !line.includes('---')) {
      const parts = line.split('|').map(s => s.trim());
      const numericParts = parts.map(p => parseFloat(p.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));
      const firstPartLower = parts[0].toLowerCase();
      
      const isHeaderRow = (
        firstPartLower.includes("engineer") || 
        firstPartLower.includes("received") || 
        firstPartLower.includes("resolution") || 
        firstPartLower.includes("go-live") ||
        firstPartLower.includes("go lives") ||
        firstPartLower.includes("reason")
      );

      if (!isHeaderRow) {
        if (currentSection === "TICKETS" && numericParts.length >= 3) {
          targetShift.tickets.received = numericParts[0];
          targetShift.tickets.resolvedClosed = numericParts[1];
          if (numericParts.length >= 7) {
            targetShift.tickets.waitingFinal = numericParts[2];
            targetShift.tickets.pendingClient = numericParts[3];
            targetShift.tickets.open = numericParts[4];
            targetShift.tickets.nightToDay = numericParts[5];
            targetShift.tickets.passed = numericParts[6];
          } else if (numericParts.length >= 6) {
            targetShift.tickets.waitingFinal = numericParts[2];
            targetShift.tickets.pendingClient = numericParts[3];
            targetShift.tickets.open = numericParts[4];
            targetShift.tickets.passed = numericParts[5];
          } else if (numericParts.length === 5) {
            targetShift.tickets.resolvedClosed = numericParts[2];
            targetShift.tickets.passed = numericParts[3];
            targetShift.tickets.pendingClient = numericParts[4];
          }
        } else if (currentSection === "RESOLUTION" && numericParts.length >= 2) {
          targetShift.resolution.resolutionPct = numericParts[0];
          targetShift.resolution.passPct = numericParts[1];
          if (numericParts[2] !== undefined) {
            targetShift.resolution.slaPct = numericParts.length >= 4 ? numericParts[3] : numericParts[2];
          }
        } else if (currentSection === "GOLIVE" && numericParts.length >= 4) {
          targetShift.goLive.count = numericParts[0];
          targetShift.goLive.tickets = numericParts[1];
          targetShift.goLive.critical = numericParts[2];
          targetShift.goLive.resolved = numericParts[3];
          if (numericParts[4] !== undefined) targetShift.goLive.passed = numericParts[4];
        } else if (currentSection === "TEAM" && parts.length >= 2) {
          const engResolved = numericParts[0] !== undefined ? numericParts[0] : 0;
          const engRes = numericParts[1] !== undefined ? numericParts[1] : 0;
          newTeam.push({
            name: parts[0],
            resolved: engResolved,
            resolution: engRes,
            tag: parts[3] || parts[4] || parts[2] || "Engineer"
          });
        }
      }
      return;
    }

    // Key-value lines parsing
    const colonIndex = line.indexOf(':') !== -1 ? line.indexOf(':') : line.indexOf('=');
    if (colonIndex !== -1) {
      const k = line.substring(0, colonIndex).trim().toLowerCase();
      const v = line.substring(colonIndex + 1).trim();
      const num = parseFloat(v.replace(/[^0-9.]/g, ''));
      const hasNum = !isNaN(num);

      if (k.includes("date") || k.includes("shift date")) {
        const dateMatch = v.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) parsedDate = dateMatch[0];
      }
      if (k.includes("lead") || k.includes("shift lead")) {
        targetShift.meta.lead = v;
      }

      // Tickets
      if (k.includes("received") && hasNum) targetShift.tickets.received = num;
      if ((k.includes("resolved") || k.includes("closed")) && currentSection === "TICKETS" && hasNum) {
        targetShift.tickets.resolvedClosed = num;
      }
      if (k.includes("waiting") && hasNum) targetShift.tickets.waitingFinal = num;
      if (k.includes("pending") && hasNum) targetShift.tickets.pendingClient = num;
      if (k.includes("open") && hasNum) targetShift.tickets.open = num;
      if ((k.includes("night to day") || k.includes("night-to-day") || k.includes("night 2 day")) && hasNum) {
        if (k.includes("verify") || k.includes("verification")) {
          targetShift.tickets.nightToDayVerify = num;
        } else if (k.includes("other") || k.includes("external")) {
          targetShift.tickets.nightToDayExternal = num;
        } else {
          targetShift.tickets.nightToDay = num;
        }
      }
      if ((k.includes("day verify") || k.includes("day verification")) && hasNum) {
        targetShift.tickets.nightToDayVerify = num;
      }
      if ((k.includes("other team") || k.includes("external team") || k.includes("action needed by other")) && hasNum) {
        targetShift.tickets.nightToDayExternal = num;
      }
      if (k.includes("passed") && currentSection === "TICKETS" && hasNum) targetShift.tickets.passed = num;

      // Resolution
      if (k.includes("resolution") && (k.includes("%") || currentSection === "RESOLUTION") && hasNum) {
        targetShift.resolution.resolutionPct = num;
      }
      if (k.includes("pass") && k.includes("%") && hasNum) targetShift.resolution.passPct = num;
      if (k.includes("sla") && hasNum) targetShift.resolution.slaPct = num;

      // AI
      if (k.includes("assisted") && hasNum) targetShift.ai.assisted = num;
      if (k.includes("accuracy") && hasNum) targetShift.ai.accuracy = num;
      if (k.includes("resolution") && currentSection === "AI" && hasNum) targetShift.ai.resolution = num;
      if (k.includes("zero touch") && hasNum) targetShift.ai.zeroTouch = num;
      if (k.includes("human correction") && hasNum) targetShift.ai.humanCorrection = num;
      if (k.includes("failure") && hasNum) targetShift.ai.failures = num;

      // Go-Live
      if ((k.includes("go-live") || k.includes("go live") || currentSection === "GOLIVE") && k.includes("count") && hasNum) {
        targetShift.goLive.count = num;
      }
      if (k.includes("on call") || k.includes("on-call")) targetShift.goLive.onCallFixes = num;
      if (k.includes("critical") && hasNum) targetShift.goLive.critical = num;
      if (k.includes("passed") && currentSection === "GOLIVE" && hasNum) targetShift.goLive.passed = num;

      // Knowledge
      if (k.includes("kb gap") && hasNum) targetShift.knowledge.gaps = num;
      if (k.includes("kb created") && hasNum) targetShift.knowledge.created = num;
      if (k.includes("training") && hasNum) targetShift.knowledge.training = num;
      if (k.includes("repeat") && hasNum) targetShift.knowledge.repeatIssues = num;
    }
  });

  if (newTeam.length > 0) {
    targetShift.team = newTeam;
  }

  // Enforce rule: Passed = Open Active + Night to Day
  targetShift.tickets.passed = (Number(targetShift.tickets.open) || 0) + (Number(targetShift.tickets.nightToDay) || 0);

  targetShift.meta.date = parsedDate;
  targetShift.meta.lastUpdated = `Notes Imported @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return { parsedDate, shiftData: targetShift };
}

export function parsePassAnalysisText(text, currentShift) {
  const targetShift = JSON.parse(JSON.stringify(currentShift));
  const lines = text.split('\n');
  const newWhyPassed = [];
  let yesCount = targetShift.passAnalysis.couldResolveYes;
  let noCount = targetShift.passAnalysis.couldResolveNo;
  let primaryDep = targetShift.passAnalysis.teamDependency;

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;

    const lower = line.toLowerCase();
    if (lower.includes("could resolve")) {
      const yesMatch = line.match(/yes\s*:\s*(\d+)/i);
      const noMatch = line.match(/no\s*:\s*(\d+)/i);
      if (yesMatch) yesCount = parseInt(yesMatch[1], 10);
      if (noMatch) noCount = parseInt(noMatch[1], 10);
      return;
    }

    if (lower.includes("primary dependency") || lower.includes("team dependency")) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        primaryDep = line.substring(colonIdx + 1).trim();
      }
      return;
    }

    if (line.includes('|')) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2 && !parts[0].toLowerCase().includes("reason")) {
        const reason = parts[0];
        const count = parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 1;
        const team = parts[2] || "Unassigned";
        newWhyPassed.push({ reason, count, team });
      }
      return;
    }
  });

  if (newWhyPassed.length > 0) {
    targetShift.passAnalysis.whyPassed = newWhyPassed;
  }
  targetShift.passAnalysis.couldResolveYes = yesCount;
  targetShift.passAnalysis.couldResolveNo = noCount;
  targetShift.passAnalysis.teamDependency = primaryDep;
  targetShift.meta.lastUpdated = `Pass Updated @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return targetShift;
}

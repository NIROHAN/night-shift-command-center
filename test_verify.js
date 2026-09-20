import { getDefaultShiftRecord } from './src/js/state.js';
import { calculateMetrics } from './src/js/metrics.js';
import { parseNotesText, parsePassAnalysisText } from './src/js/parser.js';
import { generateHandoverText } from './src/js/export.js';

console.log("--- STARTING UNIT & LOGIC VERIFICATION ---");

// 1. Test Default Record
const record = getDefaultShiftRecord("2026-09-20", "Aarjan Shrestha");
console.assert(record.meta.date === "2026-09-20", "Date mismatch");
console.assert(record.tickets.received === 69, "Received tickets mismatch");

// 2. Test Metrics Calculation
const m = calculateMetrics(record);
console.assert(m.received === 69, "Metrics received mismatch");
console.assert(m.resolvedClosed === 11, "Metrics resolvedClosed mismatch");
console.assert(m.effectiveResolutions === 17, "Effective resolutions should be 11 + 6 = 17");
console.assert(m.nightToDay === 7, `Night to Day count mismatch: ${m.nightToDay}`);
console.assert(m.nightToDayVerify === 4, `Night to Day verify mismatch: ${m.nightToDayVerify}`);
console.assert(m.nightToDayExternal === 3, `Night to Day external mismatch: ${m.nightToDayExternal}`);
console.assert(m.nightToDayRatio === "10.1", `Night to Day ratio mismatch: ${m.nightToDayRatio}`);
console.assert(m.passed === 17, `Passed count mismatch: ${m.passed}`); // 10 open + 7 nightToDay
console.assert(m.resolutionPct === "24.6", `Resolution % mismatch: ${m.resolutionPct}`);
console.assert(m.passPct === "84.1", `Pass % mismatch: ${m.passPct}`);
console.assert(m.slaPct === "91.2", `SLA % mismatch: ${m.slaPct}`);
console.assert(m.aiCoverage === 81, `AI coverage mismatch: ${m.aiCoverage}`);
console.log("✓ Metrics calculation passed.");

// 3. Test Notes Parser
const sampleNotes = `NIGHT SHIFT COMMAND CENTER
Shift Date: 2026-09-21
Shift Lead: Test Lead

TICKETS
Received | Resolved & Closed | Waiting Final Response | Pending Client Response | Open | Night to Day | Passed
75 | 15 | 5 | 40 | 8 | 4 | 7

RESOLUTION
Resolution % | Pass % | SLA %
26.7% | 80.0% | 94.0%`;

const { parsedDate, shiftData } = parseNotesText(sampleNotes, "2026-09-21", record);
console.assert(parsedDate === "2026-09-21", `Parsed date mismatch: ${parsedDate}`);
console.assert(shiftData.tickets.received === 75, `Parsed received mismatch: ${shiftData.tickets.received}`);
console.assert(shiftData.tickets.resolvedClosed === 15, `Parsed resolved mismatch: ${shiftData.tickets.resolvedClosed}`);
console.assert(shiftData.tickets.nightToDay === 4, `Parsed nightToDay mismatch: ${shiftData.tickets.nightToDay}`);
console.assert(shiftData.meta.lead === "Test Lead", `Parsed lead mismatch: ${shiftData.meta.lead}`);
console.log("✓ Notes parser passed.");

// 4. Test Pass Analysis Parser
const samplePass = `Reason | Count | Team Dependency
Database Deadlock in Auth Cluster | 4 | DBA
Payment Gateway API Rate Limit | 3 | External Vendor

Could Resolve: Yes: 3 | No: 4
Primary Dependency: Infrastructure & DBA`;

const updatedWithPass = parsePassAnalysisText(samplePass, record);
console.assert(updatedWithPass.passAnalysis.whyPassed.length === 2, "Pass reasons count mismatch");
console.assert(updatedWithPass.passAnalysis.couldResolveYes === 3, "Could resolve yes mismatch");
console.assert(updatedWithPass.passAnalysis.couldResolveNo === 4, "Could resolve no mismatch");
console.assert(updatedWithPass.passAnalysis.teamDependency === "Infrastructure & DBA", "Dependency mismatch");
console.log("✓ Pass Analysis parser passed.");

// 5. Test Handover Text Generation
const handoverText = generateHandoverText(record);
console.assert(handoverText.includes("NIGHT SHIFT COMMAND CENTER HANDOVER"), "Handover title missing");
console.assert(handoverText.includes("Aarjan Shrestha"), "Lead name missing in handover");
console.assert(handoverText.includes("Influx / Received: 69"), "Influx missing in handover");
console.assert(handoverText.includes("Night to Day (Day Verify/External): 7"), "Night to Day missing in handover text");
console.log("✓ Handover text generator passed.");

console.log("--- ALL TESTS PASSED SUCCESSFULLY! ---");

/* ==========================================================================
   Metrics & KPI Calculation Utilities
   ========================================================================== */

export function calculateMetrics(shift) {
  const t = shift.tickets || {};
  const received = Number(t.received) || 0;
  const resolvedClosed = Number(t.resolvedClosed !== undefined ? t.resolvedClosed : t.resolved) || 0;
  const waitingFinal = Number(t.waitingFinal) || 0;
  const pendingClient = Number(t.pendingClient !== undefined ? t.pendingClient : t.pending) || 0;
  const open = Number(t.open) || 0;
  // Effective Resolutions: Closed, Resolved, and Waiting Final Response count as resolved
  const effectiveResolutions = resolvedClosed + waitingFinal;
  const computedResolutionPct = received > 0 ? ((effectiveResolutions / received) * 100).toFixed(1) : "0.0";

  // SLA % from record or fallback
  const slaPct = shift.resolution && shift.resolution.slaPct !== undefined
    ? Number(shift.resolution.slaPct).toFixed(1)
    : "0.0";

  // AI Telemetry
  const ai = shift.ai || {};
  const aiAssisted = Number(ai.assisted) || 0;
  const aiAccuracy = Number(ai.accuracy || 0).toFixed(1);
  const aiCoverage = received > 0 ? Math.round((aiAssisted / received) * 100) : 0;

  // Go-Live Critical Status
  const gl = shift.goLive || {};
  const glCritical = Number(gl.critical) || 0;

  const nightToDay = Number(t.nightToDay) || 0;
  const nightToDayRatio = received > 0 ? ((nightToDay / received) * 100).toFixed(1) : "0.0";
  const nightToDayVerify = t.nightToDayVerify !== undefined && !isNaN(Number(t.nightToDayVerify)) 
    ? Number(t.nightToDayVerify) 
    : Math.ceil(nightToDay * 0.6);
  const nightToDayExternal = t.nightToDayExternal !== undefined && !isNaN(Number(t.nightToDayExternal)) 
    ? Number(t.nightToDayExternal) 
    : Math.max(0, nightToDay - nightToDayVerify);

  // Core Rule: In case of passed, it is open tickets plus Night to Day ticket
  const passed = open + nightToDay;

  // Pass %: Ratio of passed (open + night to day) over total received
  const computedPassPct = received > 0 ? ((passed / received) * 100).toFixed(1) : "0.0";

  return {
    received,
    resolvedClosed,
    waitingFinal,
    pendingClient,
    open,
    nightToDay,
    nightToDayRatio,
    nightToDayVerify,
    nightToDayExternal,
    passed,
    effectiveResolutions,
    resolutionPct: shift.resolution?.resolutionPct !== undefined ? Number(shift.resolution.resolutionPct).toFixed(1) : computedResolutionPct,
    passPct: shift.resolution?.passPct !== undefined ? Number(shift.resolution.passPct).toFixed(1) : computedPassPct,
    slaPct,
    resolvedClosedRatio: received > 0 ? ((resolvedClosed / received) * 100).toFixed(1) : "0.0",
    passedRatio: received > 0 ? ((passed / received) * 100).toFixed(1) : "0.0",
    aiCoverage,
    aiAccuracy,
    glCritical
  };
}

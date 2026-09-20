/* ==========================================================================
   Application Entrypoint
   ========================================================================== */

import { store } from './state.js';
import { initTicketChart } from './charts.js';
import { renderDashboard, setupEventListeners } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Doughnut Chart
  initTicketChart('ticketDoughnutCanvas');

  // 2. Setup Event Listeners
  setupEventListeners(store);

  // 3. Subscribe UI to State Updates
  store.subscribe((activeShift) => {
    renderDashboard(activeShift, store);
  });

  // 4. Initial Render
  renderDashboard(store.getActiveShift(), store);

  console.log("Night Shift Command Center initialized successfully.");
});

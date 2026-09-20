/* ==========================================================================
   Chart.js Telemetry Visualizations
   ========================================================================== */

import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

let ticketDoughnutChart = null;

export function initTicketChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (ticketDoughnutChart) {
    ticketDoughnutChart.destroy();
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  ticketDoughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Resolved & Closed', 'Waiting Final', 'Pending Client', 'Open', 'Night to Day', 'Passed'],
      datasets: [{
        data: [11, 6, 35, 10, 5, 7],
        backgroundColor: [
          '#34d399', // emerald
          '#38bdf8', // sky blue
          '#a78bfa', // violet
          '#818cf8', // indigo
          '#06b6d4', // cyan / night to day
          '#fbbf24'  // amber
        ],
        borderWidth: 2,
        borderColor: isLight ? '#ffffff' : '#131d33',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isLight ? '#0f172a' : '#1e293b',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: isLight ? '#e2e8f0' : '#334155',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return ` ${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

export function updateTicketChart(tickets) {
  if (!ticketDoughnutChart) return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const resolved = Number(tickets.resolvedClosed !== undefined ? tickets.resolvedClosed : tickets.resolved) || 0;
  const waiting = Number(tickets.waitingFinal) || 0;
  const pending = Number(tickets.pendingClient !== undefined ? tickets.pendingClient : tickets.pending) || 0;
  const open = Number(tickets.open) || 0;
  const nightToDay = Number(tickets.nightToDay) || 0;
  const passed = Number(tickets.passed) || 0;

  ticketDoughnutChart.data.datasets[0].data = [resolved, waiting, pending, open, nightToDay, passed];
  ticketDoughnutChart.data.datasets[0].borderColor = isLight ? '#ffffff' : '#131d33';
  ticketDoughnutChart.update();
}

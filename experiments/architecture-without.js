// ── ARCHITECTURE WITHOUT AN OCCUPANT
// Ganoderma lucidum × Epipremnum aureum
// Data loaded from data/architecture_reishi_pothos_data.json

// ── DUAL AXIS CHART BUILDER ──
function buildDualChart(canvasId, ds1, ds2, y1Label, y2Label, y1Min, y1Max, y2Min, y2Max) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  return new Chart(ctx, {
    type: 'line',
    data: { datasets: [ds1, ds2] },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#555555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            boxWidth: 16,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'line'
          }
        },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#1e1e1e',
          borderWidth: 1,
          titleColor: '#555',
          bodyColor: '#e8e8e8',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 9 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          callbacks: {
            title: items => `hr ${parseFloat(items[0].parsed.x).toFixed(1)}`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 68.5,
          grid: { color: '#1e1e1e', lineWidth: 1 },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 10,
            callback: v => `${Math.round(v)}h`
          },
          border: { color: '#1e1e1e' }
        },
        y: {
          min: y1Min,
          max: y1Max,
          position: 'left',
          grid: { color: '#1e1e1e', lineWidth: 1 },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 6
          },
          title: {
            display: true,
            text: y1Label,
            color: '#3a3a3a',
            font: { family: "'IBM Plex Mono', monospace", size: 9 }
          },
          border: { color: '#1e1e1e' }
        },
        y2: {
          min: y2Min,
          max: y2Max,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#555',
            font: { family: "'IBM Plex Mono', monospace", size: 9 },
            maxTicksLimit: 6
          },
          title: {
            display: true,
            text: y2Label,
            color: '#3a3a3a',
            font: { family: "'IBM Plex Mono', monospace", size: 9 }
          },
          border: { color: '#1e1e1e' }
        }
      }
    }
  });
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {

  // ── LOAD DATA FROM JSON ──
  fetch('../data/architecture_reishi_pothos_data.json')
    .then(r => r.json())
    .then(json => {
      const raw = json.data;

      const lineStyle = (color, width = 1.5, axisId = 'y') => ({
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: width,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.2,
        spanGaps: true,
        yAxisID: axisId
      });

      const co2pts   = raw.map(d => ({ x: d.hours, y: d.co2_ppm }));
      const humpts   = raw.map(d => ({ x: d.hours, y: d.humidity_pct }));
      const temppts  = raw.map(d => ({ x: d.hours, y: d.temp_c }));
      const lightpts = raw.map(d => ({ x: d.hours, y: d.light_counts }));

      // Chart 1 — CO₂ + Humidity
      buildDualChart(
        'chart-co2-hum',
        { label: 'CO₂ ppm', data: co2pts, ...lineStyle('#88c9a0', 2, 'y') },
        { label: 'Humidity %', data: humpts, ...lineStyle('#c39bd3', 1.5, 'y2') },
        'CO₂ (ppm)', 'Humidity (%RH)',
        500, 3500, 30, 90
      );

      // Chart 2 — Temperature + Light
      buildDualChart(
        'chart-temp-soil',
        { label: 'Temperature °C', data: temppts, ...lineStyle('#e67e22', 2, 'y') },
        { label: 'Light (counts)', data: lightpts, ...lineStyle('#6ab187', 1.5, 'y2') },
        'Temp (°C)', 'Light (counts)',
        21, 27, 0, 120
      );
    })
    .catch(err => console.error('Failed to load chart data:', err));

  // ── SCROLL REVEAL ──
  const sections = document.querySelectorAll('section');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  sections.forEach(s => observer.observe(s));

});
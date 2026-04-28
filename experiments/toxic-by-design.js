// ── SCROLL REVEAL ──
const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.08 });
sections.forEach(s => observer.observe(s));

// ── CHART DEFAULTS ──
const MONO = "'IBM Plex Mono', monospace";
const DIM  = '#555555';
const DIM2 = '#2a2a2a';
const TEXT = '#e8e8e8';

Chart.defaults.color = DIM;
Chart.defaults.font.family = MONO;
Chart.defaults.font.size = 10;

// ── LOAD DATA + DRAW ──
fetch('../data/toxic_data.json')
  .then(r => r.json())
  .then(data => {
    drawResistanceChart(data);
    drawConductivityChart(data);
  })
  .catch(err => {
    console.error('Could not load toxic_data.json:', err);
    ['ec-resistance-chart', 'ec-conductivity-chart'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#2a2a2a;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;">Data unavailable — run from local server</div>`;
    });
  });

// ── RESISTANCE OVER TIME ──
function drawResistanceChart(data) {
  const el = document.getElementById('ec-resistance-chart');
  if (!el) return;

  const hourly = data.hourly;
  const labels = hourly.map(d => d.hour);
  const resistance = hourly.map(d => d.resistance);

  new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Resistance (Ω)',
        data: resistance,
        borderColor: '#6ab187',
        backgroundColor: 'rgba(106,177,135,0.06)',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#1e1e1e',
          borderWidth: 1,
          titleColor: DIM,
          bodyColor: TEXT,
          padding: 12,
          callbacks: {
            title: ctx => `Hour ${ctx[0].label}`,
            label: ctx => ` Resistance: ${ctx.parsed.y.toLocaleString()} Ω`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'TIME (HOURS)',
            color: DIM,
            font: { family: MONO, size: 9 },
            padding: { top: 12 }
          },
          grid: { color: DIM2, lineWidth: 0.5 },
          ticks: { color: DIM, maxTicksLimit: 12 }
        },
        y: {
          title: {
            display: true,
            text: 'RESISTANCE (Ω)',
            color: DIM,
            font: { family: MONO, size: 9 },
            padding: { bottom: 12 }
          },
          grid: { color: DIM2, lineWidth: 0.5 },
          ticks: {
            color: DIM,
            callback: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v
          }
        }
      }
    }
  });
}

// ── CONDUCTIVITY OVER TIME ──
function drawConductivityChart(data) {
  const el = document.getElementById('ec-conductivity-chart');
  if (!el) return;

  const hourly = data.hourly;
  const labels = hourly.map(d => d.hour);
  const conductivity = hourly.map(d => d.conductivity);

  new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Conductivity (S)',
        data: conductivity,
        borderColor: '#c39bd3',
        backgroundColor: 'rgba(195,155,211,0.05)',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#1e1e1e',
          borderWidth: 1,
          titleColor: DIM,
          bodyColor: TEXT,
          padding: 12,
          callbacks: {
            title: ctx => `Hour ${ctx[0].label}`,
            label: ctx => ` Conductivity: ${ctx.parsed.y.toExponential(3)} S`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'TIME (HOURS)',
            color: DIM,
            font: { family: MONO, size: 9 },
            padding: { top: 12 }
          },
          grid: { color: DIM2, lineWidth: 0.5 },
          ticks: { color: DIM, maxTicksLimit: 12 }
        },
        y: {
          title: {
            display: true,
            text: 'CONDUCTIVITY (S)',
            color: DIM,
            font: { family: MONO, size: 9 },
            padding: { bottom: 12 }
          },
          grid: { color: DIM2, lineWidth: 0.5 },
          ticks: {
            color: DIM,
            callback: v => v.toExponential(2)
          }
        }
      }
    }
  });
}
/* ─────────────────────────────────────────────────────────────────
 * BIO-MACHINE — bio-machine.js
 * Bioelectrical EC signal + environmental sensor overlay
 * Data loaded from JSON files in data/
 * ───────────────────────────────────────────────────────────────── */

/* ── INTERSECTION OBSERVER ── */
const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
sections.forEach(s => observer.observe(s));

/* ── ENV CHANNEL DEFINITIONS ── */
const ENV_CHANNELS = [
  { key: 'co2',   label: 'CO₂',      color: '#e8c07a', min: 0,   max: 20   },
  { key: 'hum',   label: 'Humidity',  color: '#7ab8e8', min: 30,  max: 55   },
  { key: 'temp',  label: 'Temp',      color: '#e87a7a', min: 50,  max: 70   },
  { key: 'prox',  label: 'Proximity', color: '#c39bd3', min: 0,   max: 15   },
  { key: 'light', label: 'Light',     color: '#e8e07a', min: 0,   max: 1    },
  { key: 'soil',  label: 'Soil',      color: '#8fb87a', min: 0,   max: 50   },
];

/* ── CHART CONFIGS ── */
const PLANT_CFG = {
  ecSrc:  '../data/biomachine_plantdata.json',
  ecPath: 'datasets.ec_only.records',
  envSrc:  '../data/biomachine_plantdata.json',
  envPath: 'datasets.all_sensors.records',
  rawField:     'ec_raw',
  avgField:     'bioelectric_avg',
  duration:     52.8,
  minY: 60, maxY: 370,
  baseline:     202,
  threshold:    240,
  smoothWindow: 20,
  color:    '#6ab187',
  organism: 'Chlorophytum comosum',
  events: [
    { t: 37.0, label: 'touch'     },
    { t: 39.3, label: 'touch'     },
    { t: 42.2, label: 'proximity' },
    { t: 44.8, label: 'breath'    },
    { t: 48.1, label: 'sound'     },
  ]
};

const MUSH_CFG = {
  ecSrc:  '../data/biomachine_mushroomdata.json',
  ecPath: 'dataset_ec_only.records',
  envSrc:  '../data/biomachine_mushroomdata.json',
  envPath: 'dataset.records',
  rawField:     'ec_raw',
  avgField:     'bioelectric_avg',
  duration:     1214,
  minY: 150, maxY: 380,
  baseline:     230,
  threshold:    300,
  smoothWindow: 200,
  color:    '#c39bd3',
  organism: 'Pleurotus ostreatus',
  events: [
    { t: 61.5,  label: 'touch'    },
    { t: 80.7,  label: 'touch'    },
    { t: 97.4,  label: 'brush'    },
    { t: 185.0, label: 'multiple' },
    { t: 310.0, label: 'indirect' },
  ]
};

/* ── UTILITIES ── */
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, k) => acc && acc[k], obj);
}

function normalizeEC(records, cfg) {
  const t0   = records[0].timestamp_ms;
  const step = records.length > 1000 ? 8 : 1;
  const out  = [];
  records.forEach((r, i) => {
    if (i % step !== 0 && r[cfg.rawField] <= cfg.threshold) return;
    out.push({
      t:   Math.round((r.timestamp_ms - t0) / 100) / 10,
      raw: r[cfg.rawField],
      avg: r[cfg.avgField]
    });
  });
  return out;
}

function normalizeEnv(records, ecT0ms, ecDuration) {
  const ecT1ms = ecT0ms + ecDuration * 1000;
  return records
    .filter(r => r.timestamp_ms >= ecT0ms && r.timestamp_ms <= ecT1ms)
    .map(r => ({
      t:     Math.round((r.timestamp_ms - ecT0ms) / 100) / 10,
      co2:   r.co2_norm,
      hum:   r.humidity_scd,
      temp:  r.temp_sht_norm,
      prox:  r.proximity_norm,
      light: r.light_norm,
      soil:  r.soil_norm,
    }));
}

/* ── CHART BUILDER ── */
function makeChart(wrap, cfg, ecPts, envPts) {
  wrap.innerHTML = '';
  wrap.style.cssText += 'padding:0; display:flex; flex-direction:column; min-height:380px;';

  /* ── LEGEND / TOGGLE ROW ── */
  const legend = document.createElement('div');
  legend.style.cssText = [
    'display:flex', 'align-items:flex-start', 'justify-content:space-between',
    'padding:20px 24px 0', 'flex-shrink:0', 'flex-wrap:wrap', 'gap:16px'
  ].join(';');

  // EC legend items (left)
  const ecLeg = document.createElement('div');
  ecLeg.style.cssText = 'display:flex; gap:16px; align-items:center; flex-wrap:wrap;';
  ecLeg.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;">
      <div style="width:16px;height:1.5px;background:${cfg.color};opacity:0.9;"></div>
      <span style="font:10px/1 'IBM Plex Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;color:#555;">raw EC</span>
    </div>
    <div style="display:flex;align-items:center;gap:7px;">
      <div style="width:16px;height:1.5px;background:${cfg.color};opacity:0.35;"></div>
      <span style="font:10px/1 'IBM Plex Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;color:#555;">avg (${cfg.smoothWindow}-sample)</span>
    </div>
    <div style="display:flex;align-items:center;gap:7px;">
      <div style="width:16px;height:0;border-top:1px dashed #2a2a2a;"></div>
      <span style="font:10px/1 'IBM Plex Mono',monospace;letter-spacing:0.1em;text-transform:uppercase;color:#555;">threshold</span>
    </div>
  `;
  legend.appendChild(ecLeg);

  // ENV toggles (right) — only show if we have env data
  const envVisible = {};
  ENV_CHANNELS.forEach(ch => { envVisible[ch.key] = true; }); // all on by default

  const envLeg = document.createElement('div');
  envLeg.style.cssText = 'display:flex; gap:10px; align-items:center; flex-wrap:wrap;';

  if (envPts.length > 0) {
    const envLabel = document.createElement('span');
    envLabel.style.cssText = "font:9px/1 'IBM Plex Mono',monospace;letter-spacing:0.14em;text-transform:uppercase;color:#2a2a2a;margin-right:4px;";
    envLabel.textContent = 'overlay:';
    envLeg.appendChild(envLabel);

    function setActive(btn, ch, active) {
      const dot = btn.querySelector('[data-dot="' + ch.key + '"]');
      if (active) {
        btn.style.borderColor = ch.color + '66';
        btn.style.color = '#aaa';
        dot.style.opacity = '1';
      } else {
        btn.style.borderColor = '#1e1e1e';
        btn.style.color = '#333';
        dot.style.opacity = '0.3';
      }
    }

    const chBtns = {};
    ENV_CHANNELS.forEach(ch => {
      const btn = document.createElement('button');
      btn.dataset.ch = ch.key;
      chBtns[ch.key] = btn;
      btn.style.cssText = [
        'display:flex', 'align-items:center', 'gap:6px',
        'background:none', 'border:1px solid #1e1e1e',
        'padding:4px 10px', 'cursor:pointer',
        "font:9px 'IBM Plex Mono',monospace",
        'letter-spacing:0.12em', 'text-transform:uppercase',
        'color:#333', 'transition:color 0.15s, border-color 0.15s'
      ].join(';');
      btn.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${ch.color};opacity:0.3;display:inline-block;transition:opacity 0.15s;" data-dot="${ch.key}"></span>${ch.label}`;
      setActive(btn, ch, true);
      btn.addEventListener('click', () => {
        envVisible[ch.key] = !envVisible[ch.key];
        setActive(btn, ch, envVisible[ch.key]);
        draw();
      });
      envLeg.appendChild(btn);
    });

    let allOn = true;
    const allNoneBtn = document.createElement('button');
    allNoneBtn.style.cssText = [
      'background:none', 'border:1px solid #2a2a2a',
      'padding:4px 10px', 'cursor:pointer',
      "font:9px 'IBM Plex Mono',monospace",
      'letter-spacing:0.12em', 'text-transform:uppercase',
      'color:#444', 'margin-left:4px', 'transition:color 0.15s'
    ].join(';');
    allNoneBtn.textContent = 'none';
    allNoneBtn.addEventListener('click', () => {
      allOn = !allOn;
      ENV_CHANNELS.forEach(ch => {
        envVisible[ch.key] = allOn;
        setActive(chBtns[ch.key], ch, allOn);
      });
      allNoneBtn.textContent = allOn ? 'none' : 'all';
      draw();
    });
    envLeg.appendChild(allNoneBtn);
  }

  legend.appendChild(envLeg);
  wrap.appendChild(legend);

  /* ── SESSION INFO ── */
  const info = document.createElement('div');
  info.style.cssText = "padding:8px 24px 0; font:9px 'IBM Plex Mono',monospace; letter-spacing:0.14em; text-transform:uppercase; color:#2a2a2a; flex-shrink:0;";
  info.textContent = `ADC 0–1023  ·  ${cfg.duration > 200 ? Math.round(cfg.duration) + 's session' : cfg.duration + 's session'}${envPts.length ? '  ·  env channels normalized 0–100' : ''}`;
  wrap.appendChild(info);

  /* ── CANVAS ── */
  const cWrap = document.createElement('div');
  cWrap.style.cssText = 'flex:1; position:relative; padding:12px 24px 20px;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block; width:100%; cursor:crosshair;';
  cWrap.appendChild(canvas);
  wrap.appendChild(cWrap);

  /* tooltip */
  const tip = document.createElement('div');
  tip.style.cssText = [
    'position:absolute','pointer-events:none','display:none',
    'background:#0a0a0a','border:1px solid #1e1e1e','padding:8px 12px',
    "font:10px 'IBM Plex Mono',monospace",'color:#888',
    'letter-spacing:0.06em','z-index:10','white-space:nowrap','line-height:1.8'
  ].join(';');
  cWrap.appendChild(tip);

  const DPR = window.devicePixelRatio || 1;
  const ctx  = canvas.getContext('2d');
  const PAD  = { top: 28, right: 44, bottom: 44, left: 48 };
  // right padding expanded to 44 to make room for env right-axis labels

  function draw() {
    const W = cWrap.clientWidth - 48;
    const H = Math.max(260, cWrap.clientHeight - 32);
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top  - PAD.bottom;

    // EC y-scale (left axis)
    function tx(t)    { return PAD.left + (t / cfg.duration) * CW; }
    function tyEC(v)  { return PAD.top + CH - ((v - cfg.minY) / (cfg.maxY - cfg.minY)) * CH; }
    // Env y-scale (right axis, 0–100 normalized)
    function tyEnv(v, ch) {
      const norm = (v - ch.min) / (ch.max - ch.min);
      return PAD.top + CH - Math.max(0, Math.min(1, norm)) * CH;
    }

    ctx.clearRect(0, 0, W, H);

    /* grid */
    [200, 250, 300, 350].filter(v => v > cfg.minY && v < cfg.maxY).forEach(v => {
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, tyEC(v)); ctx.lineTo(PAD.left + CW, tyEC(v)); ctx.stroke();
      ctx.fillStyle = '#2a2a2a';
      ctx.font = "9px 'IBM Plex Mono', monospace"; ctx.textAlign = 'right';
      ctx.fillText(v, PAD.left - 8, tyEC(v) + 3);
    });

    /* baseline */
    ctx.strokeStyle = '#1a1a1a'; ctx.setLineDash([3, 7]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, tyEC(cfg.baseline)); ctx.lineTo(PAD.left + CW, tyEC(cfg.baseline)); ctx.stroke();
    ctx.setLineDash([]);

    /* threshold */
    ctx.strokeStyle = '#222'; ctx.setLineDash([2, 10]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, tyEC(cfg.threshold)); ctx.lineTo(PAD.left + CW, tyEC(cfg.threshold)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#2a2a2a'; ctx.font = "9px 'IBM Plex Mono', monospace"; ctx.textAlign = 'left';
    ctx.fillText('threshold', PAD.left + 6, tyEC(cfg.threshold) - 5);

    /* event verticals */
    cfg.events.forEach(ev => {
      const x = tx(ev.t);
      if (x < PAD.left || x > PAD.left + CW) return;
      ctx.strokeStyle = cfg.color + '1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + CH); ctx.stroke();
      ctx.save(); ctx.translate(x + 4, PAD.top + 10);
      ctx.fillStyle = cfg.color + '55'; ctx.font = "8px 'IBM Plex Mono', monospace"; ctx.textAlign = 'left';
      ctx.fillText(ev.label, 0, 0); ctx.restore();
    });

    /* ── ENV OVERLAYS (step-interpolated, behind EC) ── */
    const activeEnv = ENV_CHANNELS.filter(ch => envVisible[ch.key] && envPts.length > 0);

    activeEnv.forEach(ch => {
      if (envPts.length < 1) return;

      // step line
      ctx.beginPath();
      ctx.strokeStyle = ch.color + '88';
      ctx.lineWidth = 1.5;
      envPts.forEach((pt, i) => {
        const x = tx(pt.t);
        const y = tyEnv(pt[ch.key], ch);
        if (i === 0) {
          ctx.moveTo(PAD.left, y); // extend to chart left
          ctx.lineTo(x, y);
        } else {
          const prevY = tyEnv(envPts[i - 1][ch.key], ch);
          ctx.lineTo(x, prevY); // horizontal step
          ctx.lineTo(x, y);     // then vertical
        }
      });
      // extend last value to chart right
      const lastY = tyEnv(envPts[envPts.length - 1][ch.key], ch);
      ctx.lineTo(PAD.left + CW, lastY);
      ctx.stroke();

      // subtle fill under
      ctx.beginPath();
      envPts.forEach((pt, i) => {
        const x = tx(pt.t);
        const y = tyEnv(pt[ch.key], ch);
        if (i === 0) { ctx.moveTo(PAD.left, y); ctx.lineTo(x, y); }
        else {
          const prevY = tyEnv(envPts[i - 1][ch.key], ch);
          ctx.lineTo(x, prevY); ctx.lineTo(x, y);
        }
      });
      ctx.lineTo(PAD.left + CW, lastY);
      ctx.lineTo(PAD.left + CW, PAD.top + CH);
      ctx.lineTo(PAD.left, PAD.top + CH);
      ctx.closePath();
      ctx.fillStyle = ch.color + '0d';
      ctx.fill();

      // data point dots
      envPts.forEach(pt => {
        ctx.beginPath();
        ctx.arc(tx(pt.t), tyEnv(pt[ch.key], ch), 2, 0, Math.PI * 2);
        ctx.fillStyle = ch.color + 'aa';
        ctx.fill();
      });

      // right axis label
      ctx.fillStyle = ch.color + '88';
      ctx.font = "8px 'IBM Plex Mono', monospace"; ctx.textAlign = 'left';
      const labelY = tyEnv(envPts[envPts.length - 1][ch.key], ch);
      ctx.fillText(ch.label, PAD.left + CW + 6, Math.max(PAD.top + 8, Math.min(PAD.top + CH - 2, labelY + 3)));
    });

    /* ── EC avg fill ── */
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + CH);
    grad.addColorStop(0, cfg.color + '14'); grad.addColorStop(1, cfg.color + '03');
    ctx.beginPath();
    ecPts.forEach((d, i) => { i === 0 ? ctx.moveTo(tx(d.t), tyEC(d.avg)) : ctx.lineTo(tx(d.t), tyEC(d.avg)); });
    ctx.lineTo(tx(ecPts[ecPts.length - 1].t), PAD.top + CH);
    ctx.lineTo(PAD.left, PAD.top + CH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    /* EC avg line */
    ctx.beginPath(); ctx.strokeStyle = cfg.color + '40'; ctx.lineWidth = 1.5;
    ecPts.forEach((d, i) => { i === 0 ? ctx.moveTo(tx(d.t), tyEC(d.avg)) : ctx.lineTo(tx(d.t), tyEC(d.avg)); });
    ctx.stroke();

    /* EC raw line */
    ctx.beginPath(); ctx.strokeStyle = cfg.color + 'bb'; ctx.lineWidth = 1;
    ecPts.forEach((d, i) => { i === 0 ? ctx.moveTo(tx(d.t), tyEC(d.raw)) : ctx.lineTo(tx(d.t), tyEC(d.raw)); });
    ctx.stroke();

    /* spike dots */
    ecPts.forEach(d => {
      if (d.raw < cfg.threshold) return;
      ctx.beginPath(); ctx.arc(tx(d.t), tyEC(d.raw), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color; ctx.fill();
    });

    /* axes */
    ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + CH); ctx.lineTo(PAD.left + CW, PAD.top + CH); ctx.stroke();

    /* x ticks */
    const tickN = cfg.duration > 200 ? 8 : 6;
    for (let i = 0; i <= tickN; i++) {
      const t = (cfg.duration / tickN) * i;
      const x = tx(t);
      ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PAD.top + CH); ctx.lineTo(x, PAD.top + CH + 4); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = "9px 'IBM Plex Mono', monospace"; ctx.textAlign = 'center';
      ctx.fillText((cfg.duration > 200 ? Math.round(t) : t.toFixed(0)) + 's', x, PAD.top + CH + 16);
    }

    /* y label */
    ctx.save(); ctx.translate(11, PAD.top + CH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#2a2a2a'; ctx.font = "9px 'IBM Plex Mono', monospace"; ctx.textAlign = 'center';
    ctx.fillText('ADC', 0, 0); ctx.restore();
  }

  /* tooltip */
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const CW   = rect.width - PAD.left - PAD.right;
    if (mx < PAD.left || mx > PAD.left + CW) { tip.style.display = 'none'; return; }
    const tRel = ((mx - PAD.left) / CW) * cfg.duration;
    const d    = ecPts.reduce((a, b) => Math.abs(b.t - tRel) < Math.abs(a.t - tRel) ? b : a);

    let html = `t=${d.t.toFixed(1)}s &nbsp;·&nbsp; raw=${d.raw} &nbsp;·&nbsp; avg=${d.avg}`;

    const activeEnv = ENV_CHANNELS.filter(ch => envVisible[ch.key] && envPts.length > 0);
    if (activeEnv.length > 0 && envPts.length > 0) {
      const envClosest = envPts.reduce((a, b) => Math.abs(b.t - tRel) < Math.abs(a.t - tRel) ? b : a);
      activeEnv.forEach(ch => {
        html += `<br><span style="color:${ch.color}88">${ch.label}</span> ${envClosest[ch.key].toFixed(2)}`;
      });
    }

    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = (mx + 14) + 'px';
    tip.style.top  = '4px';
  });
  canvas.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

  new ResizeObserver(draw).observe(cWrap);
  draw();
}

/* ── LOADING / ERROR STATES ── */
function showLoading(wrap, cfg) {
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.minHeight = '380px';
  wrap.innerHTML = `
    <div style="text-align:center;">
      <div style="width:6px;height:6px;border-radius:50%;background:${cfg.color};margin:0 auto 16px;animation:pulse 2s infinite;"></div>
      <div style="font:9px 'IBM Plex Mono',monospace;letter-spacing:0.18em;text-transform:uppercase;color:#333;">Loading ${cfg.organism}</div>
    </div>`;
}

function showError(wrap, cfg, msg) {
  wrap.innerHTML = `<div style="padding:32px 24px;font:10px 'IBM Plex Mono',monospace;letter-spacing:0.12em;text-transform:uppercase;color:#2a2a2a;">${cfg.ecSrc}<br><span style="color:#1e1e1e;margin-top:8px;display:block;">${msg}</span></div>`;
}

/* ── FETCH + RENDER ── */
async function loadAndRender(wrap, cfg) {
  showLoading(wrap, cfg);
  try {
    // Fetch EC and env from same file (or separate if needed)
    const [ecRes, envRes] = await Promise.all([
      fetch(cfg.ecSrc),
      fetch(cfg.envSrc)
    ]);
    if (!ecRes.ok) throw new Error(`EC fetch failed: HTTP ${ecRes.status}`);
    if (!envRes.ok) throw new Error(`Env fetch failed: HTTP ${envRes.status}`);

    const ecJson  = await ecRes.json();
    // If same file, reuse; otherwise parse separately
    const envJson = cfg.ecSrc === cfg.envSrc ? ecJson : await envRes.json();

    const ecRecords  = resolvePath(ecJson,  cfg.ecPath);
    const envRecords = resolvePath(envJson, cfg.envPath) || [];

    if (!ecRecords || !ecRecords.length) throw new Error('No EC records at: ' + cfg.ecPath);

    const ecPts  = normalizeEC(ecRecords, cfg);
    const ecT0ms = ecRecords[0].timestamp_ms;
    const envPts = normalizeEnv(envRecords, ecT0ms, cfg.duration);

    wrap.style.display = '';
    wrap.style.alignItems = '';
    wrap.style.justifyContent = '';

    makeChart(wrap, cfg, ecPts, envPts);
  } catch (err) {
    showError(wrap, cfg, err.message);
  }
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  const wraps = document.querySelectorAll('#data .chart-wrap');
  if (wraps[0]) loadAndRender(wraps[0], PLANT_CFG);
  if (wraps[1]) loadAndRender(wraps[1], MUSH_CFG);
});

/* ── SCROLL-TRIGGERED VIDEO PLAYBACK ── */
document.addEventListener('DOMContentLoaded', () => {
  // HTML5 videos: play when scrolled into view, pause when out
  document.querySelectorAll('video').forEach(video => {
    const videoObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play();
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.3 });
    videoObs.observe(video);
  });

  // YouTube iframes: set src (triggering autoplay) only once on first scroll into view
  document.querySelectorAll('iframe[data-src]').forEach(iframe => {
    const iframeObs = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          iframe.src = iframe.dataset.src;
          obs.unobserve(iframe);
        }
      });
    }, { threshold: 0.3 });
    iframeObs.observe(iframe);
  });
});
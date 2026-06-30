// Dashboard-1 local server — serves dashboard + Obsidian vault API + health sync
// Run: node server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT        = 9876;
const VAULT       = path.resolve('G:\\My Drive\\Vault');
const ROOT        = path.resolve('G:\\My Drive\\Projects\\Dashboard-1');
const HEALTH_FILE      = path.join(ROOT, 'health.json');
const GDRIVE_HEALTH_DIR  = path.resolve('G:\\My Drive\\Health Auto Export\\Health');
const GDRIVE_WORKOUT_DIR = path.resolve('G:\\My Drive\\Health Auto Export\\Workout');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);
  const pn     = decodeURIComponent(parsed.pathname);

  // POST /api/update-health — iPhone Shortcut sends health JSON here
  if (pn === '/api/update-health' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        data.synced = new Date().toISOString();
        fs.writeFile(HEALTH_FILE, JSON.stringify(data, null, 2), err => {
          if (err) return reply(res, 500, 'Write failed');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, synced: data.synced }));
          console.log('[health] synced:', data);
        });
      } catch { reply(res, 400, 'Invalid JSON'); }
    });
    return;
  }

  // GET /api/health-json — reads latest Health Auto Export file from Google Drive
  if (pn === '/api/health-json') {
    latestFileIn(GDRIVE_HEALTH_DIR, (err, filePath) => {
      const fallback = () => fs.readFile(HEALTH_FILE, 'utf8', (e2, raw2) => {
        if (e2) return reply(res, 404, 'No health data yet');
        serveNormalizedHealth(res, raw2);
      });
      if (err || !filePath) return fallback();
      fs.readFile(filePath, 'utf8', (e, raw) => {
        if (e) return fallback();
        serveNormalizedHealth(res, raw);
      });
    });
    return;
  }

  // GET /api/workout-json — reads latest workout file from Google Drive
  if (pn === '/api/workout-json') {
    latestFileIn(GDRIVE_WORKOUT_DIR, (err, filePath) => {
      if (err || !filePath) return reply(res, 404, 'No workout data yet');
      fs.readFile(filePath, 'utf8', (e, raw) => {
        if (e) return reply(res, 404, 'No workout data yet');
        try {
          const d = JSON.parse(raw);
          const workouts = (d?.data?.workouts || []).map(w => ({
            name:     w.name || 'Workout',
            start:    w.start,
            end:      w.end,
            duration: Math.round((w.duration || 0) / 60), // seconds → minutes
            avgHR:    Math.round(w.avgHeartRate?.qty || w.heartRate?.avg?.qty || 0),
            maxHR:    Math.round(w.maxHeartRate?.qty || w.heartRate?.max?.qty || 0),
            minHR:    Math.round(w.heartRate?.min?.qty || 0),
          kcal:     Math.round((w.activeEnergyBurned?.qty || 0) * 0.239),
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ workouts, file: path.basename(filePath) }));
        } catch { reply(res, 500, 'Parse error'); }
      });
    });
    return;
  }

  // GET /api/vault?file=relative/path.md  — read a vault file
  if (pn === '/api/vault') {
    const rel  = parsed.query.file;
    if (!rel) return reply(res, 400, 'Missing file param');
    const full = path.resolve(VAULT, rel);
    if (!full.startsWith(VAULT + path.sep) && full !== VAULT)
      return reply(res, 403, 'Forbidden');
    fs.readFile(full, 'utf8', (err, data) => {
      if (err) return reply(res, 404, 'Not found: ' + rel);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // GET /api/vault-dir?dir=relative/dir  — list vault directory
  if (pn === '/api/vault-dir') {
    const rel  = parsed.query.dir || '';
    const full = path.resolve(VAULT, rel);
    if (!full.startsWith(VAULT + path.sep) && full !== VAULT)
      return reply(res, 403, 'Forbidden');
    fs.readdir(full, { withFileTypes: true }, (err, entries) => {
      if (err) return reply(res, 404, 'Not found');
      const list = entries.map(e => ({ name: e.name, isDir: e.isDirectory() }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
    });
    return;
  }

  // GET /api/proxy?url=... — proxy public Google Sheets CSV
  if (pn === '/api/proxy') {
    const target = parsed.query.url;
    if (!target || !target.startsWith('https://docs.google.com/spreadsheets/'))
      return reply(res, 403, 'Forbidden');
    const https = require('https');
    https.get(target, r => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      r.pipe(res);
    }).on('error', e => reply(res, 502, e.message));
    return;
  }

  // Static files from Dashboard-1
  const rel  = pn === '/' ? '/index.html' : pn;
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT)) return reply(res, 403, 'Forbidden');

  fs.readFile(full, (err, data) => {
    if (err) return reply(res, 404, 'Not found: ' + rel);
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

// Listen on all interfaces so iPhone on same WiFi can reach it
}).listen(PORT, '0.0.0.0', () => {
  console.log('\n  Dashboard  →  http://localhost:' + PORT);
  console.log('  iPhone sync →  http://192.168.8.163:' + PORT + '/api/update-health\n');
});

// Find the most recently modified file in a directory
function latestFileIn(dir, cb) {
  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err) return cb(err);
    const files = entries.filter(e => e.isFile()).map(e => {
      const fp = path.join(dir, e.name);
      try { return { fp, mt: fs.statSync(fp).mtimeMs }; } catch { return null; }
    }).filter(Boolean).sort((a, b) => b.mt - a.mt);
    cb(null, files[0]?.fp || null);
  });
}

function serveNormalizedHealth(res, raw) {
  try {
    const d = JSON.parse(raw);
    const out = normalizeHealthData(d);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  } catch { reply(res, 500, 'Parse error'); }
}

// Parses Health Auto Export JSON or plain {steps, restingHR, ...}
function normalizeHealthData(d) {
  if (typeof d.steps !== 'undefined' || typeof d.restingHR !== 'undefined') return d;

  const metrics = d?.data?.metrics || d?.metrics || [];
  const out = { synced: new Date().toISOString() };

  metrics.forEach(m => {
    if (!m.data?.length) return;
    switch (m.name) {
      case 'step_count':
        out.steps = Math.round(m.data.reduce((s, e) => s + (e.qty || 0), 0));
        break;
      case 'resting_heart_rate':
        out.restingHR = Math.round(m.data[0].qty);
        break;
      case 'sleep_analysis': {
        const s = m.data[0];
        out.sleepHours = +(s.totalSleep || 0).toFixed(1);
        out.sleepDeep  = +(s.deep  || 0).toFixed(1);
        out.sleepREM   = +(s.rem   || 0).toFixed(1);
        out.sleepCore  = +(s.core  || 0).toFixed(1);
        out.sleepAwake = +(s.awake || 0).toFixed(1);
        out.sleepInBed = +(s.inBed || 0).toFixed(1);
        out.sleepStart = s.sleepStart || null;
        out.sleepEnd   = s.sleepEnd   || null;
        break;
      }
      case 'active_energy':
        out.activeCal = Math.round(m.data.reduce((s, e) => s + (e.qty || 0), 0) * 0.239);
        break;
      case 'basal_energy_burned':
        out.basalCal = Math.round(m.data.reduce((s, e) => s + (e.qty || 0), 0) * 0.239);
        break;
      case 'heart_rate_variability': {
        const vals = m.data.map(e => e.qty).filter(Boolean);
        out.hrv = vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
        break;
      }
      case 'heart_rate': {
        const mins = m.data.map(e => e.Min ?? e.qty).filter(v => v != null);
        const maxs = m.data.map(e => e.Max ?? e.qty).filter(v => v != null);
        const avgs = m.data.map(e => e.Avg ?? e.qty).filter(v => v != null);
        out.minHR = mins.length ? Math.round(Math.min(...mins)) : null;
        out.maxHR = maxs.length ? Math.round(Math.max(...maxs)) : null;
        out.avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b) / avgs.length) : null;
        break;
      }
      case 'respiratory_rate': {
        const vals = m.data.map(e => e.qty).filter(Boolean);
        out.respiratoryRate = vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null;
        break;
      }
      case 'walking_running_distance':
        out.distanceKm = +(m.data.reduce((s, e) => s + (e.qty || 0), 0)).toFixed(2);
        break;
      case 'flights_climbed':
        out.flightsClimbed = Math.round(m.data.reduce((s, e) => s + (e.qty || 0), 0));
        break;
      case 'walking_speed': {
        const vals = m.data.map(e => e.qty).filter(Boolean);
        out.walkingSpeed = vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null;
        break;
      }
      case 'walking_step_length': {
        const vals = m.data.map(e => e.qty).filter(Boolean);
        out.stepLength = vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
        break;
      }
    }
  });
  return out;
}

function reply(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain' });
  res.end(msg);
}

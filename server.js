const http    = require('http');
const url     = require('url');
const { google } = require('googleapis');
const { parseFinanceWorkbook } = require('./financeParser');

const PORT = process.env.PORT || 9876;

// Service account key from env var (JSON string)
const SA_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'null');

// Google Drive folder IDs — set these after sharing folders with service account
const HEALTH_FOLDER_ID  = process.env.HEALTH_FOLDER_ID  || '';
const WORKOUT_FOLDER_ID = process.env.WORKOUT_FOLDER_ID || '';
const VAULT_FOLDER_ID   = process.env.VAULT_FOLDER_ID   || '';

// In-memory cache for the parsed finance workbook (5-min TTL, see endpoint).
let _financeCache = null;

function getDrive() {
  if (!SA_KEY) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  const auth = new google.auth.GoogleAuth({
    credentials: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// Find latest file in a Drive folder (by modifiedTime desc)
async function latestFileIn(folderId) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: 1,
    fields: 'files(id, name, modifiedTime)',
  });
  return res.data.files?.[0] || null;
}

// Find the N most recently modified files in a Drive folder
async function recentFilesIn(folderId, limit) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: limit,
    fields: 'files(id, name, modifiedTime)',
  });
  return res.data.files || [];
}

// Newest per-entry date found inside an export's metrics. Drive's
// modifiedTime metadata isn't a reliable proxy for "which file has the
// freshest health data" (multiple automations/widgets can touch the same
// folder), so pick the candidate file by its actual content instead.
function latestContentDate(d) {
  if (typeof d.steps !== 'undefined' || typeof d.restingHR !== 'undefined') return null;
  const metrics = d?.data?.metrics || d?.metrics || [];
  let max = null;
  metrics.forEach(m => {
    (m.data || []).forEach(e => {
      if (typeof e.date === 'string' && (!max || e.date > max)) max = e.date;
    });
  });
  return max;
}

// Download a file's content by Drive file ID
async function downloadFile(fileId) {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );
  return res.data;
}

// Download a file's raw bytes (for binary formats like .xlsx)
async function downloadBinary(fileId) {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

// Find a file in a Drive folder by name
async function findFileByName(folderId, name) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: 1,
    fields: 'files(id, name)',
  });
  return res.data.files?.[0] || null;
}

// Find a subfolder by name inside a parent folder
async function findFolder(parentId, name) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: 1,
    fields: 'files(id, name)',
  });
  return res.data.files?.[0] || null;
}

// Keep only data points recorded on the current calendar day, so
// cumulative metrics (steps, calories, distance, ...) reset at 00:00
// instead of accumulating across every day present in the export file.
function onlyToday(data) {
  const today = new Date().toISOString().slice(0, 10);
  return data.filter(e => typeof e.date === 'string' && e.date.slice(0, 10) === today);
}

function onlyDate(data, dateStr) {
  return data.filter(e => typeof e.date === 'string' && e.date.slice(0, 10) === dateStr);
}

// Intraday hourly buckets + a downsampled heart-rate line, for sparklines.
// Iceland runs on GMT year-round, so the export's "+0000" hour is local hour.
function computeIntraday(metrics) {
  const hourOf = e => {
    if (typeof e.date !== 'string') return null;
    const h = parseInt(e.date.slice(11, 13), 10);
    return Number.isFinite(h) ? h : null;
  };
  const hourly = (m, mult = 1) => {
    const buckets = new Array(24).fill(0);
    onlyToday(m?.data || []).forEach(e => {
      const h = hourOf(e); if (h != null) buckets[h] += (e.qty || 0) * mult;
    });
    return buckets.map(v => Math.round(v));
  };
  const byName = {};
  metrics.forEach(m => { byName[m.name] = m; });
  const out = {
    stepsHourly:  byName.step_count      ? hourly(byName.step_count)          : null,
    activeHourly: byName.active_energy   ? hourly(byName.active_energy, 0.239) : null,
  };
  // Heart rate: downsample today's samples to ~48 points for a smooth line.
  const hr = onlyToday(byName.heart_rate?.data || [])
    .map(e => e.Avg ?? e.qty).filter(v => v != null);
  if (hr.length) {
    const step = Math.max(1, Math.ceil(hr.length / 48));
    const line = [];
    for (let i = 0; i < hr.length; i += step) line.push(Math.round(hr[i]));
    out.hrSeries = line;
  }
  return out;
}

// Compact one-day summary keyed to a specific date, for history/trends.
function summarizeForDate(metrics, dateStr) {
  const sum = arr => arr.reduce((s, e) => s + (e.qty || 0), 0);
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const by = {}; metrics.forEach(m => { by[m.name] = m?.data || []; });
  const rhr = onlyDate(by.resting_heart_rate || [], dateStr).map(e => e.qty).filter(Boolean);
  const hrv = onlyDate(by.heart_rate_variability || [], dateStr).map(e => e.qty).filter(Boolean);
  const sleep = (by.sleep_analysis || []).filter(s =>
    typeof s.date === 'string' && s.date.slice(0, 10) === dateStr);
  const s = sleep[sleep.length - 1];
  return {
    date: dateStr,
    steps: Math.round(sum(onlyDate(by.step_count || [], dateStr))),
    activeCal: Math.round(sum(onlyDate(by.active_energy || [], dateStr)) * 0.239),
    basalCal: Math.round(sum(onlyDate(by.basal_energy_burned || [], dateStr)) * 0.239),
    restingHR: rhr.length ? Math.round(rhr[rhr.length - 1]) : null,
    hrv: hrv.length ? Math.round(avg(hrv)) : null,
    sleepHours: s ? +(s.totalSleep || 0).toFixed(1) : null,
  };
}

// All calendar dates that appear in a parsed export's metrics.
function datesInExport(metrics) {
  const set = new Set();
  metrics.forEach(m => (m.data || []).forEach(e => {
    if (typeof e.date === 'string') set.add(e.date.slice(0, 10));
  }));
  return [...set];
}

function normalizeHealthData(d) {
  if (typeof d.steps !== 'undefined' || typeof d.restingHR !== 'undefined') return d;

  const metrics = d?.data?.metrics || d?.metrics || [];
  const out = { synced: new Date().toISOString() };

  metrics.forEach(m => {
    if (!m.data?.length) return;
    switch (m.name) {
      case 'step_count': {
        const today = onlyToday(m.data);
        out.steps = Math.round(today.reduce((s, e) => s + (e.qty || 0), 0));
        break;
      }
      case 'resting_heart_rate': {
        const today = onlyToday(m.data);
        if (today.length) out.restingHR = Math.round(today[today.length - 1].qty);
        break;
      }
      case 'sleep_analysis': {
        // Sleep spans midnight, so report the most recent session (last
        // night) rather than filtering by today's date.
        const s = m.data[m.data.length - 1];
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
      case 'active_energy': {
        const today = onlyToday(m.data);
        out.activeCal = Math.round(today.reduce((s, e) => s + (e.qty || 0), 0) * 0.239);
        break;
      }
      case 'basal_energy_burned': {
        const today = onlyToday(m.data);
        out.basalCal = Math.round(today.reduce((s, e) => s + (e.qty || 0), 0) * 0.239);
        break;
      }
      case 'heart_rate_variability': {
        const vals = onlyToday(m.data).map(e => e.qty).filter(Boolean);
        out.hrv = vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : null;
        break;
      }
      case 'heart_rate': {
        const today = onlyToday(m.data);
        const mins = today.map(e => e.Min ?? e.qty).filter(v => v != null);
        const maxs = today.map(e => e.Max ?? e.qty).filter(v => v != null);
        const avgs = today.map(e => e.Avg ?? e.qty).filter(v => v != null);
        out.minHR = mins.length ? Math.round(Math.min(...mins)) : null;
        out.maxHR = maxs.length ? Math.round(Math.max(...maxs)) : null;
        out.avgHR = avgs.length ? Math.round(avgs.reduce((a, b) => a + b) / avgs.length) : null;
        break;
      }
      case 'respiratory_rate': {
        const vals = onlyToday(m.data).map(e => e.qty).filter(Boolean);
        out.respiratoryRate = vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null;
        break;
      }
      case 'walking_running_distance': {
        const today = onlyToday(m.data);
        out.distanceKm = +(today.reduce((s, e) => s + (e.qty || 0), 0)).toFixed(2);
        break;
      }
      case 'flights_climbed': {
        const today = onlyToday(m.data);
        out.flightsClimbed = Math.round(today.reduce((s, e) => s + (e.qty || 0), 0));
        break;
      }
      case 'walking_speed': {
        const vals = onlyToday(m.data).map(e => e.qty).filter(Boolean);
        out.walkingSpeed = vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null;
        break;
      }
      case 'walking_step_length': {
        const vals = onlyToday(m.data).map(e => e.qty).filter(Boolean);
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

function jsonReply(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed = url.parse(req.url, true);
  const pn     = decodeURIComponent(parsed.pathname);

  try {
    // GET /api/health-json
    if (pn === '/api/health-json') {
      const candidates = await recentFilesIn(HEALTH_FOLDER_ID, 5);
      if (!candidates.length) return reply(res, 404, 'No health data yet');

      let best = null, bestParsed = null, bestDate = null;
      for (const file of candidates) {
        let parsed;
        try { parsed = JSON.parse(await downloadFile(file.id)); }
        catch (e) { continue; }
        const contentDate = latestContentDate(parsed);
        if (!best || (contentDate && (!bestDate || contentDate > bestDate))) {
          best = file; bestParsed = parsed; bestDate = contentDate;
        }
      }
      if (!best) return reply(res, 404, 'No health data yet');

      const data = normalizeHealthData(bestParsed);
      // Report when the export file itself was last updated, not when this
      // request happened — otherwise a stale export still says "synced
      // just now" and hides that no new data has actually landed.
      data.synced = best.modifiedTime || data.synced;
      const metrics = bestParsed?.data?.metrics || bestParsed?.metrics || [];
      data.intraday = computeIntraday(metrics);
      return jsonReply(res, data);
    }

    // GET /api/health-history — compact per-day summaries across every export
    // file, for 7-day averages, deltas and trend sparklines. Grows over time.
    if (pn === '/api/health-history') {
      const files = await recentFilesIn(HEALTH_FOLDER_ID, 60);
      const byDate = {};
      for (const file of files) {
        let parsed;
        try { parsed = JSON.parse(await downloadFile(file.id)); }
        catch (e) { continue; }
        const metrics = parsed?.data?.metrics || parsed?.metrics || [];
        for (const dateStr of datesInExport(metrics)) {
          const day = summarizeForDate(metrics, dateStr);
          // Prefer the entry with the most data if a date spans files.
          const score = d => (d.steps||0) + (d.sleepHours?1000:0) + (d.restingHR?500:0);
          if (!byDate[dateStr] || score(day) > score(byDate[dateStr])) byDate[dateStr] = day;
        }
      }
      const days = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : 1);
      return jsonReply(res, { days });
    }

    // GET /api/workout-history — every workout across all export files, for
    // the workout-consistency heatmap.
    if (pn === '/api/workout-history') {
      const files = await recentFilesIn(WORKOUT_FOLDER_ID, 60);
      const seen = new Set();
      const workouts = [];
      for (const file of files) {
        let d;
        try { d = JSON.parse(await downloadFile(file.id)); }
        catch (e) { continue; }
        (d?.data?.workouts || []).forEach(w => {
          const key = (w.name || '') + '|' + (w.start || '');
          if (seen.has(key)) return;
          seen.add(key);
          workouts.push({
            name: w.name || 'Workout',
            start: w.start,
            duration: Math.round((w.duration || 0) / 60),
            kcal: Math.round((w.activeEnergyBurned?.qty || 0) * 0.239),
          });
        });
      }
      workouts.sort((a, b) => (a.start || '') < (b.start || '') ? -1 : 1);
      return jsonReply(res, { workouts });
    }

    // GET /api/finance-json — parse the latest "Hilmir Finance vN.xlsx" in the
    // vault (2-Areas/Finance) into the dashboard's finance JSON. Cached 5 min
    // so we don't re-download + re-parse the workbook on every tab open.
    if (pn === '/api/finance-json') {
      const now = Date.now();
      if (_financeCache && now - _financeCache.at < 5 * 60 * 1000) {
        return jsonReply(res, _financeCache.data);
      }
      const areas = await findFolder(VAULT_FOLDER_ID, '2-Areas');
      const finDir = areas && await findFolder(areas.id, 'Finance');
      if (!finDir) return reply(res, 404, 'Finance folder not found in vault');
      const drive = getDrive();
      const r = await drive.files.list({
        q: `'${finDir.id}' in parents and trashed = false and name contains 'Finance'`,
        fields: 'files(id, name)',
        pageSize: 50,
      });
      // Pick the highest version number among "Hilmir Finance vN.xlsx".
      const xlsx = (r.data.files || [])
        .filter(f => /\.xlsx$/i.test(f.name))
        .map(f => ({ ...f, v: (f.name.match(/v(\d+)/i) || [])[1] | 0 }))
        .sort((a, b) => b.v - a.v)[0];
      if (!xlsx) return reply(res, 404, 'No finance workbook found');
      const data = parseFinanceWorkbook(await downloadBinary(xlsx.id));
      data.source = xlsx.name;
      _financeCache = { at: now, data };
      return jsonReply(res, data);
    }

    // GET /api/workout-json
    if (pn === '/api/workout-json') {
      const file = await latestFileIn(WORKOUT_FOLDER_ID);
      if (!file) return reply(res, 404, 'No workout data yet');
      const raw = await downloadFile(file.id);
      const d = JSON.parse(raw);
      const workouts = (d?.data?.workouts || []).map(w => ({
        name:     w.name || 'Workout',
        start:    w.start,
        end:      w.end,
        duration: Math.round((w.duration || 0) / 60),
        avgHR:    Math.round(w.avgHeartRate?.qty || w.heartRate?.avg?.qty || 0),
        maxHR:    Math.round(w.maxHeartRate?.qty || w.heartRate?.max?.qty || 0),
        minHR:    Math.round(w.heartRate?.min?.qty || 0),
        kcal:     Math.round((w.activeEnergyBurned?.qty || 0) * 0.239),
      }));
      return jsonReply(res, { workouts, file: file.name });
    }

    // GET /api/vault-dir?dir=relative/dir — list files in a vault folder
    if (pn === '/api/vault-dir') {
      const rel = parsed.query.dir || '';
      const parts = rel.split('/').filter(Boolean);
      let currentFolder = VAULT_FOLDER_ID;
      for (const part of parts) {
        const folder = await findFolder(currentFolder, part);
        if (!folder) return jsonReply(res, []);
        currentFolder = folder.id;
      }
      const drive = getDrive();
      const r = await drive.files.list({
        q: `'${currentFolder}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
      });
      const list = (r.data.files || []).map(f => ({
        name: f.name,
        isDir: f.mimeType === 'application/vnd.google-apps.folder',
      }));
      return jsonReply(res, list);
    }

    // GET /api/vault?file=relative/path.md
    if (pn === '/api/vault') {
      const rel = parsed.query.file;
      if (!rel) return reply(res, 400, 'Missing file param');

      // Navigate folder path in Drive
      const parts = rel.split('/');
      const fileName = parts.pop();
      let currentFolder = VAULT_FOLDER_ID;
      for (const part of parts) {
        const folder = await findFolder(currentFolder, part);
        if (!folder) return reply(res, 404, 'Not found: ' + rel);
        currentFolder = folder.id;
      }
      const file = await findFileByName(currentFolder, fileName);
      if (!file) return reply(res, 404, 'Not found: ' + rel);
      const content = await downloadFile(file.id);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(content);
    }

    // Health check
    if (pn === '/api/ping') {
      return jsonReply(res, { ok: true });
    }

    reply(res, 404, 'Not found');
  } catch (err) {
    console.error(err);
    reply(res, 500, err.message);
  }

}).listen(PORT, () => {
  console.log('Dashboard API running on port ' + PORT);
});

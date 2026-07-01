const http    = require('http');
const url     = require('url');
const { google } = require('googleapis');

const PORT = process.env.PORT || 9876;

// Service account key from env var (JSON string)
const SA_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'null');

// Google Drive folder IDs — set these after sharing folders with service account
const HEALTH_FOLDER_ID  = process.env.HEALTH_FOLDER_ID  || '';
const WORKOUT_FOLDER_ID = process.env.WORKOUT_FOLDER_ID || '';
const VAULT_FOLDER_ID   = process.env.VAULT_FOLDER_ID   || '';

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

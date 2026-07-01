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
      const file = await latestFileIn(HEALTH_FOLDER_ID);
      if (!file) return reply(res, 404, 'No health data yet');
      const raw = await downloadFile(file.id);
      const data = normalizeHealthData(JSON.parse(raw));
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

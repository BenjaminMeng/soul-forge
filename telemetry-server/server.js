'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

// --- Config ---
const PORT = process.env.PORT || 9091;
const API_KEY = process.env.API_KEY || 'sf-telemetry-dev-key';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// --- Ensure data directory ---
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- JSON file storage ---
// Each event appended as a JSON line to events.jsonl (JSON Lines format)
// Fast writes, easy to parse, no native dependencies
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

function appendEvent(data) {
  const record = {
    ...data,
    _received_at: new Date().toISOString()
  };
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(record) + '\n');
}

function readAllEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const lines = fs.readFileSync(EVENTS_FILE, 'utf-8').trim().split('\n');
  return lines.filter(l => l.trim()).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function getLatestPerUser(events) {
  const latest = {};
  for (const e of events) {
    if (!e.anon_id) continue;
    if (!latest[e.anon_id] || e._received_at > latest[e.anon_id]._received_at) {
      latest[e.anon_id] = e;
    }
  }
  return Object.values(latest);
}

// --- Express app ---
const app = express();
app.use(express.json({ limit: '50kb' }));

// Auth middleware
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== API_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// POST /api/telemetry — receive telemetry data
app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  if (!data || !data.anon_id) {
    return res.status(400).json({ error: 'missing anon_id' });
  }
  try {
    appendEvent(data);
    res.status(204).end();
  } catch (err) {
    console.error('Write error:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

// GET /api/dashboard — aggregated analytics (requires auth)
app.get('/api/dashboard', auth, (req, res) => {
  try {
    const events = readAllEvents();
    const users = getLatestPerUser(events);
    const uniqueIds = new Set(events.map(e => e.anon_id));

    // DISC distribution
    const discDist = {};
    const confDist = {};
    users.forEach(u => {
      if (u.disc && u.disc.primary) discDist[u.disc.primary] = (discDist[u.disc.primary] || 0) + 1;
      if (u.disc && u.disc.confidence) confDist[u.disc.confidence] = (confDist[u.disc.confidence] || 0) + 1;
    });

    // Version distribution
    const versionDist = {};
    users.forEach(u => {
      const v = u.soul_forge_version || 'unknown';
      versionDist[v] = (versionDist[v] || 0) + 1;
    });

    // Maturity distribution
    const maturityDist = {};
    users.forEach(u => {
      const m = u.session && u.session.maturity_phase || 'unknown';
      maturityDist[m] = (maturityDist[m] || 0) + 1;
    });

    // Recent events
    const recent = events.slice(-20).reverse().map(e => ({
      anon_id: e.anon_id,
      soul_forge_version: e.soul_forge_version,
      session_count: e.session ? e.session.count : null,
      disc_primary: e.disc ? e.disc.primary : null,
      maturity_phase: e.session ? e.session.maturity_phase : null,
      received_at: e._received_at
    }));

    res.json({
      summary: { total_users: uniqueIds.size, total_events: events.length },
      disc_distribution: discDist,
      confidence_distribution: confDist,
      version_distribution: versionDist,
      maturity_distribution: maturityDist,
      recent_events: recent
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'query error' });
  }
});

// GET /api/reports/:anon_id — single user longitudinal data (requires auth)
app.get('/api/reports/:anon_id', auth, (req, res) => {
  try {
    const events = readAllEvents().filter(e => e.anon_id === req.params.anon_id);
    if (events.length === 0) return res.status(404).json({ error: 'not found' });
    res.json({ anon_id: req.params.anon_id, events });
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ error: 'query error' });
  }
});

// GET /api/analysis — 5-dimension analysis report (requires auth)
app.get('/api/analysis', auth, (req, res) => {
  try {
    const events = readAllEvents();
    const users = getLatestPerUser(events);
    if (users.length === 0) return res.json({ message: 'no data yet' });

    // Dim 1: Questionnaire validity
    const discCounts = { D: 0, I: 0, S: 0, C: 0 };
    const confCounts = { high: 0, medium: 0, low: 0 };
    users.forEach(u => {
      if (u.disc && u.disc.primary) discCounts[u.disc.primary] = (discCounts[u.disc.primary] || 0) + 1;
      if (u.disc && u.disc.confidence) confCounts[u.disc.confidence] = (confCounts[u.disc.confidence] || 0) + 1;
    });
    const maxDisc = Math.max(...Object.values(discCounts));

    // Dim 2: Modifier drift
    const driftSums = { verbosity: 0, humor: 0, proactivity: 0, challenge: 0 };
    let driftCount = 0;
    users.forEach(u => {
      if (u.drift) {
        driftCount++;
        for (const mod of Object.keys(driftSums)) {
          driftSums[mod] += (u.drift[mod] && u.drift[mod].net) || 0;
        }
      }
    });
    const driftAvg = {};
    for (const mod of Object.keys(driftSums)) {
      driftAvg[mod] = driftCount > 0 ? Math.round((driftSums[mod] / driftCount) * 100) / 100 : 0;
    }

    // Dim 3: Sentiment engine
    let lowConfSum = 0, moodUsers = 0;
    users.forEach(u => {
      if (u.mood_history_summary) { lowConfSum += u.mood_history_summary.low_confidence_ratio || 0; moodUsers++; }
    });

    // Dim 4: Memory health
    let dedupSum = 0, memUsers = 0;
    users.forEach(u => {
      if (u.memory_dedup) { dedupSum += u.memory_dedup.dedup_ratio || 0; memUsers++; }
    });

    // Dim 5: Pipeline effectiveness
    let permTotal = 0, revertTotal = 0;
    users.forEach(u => {
      if (u.change_history_summary) {
        permTotal += u.change_history_summary.permanent || 0;
        revertTotal += u.change_history_summary.reverted || 0;
      }
    });

    res.json({
      user_count: users.length,
      questionnaire: {
        disc_distribution: discCounts, confidence_distribution: confCounts,
        bias_warning: maxDisc / users.length > 0.7
      },
      modifier_drift: {
        avg_drift: driftAvg,
        systemic_warning: Object.values(driftAvg).some(v => Math.abs(v) >= 3)
      },
      sentiment_engine: {
        avg_low_confidence_ratio: moodUsers > 0 ? Math.round((lowConfSum / moodUsers) * 100) / 100 : null,
        lexicon_expansion_needed: moodUsers > 0 && (lowConfSum / moodUsers) > 0.5
      },
      memory_health: {
        avg_dedup_ratio: memUsers > 0 ? Math.round((dedupSum / memUsers) * 100) / 100 : null,
        dedup_instruction_needed: memUsers > 0 && (dedupSum / memUsers) > 0.7
      },
      pipeline: {
        total_permanent: permTotal, total_reverted: revertTotal,
        revert_ratio: (permTotal + revertTotal) > 0 ? Math.round((revertTotal / (permTotal + revertTotal)) * 100) / 100 : null,
        params_adjustment_needed: (permTotal + revertTotal) > 0 && (revertTotal / (permTotal + revertTotal)) > 0.5
      }
    });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: 'analysis error' });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// --- Start ---
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Soul Forge Telemetry Server listening on 127.0.0.1:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- Config ---
const PORT = process.env.PORT || 9091;
const API_KEY = process.env.API_KEY || 'sf-telemetry-dev-key';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'telemetry.db');

// --- Ensure data directory ---
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// --- Database setup ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_id TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    soul_forge_version TEXT,
    session_count INTEGER,
    disc_primary TEXT,
    maturity_phase TEXT,
    payload TEXT NOT NULL,
    received_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_anon_id ON events(anon_id);
  CREATE INDEX IF NOT EXISTS idx_received_at ON events(received_at);
  CREATE INDEX IF NOT EXISTS idx_disc_primary ON events(disc_primary);
`);

const insertStmt = db.prepare(`
  INSERT INTO events (anon_id, schema_version, soul_forge_version, session_count, disc_primary, maturity_phase, payload)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

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
    insertStmt.run(
      data.anon_id,
      data._schema || 'unknown',
      data.soul_forge_version || null,
      data.session ? data.session.count : null,
      data.disc ? data.disc.primary : null,
      data.session ? data.session.maturity_phase : null,
      JSON.stringify(data)
    );
    res.status(204).end();
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

// GET /api/dashboard — aggregated analytics (requires auth)
app.get('/api/dashboard', auth, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(DISTINCT anon_id) as count FROM events').get();
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get();

    // DISC distribution
    const discDist = db.prepare(`
      SELECT disc_primary, COUNT(DISTINCT anon_id) as users
      FROM events WHERE disc_primary IS NOT NULL
      GROUP BY disc_primary ORDER BY users DESC
    `).all();

    // Maturity distribution
    const maturityDist = db.prepare(`
      SELECT maturity_phase, COUNT(DISTINCT anon_id) as users
      FROM events WHERE maturity_phase IS NOT NULL
      GROUP BY maturity_phase
    `).all();

    // Version distribution
    const versionDist = db.prepare(`
      SELECT soul_forge_version, COUNT(DISTINCT anon_id) as users
      FROM events WHERE soul_forge_version IS NOT NULL
      GROUP BY soul_forge_version ORDER BY soul_forge_version DESC
    `).all();

    // Recent events
    const recent = db.prepare(`
      SELECT anon_id, soul_forge_version, session_count, disc_primary, maturity_phase, received_at
      FROM events ORDER BY received_at DESC LIMIT 20
    `).all();

    res.json({
      summary: {
        total_users: totalUsers.count,
        total_events: totalEvents.count
      },
      disc_distribution: discDist,
      maturity_distribution: maturityDist,
      version_distribution: versionDist,
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
    const events = db.prepare(`
      SELECT payload, received_at FROM events
      WHERE anon_id = ? ORDER BY received_at ASC
    `).all(req.params.anon_id);

    if (events.length === 0) return res.status(404).json({ error: 'not found' });

    const parsed = events.map(e => ({
      ...JSON.parse(e.payload),
      received_at: e.received_at
    }));

    res.json({ anon_id: req.params.anon_id, events: parsed });
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ error: 'query error' });
  }
});

// GET /api/analysis — 5-dimension analysis report (requires auth)
app.get('/api/analysis', auth, (req, res) => {
  try {
    // Get latest event per user
    const latestPerUser = db.prepare(`
      SELECT payload FROM events e1
      WHERE received_at = (SELECT MAX(received_at) FROM events e2 WHERE e2.anon_id = e1.anon_id)
    `).all();

    const users = latestPerUser.map(r => JSON.parse(r.payload));
    if (users.length === 0) return res.json({ message: 'no data yet' });

    // Dimension 1: Questionnaire validity
    const discCounts = { D: 0, I: 0, S: 0, C: 0 };
    const confCounts = { high: 0, medium: 0, low: 0 };
    users.forEach(u => {
      if (u.disc && u.disc.primary) discCounts[u.disc.primary] = (discCounts[u.disc.primary] || 0) + 1;
      if (u.disc && u.disc.confidence) confCounts[u.disc.confidence] = (confCounts[u.disc.confidence] || 0) + 1;
    });
    const maxDisc = Math.max(...Object.values(discCounts));
    const questionnaire_bias = maxDisc / users.length > 0.7;

    // Dimension 2: Modifier drift
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

    // Dimension 3: Sentiment engine
    let lowConfSum = 0, moodUsers = 0;
    users.forEach(u => {
      if (u.mood_history_summary) {
        lowConfSum += u.mood_history_summary.low_confidence_ratio || 0;
        moodUsers++;
      }
    });

    // Dimension 4: Memory health
    let dedupSum = 0, memUsers = 0;
    users.forEach(u => {
      if (u.memory_dedup) {
        dedupSum += u.memory_dedup.dedup_ratio || 0;
        memUsers++;
      }
    });

    // Dimension 5: Pipeline effectiveness
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
        disc_distribution: discCounts,
        confidence_distribution: confCounts,
        bias_warning: questionnaire_bias
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
        total_permanent: permTotal,
        total_reverted: revertTotal,
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
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// --- Start ---
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Soul Forge Telemetry Server listening on 127.0.0.1:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});

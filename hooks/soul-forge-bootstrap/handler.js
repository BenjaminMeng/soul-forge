'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ============================================================
// Soul Forge Bootstrap Hook — handler.js (CommonJS)
// Runs on agent:bootstrap. Pure Node.js builtins only.
// ============================================================

const FRESH_CONFIG = { status: 'fresh', version: 3 };
const MAX_INJECT_BYTES = 4096; // 4KB budget (increased for Phase 3 context)
const MAX_OBSERVATIONS = 20;
const READINESS_THRESHOLD = 5;
const MOOD_HISTORY_MAX = 10; // FIFO mood history size

// --- Auto-update + Telemetry constants ---
const SOUL_FORGE_VERSION = '3.1.0';
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/BenjaminMeng/soul-forge/main/version.json';
const UPDATE_CHECK_URL_CN = 'https://YOUR_DOMAIN_CN/soul-forge/version.json'; // 境内 fallback
const UPDATE_BASE_URL = 'https://raw.githubusercontent.com/BenjaminMeng/soul-forge/main/';
const UPDATE_BASE_URL_CN = 'https://YOUR_DOMAIN_CN/soul-forge/'; // 境内 fallback
const UPDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_SALT = 'soul_forge_2026_anon';
const TELEMETRY_ENDPOINT_DEFAULT = 'https://89.117.23.59:9090/api/telemetry';
const TELEMETRY_ENDPOINT_CN = 'https://YOUR_DOMAIN_CN:9090/api/telemetry'; // 境内 fallback

// --- Sentiment analysis (lazy loaded) ---
let _sentiment = null;
function getSentiment() {
  if (!_sentiment) {
    try {
      _sentiment = require('./sentiment');
    } catch {
      _sentiment = { analyze: () => ({ score: 0, vote: 'neutral', tokens: 0, confidence: 'low', lang: 'unknown' }) };
    }
  }
  return _sentiment;
}

// --- Utility helpers ---

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function safeWriteFile(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function appendToErrorLog(workspaceDir, message) {
  const logPath = path.join(workspaceDir, '.soul_forge', 'errors.log');
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch {
    // Best effort — if we can't log, we can't log
  }
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// --- config_update.md parser ---

function parseConfigUpdate(content) {
  const result = {};
  let currentSection = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Detect section headers: ## Action, ## DISC, ## Modifiers, ## Status, ## Reason
    const headerMatch = trimmed.match(/^##\s+(.+)$/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase();
      continue;
    }

    if (!currentSection || trimmed === '' || trimmed.startsWith('#')) continue;

    // Parse bold-key fields: - **key**: value
    const fieldMatch = trimmed.match(/^-?\s*\*\*(\w+)\*\*:\s*(.+)$/);

    switch (currentSection) {
      case 'action':
        if (!result.action) result.action = trimmed;
        break;
      case 'status':
        if (!result.status) result.status = trimmed;
        break;
      case 'reason':
        result.reason = (result.reason ? result.reason + ' ' : '') + trimmed;
        break;
      case 'disc':
        if (fieldMatch) {
          if (!result.disc) result.disc = {};
          const key = fieldMatch[1].toLowerCase();
          let value = fieldMatch[2].trim();
          if (key === 'scores') {
            // Parse "D=1 I=2 S=5 C=4"
            const scores = {};
            for (const part of value.split(/\s+/)) {
              const [k, v] = part.split('=');
              if (k && v) scores[k] = parseInt(v, 10);
            }
            result.disc.scores = scores;
          } else {
            result.disc[key] = value;
          }
        }
        break;
      case 'modifiers':
        if (fieldMatch) {
          if (!result.modifiers) result.modifiers = {};
          result.modifiers[fieldMatch[1].toLowerCase()] = parseInt(fieldMatch[2], 10);
        }
        break;
      case 'soul_evolve':
      case 'soul evolve':
        if (fieldMatch) {
          const key = fieldMatch[1].toLowerCase();
          const val = fieldMatch[2].trim();
          if (key === 'modifier') result.soul_evolve_modifier = val;
          else if (key === 'direction') result.soul_evolve_direction = val;
          else if (key === 'backup') result.soul_evolve_backup = val;
        }
        break;
      case 'telemetry_opt_in':
      case 'telemetry opt in':
        result.telemetry_opt_in = value.toLowerCase() === 'true';
        break;
    }
  }

  return result;
}

// --- Process pending config_update.md ---

function processConfigUpdate(workspaceDir, config) {
  const updatePath = path.join(workspaceDir, '.soul_forge', 'config_update.md');
  const configPath = path.join(workspaceDir, '.soul_forge', 'config.json');

  if (!fs.existsSync(updatePath)) return config;

  const updateContent = safeReadFile(updatePath);
  if (!updateContent) {
    appendToErrorLog(workspaceDir, 'config_update.md exists but could not be read. File will be retried on next bootstrap.');
    return config;
  }

  try {
    const update = parseConfigUpdate(updateContent);

    // Handle merge_failed flag
    if (update.action === 'merge_failed') {
      config.merge_failed = true;
    }

    // Handle decline
    if (update.action === 'decline' || update.status === 'declined') {
      config.status = 'declined';
    }

    // Apply modifier updates
    if (update.modifiers) {
      if (!config.modifiers) {
        config.modifiers = { humor: 1, verbosity: 2, proactivity: 1, challenge: 0 };
      }
      Object.assign(config.modifiers, update.modifiers);
    }

    // Apply status update
    if (update.status && update.action !== 'merge_failed') {
      config.status = update.status;
    }

    // Handle soul_evolve action (Phase 3.2)
    if (update.action === 'soul_evolve') {
      const modifier = update.soul_evolve_modifier || null;
      const direction = update.soul_evolve_direction || null;
      if (modifier && direction && config.soul_evolve) {
        // Record as pending evolve with 10-session validation window
        config.soul_evolve.pending = {
          modifier: modifier,
          direction: direction,
          applied_session: config.probe_session_count || 0,
          validation_window: 10,
          negative_signals: 0,
          backup_file: update.soul_evolve_backup || null
        };
        config.soul_evolve.last_execution = new Date().toISOString();
        // Increment evolve_count
        if (config.soul_evolve.evolve_count) {
          config.soul_evolve.evolve_count[modifier] = (config.soul_evolve.evolve_count[modifier] || 0) + 1;
        }
      }
    }

    // Apply DISC update
    if (update.disc) {
      config.disc = Object.assign(config.disc || {}, update.disc);
    }

    // Handle telemetry opt-in/out (Phase 3.4)
    if (update.telemetry_opt_in !== undefined) {
      config.telemetry_opt_in = update.telemetry_opt_in;
      if (update.telemetry_opt_in && !config.telemetry_anon_id) {
        config.telemetry_anon_id = generateAnonId(config);
      }
    }

    // Append to calibration history
    if (!config.calibration_history) config.calibration_history = [];
    config.calibration_history.push({
      timestamp: new Date().toISOString(),
      trigger: update.action || update.reason || 'calibration',
      changes: update.reason || 'Updated via config_update.md'
    });

    config.updated_at = new Date().toISOString();

    // Write updated config
    safeWriteFile(configPath, JSON.stringify(config, null, 2));

    // Delete the processed update file
    try { fs.unlinkSync(updatePath); } catch { /* best effort */ }

  } catch (e) {
    appendToErrorLog(workspaceDir, `config_update.md processing failed: ${e.message}`);
    // Keep config_update.md for retry
  }

  return config;
}

// --- Parse memory.md observations ---

function parseMemory(content) {
  if (!content) return [];

  const observations = [];
  // Split by ## headings
  const sections = content.split(/^(?=## )/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.startsWith('# Soul Forge')) continue; // skip H1 header

    try {
      const entry = {};

      // Extract date from ## heading
      const dateMatch = trimmed.match(/^##\s+(.+?)(?:\s*\[CRYSTALLIZED\])?\s*$/m);
      if (dateMatch) {
        entry.date = dateMatch[1].trim();
      }

      // Check for CRYSTALLIZED flag
      if (trimmed.includes('[CRYSTALLIZED]')) {
        entry.crystallized = true;
      }

      // Extract fields: - **key**: value
      const fieldPattern = /[-*]\s*\*\*(\w[\w_-]*)\*\*:\s*(.+)/g;
      let match;
      while ((match = fieldPattern.exec(trimmed)) !== null) {
        // Normalize field names: modifier-hint → modifier_hint
        const key = match[1].toLowerCase().replace(/-/g, '_');
        entry[key] = match[2].trim();
      }

      if (entry.date || entry.type) {
        observations.push(entry);
      }
    } catch {
      // Per-entry error: skip, log metadata only (no raw text for privacy)
      const dateGuess = trimmed.match(/^##\s+(.+)$/m);
      const entryDate = dateGuess ? dateGuess[1].trim() : 'unknown-date';
      // We'll log outside this function if needed
    }
  }

  return observations;
}

// --- Compute calibration readiness ---

function computeCalibrationReadiness(observations) {
  const groups = {};
  const activeObs = observations.filter(o => o.status === 'active');

  for (const obs of activeObs) {
    if (!obs.modifier_hint) continue;

    // Parse "verbosity → lower" or "verbosity → 降低" or "humor → raise"
    const hintMatch = obs.modifier_hint.match(/(\w+)\s*[→\->]+\s*(.+)/);
    if (!hintMatch) continue;

    const modifier = hintMatch[1].toLowerCase().trim();
    const direction = hintMatch[2].toLowerCase().trim();

    // Normalize direction
    let normalizedDir = direction;
    if (direction.includes('lower') || direction.includes('降低') || direction.includes('减少')) {
      normalizedDir = 'lower';
    } else if (direction.includes('raise') || direction.includes('提高') || direction.includes('增加')) {
      normalizedDir = 'raise';
    } else if (direction.includes('暂停') || direction.includes('pause') || direction.includes('stop')) {
      normalizedDir = 'lower';
    }

    const key = `${modifier}(${normalizedDir})`;
    if (!groups[key]) groups[key] = { modifier, direction: normalizedDir, count: 0 };
    groups[key].count++;
  }

  // Mark readiness
  for (const key in groups) {
    groups[key].ready = groups[key].count >= READINESS_THRESHOLD;
  }

  return groups;
}

// --- Generate injection content ---

function generateInjection(config, observations, readiness, moodContext, actionSignals) {
  const lines = [];

  lines.push('# Soul Forge Calibration Context');
  lines.push('');

  // Status section (with maturity phase)
  lines.push('## Status');
  const discType = config.disc ? config.disc.primary : 'unknown';
  const confidence = config.disc ? config.disc.confidence : 'unknown';
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);
  lines.push(`${config.status} | ${discType}-type | confidence: ${confidence} | session: ${sessionCount}`);
  lines.push(`maturity: ${maturity.phase} | cooldown: ${maturity.change_cooldown_days}d | drift_threshold: ${maturity.drift_threshold}`);
  lines.push('');

  // Active modifiers
  lines.push('## Active Modifiers');
  if (config.modifiers) {
    const m = config.modifiers;
    lines.push(`verbosity: ${m.verbosity ?? 2} | humor: ${m.humor ?? 1} | proactivity: ${m.proactivity ?? 1} | challenge: ${m.challenge ?? 0}`);
  } else {
    lines.push('verbosity: 2 | humor: 1 | proactivity: 1 | challenge: 0');
  }
  lines.push('');

  // Context Adjustments (Phase 3: mood-driven)
  if (moodContext && moodContext.moodResult) {
    lines.push('## Context Adjustments');
    const mc = moodContext;
    const moodLabel = mc.moodResult.score > 0.3 ? 'positive' :
                      mc.moodResult.score < -0.3 ? 'negative' : 'neutral';
    lines.push(`mood: ${mc.moodResult.score} (${moodLabel}) | trend: ${mc.trend} | emotion: ${mc.moodResult.vote}`);

    // Compute mood-driven overrides
    const overrides = [];
    if (mc.trend === 'declining' && mc.moodResult.score < -0.2) {
      overrides.push('challenge -1 (mood-driven)');
      overrides.push('humor -1 (mood-driven)');
      if (mc.moodResult.score < -0.5) {
        overrides.push('proactivity +1 (mood-driven, supportive)');
      }
    }
    if (overrides.length > 0) {
      lines.push(`active_overrides: ${overrides.join(', ')}`);
    } else {
      lines.push('active_overrides: none');
    }
    lines.push('');
  }

  // Action Signals (Phase 3.1)
  if (actionSignals && actionSignals.length > 0) {
    lines.push('## Action Signals');
    for (const sig of actionSignals) {
      const dataStr = Object.entries(sig.data || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      lines.push(`- ${sig.signal}: ${dataStr}`);
    }
    lines.push('');
  }

  // Pending Changes (Phase 3.1)
  const hasPendingChanges = config.pending_changes && Object.keys(config.pending_changes).length > 0;
  const hasPendingEvolve = config.soul_evolve && config.soul_evolve.pending;
  if (hasPendingChanges || hasPendingEvolve) {
    lines.push('## Pending Changes');
    if (hasPendingChanges) {
      for (const [mod, pc] of Object.entries(config.pending_changes)) {
        if (!pc || !pc.applied_session) continue;
        const remaining = (pc.validation_window || 5) - ((config.probe_session_count || 0) - pc.applied_session);
        lines.push(`- ${mod}: ${pc.from}→${pc.to} (${remaining > 0 ? remaining + ' sessions remaining' : 'validation complete'}), negative_signals: ${pc.negative_signals || 0}`);
      }
    }
    if (hasPendingEvolve) {
      const pe = config.soul_evolve.pending;
      const remaining = (pe.validation_window || 10) - ((config.probe_session_count || 0) - pe.applied_session);
      lines.push(`- SOUL_EVOLVE: ${pe.modifier} ${pe.direction} (${remaining > 0 ? remaining + ' sessions remaining' : 'validation complete'}), negative_signals: ${pe.negative_signals || 0}`);
    }
    lines.push('');
  }

  // Calibration readiness
  lines.push('## Calibration Readiness');
  const readinessKeys = Object.keys(readiness);
  if (readinessKeys.length === 0) {
    lines.push('No observations yet.');
  } else {
    for (const key of readinessKeys) {
      const r = readiness[key];
      const status = r.ready ? 'READY' : 'not yet';
      lines.push(`${r.modifier}(${r.direction}): ${r.count} observations — ${status}`);
    }
  }
  lines.push('');

  // Recording format
  lines.push('## Recording Format');
  lines.push('When you observe personality signals, append to .soul_forge/memory.md:');
  lines.push('```');
  lines.push('## YYYY-MM-DD HH:MM');
  lines.push('- **type**: style|emotion|boundary|decision');
  lines.push('- **signal**: (what you observed)');
  lines.push('- **inference**: (what it implies)');
  lines.push('- **modifier_hint**: (modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)');
  lines.push('- **status**: active');
  lines.push('```');
  lines.push('');

  // Recent observations
  const activeObs = observations.filter(o => o.status === 'active');
  let recentObs = activeObs.slice(-MAX_OBSERVATIONS);

  lines.push('## Recent Observations');
  if (recentObs.length === 0) {
    lines.push('No observations recorded yet.');
  } else {
    for (const obs of recentObs) {
      const date = obs.date || 'unknown';
      const type = obs.type || '?';
      const signal = obs.signal || '';
      // Truncate signal for space
      const shortSignal = signal.length > 80 ? signal.substring(0, 77) + '...' : signal;
      lines.push(`- ${date}: ${type} / ${shortSignal}`);
    }
  }

  let content = lines.join('\n');

  // Budget check: trim observations if over 3KB
  if (Buffer.byteLength(content, 'utf-8') > MAX_INJECT_BYTES) {
    // Retry with fewer observations
    const trimCounts = [10, 5, 0];
    for (const count of trimCounts) {
      const trimmedLines = lines.filter(l => !l.startsWith('- ') || !l.includes(': '));
      // Re-build with fewer obs
      const obsStart = lines.indexOf('## Recent Observations');
      if (obsStart >= 0) {
        const beforeObs = lines.slice(0, obsStart + 1);
        const trimmedObs = recentObs.slice(-count);
        if (trimmedObs.length === 0) {
          beforeObs.push(`${activeObs.length} observations recorded (summary omitted for space).`);
        } else {
          for (const obs of trimmedObs) {
            const date = obs.date || 'unknown';
            const type = obs.type || '?';
            beforeObs.push(`- ${date}: ${type}`);
          }
        }
        content = beforeObs.join('\n');
        if (Buffer.byteLength(content, 'utf-8') <= MAX_INJECT_BYTES) break;
      }
    }
  }

  return content;
}

// --- HEARTBEAT.md segment ---

const HEARTBEAT_SEGMENT = `<!-- SOUL_FORGE_START — CRITICAL: This section is auto-maintained by soul-forge-bootstrap hook. Do not remove or modify. Deletion will be detected and restored on next startup. -->
## Soul Forge: Personality Check
- FIRST: Check the Soul Forge status in your bootstrap context
  (look for the "## Status" section injected by soul-forge-bootstrap hook).
  Do NOT read .soul_forge/config.json directly.
- If status = "fresh": remind user to run /soul-forge (max once per 3 heartbeats)
- If status = "paused", "dormant", or "declined": skip all checks, do nothing
- IMPORTANT: If any /soul-forge command was run earlier in THIS conversation,
  check your conversation history for the MOST RECENT one:
  - If most recent was /soul-forge, /soul-forge calibrate, /soul-forge recalibrate, or /soul-forge resume → treat as "calibrated"
    (Exception: if /soul-forge was run but the user declined the privacy prompt, treat as "declined" and skip all checks)
  - If most recent was /soul-forge pause → treat as "paused", skip all checks
  - If most recent was /soul-forge reset → treat as "dormant", skip all checks
- If no Soul Forge status section is found in bootstrap context
  (hook has not yet run since installation), skip all Soul Forge checks.
- If status = "calibrated":
  Review the conversation since last check. Answer these questions:
  1. Did user express preference about reply LENGTH? (too long/too short/just right)
  2. Did user express preference about reply TONE? (too formal/too casual/just right)
  3. Did user show EMOTION signal? (frustrated/happy/impatient/neutral)
  4. Did user set any BOUNDARY? (don't do X / always do Y)
  5. Did user show DECISION-MAKING preference? (wants options vs wants direct answer)
  6. Did user express preference about PROACTIVITY? (too pushy/too passive/just right)

  If ANY answer is not "neutral/just right":
    Append to .soul_forge/memory.md using EXACTLY this format
    (copy-paste the template below, do NOT paraphrase field names):
    ## YYYY-MM-DD HH:MM
    - **type**: style|emotion|boundary|decision
    - **signal**: (exact quote or behavior observed)
    - **inference**: (what it implies about preferences)
    - **modifier_hint**: (which modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)
    - **status**: active
  If ALL neutral → skip silently

- Check the "Calibration Readiness" section in your bootstrap context
  (injected by soul-forge-bootstrap hook, NOT in memory.md).
  If any modifier shows "READY", suggest user run /soul-forge calibrate
  (max once per day). Do NOT read memory.md for counting.
<!-- SOUL_FORGE_END -->`;

// --- Check/repair HEARTBEAT.md ---

// --- Schema migration ---

/**
 * Migrate config from v1/v2 → v3. Non-destructive: adds new fields with defaults.
 */
function migrateSchema(config) {
  if (!config) return Object.assign({}, FRESH_CONFIG);

  // v1 → v2 (from Phase 2)
  if (!config.version || config.version < 2) {
    config.version = 2;
    if (!config.modifiers) {
      config.modifiers = { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 };
    }
    if (!config.q_version) config.q_version = 1;
    if (!config.probe_session_count) config.probe_session_count = 0;
  }

  // v2 → v3
  if (config.version < 3) {
    config.version = 3;

    // mood_history: FIFO array of recent mood snapshots
    if (!config.mood_history) config.mood_history = [];

    // drift_state: per-modifier drift tracking
    if (!config.drift_state) {
      config.drift_state = {
        verbosity: { net: 0, last_alert_session: null, user_declined: false },
        humor: { net: 0, last_alert_session: null, user_declined: false },
        proactivity: { net: 0, last_alert_session: null, user_declined: false },
        challenge: { net: 0, last_alert_session: null, user_declined: false }
      };
    }

    // pending_changes: staged change pipeline
    if (!config.pending_changes) config.pending_changes = {};

    // change_history: completed changes log
    if (!config.change_history) config.change_history = [];

    // memory_stats: memory health tracking
    if (!config.memory_stats) {
      config.memory_stats = {
        total_entries: 0, unique_entries: 0, line_count: 0,
        last_dedup_session: null, entries_removed: 0,
        last_consolidation: null, last_archive: null
      };
    }

    // soul_evolve: SOUL.md evolution tracking
    if (!config.soul_evolve) {
      config.soul_evolve = {
        last_execution: null,
        evolve_count: { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 },
        approved_drifts: { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 },
        pending: null  // Phase 3.2: pending SOUL_EVOLVE validation
      };
    }
    // Ensure pending field exists on existing soul_evolve
    if (config.soul_evolve && !config.soul_evolve.hasOwnProperty('pending')) {
      config.soul_evolve.pending = null;
    }

    // calibration_baseline: anchor for SOUL_EVOLVE range checks
    if (!config.calibration_baseline) {
      config.calibration_baseline = {
        modifiers: config.modifiers ? Object.assign({}, config.modifiers) : { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 },
        disc_scores: config.disc ? Object.assign({}, config.disc.scores || {}) : {},
        created_at: config.updated_at || new Date().toISOString()
      };
    }

    // integrity: tamper detection
    if (!config.integrity) {
      config.integrity = {
        _handler_checksum: null,
        _last_memory_lines: 0,
        violation_count: 0
      };
    }

    if (!config.calibration_history) config.calibration_history = [];
    if (!config.updated_at) config.updated_at = new Date().toISOString();
  }

  // Phase 3.2: Ensure soul_evolve.pending field exists (even on existing v3 configs)
  if (config.soul_evolve && !config.soul_evolve.hasOwnProperty('pending')) {
    config.soul_evolve.pending = null;
  }

  // Phase 3.4: Auto-update + telemetry fields
  if (!config.soul_forge_version) config.soul_forge_version = SOUL_FORGE_VERSION;
  if (config.auto_update === undefined) config.auto_update = true;
  if (!config.last_update_check) config.last_update_check = null;
  if (!config.last_update_applied) config.last_update_applied = null;
  if (config.telemetry_opt_in === undefined) config.telemetry_opt_in = false;
  if (!config.telemetry_anon_id) config.telemetry_anon_id = null;
  if (!config.telemetry_endpoint) config.telemetry_endpoint = TELEMETRY_ENDPOINT_DEFAULT;

  return config;
}

// --- Config backup (config.json.prev) ---

function backupConfig(workspaceDir) {
  const configPath = path.join(workspaceDir, '.soul_forge', 'config.json');
  const prevPath = configPath + '.prev';
  try {
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, prevPath);
    }
  } catch {
    // Best effort
  }
}

// --- Simple checksum for tamper detection ---

function computeConfigChecksum(config) {
  // Exclude integrity fields from checksum to avoid circular dependency
  const copy = Object.assign({}, config);
  delete copy.integrity;
  const str = JSON.stringify(copy);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// --- Mood engine ---

/**
 * Analyze HEARTBEAT.md content for mood signals.
 * Returns { score, vote, tokens, confidence, lang }
 */
function analyzeMood(workspaceDir) {
  const heartbeatPath = path.join(workspaceDir, 'HEARTBEAT.md');
  const content = safeReadFile(heartbeatPath);
  if (!content) return null;

  // Extract user-facing content (skip Soul Forge segment)
  const sfStart = content.indexOf('<!-- SOUL_FORGE_START');
  const sfEnd = content.indexOf('SOUL_FORGE_END -->');
  let textToAnalyze = content;
  if (sfStart >= 0 && sfEnd >= 0) {
    textToAnalyze = content.substring(0, sfStart) + content.substring(sfEnd + 18);
  }

  // Only analyze if there's meaningful content
  const trimmed = textToAnalyze.replace(/[#\-*>\s]/g, '').trim();
  if (trimmed.length < 5) return null;

  const sentiment = getSentiment();
  return sentiment.analyze(textToAnalyze);
}

/**
 * Compute mood trend from mood_history.
 * Returns 'improving' | 'declining' | 'stable'
 */
function computeMoodTrend(moodHistory) {
  if (!moodHistory || moodHistory.length < 2) return 'stable';

  // Use last 3-5 entries for trend
  const recent = moodHistory.slice(-5);
  if (recent.length < 2) return 'stable';

  // Simple linear trend: compare first half avg vs second half avg
  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);

  const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

/**
 * Update mood_history in config. Returns mood result for context injection.
 */
function updateMoodHistory(config, workspaceDir) {
  const moodResult = analyzeMood(workspaceDir);
  if (!moodResult || moodResult.confidence === 'low') {
    // Not enough signal — don't record
    return { moodResult: null, trend: computeMoodTrend(config.mood_history) };
  }

  const sessionCount = config.probe_session_count || 0;
  const entry = {
    session: sessionCount,
    score: moodResult.score,
    raw_score: moodResult.score, // preserve original before any future smoothing
    token_count: moodResult.tokens,
    confidence: moodResult.confidence,
    emotion: moodResult.vote // positive/negative/neutral
  };

  if (!config.mood_history) config.mood_history = [];
  config.mood_history.push(entry);

  // FIFO: keep only last N entries
  while (config.mood_history.length > MOOD_HISTORY_MAX) {
    config.mood_history.shift();
  }

  const trend = computeMoodTrend(config.mood_history);
  return { moodResult, trend };
}

// --- Post-hoc integrity checks ---

function postHocCheck(workspaceDir, config) {
  const issues = [];

  // 1. config.json checksum tamper detection
  if (config.integrity && config.integrity._handler_checksum) {
    const currentChecksum = computeConfigChecksum(config);
    if (currentChecksum !== config.integrity._handler_checksum) {
      issues.push({ type: 'CONFIG_TAMPERED', severity: 'high' });
    }
  }

  // 2. memory.md overwrite detection
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');
  if (config.integrity && config.integrity._last_memory_lines > 0) {
    const memContent = safeReadFile(memoryPath);
    if (memContent !== null) {
      const currentLines = memContent.split('\n').length;
      const lastLines = config.integrity._last_memory_lines;
      // If lines dropped by >20% and not from a dedup operation
      if (currentLines < lastLines * 0.8) {
        const wasDedup = config.memory_stats &&
          config.memory_stats.last_dedup_session === (config.probe_session_count || 0);
        if (!wasDedup) {
          issues.push({ type: 'MEMORY_OVERWRITTEN', severity: 'high' });
        }
      }
    }
  }

  // 3. Handle detected issues
  for (const issue of issues) {
    if (issue.type === 'CONFIG_TAMPERED') {
      // Try restore from .prev
      const prevPath = path.join(workspaceDir, '.soul_forge', 'config.json.prev');
      if (fs.existsSync(prevPath)) {
        appendToErrorLog(workspaceDir, 'CONFIG_TAMPERED detected — Agent may have directly written config.json. Logging violation.');
      }
      if (!config.integrity) config.integrity = { violation_count: 0 };
      config.integrity.violation_count = (config.integrity.violation_count || 0) + 1;
    }

    if (issue.type === 'MEMORY_OVERWRITTEN') {
      // Try restore from backup
      const historyDir = path.join(workspaceDir, '.soul_history');
      try {
        if (fs.existsSync(historyDir)) {
          const backups = fs.readdirSync(historyDir)
            .filter(f => f.startsWith('memory_') && f.endsWith('.md'))
            .sort()
            .reverse();
          if (backups.length > 0) {
            const backupPath = path.join(historyDir, backups[0]);
            const backup = safeReadFile(backupPath);
            if (backup) {
              safeWriteFile(memoryPath, backup);
              appendToErrorLog(workspaceDir, `MEMORY_OVERWRITTEN detected — restored from ${backups[0]}`);
            }
          }
        }
      } catch {
        appendToErrorLog(workspaceDir, 'MEMORY_OVERWRITTEN detected — no backup available for restore');
      }
      if (!config.integrity) config.integrity = { violation_count: 0 };
      config.integrity.violation_count = (config.integrity.violation_count || 0) + 1;
    }
  }

  return issues;
}

// --- Update memory stats in config ---

function updateMemoryStats(config, workspaceDir) {
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');
  const memContent = safeReadFile(memoryPath);
  if (memContent === null) return;

  const lines = memContent.split('\n').length;
  const observations = parseMemory(memContent);

  if (!config.memory_stats) {
    config.memory_stats = {
      total_entries: 0, unique_entries: 0, line_count: 0,
      last_dedup_session: null, entries_removed: 0,
      last_consolidation: null, last_archive: null
    };
  }

  config.memory_stats.total_entries = observations.length;
  config.memory_stats.line_count = lines;

  // Update integrity tracking
  if (!config.integrity) config.integrity = { violation_count: 0 };
  config.integrity._last_memory_lines = lines;
}

// ============================================================
// Phase 3.1 — Maturity Curve
// ============================================================

function getMaturityPhase(sessionCount) {
  if (sessionCount < 30) return 'exploration';
  if (sessionCount < 100) return 'calibration';
  return 'stable';
}

function getMaturityParams(sessionCount) {
  const phase = getMaturityPhase(sessionCount);
  const PARAMS = {
    exploration: {
      change_cooldown_days: 3, validation_window: 3,
      drift_threshold: 3, soul_evolve_allowed: false,
      soul_evolve_cooldown_days: Infinity, mood_trend_min_sessions: 2
    },
    calibration: {
      change_cooldown_days: 7, validation_window: 5,
      drift_threshold: 5, soul_evolve_allowed: true,
      soul_evolve_cooldown_days: 15, mood_trend_min_sessions: 3
    },
    stable: {
      change_cooldown_days: 14, validation_window: 8,
      drift_threshold: 8, soul_evolve_allowed: true,
      soul_evolve_cooldown_days: 30, mood_trend_min_sessions: 5
    }
  };
  return { phase, ...PARAMS[phase] };
}

// ============================================================
// Phase 3.1 — Drift Detection Engine
// ============================================================

/**
 * Compute drift state from memory observations.
 * Updates config.drift_state with net direction counts per modifier.
 */
function computeDrift(observations, config) {
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);
  const windowSize = 20;
  const recent = observations.filter(o => o.status === 'active').slice(-windowSize);

  if (!config.drift_state) {
    config.drift_state = {
      verbosity: { net: 0, last_alert_session: null, user_declined: false },
      humor: { net: 0, last_alert_session: null, user_declined: false },
      proactivity: { net: 0, last_alert_session: null, user_declined: false },
      challenge: { net: 0, last_alert_session: null, user_declined: false }
    };
  }

  // Reset nets and recount from window
  const nets = { verbosity: 0, humor: 0, proactivity: 0, challenge: 0 };

  for (const obs of recent) {
    if (!obs.modifier_hint) continue;
    const hintMatch = obs.modifier_hint.match(/(\w+)\s*[→\->]+\s*(.+)/);
    if (!hintMatch) continue;

    const modifier = hintMatch[1].toLowerCase().trim();
    const direction = hintMatch[2].toLowerCase().trim();

    if (!(modifier in nets)) continue;

    if (direction.includes('lower') || direction.includes('降低') || direction.includes('减少')) {
      nets[modifier]--;
    } else if (direction.includes('raise') || direction.includes('提高') || direction.includes('增加')) {
      nets[modifier]++;
    }
    // 'maintain' → no change
  }

  // Update drift_state
  const alerts = [];
  for (const modifier of Object.keys(nets)) {
    if (!config.drift_state[modifier]) {
      config.drift_state[modifier] = { net: 0, last_alert_session: null, user_declined: false };
    }
    config.drift_state[modifier].net = nets[modifier];

    // Check if drift threshold exceeded
    const absNet = Math.abs(nets[modifier]);
    if (absNet >= maturity.drift_threshold) {
      // Check cooldown: need 10 new observations since last alert
      const lastAlert = config.drift_state[modifier].last_alert_session;
      const cooldownMet = lastAlert === null || (sessionCount - lastAlert) >= 10;

      if (cooldownMet && !config.drift_state[modifier].user_declined) {
        const direction = nets[modifier] > 0 ? 'raise' : 'lower';
        alerts.push({ modifier, direction, net: nets[modifier] });
        config.drift_state[modifier].last_alert_session = sessionCount;
      }
    }
  }

  return alerts;
}

// ============================================================
// Phase 3.1 — Staged Change Pipeline
// ============================================================

/**
 * Four-gate admission check for modifier changes.
 * Returns { allowed, reason } for each proposed change.
 */
function admitChange(modifier, fromValue, toValue, config) {
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);
  const now = new Date();

  // Gate 1: Rate limit — cooldown period
  if (config.change_history && config.change_history.length > 0) {
    const recentChanges = config.change_history.filter(c => c.modifier === modifier);
    if (recentChanges.length > 0) {
      const lastChange = recentChanges[recentChanges.length - 1];
      if (lastChange.timestamp) {
        const daysSince = (now - new Date(lastChange.timestamp)) / (1000 * 60 * 60 * 24);
        if (daysSince < maturity.change_cooldown_days) {
          return { allowed: false, reason: `rate_limit: ${maturity.change_cooldown_days}d cooldown, ${Math.ceil(maturity.change_cooldown_days - daysSince)}d remaining` };
        }
      }
    }
  }

  // Gate 2: Magnitude limit — ±1 per change
  const delta = toValue - fromValue;
  if (Math.abs(delta) > 1) {
    return { allowed: false, reason: `magnitude: delta=${delta}, max ±1` };
  }

  // Gate 3: Direction consistency — change direction should match recent observation trend
  if (config.drift_state && config.drift_state[modifier]) {
    const driftNet = config.drift_state[modifier].net;
    // If drift says "lower" (negative net) but change is "raise", that's inconsistent
    if (driftNet > 0 && delta < 0) {
      return { allowed: false, reason: `direction: drift suggests raise but change is lower` };
    }
    if (driftNet < 0 && delta > 0) {
      return { allowed: false, reason: `direction: drift suggests lower but change is raise` };
    }
  }

  // Gate 4: Baseline range — must stay within calibration_baseline ±1
  if (config.calibration_baseline && config.calibration_baseline.modifiers) {
    const baselineVal = config.calibration_baseline.modifiers[modifier];
    if (baselineVal !== undefined) {
      if (Math.abs(toValue - baselineVal) > 1) {
        return { allowed: false, reason: `baseline: ${toValue} exceeds baseline(${baselineVal}) ±1 range` };
      }
    }
  }

  return { allowed: true, reason: 'all_gates_passed' };
}

/**
 * Process pending changes: check validation windows, promote or rollback.
 */
function processPendingChanges(config, observations) {
  if (!config.pending_changes) return [];
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);
  const actions = [];

  for (const [modifier, pending] of Object.entries(config.pending_changes)) {
    if (!pending || !pending.applied_session) continue;

    const sessionsSinceApplied = sessionCount - pending.applied_session;
    const validationWindow = pending.validation_window || maturity.validation_window;

    // Count negative signals in recent observations (since pending was applied)
    const recentObs = observations.filter(o =>
      o.status === 'active' && o.modifier_hint
    ).slice(-(sessionsSinceApplied + 1));

    let negativeSignals = 0;
    for (const obs of recentObs) {
      const hintMatch = obs.modifier_hint.match(/(\w+)\s*[→\->]+\s*(.+)/);
      if (!hintMatch) continue;
      const mod = hintMatch[1].toLowerCase().trim();
      const dir = hintMatch[2].toLowerCase().trim();
      if (mod !== modifier) continue;

      // If the pending change was "lower" but new obs say "raise", that's negative
      const pendingDir = pending.to < pending.from ? 'lower' : 'raise';
      const obsDir = (dir.includes('raise') || dir.includes('提高')) ? 'raise' :
                     (dir.includes('lower') || dir.includes('降低')) ? 'lower' : null;
      if (obsDir && obsDir !== pendingDir) {
        negativeSignals++;
      }
    }

    pending.negative_signals = negativeSignals;

    if (sessionsSinceApplied >= validationWindow) {
      if (negativeSignals <= 1) {
        // Promote to permanent
        actions.push({ type: 'permanent', modifier, from: pending.from, to: pending.to });
        if (!config.change_history) config.change_history = [];
        config.change_history.push({
          modifier, from: pending.from, to: pending.to,
          session: sessionCount, result: 'permanent',
          timestamp: new Date().toISOString()
        });
        delete config.pending_changes[modifier];
      } else {
        // Rollback
        actions.push({ type: 'reverted', modifier, from: pending.to, to: pending.from });
        if (config.modifiers) {
          config.modifiers[modifier] = pending.from;
        }
        if (!config.change_history) config.change_history = [];
        config.change_history.push({
          modifier, from: pending.to, to: pending.from,
          session: sessionCount, result: 'reverted',
          timestamp: new Date().toISOString()
        });
        delete config.pending_changes[modifier];
      }
    }
  }

  // Trim change_history to last 20
  if (config.change_history && config.change_history.length > 20) {
    config.change_history = config.change_history.slice(-20);
  }

  return actions;
}

// ============================================================
// Phase 3.1 — Memory Fingerprint Dedup
// ============================================================

/**
 * Parse memory.md into structured entry objects with raw text.
 * Each entry: { raw, fields: { type, signal, modifier_hint, status, ... } }
 */
function parseMemoryEntries(content) {
  if (!content) return [];
  const entries = [];
  const sections = content.split(/^(?=## )/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.startsWith('# Soul Forge') || !trimmed.startsWith('## ')) continue;

    const fields = {};
    const fieldPattern = /[-*]\s*\*\*(\w[\w_-]*)\*\*:\s*(.+)/g;
    let match;
    while ((match = fieldPattern.exec(trimmed)) !== null) {
      fields[match[1].toLowerCase().replace(/-/g, '_')] = match[2].trim();
    }

    // Extract date from heading
    const dateMatch = trimmed.match(/^##\s+(.+?)$/m);
    if (dateMatch) fields._date = dateMatch[1].trim();

    entries.push({ raw: trimmed, fields });
  }
  return entries;
}

/**
 * Generate a fingerprint for dedup. Same fingerprint = duplicate.
 * Fingerprint: type | modifier_directions_sorted | signal_first_50_chars
 */
function fingerprint(entry) {
  const type = entry.fields.type || 'unknown';

  // Extract modifier directions
  const directions = [];
  const dirRegex = /(\w+)\s*[→\->]+\s*(raise|lower|maintain|pending|提高|降低|维持)/gi;
  let m;
  const hint = entry.fields.modifier_hint || '';
  while ((m = dirRegex.exec(hint)) !== null) {
    directions.push(`${m[1].toLowerCase()}:${m[2].toLowerCase()}`);
  }
  directions.sort();

  // Normalize signal: strip timestamps/numbers, take first 50 chars
  let signal = (entry.fields.signal || '').replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '');
  signal = signal.replace(/\d+/g, '').trim().substring(0, 50);

  return `${type}|${directions.join(',')}|${signal}`;
}

/**
 * Detect and remove duplicate entries from memory.md.
 * Returns { cleaned, duplicatesRemoved, backupCreated }
 */
function deduplicateMemory(workspaceDir, config) {
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');
  const content = safeReadFile(memoryPath);
  if (!content) return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };

  const entries = parseMemoryEntries(content);
  if (entries.length < 3) return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };

  // Group by fingerprint
  const groups = {};
  for (const entry of entries) {
    const fp = fingerprint(entry);
    if (!groups[fp]) groups[fp] = [];
    groups[fp].push(entry);
  }

  // Count duplicates
  let totalDuplicates = 0;
  for (const fp of Object.keys(groups)) {
    if (groups[fp].length > 1) {
      totalDuplicates += groups[fp].length - 1; // all but the newest
    }
  }

  const duplicateRatio = totalDuplicates / entries.length;

  // Only auto-clean if ratio > 0.5 (more duplicates than unique)
  if (duplicateRatio <= 0.5) {
    return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };
  }

  // Backup before cleaning
  const historyDir = path.join(workspaceDir, '.soul_history');
  let backupCreated = false;
  try {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const datestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(historyDir, `memory_${datestamp}.md`);
    // Don't overwrite existing backup
    if (!fs.existsSync(backupPath)) {
      safeWriteFile(backupPath, content);
      backupCreated = true;
    }
  } catch {
    // Continue without backup — better to dedup than not
  }

  // Keep only the latest entry per fingerprint group
  const kept = [];
  for (const fp of Object.keys(groups)) {
    const group = groups[fp];
    // Keep the last one (newest, since memory.md is append-only)
    kept.push(group[group.length - 1]);
  }

  // Reconstruct memory.md preserving order
  const keptSet = new Set(kept.map(e => e.raw));
  const newSections = [];
  // Preserve any H1 header
  const h1Match = content.match(/^(# .+\n)/);
  if (h1Match) newSections.push(h1Match[1]);

  for (const entry of entries) {
    if (keptSet.has(entry.raw)) {
      newSections.push(entry.raw);
    }
  }

  const newContent = newSections.join('\n\n') + '\n';
  safeWriteFile(memoryPath, newContent);

  // Update stats
  const sessionCount = config.probe_session_count || 0;
  if (!config.memory_stats) config.memory_stats = {};
  config.memory_stats.last_dedup_session = sessionCount;
  config.memory_stats.entries_removed = totalDuplicates;
  config.memory_stats.unique_entries = kept.length;

  appendToErrorLog(workspaceDir, `Memory dedup: removed ${totalDuplicates} duplicates (${entries.length} → ${kept.length} entries, ratio was ${(duplicateRatio * 100).toFixed(1)}%)`);

  return { cleaned: true, duplicatesRemoved: totalDuplicates, backupCreated };
}

// ============================================================
// Phase 3.1 — Unified Context Adjustments
// ============================================================

/**
 * Compute context adjustments from mood analysis.
 * Each dimension clamped to ±1 per the design spec (R5).
 */
function computeContextAdjustments(moodResult, trend, config) {
  const adjustments = { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 };

  if (!moodResult) return adjustments;

  // MOOD_SHIFT: mood-driven adjustments
  if (trend === 'declining' && moodResult.score < -0.2) {
    adjustments.challenge = -1;
    adjustments.humor = -1;
    if (moodResult.score < -0.5) {
      adjustments.proactivity = 1; // Supportive mode
    }
  } else if (trend === 'improving' && moodResult.score > 0.3) {
    // Positive trend: slightly relax constraints
    adjustments.humor = 1;
  }

  // Clamp each to [-1, +1] (R5)
  for (const key of Object.keys(adjustments)) {
    adjustments[key] = Math.max(-1, Math.min(1, adjustments[key]));
  }

  return adjustments;
}

// ============================================================
// Phase 3.1 — Action Signal Generator
// ============================================================

/**
 * Generate action signals based on all Phase 3 analysis.
 * Returns array of { signal, data } objects.
 */
function generateActionSignals(config, observations, driftAlerts, moodContext, dedupResult) {
  const signals = [];
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);

  // DRIFT_ALERT signals
  for (const alert of driftAlerts) {
    signals.push({
      signal: 'DRIFT_ALERT',
      data: { modifier: alert.modifier, direction: alert.direction, net: alert.net }
    });
  }

  // CONSOLIDATE signal: unique entries > 50
  if (config.memory_stats && config.memory_stats.unique_entries > 50) {
    signals.push({
      signal: 'CONSOLIDATE',
      data: { unique_entries: config.memory_stats.unique_entries }
    });
  }

  // SOUL_EVOLVE signal
  if (maturity.soul_evolve_allowed) {
    // Don't generate new SOUL_EVOLVE if one is already pending validation
    const hasPendingEvolve = config.soul_evolve && config.soul_evolve.pending;
    if (!hasPendingEvolve) {
    for (const modifier of ['verbosity', 'humor', 'challenge', 'proactivity']) {
      const drift = config.drift_state && config.drift_state[modifier];
      if (!drift) continue;

      const absNet = Math.abs(drift.net);
      if (absNet < maturity.drift_threshold) continue;

      // Check evolve_count < 3 (R7)
      const evolveCount = config.soul_evolve &&
        config.soul_evolve.evolve_count &&
        config.soul_evolve.evolve_count[modifier] || 0;

      if (evolveCount >= 3) {
        // Too many evolves → suggest recalibration instead
        signals.push({
          signal: 'RECALIBRATE_SUGGEST',
          data: { modifier, evolve_count: evolveCount, reason: 'evolve_count_exceeded' }
        });
        continue;
      }

      // Check baseline range (R8)
      if (config.calibration_baseline && config.calibration_baseline.modifiers) {
        const baseVal = config.calibration_baseline.modifiers[modifier];
        const currentVal = config.modifiers && config.modifiers[modifier];
        if (baseVal !== undefined && currentVal !== undefined) {
          const proposedVal = currentVal + (drift.net > 0 ? 1 : -1);
          if (Math.abs(proposedVal - baseVal) > 1) {
            signals.push({
              signal: 'RECALIBRATE_SUGGEST',
              data: { modifier, reason: 'baseline_exceeded', baseline: baseVal, proposed: proposedVal }
            });
            continue;
          }
        }
      }

      // Check cooldown
      const lastEvolve = config.soul_evolve && config.soul_evolve.last_execution;
      if (lastEvolve) {
        const daysSince = (new Date() - new Date(lastEvolve)) / (1000 * 60 * 60 * 24);
        if (daysSince < maturity.soul_evolve_cooldown_days) continue;
      }

      signals.push({
        signal: 'SOUL_EVOLVE',
        data: { modifier, direction: drift.net > 0 ? 'raise' : 'lower', net: drift.net }
      });
    }
    } // end hasPendingEvolve check
  }

  // MOOD_SHIFT signal (informational for Agent)
  if (moodContext && moodContext.moodResult && moodContext.trend === 'declining' && moodContext.moodResult.score < -0.2) {
    signals.push({
      signal: 'MOOD_SHIFT',
      data: { score: moodContext.moodResult.score, trend: moodContext.trend }
    });
  }

  return signals;
}

// --- Phase 3.2: SOUL.md backup automation ---

function backupSoulMd(workspaceDir) {
  const soulPath = path.join(workspaceDir, 'SOUL.md');
  const historyDir = path.join(workspaceDir, '.soul_history');

  try {
    if (!fs.existsSync(soulPath)) return null;
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `SOUL_${ts}.md`;
    const backupPath = path.join(historyDir, backupName);
    fs.copyFileSync(soulPath, backupPath);
    return backupName;
  } catch {
    return null;
  }
}

// --- Phase 3.2: Process pending SOUL_EVOLVE validation ---

function processSoulEvolve(config, observations, workspaceDir) {
  const pending = config.soul_evolve && config.soul_evolve.pending;
  if (!pending || !pending.applied_session) {
    return { action: 'none' };
  }

  const currentSession = config.probe_session_count || 0;
  const elapsed = currentSession - pending.applied_session;
  const window = pending.validation_window || 10;

  // Not enough sessions yet — check for negative signals
  if (elapsed < window) {
    // Count observations since applied_session that contradict the evolve direction
    let negativeCount = 0;
    for (const obs of observations) {
      const hint = obs.modifier_hint || '';
      if (!hint.includes(pending.modifier)) continue;

      // Check if direction is opposite
      const isRaise = hint.includes('raise');
      const isLower = hint.includes('lower');
      if (pending.direction === 'raise' && isLower) negativeCount++;
      if (pending.direction === 'lower' && isRaise) negativeCount++;
    }

    pending.negative_signals = negativeCount;

    // Immediate rollback if too many negative signals
    if (negativeCount >= 2) {
      return rollbackSoulEvolve(config, workspaceDir, pending, 'negative_signals');
    }

    return { action: 'validating', elapsed, window, negative_signals: negativeCount };
  }

  // Validation window complete
  if (pending.negative_signals >= 2) {
    return rollbackSoulEvolve(config, workspaceDir, pending, 'negative_signals');
  }

  // Success — promote to permanent
  config.soul_evolve.pending = null;
  return { action: 'promoted', modifier: pending.modifier, direction: pending.direction };
}

function rollbackSoulEvolve(config, workspaceDir, pending, reason) {
  const result = { action: 'rollback', modifier: pending.modifier, reason };

  // Try to restore from backup
  if (pending.backup_file) {
    const backupPath = path.join(workspaceDir, '.soul_history', pending.backup_file);
    const soulPath = path.join(workspaceDir, 'SOUL.md');
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, soulPath);
        result.restored = true;
      }
    } catch {
      result.restored = false;
    }
  }

  // Decrement evolve_count since it failed
  if (config.soul_evolve && config.soul_evolve.evolve_count) {
    const count = config.soul_evolve.evolve_count[pending.modifier] || 0;
    if (count > 0) {
      config.soul_evolve.evolve_count[pending.modifier] = count - 1;
    }
  }

  // Clear pending
  config.soul_evolve.pending = null;

  appendToErrorLog(workspaceDir, `SOUL_EVOLVE rollback: ${pending.modifier} (${reason})`);

  return result;
}

// --- Phase 3.3: Telemetry export (structured signals for future cloud integration) ---

/**
 * Generate a structured telemetry snapshot for opt-in cloud sync (Phase 4+).
 * Writes .soul_forge/telemetry.json — contains NO conversation content, only metrics.
 * This file is a pure signal export: session count, maturity, drift, mood summary, action signals.
 */
function generateTelemetry(config, actionSignals, moodContext, dedupResult, workspaceDir) {
  const sessionCount = config.probe_session_count || 0;
  const maturity = getMaturityParams(sessionCount);

  const telemetry = {
    _schema: 'soul_forge_telemetry_v1',
    _generated_at: new Date().toISOString(),
    _privacy: 'This file contains only aggregate metrics. No conversation content is included. Opt-in cloud sync is not yet available.',

    session: {
      count: sessionCount,
      maturity_phase: maturity.phase,
      status: config.status || 'unknown'
    },

    disc: config.disc ? {
      primary: config.disc.primary,
      confidence: config.disc.confidence
    } : null,

    modifiers: config.modifiers ? { ...config.modifiers } : null,

    mood: moodContext ? {
      current_score: moodContext.moodResult ? moodContext.moodResult.score : null,
      trend: moodContext.trend || 'unknown',
      history_length: (config.mood_history || []).length
    } : null,

    drift: {},
    pending_changes: {},

    action_signals: (actionSignals || []).map(s => ({
      signal: s.signal,
      data: s.data || {}
    })),

    memory: {
      unique_entries: config.memory_stats ? config.memory_stats.unique_entries : null,
      last_dedup_session: config.memory_stats ? config.memory_stats.last_dedup_session : null,
      dedup_this_session: dedupResult ? dedupResult.cleaned : false
    },

    soul_evolve: config.soul_evolve ? {
      pending: config.soul_evolve.pending ? {
        modifier: config.soul_evolve.pending.modifier,
        direction: config.soul_evolve.pending.direction,
        sessions_remaining: config.soul_evolve.pending.validation_window
          ? (config.soul_evolve.pending.validation_window - (sessionCount - (config.soul_evolve.pending.applied_session || 0)))
          : null
      } : null,
      evolve_count: config.soul_evolve.evolve_count || {},
      last_execution: config.soul_evolve.last_execution
    } : null,

    integrity: config.integrity ? {
      violation_count: config.integrity.violation_count || 0
    } : null
  };

  // Populate drift summary
  if (config.drift_state) {
    for (const [mod, state] of Object.entries(config.drift_state)) {
      telemetry.drift[mod] = { net: state.net || 0 };
    }
  }

  // Populate pending changes summary
  if (config.pending_changes) {
    for (const [mod, pending] of Object.entries(config.pending_changes)) {
      if (pending) {
        telemetry.pending_changes[mod] = {
          from: pending.from, to: pending.to,
          negative_signals: pending.negative_signals || 0
        };
      }
    }
  }

  // Write telemetry.json
  const telemetryPath = path.join(workspaceDir, '.soul_forge', 'telemetry.json');
  safeWriteFile(telemetryPath, JSON.stringify(telemetry, null, 2));

  return telemetry;
}

// --- Check/repair HEARTBEAT.md ---

function checkHeartbeat(workspaceDir) {
  const heartbeatPath = path.join(workspaceDir, 'HEARTBEAT.md');
  const content = safeReadFile(heartbeatPath);

  if (content === null) {
    // No HEARTBEAT.md at all — create with segment
    safeWriteFile(heartbeatPath, '# HEARTBEAT\n\n' + HEARTBEAT_SEGMENT + '\n');
    appendToErrorLog(workspaceDir, 'HEARTBEAT.md missing, created with Soul Forge segment');
    return;
  }

  if (!content.includes('SOUL_FORGE_START')) {
    // Segment missing — append
    const newContent = content.trimEnd() + '\n\n' + HEARTBEAT_SEGMENT + '\n';
    safeWriteFile(heartbeatPath, newContent);
    appendToErrorLog(workspaceDir, 'HEARTBEAT.md Soul Forge segment missing, appended');
  }
}

// --- Check SOUL.md structure ---

function checkSoulMdStructure(workspaceDir, injectionWarnings) {
  const soulPath = path.join(workspaceDir, 'SOUL.md');
  const content = safeReadFile(soulPath);

  if (!content) return; // No SOUL.md — nothing to check

  const requiredSections = ['## Core Truths', '## Vibe', '## Boundaries', '## Continuity'];
  const missing = requiredSections.filter(s => !content.includes(s));

  if (missing.length === 0) return; // All good

  // Try restore from snapshot
  const historyDir = path.join(workspaceDir, '.soul_history');
  if (fs.existsSync(historyDir)) {
    // Find latest snapshot
    try {
      const files = fs.readdirSync(historyDir)
        .filter(f => f.startsWith('SOUL_') && f.endsWith('.md'))
        .sort()
        .reverse();

      if (files.length > 0) {
        const snapshotPath = path.join(historyDir, files[0]);
        const snapshot = safeReadFile(snapshotPath);
        if (snapshot) {
          safeWriteFile(soulPath, snapshot);
          appendToErrorLog(workspaceDir, `SOUL.md structure damaged (missing: ${missing.join(', ')}), restored from ${files[0]}`);
          return;
        }
      }
    } catch {
      // Fall through to warning
    }
  }

  // No snapshot available — inject warning
  injectionWarnings.push(`SOUL.md structure issue: missing ${missing.join(', ')}. Please restore from .soul_history/ snapshot or re-run /soul-forge.`);
  appendToErrorLog(workspaceDir, `SOUL.md structure damaged (missing: ${missing.join(', ')}), no snapshot available`);
}

// ============================================================
// Auto-update: check GitHub for newer version, download if available
// ============================================================

function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs || 5000 }, (res) => {
      // Follow redirects (GitHub raw sometimes 301/302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function checkForUpdates(config, configDir, workspaceDir) {
  if (config.auto_update === false) return Promise.resolve(null);
  if (process.env.SOUL_FORGE_NO_UPDATE === '1') return Promise.resolve(null);

  // Cooldown check
  const lastCheck = config.last_update_check ? new Date(config.last_update_check).getTime() : 0;
  if (Date.now() - lastCheck < UPDATE_COOLDOWN_MS) return Promise.resolve(null);

  // Try primary (GitHub), fallback to CN mirror
  return httpsGet(UPDATE_CHECK_URL, 3000).catch(() => httpsGet(UPDATE_CHECK_URL_CN, 5000)).then(body => {
    const remote = JSON.parse(body);
    config.last_update_check = new Date().toISOString();

    const localVersion = config.soul_forge_version || SOUL_FORGE_VERSION;
    if (compareVersions(remote.version, localVersion) <= 0) {
      return null; // Already up to date
    }

    // Determine which base URL is reachable (same as version check)
    const baseUrlPromise = httpsGet(UPDATE_CHECK_URL, 2000)
      .then(() => UPDATE_BASE_URL)
      .catch(() => UPDATE_BASE_URL_CN);

    return baseUrlPromise.then(baseUrl => {
      // Download each file
      const fileMap = remote.files || {};
      const downloads = Object.keys(fileMap).map(repoPath => {
        const url = baseUrl + repoPath;
        // Determine target path based on file type
        let targetPath;
        if (repoPath.startsWith('hooks/')) {
          targetPath = path.join(configDir, repoPath);
        } else if (repoPath.startsWith('skills/')) {
          targetPath = path.join(configDir, repoPath);
        } else {
          return Promise.resolve(); // Unknown path, skip
        }

        return httpsGet(url, 10000).then(content => {
          const tmpPath = targetPath + '.tmp';
          const dir = path.dirname(targetPath);
          try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
          fs.writeFileSync(tmpPath, content, 'utf-8');
          fs.renameSync(tmpPath, targetPath); // Atomic replace
        }).catch(() => {
          // Individual file download failure — skip, don't break
        });
      });

      return Promise.all(downloads).then(() => {
        config.soul_forge_version = remote.version;
        config.last_update_applied = new Date().toISOString();
        return remote;
      });
    });
  }).catch(() => {
    // Network failure — silently skip, don't block bootstrap
    config.last_update_check = new Date().toISOString(); // Still update cooldown
    return null;
  });
}

// ============================================================
// Telemetry upload: fire-and-forget POST to collection server
// ============================================================

function generateAnonId(config) {
  if (config.telemetry_anon_id) return config.telemetry_anon_id;
  const source = (config.disc && config.disc.answers_hash || 'unknown') + TELEMETRY_SALT;
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  return hash.substring(0, 8);
}

function generateEnhancedTelemetry(config, actionSignals, moodContext, dedupResult) {
  const base = {
    _schema: 'soul_forge_telemetry_v2',
    _generated_at: new Date().toISOString(),
    anon_id: generateAnonId(config),
    soul_forge_version: config.soul_forge_version || SOUL_FORGE_VERSION,

    session: {
      count: config.probe_session_count || 0,
      maturity_phase: getMaturityPhase(config.probe_session_count || 0),
      status: config.status || 'unknown'
    },

    disc: {
      primary: config.disc ? config.disc.primary : null,
      secondary: config.disc ? config.disc.secondary : null,
      confidence: config.disc ? config.disc.confidence : null,
      scores: config.disc ? config.disc.scores : null
    },

    modifiers: config.modifiers ? Object.assign({}, config.modifiers) : null,
    calibration_baseline: config.calibration_baseline ? config.calibration_baseline.modifiers : null,

    mood: {
      current_score: moodContext ? moodContext.score : null,
      trend: moodContext ? moodContext.trend : 'unknown',
      history_length: (config.mood_history || []).length
    },

    drift: {},
    pending_changes: config.pending_changes ? Object.assign({}, config.pending_changes) : {},

    change_history_summary: { permanent: 0, reverted: 0 },

    memory_stats: config.memory_stats ? Object.assign({}, config.memory_stats) : null,

    soul_evolve: {
      evolve_count: config.soul_evolve ? config.soul_evolve.evolve_count : null,
      last_execution: config.soul_evolve ? config.soul_evolve.last_execution : null
    },

    integrity: {
      violation_count: config.integrity ? config.integrity.violation_count : 0
    }
  };

  // Drift state
  if (config.drift_state) {
    for (const mod of Object.keys(config.drift_state)) {
      base.drift[mod] = { net: config.drift_state[mod].net || 0 };
    }
  }

  // Change history summary
  if (config.change_history && Array.isArray(config.change_history)) {
    for (const ch of config.change_history) {
      if (ch.result === 'permanent') base.change_history_summary.permanent++;
      else if (ch.result === 'reverted') base.change_history_summary.reverted++;
    }
  }

  // Mood history summary
  if (config.mood_history && config.mood_history.length > 0) {
    let sum = 0, lowConf = 0;
    const trendCounts = { improving: 0, declining: 0, stable: 0 };
    for (const m of config.mood_history) {
      sum += m.score || 0;
      if (m.confidence === 'low') lowConf++;
    }
    base.mood_history_summary = {
      avg_score: Math.round((sum / config.mood_history.length) * 100) / 100,
      low_confidence_ratio: Math.round((lowConf / config.mood_history.length) * 100) / 100,
      history_length: config.mood_history.length
    };
  }

  // Dedup stats
  if (dedupResult) {
    base.memory_dedup = {
      dedup_this_session: dedupResult.removed > 0,
      entries_removed: dedupResult.removed || 0,
      dedup_ratio: dedupResult.total > 0 ? Math.round((dedupResult.removed / dedupResult.total) * 100) / 100 : 0
    };
  }

  return base;
}

function sendTelemetry(config, telemetryData) {
  if (!config.telemetry_opt_in) return;
  if (process.env.SOUL_FORGE_TELEMETRY_DISABLED === '1') return;

  const endpoints = [
    config.telemetry_endpoint || TELEMETRY_ENDPOINT_DEFAULT,
    TELEMETRY_ENDPOINT_CN
  ];

  // Try each endpoint, fire-and-forget
  for (const endpoint of endpoints) {
    if (!endpoint || endpoint.includes('YOUR_DOMAIN_CN')) continue; // Skip unconfigured placeholder
    try {
      const url = new URL(endpoint);
      const payload = JSON.stringify(telemetryData);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 5000,
        rejectUnauthorized: false // Allow self-signed certs
      };

      if (config.telemetry_api_key) {
        options.headers['Authorization'] = 'Bearer ' + config.telemetry_api_key;
      }

      const req = https.request(options, () => {}); // Fire-and-forget
      req.on('error', () => {}); // Swallow errors
      req.on('timeout', () => req.destroy());
      req.end(payload);
      return; // First successful send attempt, done
    } catch {
      continue; // Try next endpoint
    }
  }
}

// ============================================================
// Main handler
// ============================================================

module.exports = function handler(event) {
  // Guard: only handle agent:bootstrap
  if (!event || event.type !== 'agent' || event.action !== 'bootstrap') {
    return;
  }

  const context = event.context;
  if (!context) return;

  const workspaceDir = context.workspaceDir;
  if (!workspaceDir) return;

  if (!context.bootstrapFiles) {
    context.bootstrapFiles = [];
  }

  const configPath = path.join(workspaceDir, '.soul_forge', 'config.json');
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');

  // --- Step 1: Backup config + schema migration ---
  backupConfig(workspaceDir);

  let configRaw = safeReadFile(configPath);
  let config;

  if (configRaw) {
    config = safeParseJSON(configRaw);
    if (!config) {
      // Corrupted config.json — rename and rebuild
      try {
        fs.renameSync(configPath, configPath + '.corrupted');
      } catch { /* best effort */ }
      config = Object.assign({}, FRESH_CONFIG);
      safeWriteFile(configPath, JSON.stringify(config, null, 2));
      appendToErrorLog(workspaceDir, 'config.json corrupted, renamed to .corrupted and rebuilt as fresh');
    }
  } else {
    // No config.json — check if .soul_forge dir exists at all
    const soulForgeDir = path.join(workspaceDir, '.soul_forge');
    if (!fs.existsSync(soulForgeDir)) {
      // Soul Forge not installed — skip everything
      return;
    }
    // Dir exists but no config — create fresh
    config = Object.assign({}, FRESH_CONFIG);
    safeWriteFile(configPath, JSON.stringify(config, null, 2));
  }

  // Process config_update.md (may modify config)
  config = processConfigUpdate(workspaceDir, config);

  // Schema migration (v1→v2→v3)
  config = migrateSchema(config);

  // Increment session count
  if (typeof config.probe_session_count === 'number') {
    config.probe_session_count++;
  }

  // --- Step 1b: Auto-update check (fire-and-forget, non-blocking) ---
  const configDir = path.resolve(workspaceDir, '..');
  checkForUpdates(config, configDir, workspaceDir).catch(() => {});
  // Note: update downloads happen async but we don't await them.
  // Updated files take effect next session.

  // --- Step 2: Branch on status ---

  const status = config.status || 'fresh';
  const contextPath = path.join(workspaceDir, '.soul_forge', 'soul-forge-context.md');

  if (status === 'declined') {
    // Respect user's privacy decision — minimal injection, no repairs
    const contextContent = '# Soul Forge Calibration Context\n\n## Status\ndeclined\n\nSoul Forge was declined by the user. No data collection or observation active.';
    context.bootstrapFiles.push({
      name: 'soul-forge-context.md',
      content: contextContent,
      path: contextPath,
      missing: false
    });
    if (!safeWriteFile(contextPath, contextContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (declined)');
    return;
  }

  if (status === 'dormant') {
    const contextContent = '# Soul Forge Calibration Context\n\n## Status\ndormant\n\nSoul Forge has been reset. Run /soul-forge to re-enable.';
    context.bootstrapFiles.push({
      name: 'soul-forge-context.md',
      content: contextContent,
      path: contextPath,
      missing: false
    });
    if (!safeWriteFile(contextPath, contextContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (dormant)');
    return;
  }

  if (status === 'fresh') {
    // Check/repair heartbeat for fresh status too
    checkHeartbeat(workspaceDir);

    const contextContent = '# Soul Forge Calibration Context\n\n## Status\nfresh\n\nSoul Forge is installed but not yet configured. Suggest the user run /soul-forge to begin personality calibration.';
    context.bootstrapFiles.push({
      name: 'soul-forge-context.md',
      content: contextContent,
      path: contextPath,
      missing: false
    });
    if (!safeWriteFile(contextPath, contextContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (fresh)');
    return;
  }

  if (status === 'paused') {
    // Inject status only, skip observation data
    const pausedContent = [
      '# Soul Forge Calibration Context',
      '',
      '## Status',
      `paused | ${config.disc ? config.disc.primary : '?'}-type`,
      '',
      '## Active Modifiers',
    ];
    if (config.modifiers) {
      const m = config.modifiers;
      pausedContent.push(`verbosity: ${m.verbosity ?? 2} | humor: ${m.humor ?? 1} | proactivity: ${m.proactivity ?? 1} | challenge: ${m.challenge ?? 0}`);
    }
    pausedContent.push('');
    pausedContent.push('Observation paused. No new signals being recorded.');

    const contextContent = pausedContent.join('\n');
    context.bootstrapFiles.push({
      name: 'soul-forge-context.md',
      content: contextContent,
      path: contextPath,
      missing: false
    });
    if (!safeWriteFile(contextPath, contextContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (paused)');
    return;
  }

  // --- Step 3: status === "calibrated" — full injection ---

  const injectionWarnings = [];

  // Post-hoc integrity check (before reading data)
  const integrityIssues = postHocCheck(workspaceDir, config);
  if (integrityIssues.length > 0) {
    for (const issue of integrityIssues) {
      injectionWarnings.push(`Integrity: ${issue.type} detected and handled.`);
    }
  }

  // Mood engine: analyze HEARTBEAT.md + update mood_history
  const moodContext = updateMoodHistory(config, workspaceDir);

  // Read memory.md
  const memoryContent = safeReadFile(memoryPath);
  const observations = parseMemory(memoryContent);

  // Phase 3.1: Memory fingerprint dedup
  const dedupResult = deduplicateMemory(workspaceDir, config);
  if (dedupResult.cleaned) {
    injectionWarnings.push(`Memory dedup: removed ${dedupResult.duplicatesRemoved} duplicate entries.`);
    // Re-read after dedup
  }

  // Re-read memory after potential dedup
  const memoryContentPost = dedupResult.cleaned ? safeReadFile(memoryPath) : memoryContent;
  const observationsPost = dedupResult.cleaned ? parseMemory(memoryContentPost) : observations;

  // Update memory stats
  updateMemoryStats(config, workspaceDir);

  // Phase 3.1: Drift detection
  const driftAlerts = computeDrift(observationsPost, config);

  // Phase 3.1: Process pending changes (validation/rollback)
  const pipelineActions = processPendingChanges(config, observationsPost);
  for (const action of pipelineActions) {
    if (action.type === 'reverted') {
      injectionWarnings.push(`Change reverted: ${action.modifier} ${action.from}→${action.to} (negative signals detected).`);
    }
  }

  // Phase 3.2: Process pending SOUL_EVOLVE validation
  const evolveResult = processSoulEvolve(config, observationsPost, workspaceDir);
  if (evolveResult.action === 'rollback') {
    injectionWarnings.push(`SOUL_EVOLVE rollback: ${evolveResult.modifier} reverted (${evolveResult.reason}).${evolveResult.restored ? ' SOUL.md restored from backup.' : ''}`);
  } else if (evolveResult.action === 'promoted') {
    injectionWarnings.push(`SOUL_EVOLVE confirmed: ${evolveResult.modifier} ${evolveResult.direction} is now permanent.`);
  }

  // Phase 3.1: Generate action signals
  const actionSignals = generateActionSignals(config, observationsPost, driftAlerts, moodContext, dedupResult);

  // Compute calibration readiness
  const readiness = computeCalibrationReadiness(observationsPost);

  // Generate injection content (with mood context + action signals)
  const injectionContent = generateInjection(config, observationsPost, readiness, moodContext, actionSignals);

  // Add warnings if any
  let finalContent = injectionContent;
  if (injectionWarnings.length > 0) {
    finalContent += '\n\n## Warnings\n';
    for (const w of injectionWarnings) {
      finalContent += `- ${w}\n`;
    }
  }

  // Inject into bootstrapFiles
  context.bootstrapFiles.push({
    name: 'soul-forge-context.md',
    content: finalContent,
    path: contextPath,
    missing: false
  });
  if (!safeWriteFile(contextPath, finalContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (calibrated)');

  // --- Step 4: Check HEARTBEAT.md ---
  checkHeartbeat(workspaceDir);

  // --- Step 5: Check SOUL.md structure ---
  checkSoulMdStructure(workspaceDir, injectionWarnings);

  // If structure check added warnings after injection was built, update
  if (injectionWarnings.length > 0) {
    let warningSection = '\n\n## Warnings\n';
    for (const w of injectionWarnings) {
      warningSection += `- ${w}\n`;
    }
    // Find existing injection in bootstrapFiles and append warnings
    const existing = context.bootstrapFiles.find(f => f.name === 'soul-forge-context.md');
    if (existing && !existing.content.includes('## Warnings')) {
      existing.content += warningSection;
    }
    if (existing) {
      if (!safeWriteFile(contextPath, existing.content)) appendToErrorLog(workspaceDir, 'Failed to rewrite soul-forge-context.md after warnings');
    }
  }

  // --- Step 6: Export telemetry (Phase 3.3) ---
  generateTelemetry(config, actionSignals, moodContext, dedupResult, workspaceDir);

  // --- Step 6b: Upload telemetry (Phase 3.4, opt-in) ---
  if (config.telemetry_opt_in) {
    // Generate anon_id if not yet set
    if (!config.telemetry_anon_id) {
      config.telemetry_anon_id = generateAnonId(config);
    }
    const enhancedData = generateEnhancedTelemetry(config, actionSignals, moodContext, dedupResult);
    sendTelemetry(config, enhancedData);
  }

  // --- Step 7: Save config with integrity checksum ---
  config.updated_at = new Date().toISOString();
  config.integrity._handler_checksum = computeConfigChecksum(config);
  safeWriteFile(configPath, JSON.stringify(config, null, 2));
};

// --- Exports for unit testing ---
module.exports._test = {
  migrateSchema,
  computeConfigChecksum,
  computeMoodTrend,
  parseMemory,
  parseConfigUpdate,
  processConfigUpdate,
  computeCalibrationReadiness,
  generateInjection,
  postHocCheck,
  updateMemoryStats,
  backupConfig,
  // Phase 3.1
  getMaturityPhase,
  getMaturityParams,
  computeDrift,
  admitChange,
  processPendingChanges,
  parseMemoryEntries,
  fingerprint,
  deduplicateMemory,
  computeContextAdjustments,
  generateActionSignals,
  // Phase 3.2
  backupSoulMd,
  processSoulEvolve,
  rollbackSoulEvolve,
  // Phase 3.3
  generateTelemetry,
  // Phase 3.4: Auto-update + Telemetry
  SOUL_FORGE_VERSION,
  compareVersions,
  checkForUpdates,
  generateAnonId,
  generateEnhancedTelemetry,
  sendTelemetry
};

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// Soul Forge Bootstrap Hook — handler.js (CommonJS)
// Runs on agent:bootstrap. Pure Node.js builtins only.
// ============================================================

const CURRENT_SCHEMA_VERSION = 2;
const CURRENT_Q_VERSION = 2;
const FRESH_CONFIG = { status: 'fresh', version: 2 };
const MAX_INJECT_BYTES = 6144; // 6KB budget
const MAX_OBSERVATIONS = 20;
const READINESS_THRESHOLD = 5;

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

// --- Schema migration ---

function migrateSchema(config) {
  if (config.version >= CURRENT_SCHEMA_VERSION) return config;

  // v1 → v2 migration
  if (!config.q_version) {
    config.q_version = 1;
  }
  if (!config.disc) {
    config.disc = {};
  }
  if (config.disc.answers_hash === undefined) {
    config.disc.answers_hash = null;
  }
  if (!config.probe_phase_start) {
    config.probe_phase_start = config.created_at || new Date().toISOString();
  }
  if (config.last_style_probe === undefined) {
    config.last_style_probe = null;
  }
  if (config.probe_session_count === undefined) {
    config.probe_session_count = 0;
  }

  config.version = CURRENT_SCHEMA_VERSION;
  return config;
}

// --- Pre-flight Check ---

function preflightCheck(workspaceDir, config) {
  const warnings = [];
  let legacyUser = false;

  // Schema validation: check required fields exist and have correct types
  const requiredFields = {
    status: 'string',
    version: 'number'
  };
  for (const [field, type] of Object.entries(requiredFields)) {
    if (config[field] === undefined) {
      warnings.push(`config.json missing required field: ${field}`);
    } else if (typeof config[field] !== type) {
      warnings.push(`config.json field "${field}" has wrong type: expected ${type}, got ${typeof config[field]}`);
    }
  }

  // File integrity: check SOUL.md, memory.md, config.json exist
  const criticalFiles = [
    { name: 'SOUL.md', path: path.join(workspaceDir, 'SOUL.md') },
    { name: 'memory.md', path: path.join(workspaceDir, '.soul_forge', 'memory.md') },
    { name: 'config.json', path: path.join(workspaceDir, '.soul_forge', 'config.json') }
  ];
  for (const file of criticalFiles) {
    if (!fs.existsSync(file.path)) {
      warnings.push(`${file.name} not found at expected location`);
    }
  }

  // Version compatibility: future schema version check
  if (config.version > CURRENT_SCHEMA_VERSION) {
    warnings.push(`config.json version ${config.version} is newer than handler.js supports (v${CURRENT_SCHEMA_VERSION}). Some features may not work correctly. Consider updating Soul Forge.`);
  }

  // Legacy user detection: config fresh/missing + SOUL.md exists with non-default content
  if (!config.status || config.status === 'fresh') {
    const soulPath = path.join(workspaceDir, 'SOUL.md');
    const soulContent = safeReadFile(soulPath);
    if (soulContent) {
      // Check if SOUL.md has non-default content (not just the basic template)
      const hasCustomContent = soulContent.includes('## Core Truths') &&
        !/soul-forge:v\d+:/.test(soulContent) &&
        soulContent.length > 200;
      if (hasCustomContent) {
        legacyUser = true;
      }
    }
  }

  return { warnings, legacyUser };
}

// --- Probing control ---

const PROBE_STAGE1 = { minSessions: 3, minDays: 1, maxSessions: 7, maxDays: 5 };
const PROBE_STAGE2 = { minSessions: 5, minDays: 2, maxSessions: 10, maxDays: 7 };
const PROBE_MATURITY_DAYS = 30;

function computeProbingControl(config) {
  // Only probe when calibrated
  if (config.status !== 'calibrated') {
    return { style_probe_allowed: false, stage: 0, target: null };
  }

  const now = Date.now();
  const phaseStart = config.probe_phase_start ? new Date(config.probe_phase_start).getTime() : now;
  const daysSinceStart = (now - phaseStart) / 86400000;

  // Determine stage
  let stage;
  if (daysSinceStart < 14) {
    stage = 1;
  } else if (daysSinceStart < PROBE_MATURITY_DAYS) {
    stage = 2;
  } else {
    stage = 3;
  }

  // Stage 3 = maturity, no probing
  if (stage === 3) {
    return { style_probe_allowed: false, stage: 3, target: null };
  }

  const params = stage === 1 ? PROBE_STAGE1 : PROBE_STAGE2;
  const sessionCount = config.probe_session_count || 0;
  const lastProbe = config.last_style_probe ? new Date(config.last_style_probe).getTime() : 0;
  const daysSinceProbe = lastProbe ? (now - lastProbe) / 86400000 : Infinity;

  // Frequency control with dual thresholds
  let allowed;
  const minMet = sessionCount >= params.minSessions && daysSinceProbe >= params.minDays;
  const maxMet = sessionCount >= params.maxSessions || daysSinceProbe >= params.maxDays;

  if (!minMet) {
    allowed = false;
  } else if (maxMet) {
    allowed = true; // forced trigger
  } else {
    allowed = true; // within window
  }

  // Find lowest-confidence modifier as target
  let target = null;
  if (config.modifiers) {
    const modifiers = config.modifiers;
    // Lower confidence = closer to default middle value (1)
    // Track which modifier has been least observed
    let lowestConfidence = Infinity;
    for (const [key, value] of Object.entries(modifiers)) {
      // Confidence heuristic: distance from middle value indicates more data
      const confidence = Math.abs(value - 1);
      if (confidence < lowestConfidence) {
        lowestConfidence = confidence;
        target = key;
      }
    }
  }

  return { style_probe_allowed: allowed, stage, target };
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
            // Parse "D=1.5 I=2 S=5.5 C=4" (dual-axis: floats)
            const scores = {};
            for (const part of value.split(/\s+/)) {
              const [k, v] = part.split('=');
              if (k && v) scores[k] = parseFloat(v);
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
      case 'probing':
        if (fieldMatch) {
          if (!result.probing) result.probing = {};
          const probingKey = fieldMatch[1].toLowerCase();
          const probingVal = fieldMatch[2].trim();
          if (probingKey === 'probe_session_count') {
            result.probing.probe_session_count = parseInt(probingVal, 10);
          } else if (probingKey === 'last_style_probe') {
            result.probing.last_style_probe = probingVal;
          }
        }
        break;
      case 'questionnaire':
        if (fieldMatch) {
          if (!result.questionnaire) result.questionnaire = {};
          const qKey = fieldMatch[1].toLowerCase();
          const qVal = fieldMatch[2].trim();
          if (qKey === 'q_version') {
            result.questionnaire.q_version = parseInt(qVal, 10);
          } else if (qKey === 'answers_hash') {
            result.questionnaire.answers_hash = qVal;
          } else if (qKey === 'option_order') {
            result.questionnaire.option_order = qVal;
          }
        }
        break;
      // 'validation' section removed — confidence is derived purely from score distribution
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
        config.modifiers = { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 };
      }
      Object.assign(config.modifiers, update.modifiers);
    }

    // Capture previous status before updating (needed for reactivation detection)
    const previousStatus = config.status;

    // Apply status update
    if (update.status && update.action !== 'merge_failed') {
      config.status = update.status;
    }

    // Apply DISC update
    if (update.disc) {
      config.disc = Object.assign(config.disc || {}, update.disc);
    }

    // ── Hard guardrail: DISC score validation ──
    // If Agent wrote DISC scores, validate them (Issue 3: scoring errors)
    if (config.disc && config.disc.scores) {
      const s = config.disc.scores;
      const total = (s.D || 0) + (s.I || 0) + (s.S || 0) + (s.C || 0);
      if (Math.abs(total - 12.0) > 0.01) {
        appendToErrorLog(workspaceDir, `DISC score validation FAILED: total=${total} (expected 12.0). Scores: D=${s.D} I=${s.I} S=${s.S} C=${s.C}. Setting _scores_invalid flag.`);
        config.disc._scores_invalid = true;
      } else {
        delete config.disc._scores_invalid;
      }
    }

    // ── Hard guardrail: Secondary type derivation (Issue 2: secondary=none on tie) ──
    // handler.js always computes secondary from scores, overriding Agent's value
    if (config.disc && config.disc.scores && config.disc.primary) {
      const s = config.disc.scores;
      const primary = config.disc.primary;
      // Priority order for tie-breaking: I > S > D > C
      const secondaryPriority = ['I', 'S', 'D', 'C'];
      let bestScore = -1;
      let bestType = null;
      for (const t of secondaryPriority) {
        if (t === primary) continue;
        const score = s[t] || 0;
        if (score > bestScore) {
          bestScore = score;
          bestType = t;
        }
        // If equal score, earlier in priority wins (already ordered)
      }
      const agentSecondary = config.disc.secondary;
      if (bestType && bestScore > 0) {
        config.disc.secondary = bestType;
        if (agentSecondary && agentSecondary !== bestType && agentSecondary !== 'none') {
          appendToErrorLog(workspaceDir, `Secondary override: Agent wrote "${agentSecondary}" but scores derive "${bestType}". Using computed value.`);
        }
      } else if (bestScore === 0) {
        config.disc.secondary = 'none';
      }
    }

    // Apply probing updates
    if (update.probing) {
      if (update.probing.last_style_probe !== undefined) {
        config.last_style_probe = update.probing.last_style_probe;
      }
      if (update.probing.probe_session_count !== undefined) {
        config.probe_session_count = update.probing.probe_session_count;
      }
    }

    // Apply questionnaire updates
    if (update.questionnaire) {
      if (update.questionnaire.q_version !== undefined) {
        config.q_version = update.questionnaire.q_version;
      }
      if (update.questionnaire.answers_hash !== undefined) {
        if (!config.disc) config.disc = {};
        config.disc.answers_hash = update.questionnaire.answers_hash;
      }
      if (update.questionnaire.option_order !== undefined) {
        if (!config.disc) config.disc = {};
        config.disc.option_order = update.questionnaire.option_order;
      }
    }

    // Validation section removed — confidence is derived purely from score distribution.
    // Legacy: if a config_update.md happens to include ## Validation, it will be silently ignored.

    // Handle modifier processing based on trigger type (user_initiated vs version_update)
    if (update.reason && update.modifiers) {
      const reason = update.reason.toLowerCase();
      if (reason.includes('version_update')) {
        // Version update: preserve existing Heartbeat-tuned modifiers, skip modifier overwrite
        // Modifiers already applied above — undo by restoring originals for version_update
        // Actually: for version_update, we should NOT apply modifier changes from questionnaire
        // But modifiers were already applied. We need to check before applying.
        // This is handled by the order: the caller (SKILL.md) should not include ## Modifiers
        // section for version_update triggers. This comment documents the intent.
      }
    }

    // Handle reset/dormant probe field cleanup
    if (update.status === 'dormant' || update.action === 'reset') {
      config.probe_phase_start = null;
      config.last_style_probe = null;
      config.probe_session_count = 0;
    }

    // Handle reactivation from dormant → calibrated
    if (previousStatus === 'dormant' && update.status === 'calibrated') {
      config.probe_phase_start = new Date().toISOString();
      config.probe_session_count = 0;
      config.last_style_probe = null;
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

function generateInjection(config, observations, readiness) {
  const lines = [];

  lines.push('# Soul Forge Calibration Context');
  lines.push('');

  // Status section
  lines.push('## Status');
  const discType = config.disc ? config.disc.primary : 'unknown';
  const confidence = config.disc ? config.disc.confidence : 'unknown';
  lines.push(`${config.status} | ${discType}-type | confidence: ${confidence}`);
  lines.push('');

  // Active modifiers
  lines.push('## Active Modifiers');
  const VERBOSITY_LABELS = ['ultra-brief(1-2 sentences max)', 'concise(short paragraphs)', 'standard', 'detailed(full explanations)'];
  const HUMOR_LABELS = ['none', 'occasional', 'moderate', 'frequent'];
  const PROACTIVITY_LABELS = ['reactive-only', 'low', 'moderate', 'high'];
  const CHALLENGE_LABELS = ['none', 'gentle', 'moderate', 'direct-pushback'];
  if (config.modifiers) {
    const m = config.modifiers;
    const vV = m.verbosity ?? 1; const hV = m.humor ?? 1; const pV = m.proactivity ?? 1; const cV = m.challenge ?? 1;
    lines.push(`verbosity: ${vV} (${VERBOSITY_LABELS[vV] ?? 'standard'}) | humor: ${hV} (${HUMOR_LABELS[hV] ?? 'occasional'}) | proactivity: ${pV} (${PROACTIVITY_LABELS[pV] ?? 'moderate'}) | challenge: ${cV} (${CHALLENGE_LABELS[cV] ?? 'moderate'})`);
    if (vV === 0) {
      lines.push('**MANDATORY: verbosity=0 — reply in 1-2 sentences maximum for ALL responses. No exceptions.**');
    } else if (vV === 1) {
      lines.push('**verbosity=1 — keep replies concise. Prefer short paragraphs over long explanations.**');
    }
  } else {
    lines.push('verbosity: 1 (concise) | humor: 1 (occasional) | proactivity: 1 (low) | challenge: 1 (gentle)');
  }
  lines.push('');

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

  // Probing control
  const probing = computeProbingControl(config);
  lines.push('## Probing Control');
  if (probing.style_probe_allowed) {
    lines.push(`style_probe_allowed: true | stage: ${probing.stage} | target: ${probing.target || 'none'} (lowest confidence)`);
  } else {
    lines.push(`style_probe_allowed: false | stage: ${probing.stage}`);
  }
  lines.push('');

  // q_version mismatch warning (flag is set by main handler)
  if (config._q_outdated) {
    lines.push('## Questionnaire Update');
    lines.push('questionnaire_outdated: true — Suggest user run `/soul-forge recalibrate` to update to the latest questionnaire.');
    lines.push('');
  }

  // Hard guardrail injections
  if (config.disc && config.disc._scores_invalid) {
    lines.push('## Scoring Error Detected');
    lines.push('**WARNING: DISC scores do not sum to 12.0. The calibration scores are invalid. You MUST re-run the scoring procedure (Section C) or suggest `/soul-forge recalibrate`.**');
    lines.push('');
  }

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

  // --- Step 1: Process pending config_update.md ---
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

  // Schema migration (v1 → v2)
  if (!config.version || config.version < CURRENT_SCHEMA_VERSION) {
    config = migrateSchema(config);
    safeWriteFile(configPath, JSON.stringify(config, null, 2));
  }

  // Process config_update.md (may modify config)
  config = processConfigUpdate(workspaceDir, config);

  // Pre-flight Check
  const preflight = preflightCheck(workspaceDir, config);

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

    let freshContent = '# Soul Forge Calibration Context\n\n## Status\nfresh';
    if (preflight.legacyUser) {
      freshContent += ' | legacy_user: true';
    }
    freshContent += '\n\nSoul Forge is installed but not yet configured. Suggest the user run /soul-forge to begin personality calibration.';
    if (preflight.warnings.length > 0) {
      freshContent += '\n\n## Warnings\n';
      for (const w of preflight.warnings) {
        freshContent += `- ${w}\n`;
      }
    }
    context.bootstrapFiles.push({
      name: 'soul-forge-context.md',
      content: freshContent,
      path: contextPath,
      missing: false
    });
    if (!safeWriteFile(contextPath, freshContent)) appendToErrorLog(workspaceDir, 'Failed to write soul-forge-context.md (fresh)');
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

  // Include preflight warnings
  if (preflight.warnings.length > 0) {
    injectionWarnings.push(...preflight.warnings);
  }

  // Increment probe_session_count for each bootstrap in calibrated state
  config.probe_session_count = (config.probe_session_count || 0) + 1;

  // q_version mismatch check + probe cycle reset
  if (config.q_version && config.q_version < CURRENT_Q_VERSION) {
    config._q_outdated = true;
    // Reset probing cycle so user re-enters Stage 1 after recalibrating
    config.probe_phase_start = new Date().toISOString();
    config.probe_session_count = 0;
    config.last_style_probe = null;
  } else {
    delete config._q_outdated;
  }

  // Save updated probe_session_count (and any q_version reset)
  safeWriteFile(configPath, JSON.stringify(config, null, 2));

  // Read memory.md
  const memoryContent = safeReadFile(memoryPath);
  const observations = parseMemory(memoryContent);

  // Compute calibration readiness
  const readiness = computeCalibrationReadiness(observations);

  // Generate injection content
  const injectionContent = generateInjection(config, observations, readiness);

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
};

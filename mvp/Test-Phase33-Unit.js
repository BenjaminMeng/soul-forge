'use strict';

// ============================================================
// Soul Forge Phase 3.3 Unit Tests
// Tests: telemetry.json generation, schema, privacy fields, edge cases
// Run: node mvp/Test-Phase33-Unit.js
// ============================================================

const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Paths ---
const HOOK_DIR = path.join(__dirname, '..', 'src', 'hooks', 'soul-forge-bootstrap');
const handler = require(path.join(HOOK_DIR, 'handler'));
const T = handler._test;

// --- Test framework ---
let _pass = 0, _fail = 0, _group = '';

function group(name) {
  _group = name;
  console.log(`\n=== ${name} ===`);
}

function assert(condition, label) {
  const fullLabel = `[${_group}] ${label}`;
  if (condition) {
    _pass++;
    console.log(`  PASS  ${fullLabel}`);
  } else {
    _fail++;
    console.log(`  FAIL  ${fullLabel}`);
  }
}

function assertEqual(actual, expected, label) {
  const match = actual === expected;
  const fullLabel = `[${_group}] ${label}`;
  if (match) {
    _pass++;
    console.log(`  PASS  ${fullLabel}`);
  } else {
    _fail++;
    console.log(`  FAIL  ${fullLabel} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }
}

// --- Helper: create temp workspace ---
function createTempWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test33-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  const historyDir = path.join(tmpDir, '.soul_history');
  fs.mkdirSync(sfDir, { recursive: true });
  fs.mkdirSync(historyDir, { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}

// ============================================================
// Group: generateTelemetry — schema and structure
// ============================================================

group('generateTelemetry — schema structure');
{
  const tmpDir = createTempWorkspace();
  const config = {
    status: 'calibrated',
    probe_session_count: 50,
    disc: { primary: 'D', confidence: 'medium' },
    modifiers: { verbosity: 2, humor: 1, proactivity: 3, challenge: 3 },
    mood_history: [
      { session: 49, score: 0.1, confidence: 'medium' },
      { session: 50, score: -0.2, confidence: 'high' }
    ],
    drift_state: {
      verbosity: { net: -4, last_alert_session: null, user_declined: false },
      humor: { net: 1, last_alert_session: null, user_declined: false }
    },
    pending_changes: {},
    soul_evolve: {
      pending: null,
      evolve_count: { verbosity: 1, humor: 0 },
      last_execution: '2026-03-15T10:00:00Z'
    },
    memory_stats: { unique_entries: 15, last_dedup_session: 45 },
    integrity: { violation_count: 0 }
  };

  const moodContext = {
    moodResult: { score: -0.2, vote: 'negative', confidence: 'high' },
    trend: 'declining'
  };
  const actionSignals = [
    { signal: 'MOOD_SHIFT', data: { score: -0.2, trend: 'declining' } }
  ];
  const dedupResult = { cleaned: false, duplicatesRemoved: 0 };

  const telemetry = T.generateTelemetry(config, actionSignals, moodContext, dedupResult, tmpDir);

  // Schema version
  assertEqual(telemetry._schema, 'soul_forge_telemetry_v1', 'schema version is v1');
  assert(telemetry._generated_at !== undefined, 'generated_at timestamp present');
  assert(telemetry._privacy.includes('No conversation content'), 'privacy notice present');

  // Session
  assertEqual(telemetry.session.count, 50, 'session count');
  assertEqual(telemetry.session.maturity_phase, 'calibration', 'maturity phase correct for session 50');
  assertEqual(telemetry.session.status, 'calibrated', 'status');

  // DISC
  assertEqual(telemetry.disc.primary, 'D', 'disc primary');
  assertEqual(telemetry.disc.confidence, 'medium', 'disc confidence');

  // Modifiers
  assertEqual(telemetry.modifiers.verbosity, 2, 'modifier verbosity');
  assertEqual(telemetry.modifiers.challenge, 3, 'modifier challenge');

  // Mood
  assertEqual(telemetry.mood.current_score, -0.2, 'mood current score');
  assertEqual(telemetry.mood.trend, 'declining', 'mood trend');
  assertEqual(telemetry.mood.history_length, 2, 'mood history length');

  // Drift
  assertEqual(telemetry.drift.verbosity.net, -4, 'drift verbosity net');
  assertEqual(telemetry.drift.humor.net, 1, 'drift humor net');

  // Action signals
  assertEqual(telemetry.action_signals.length, 1, 'one action signal');
  assertEqual(telemetry.action_signals[0].signal, 'MOOD_SHIFT', 'signal is MOOD_SHIFT');

  // Memory
  assertEqual(telemetry.memory.unique_entries, 15, 'memory unique entries');
  assertEqual(telemetry.memory.dedup_this_session, false, 'no dedup this session');

  // Soul evolve
  assertEqual(telemetry.soul_evolve.pending, null, 'no pending evolve');
  assertEqual(telemetry.soul_evolve.evolve_count.verbosity, 1, 'evolve count verbosity');
  assertEqual(telemetry.soul_evolve.last_execution, '2026-03-15T10:00:00Z', 'last execution');

  // Integrity
  assertEqual(telemetry.integrity.violation_count, 0, 'violation count');

  // File written
  const telemetryPath = path.join(tmpDir, '.soul_forge', 'telemetry.json');
  assert(fs.existsSync(telemetryPath), 'telemetry.json file created');
  const written = JSON.parse(fs.readFileSync(telemetryPath, 'utf-8'));
  assertEqual(written._schema, 'soul_forge_telemetry_v1', 'written file has correct schema');

  cleanup(tmpDir);
}

// ============================================================
// Group: generateTelemetry — with pending SOUL_EVOLVE
// ============================================================

group('generateTelemetry — pending SOUL_EVOLVE');
{
  const tmpDir = createTempWorkspace();
  const config = {
    status: 'calibrated',
    probe_session_count: 55,
    disc: { primary: 'I', confidence: 'high' },
    modifiers: { verbosity: 1, humor: 2, proactivity: 1, challenge: 1 },
    mood_history: [],
    drift_state: {},
    pending_changes: {
      humor: { from: 1, to: 2, negative_signals: 1 }
    },
    soul_evolve: {
      pending: {
        modifier: 'verbosity',
        direction: 'lower',
        applied_session: 50,
        validation_window: 10,
        negative_signals: 0
      },
      evolve_count: { verbosity: 1 },
      last_execution: '2026-03-16T00:00:00Z'
    },
    memory_stats: { unique_entries: 8, last_dedup_session: null },
    integrity: { violation_count: 2 }
  };

  const telemetry = T.generateTelemetry(config, [], null, null, tmpDir);

  // Pending evolve
  assert(telemetry.soul_evolve.pending !== null, 'pending evolve present');
  assertEqual(telemetry.soul_evolve.pending.modifier, 'verbosity', 'pending modifier');
  assertEqual(telemetry.soul_evolve.pending.direction, 'lower', 'pending direction');
  assertEqual(telemetry.soul_evolve.pending.sessions_remaining, 5, 'sessions remaining = 10 - (55-50)');

  // Pending changes
  assert(telemetry.pending_changes.humor !== undefined, 'pending change humor present');
  assertEqual(telemetry.pending_changes.humor.from, 1, 'pending change from');
  assertEqual(telemetry.pending_changes.humor.to, 2, 'pending change to');
  assertEqual(telemetry.pending_changes.humor.negative_signals, 1, 'pending change negative signals');

  // Integrity with violations
  assertEqual(telemetry.integrity.violation_count, 2, 'violation count = 2');

  // Null mood context
  assertEqual(telemetry.mood, null, 'mood is null when no context');

  cleanup(tmpDir);
}

// ============================================================
// Group: generateTelemetry — minimal config (fresh/edge cases)
// ============================================================

group('generateTelemetry — minimal config');
{
  const tmpDir = createTempWorkspace();
  const config = {
    status: 'fresh',
    probe_session_count: 0
  };

  const telemetry = T.generateTelemetry(config, [], null, null, tmpDir);

  assertEqual(telemetry.session.count, 0, 'session 0');
  assertEqual(telemetry.session.maturity_phase, 'exploration', 'exploration phase at session 0');
  assertEqual(telemetry.disc, null, 'disc null when not set');
  assertEqual(telemetry.modifiers, null, 'modifiers null when not set');
  assertEqual(telemetry.mood, null, 'mood null');
  assertEqual(telemetry.soul_evolve, null, 'soul_evolve null when not set');
  assertEqual(telemetry.integrity, null, 'integrity null when not set');
  assertEqual(telemetry.action_signals.length, 0, 'no action signals');
  assertEqual(Object.keys(telemetry.drift).length, 0, 'empty drift');
  assertEqual(Object.keys(telemetry.pending_changes).length, 0, 'empty pending changes');

  cleanup(tmpDir);
}

// ============================================================
// Group: generateTelemetry — no conversation content leak
// ============================================================

group('generateTelemetry — privacy: no conversation content');
{
  const tmpDir = createTempWorkspace();
  const config = {
    status: 'calibrated',
    probe_session_count: 100,
    disc: { primary: 'S', confidence: 'high', scores: { D: 1, I: 2, S: 6, C: 3 }, answers_hash: 'abc123' },
    modifiers: { verbosity: 1, humor: 1, proactivity: 2, challenge: 0 },
    mood_history: [
      { session: 99, score: 0.5, raw_score: 0.55, token_count: 12, confidence: 'high', emotion: 'happy' }
    ],
    drift_state: { verbosity: { net: 0, last_alert_session: null, user_declined: false } },
    pending_changes: {},
    soul_evolve: { pending: null, evolve_count: {}, last_execution: null },
    memory_stats: { unique_entries: 30, last_dedup_session: 90, line_count: 200 },
    integrity: { violation_count: 0, _handler_checksum: 'xyz789', _last_memory_lines: 200 },
    calibration_baseline: { modifiers: { verbosity: 1, humor: 1, proactivity: 2, challenge: 0 } },
    calibration_history: [{ from: 'D', to: 'S', session: 50 }]
  };

  const telemetry = T.generateTelemetry(config, [], null, null, tmpDir);
  const json = JSON.stringify(telemetry);

  // Must NOT contain: answers_hash, raw_score, _handler_checksum, calibration_baseline, calibration_history
  assert(!json.includes('answers_hash'), 'no answers_hash leaked');
  assert(!json.includes('abc123'), 'no hash value leaked');
  assert(!json.includes('_handler_checksum'), 'no handler checksum leaked');
  assert(!json.includes('xyz789'), 'no checksum value leaked');
  assert(!json.includes('calibration_baseline'), 'no calibration baseline leaked');
  assert(!json.includes('calibration_history'), 'no calibration history leaked');

  // Scores should not be present (only primary type)
  assert(!json.includes('"scores"'), 'no DISC scores leaked');

  // DISC primary type IS present (aggregate, not PII)
  assert(json.includes('"S"'), 'disc primary type present (allowed)');

  cleanup(tmpDir);
}

// ============================================================
// Group: SKILL.md privacy notice updated
// ============================================================

group('SKILL.md — privacy notice includes telemetry');
{
  const skillPath = path.join(__dirname, '..', 'src', 'skills', 'soul-forge', 'SKILL.md');
  const content = fs.readFileSync(skillPath, 'utf-8');

  // English notice
  assert(content.includes('telemetry.json'), 'EN: mentions telemetry.json');
  assert(content.includes('opt-in only'), 'EN: opt-in only');
  assert(content.includes('no conversation content'), 'EN: no conversation content');

  // Chinese notice
  assert(content.includes('telemetry.json') && content.includes('opt-in'), 'ZH: mentions telemetry.json and opt-in');
  assert(content.includes('不包含任何对话内容'), 'ZH: no conversation content in Chinese');
}

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Phase 3.3 Unit Tests: ${_pass} PASS, ${_fail} FAIL (${_pass + _fail} total)`);
console.log('='.repeat(50));

if (_fail > 0) {
  process.exit(1);
}

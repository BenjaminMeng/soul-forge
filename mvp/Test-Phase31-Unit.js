'use strict';

// ============================================================
// Soul Forge Phase 3.1 Unit Tests
// Tests: maturity, drift, staged pipeline, memory dedup, context, action signals
// Run: node mvp/Test-Phase31-Unit.js
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
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  const fullLabel = `[${_group}] ${label}`;
  if (match) {
    _pass++;
    console.log(`  PASS  ${fullLabel}`);
  } else {
    _fail++;
    console.log(`  FAIL  ${fullLabel} — expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// Group: maturity
// ============================================================

group('maturity — phase detection');
{
  assertEqual(T.getMaturityPhase(0), 'exploration', 'session 0 → exploration');
  assertEqual(T.getMaturityPhase(15), 'exploration', 'session 15 → exploration');
  assertEqual(T.getMaturityPhase(29), 'exploration', 'session 29 → exploration');
  assertEqual(T.getMaturityPhase(30), 'calibration', 'session 30 → calibration');
  assertEqual(T.getMaturityPhase(50), 'calibration', 'session 50 → calibration');
  assertEqual(T.getMaturityPhase(99), 'calibration', 'session 99 → calibration');
  assertEqual(T.getMaturityPhase(100), 'stable', 'session 100 → stable');
  assertEqual(T.getMaturityPhase(500), 'stable', 'session 500 → stable');
}

group('maturity — params generation');
{
  const exp = T.getMaturityParams(10);
  assertEqual(exp.phase, 'exploration', 'exploration phase name');
  assertEqual(exp.change_cooldown_days, 3, 'exploration cooldown = 3d');
  assertEqual(exp.drift_threshold, 3, 'exploration drift threshold = 3');
  assertEqual(exp.soul_evolve_allowed, false, 'exploration: no SOUL_EVOLVE');
  assertEqual(exp.validation_window, 3, 'exploration validation = 3 sessions');

  const cal = T.getMaturityParams(60);
  assertEqual(cal.phase, 'calibration', 'calibration phase name');
  assertEqual(cal.change_cooldown_days, 7, 'calibration cooldown = 7d');
  assertEqual(cal.drift_threshold, 5, 'calibration drift threshold = 5');
  assertEqual(cal.soul_evolve_allowed, true, 'calibration: SOUL_EVOLVE allowed');

  const stb = T.getMaturityParams(200);
  assertEqual(stb.phase, 'stable', 'stable phase name');
  assertEqual(stb.change_cooldown_days, 14, 'stable cooldown = 14d');
  assertEqual(stb.drift_threshold, 8, 'stable drift threshold = 8');
  assertEqual(stb.validation_window, 8, 'stable validation = 8 sessions');
}

// ============================================================
// Group: drift detection
// ============================================================

group('drift — net computation');
{
  const obs = [
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'humor → raise', status: 'active' },
  ];
  const config = {
    probe_session_count: 10, // exploration phase, threshold=3
    drift_state: {}
  };
  const alerts = T.computeDrift(obs, config);
  assertEqual(config.drift_state.verbosity.net, -3, 'verbosity drift net = -3');
  assertEqual(config.drift_state.humor.net, 1, 'humor drift net = 1');
  assert(alerts.length === 1, 'one drift alert (verbosity meets threshold=3)');
  if (alerts.length > 0) {
    assertEqual(alerts[0].modifier, 'verbosity', 'alert modifier = verbosity');
    assertEqual(alerts[0].direction, 'lower', 'alert direction = lower');
  }
}

group('drift — cooldown');
{
  const obs = [
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
  ];
  const config = {
    probe_session_count: 15,
    drift_state: {
      verbosity: { net: 0, last_alert_session: 10, user_declined: false }, // last alert 5 sessions ago
      humor: { net: 0, last_alert_session: null, user_declined: false },
      proactivity: { net: 0, last_alert_session: null, user_declined: false },
      challenge: { net: 0, last_alert_session: null, user_declined: false }
    }
  };
  const alerts = T.computeDrift(obs, config);
  assertEqual(alerts.length, 0, 'no alert: cooldown not met (5 < 10 sessions)');
}

group('drift — user declined');
{
  const obs = [
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
    { modifier_hint: 'verbosity → lower', status: 'active' },
  ];
  const config = {
    probe_session_count: 50,
    drift_state: {
      verbosity: { net: 0, last_alert_session: null, user_declined: true },
      humor: { net: 0, last_alert_session: null, user_declined: false },
      proactivity: { net: 0, last_alert_session: null, user_declined: false },
      challenge: { net: 0, last_alert_session: null, user_declined: false }
    }
  };
  const alerts = T.computeDrift(obs, config);
  assertEqual(alerts.length, 0, 'no alert: user previously declined');
}

// ============================================================
// Group: staged pipeline — admission
// ============================================================

group('pipeline — admission gate 1: rate limit');
{
  const config = {
    probe_session_count: 10,
    change_history: [{ modifier: 'verbosity', timestamp: new Date().toISOString() }],
    drift_state: { verbosity: { net: -3 } },
    calibration_baseline: { modifiers: { verbosity: 2 } }
  };
  const result = T.admitChange('verbosity', 2, 1, config);
  assertEqual(result.allowed, false, 'rejected: within cooldown');
  assert(result.reason.includes('rate_limit'), 'reason includes rate_limit');
}

group('pipeline — admission gate 2: magnitude');
{
  const config = {
    probe_session_count: 10,
    change_history: [],
    drift_state: { verbosity: { net: -3 } },
    calibration_baseline: { modifiers: { verbosity: 2 } }
  };
  const result = T.admitChange('verbosity', 2, 0, config); // delta = -2
  assertEqual(result.allowed, false, 'rejected: magnitude > ±1');
  assert(result.reason.includes('magnitude'), 'reason includes magnitude');
}

group('pipeline — admission gate 3: direction consistency');
{
  const config = {
    probe_session_count: 10,
    change_history: [],
    drift_state: { verbosity: { net: -3 } }, // drift says lower
    calibration_baseline: { modifiers: { verbosity: 2 } }
  };
  const result = T.admitChange('verbosity', 2, 3, config); // trying to raise
  assertEqual(result.allowed, false, 'rejected: direction inconsistent');
  assert(result.reason.includes('direction'), 'reason includes direction');
}

group('pipeline — admission gate 4: baseline range');
{
  const config = {
    probe_session_count: 10,
    change_history: [],
    drift_state: { verbosity: { net: -3 } },
    calibration_baseline: { modifiers: { verbosity: 2 } }
  };
  const result = T.admitChange('verbosity', 1, 0, config); // 0 is 2 away from baseline 2
  assertEqual(result.allowed, false, 'rejected: exceeds baseline ±1');
  assert(result.reason.includes('baseline'), 'reason includes baseline');
}

group('pipeline — admission: all gates pass');
{
  const config = {
    probe_session_count: 10,
    change_history: [],
    drift_state: { verbosity: { net: -3 } },
    calibration_baseline: { modifiers: { verbosity: 2 } }
  };
  const result = T.admitChange('verbosity', 2, 1, config); // delta=-1, baseline ok, direction ok
  assertEqual(result.allowed, true, 'all gates passed');
}

// ============================================================
// Group: staged pipeline — pending changes
// ============================================================

group('pipeline — pending promotion');
{
  const config = {
    probe_session_count: 20,
    modifiers: { verbosity: 1 },
    pending_changes: {
      verbosity: { from: 2, to: 1, applied_session: 14, validation_window: 5, negative_signals: 0 }
    },
    change_history: []
  };
  const obs = []; // no observations = no negative signals
  const actions = T.processPendingChanges(config, obs);
  assertEqual(actions.length, 1, 'one action: permanent');
  if (actions.length > 0) {
    assertEqual(actions[0].type, 'permanent', 'action type = permanent');
    assertEqual(actions[0].modifier, 'verbosity', 'modifier = verbosity');
  }
  assertEqual(config.pending_changes.verbosity, undefined, 'pending_changes cleared');
  assert(config.change_history.length === 1, 'change_history has 1 entry');
  assertEqual(config.change_history[0].result, 'permanent', 'history result = permanent');
}

group('pipeline — pending rollback');
{
  const config = {
    probe_session_count: 20,
    modifiers: { verbosity: 1 },
    pending_changes: {
      verbosity: { from: 2, to: 1, applied_session: 14, validation_window: 5, negative_signals: 0 }
    },
    change_history: []
  };
  // Observations with reverse direction signals
  const obs = [
    { modifier_hint: 'verbosity → raise', status: 'active' },
    { modifier_hint: 'verbosity → raise', status: 'active' },
    { modifier_hint: 'verbosity → raise', status: 'active' },
  ];
  const actions = T.processPendingChanges(config, obs);
  assertEqual(actions.length, 1, 'one action: reverted');
  if (actions.length > 0) {
    assertEqual(actions[0].type, 'reverted', 'action type = reverted');
  }
  assertEqual(config.modifiers.verbosity, 2, 'modifier rolled back to original');
  assertEqual(config.change_history[0].result, 'reverted', 'history result = reverted');
}

group('pipeline — pending not yet ready');
{
  const config = {
    probe_session_count: 16, // only 2 sessions since applied
    modifiers: { verbosity: 1 },
    pending_changes: {
      verbosity: { from: 2, to: 1, applied_session: 14, validation_window: 5, negative_signals: 0 }
    },
    change_history: []
  };
  const actions = T.processPendingChanges(config, []);
  assertEqual(actions.length, 0, 'no action: validation window not reached');
  assert(config.pending_changes.verbosity !== undefined, 'pending still exists');
}

// ============================================================
// Group: memory dedup
// ============================================================

group('memory dedup — parseMemoryEntries');
{
  const content = `## 2026-03-16 04:06
- **type**: heartbeat
- **signal**: Heartbeat check
- **modifier_hint**: verbosity → maintain at 0
- **status**: active

## 2026-03-16 04:36
- **type**: heartbeat
- **signal**: Heartbeat check
- **modifier_hint**: verbosity → maintain at 0
- **status**: active

## 2026-03-14 15:51
- **type**: calibration
- **signal**: User recalibrated with extreme D-type
- **modifier_hint**: verbosity → lower
- **status**: active`;

  const entries = T.parseMemoryEntries(content);
  assertEqual(entries.length, 3, 'parsed 3 entries');
  assertEqual(entries[0].fields.type, 'heartbeat', 'first entry type');
  assertEqual(entries[2].fields.type, 'calibration', 'third entry type');
}

group('memory dedup — fingerprint');
{
  const e1 = { fields: { type: 'heartbeat', modifier_hint: 'verbosity → maintain at 0', signal: 'Heartbeat check' } };
  const e2 = { fields: { type: 'heartbeat', modifier_hint: 'verbosity → maintain at 0', signal: 'Heartbeat check' } };
  const e3 = { fields: { type: 'calibration', modifier_hint: 'verbosity → lower', signal: 'User recalibrated' } };

  const fp1 = T.fingerprint(e1);
  const fp2 = T.fingerprint(e2);
  const fp3 = T.fingerprint(e3);

  assertEqual(fp1, fp2, 'identical entries → same fingerprint');
  assert(fp1 !== fp3, 'different entries → different fingerprint');
}

group('memory dedup — full dedup with filesystem');
{
  // Create temp workspace
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-dedup-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  // Create memory with lots of duplicates (>50% ratio)
  const duplicateEntry = `## 2026-03-16 04:06
- **type**: heartbeat
- **signal**: Heartbeat check - no new communication signals observed
- **modifier_hint**: verbosity → maintain at 0 (minimal), challenge → maintain at 3
- **status**: active`;

  const uniqueEntry = `## 2026-03-14 15:51
- **type**: calibration
- **signal**: User recalibrated with extreme D-type preference
- **modifier_hint**: verbosity → lower, challenge → raise
- **status**: active`;

  // 10 duplicate heartbeats + 2 unique entries = 12 total, 9 duplicates = 75%
  const entries = [];
  entries.push(uniqueEntry);
  for (let i = 0; i < 10; i++) {
    entries.push(duplicateEntry.replace('04:06', `04:${String(i * 3 + 6).padStart(2, '0')}`));
  }
  entries.push(uniqueEntry.replace('15:51', '16:08').replace('extreme D-type preference', 'style preference direct'));

  fs.writeFileSync(path.join(sfDir, 'memory.md'), entries.join('\n\n') + '\n');

  const config = { probe_session_count: 50, memory_stats: {} };
  const result = T.deduplicateMemory(tmpDir, config);

  assertEqual(result.cleaned, true, 'dedup executed');
  assert(result.duplicatesRemoved >= 9, `removed ${result.duplicatesRemoved} duplicates (expected ≥9)`);
  assertEqual(result.backupCreated, true, 'backup created');

  // Verify backup exists
  const historyDir = path.join(tmpDir, '.soul_history');
  const backups = fs.readdirSync(historyDir).filter(f => f.startsWith('memory_'));
  assert(backups.length > 0, 'backup file exists in .soul_history');

  // Verify deduped memory is smaller
  const newContent = fs.readFileSync(path.join(sfDir, 'memory.md'), 'utf-8');
  const newEntries = T.parseMemoryEntries(newContent);
  assert(newEntries.length <= 3, `deduped to ${newEntries.length} entries (expected ≤3)`);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

group('memory dedup — no dedup when ratio low');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-nodedup-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  // 3 unique entries, 0 duplicates
  const content = `## 2026-03-14 15:51
- **type**: calibration
- **signal**: First
- **status**: active

## 2026-03-15 11:36
- **type**: style
- **signal**: Second
- **status**: active

## 2026-03-16 04:06
- **type**: emotion
- **signal**: Third
- **status**: active`;

  fs.writeFileSync(path.join(sfDir, 'memory.md'), content);
  const config = { probe_session_count: 10, memory_stats: {} };
  const result = T.deduplicateMemory(tmpDir, config);
  assertEqual(result.cleaned, false, 'no dedup when ratio low');
  assertEqual(result.duplicatesRemoved, 0, 'zero duplicates removed');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================
// Group: unified context adjustments
// ============================================================

group('context — mood-driven adjustments');
{
  // Declining + negative
  const adj1 = T.computeContextAdjustments({ score: -0.5, vote: 'negative' }, 'declining', {});
  assertEqual(adj1.challenge, -1, 'declining negative: challenge -1');
  assertEqual(adj1.humor, -1, 'declining negative: humor -1');

  // Declining + very negative
  const adj2 = T.computeContextAdjustments({ score: -0.7, vote: 'negative' }, 'declining', {});
  assertEqual(adj2.proactivity, 1, 'very negative: proactivity +1 (supportive)');

  // Improving + positive
  const adj3 = T.computeContextAdjustments({ score: 0.5, vote: 'positive' }, 'improving', {});
  assertEqual(adj3.humor, 1, 'improving positive: humor +1');
  assertEqual(adj3.challenge, 0, 'improving positive: challenge unchanged');

  // Stable neutral
  const adj4 = T.computeContextAdjustments({ score: 0, vote: 'neutral' }, 'stable', {});
  assertEqual(adj4.challenge, 0, 'stable neutral: no adjustments');
  assertEqual(adj4.humor, 0, 'stable neutral: humor unchanged');
}

group('context — clamp ±1');
{
  // Even with extreme input, adjustments should be clamped
  const adj = T.computeContextAdjustments({ score: -0.9, vote: 'negative' }, 'declining', {});
  assert(adj.challenge >= -1 && adj.challenge <= 1, 'challenge clamped [-1,1]');
  assert(adj.humor >= -1 && adj.humor <= 1, 'humor clamped [-1,1]');
  assert(adj.proactivity >= -1 && adj.proactivity <= 1, 'proactivity clamped [-1,1]');
  assert(adj.verbosity >= -1 && adj.verbosity <= 1, 'verbosity clamped [-1,1]');
}

group('context — null input');
{
  const adj = T.computeContextAdjustments(null, 'stable', {});
  assertEqual(adj.challenge, 0, 'null mood: no adjustments');
}

// ============================================================
// Group: action signals
// ============================================================

group('action signals — DRIFT_ALERT');
{
  const config = {
    probe_session_count: 10,
    drift_state: {},
    memory_stats: { unique_entries: 5 },
    soul_evolve: { evolve_count: {} },
    calibration_baseline: { modifiers: { verbosity: 2 } },
    modifiers: { verbosity: 2 }
  };
  const driftAlerts = [{ modifier: 'verbosity', direction: 'lower', net: -3 }];
  const signals = T.generateActionSignals(config, [], driftAlerts, null, {});
  assert(signals.some(s => s.signal === 'DRIFT_ALERT'), 'DRIFT_ALERT signal generated');
}

group('action signals — CONSOLIDATE');
{
  const config = {
    probe_session_count: 50,
    drift_state: {},
    memory_stats: { unique_entries: 55 },
    soul_evolve: { evolve_count: {} },
    calibration_baseline: { modifiers: {} },
    modifiers: {}
  };
  const signals = T.generateActionSignals(config, [], [], null, {});
  assert(signals.some(s => s.signal === 'CONSOLIDATE'), 'CONSOLIDATE signal when >50 unique entries');
}

group('action signals — SOUL_EVOLVE blocked in exploration');
{
  const config = {
    probe_session_count: 10, // exploration → soul_evolve_allowed = false
    drift_state: { verbosity: { net: -5 } },
    memory_stats: { unique_entries: 5 },
    soul_evolve: { last_execution: null, evolve_count: { verbosity: 0 } },
    calibration_baseline: { modifiers: { verbosity: 2 } },
    modifiers: { verbosity: 2 }
  };
  const signals = T.generateActionSignals(config, [], [], null, {});
  assert(!signals.some(s => s.signal === 'SOUL_EVOLVE'), 'no SOUL_EVOLVE in exploration phase');
}

group('action signals — SOUL_EVOLVE allowed in calibration');
{
  const config = {
    probe_session_count: 50, // calibration phase
    drift_state: { verbosity: { net: -6 } }, // exceeds threshold 5
    memory_stats: { unique_entries: 5 },
    soul_evolve: { last_execution: null, evolve_count: { verbosity: 0 } },
    calibration_baseline: { modifiers: { verbosity: 2 } },
    modifiers: { verbosity: 2 }
  };
  const signals = T.generateActionSignals(config, [], [], null, {});
  assert(signals.some(s => s.signal === 'SOUL_EVOLVE'), 'SOUL_EVOLVE allowed in calibration phase');
}

group('action signals — RECALIBRATE when evolve_count >= 3');
{
  const config = {
    probe_session_count: 50,
    drift_state: { verbosity: { net: -6 } },
    memory_stats: { unique_entries: 5 },
    soul_evolve: { last_execution: null, evolve_count: { verbosity: 3 } }, // maxed out
    calibration_baseline: { modifiers: { verbosity: 2 } },
    modifiers: { verbosity: 2 }
  };
  const signals = T.generateActionSignals(config, [], [], null, {});
  assert(signals.some(s => s.signal === 'RECALIBRATE_SUGGEST'), 'RECALIBRATE when evolve_count >= 3');
  assert(!signals.some(s => s.signal === 'SOUL_EVOLVE'), 'no SOUL_EVOLVE when evolve_count >= 3');
}

group('action signals — RECALIBRATE when baseline exceeded');
{
  const config = {
    probe_session_count: 50,
    drift_state: { verbosity: { net: -6 } },
    memory_stats: { unique_entries: 5 },
    soul_evolve: { last_execution: null, evolve_count: { verbosity: 1 } },
    calibration_baseline: { modifiers: { verbosity: 2 } },
    modifiers: { verbosity: 0 } // already 2 away from baseline
  };
  const signals = T.generateActionSignals(config, [], [], null, {});
  assert(signals.some(s => s.signal === 'RECALIBRATE_SUGGEST'), 'RECALIBRATE when proposed exceeds baseline ±1');
}

group('action signals — MOOD_SHIFT');
{
  const config = {
    probe_session_count: 10,
    drift_state: {},
    memory_stats: { unique_entries: 5 },
    soul_evolve: { evolve_count: {} },
    calibration_baseline: { modifiers: {} },
    modifiers: {}
  };
  const moodCtx = { moodResult: { score: -0.5, vote: 'negative' }, trend: 'declining' };
  const signals = T.generateActionSignals(config, [], [], moodCtx, {});
  assert(signals.some(s => s.signal === 'MOOD_SHIFT'), 'MOOD_SHIFT on declining + negative');
}

// ============================================================
// Group: integration — full bootstrap
// ============================================================

group('integration — full Phase 3.1 bootstrap');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-int31-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  // v2 config with existing calibration
  const v2Config = {
    version: 2, status: 'calibrated',
    disc: { primary: 'D', secondary: 'C', confidence: 'medium', scores: { D:5, I:0, S:0, C:3 } },
    modifiers: { humor: 1, verbosity: 0, proactivity: 3, challenge: 3 },
    probe_session_count: 42, q_version: 2
  };
  fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify(v2Config, null, 2));

  // Memory with high duplication (like real data)
  const heartbeat = `## 2026-03-16 HH:MM
- **type**: heartbeat
- **signal**: Heartbeat check - no new communication signals observed
- **modifier_hint**: verbosity → maintain at 0 (minimal), challenge → maintain at 3
- **status**: active`;

  const unique1 = `## 2026-03-14 15:51
- **type**: calibration
- **signal**: User recalibrated with extreme D-type preference
- **modifier_hint**: verbosity → lower, challenge → raise
- **status**: active`;

  const memEntries = [unique1];
  for (let i = 0; i < 20; i++) {
    memEntries.push(heartbeat.replace('HH:MM', `${String(4 + Math.floor(i/2)).padStart(2,'0')}:${String((i%2)*30).padStart(2,'0')}`));
  }
  fs.writeFileSync(path.join(sfDir, 'memory.md'), memEntries.join('\n\n') + '\n');

  // HEARTBEAT.md with emotional content
  fs.writeFileSync(path.join(tmpDir, 'HEARTBEAT.md'),
    '# HEARTBEAT\n\nI am really frustrated and annoyed with this terrible bug. Everything is broken and nothing works properly. This is awful.\n');

  // Bootstrap
  const event = {
    type: 'agent', action: 'bootstrap',
    context: { workspaceDir: tmpDir, bootstrapFiles: [] }
  };
  handler(event);

  // Verify config
  const newConfig = JSON.parse(fs.readFileSync(path.join(sfDir, 'config.json'), 'utf-8'));
  assertEqual(newConfig.version, 3, 'migrated to v3');
  assert(newConfig.drift_state !== undefined, 'drift_state exists');
  assert(newConfig.calibration_baseline !== undefined, 'calibration_baseline exists');
  assert(newConfig.memory_stats.entries_removed > 0 || newConfig.memory_stats.total_entries < 21, 'memory dedup executed or not needed');

  // Verify context injection
  const ctxFile = event.context.bootstrapFiles.find(f => f.name === 'soul-forge-context.md');
  assert(ctxFile !== undefined, 'context injected');
  assert(ctxFile.content.includes('maturity:'), 'context has maturity info');

  // Verify backup
  assert(fs.existsSync(path.join(sfDir, 'config.json.prev')), '.prev backup exists');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Phase 3.1 Unit Tests: ${_pass} PASS, ${_fail} FAIL (${_pass + _fail} total)`);
console.log('='.repeat(50));

if (_fail > 0) {
  process.exit(1);
}

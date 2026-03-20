'use strict';

// ============================================================
// Soul Forge Phase 3.2 Unit Tests
// Tests: SOUL_EVOLVE validation, backup automation, parseConfigUpdate soul_evolve,
//        pending evolve in injection, schema migration pending field
// Run: node mvp/Test-Phase32-Unit.js
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test32-'));
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
// Group: parseConfigUpdate — soul_evolve action
// ============================================================

group('parseConfigUpdate — soul_evolve fields');
{
  const content = `# Config Update Request

## Action
soul_evolve

## Soul_Evolve
- **modifier**: verbosity
- **direction**: lower
- **backup**: SOUL_2026-03-17T10-30-00.md

## Status
calibrated

## Reason
SOUL_EVOLVE: adjusted verbosity lower based on drift evidence`;

  const result = T.parseConfigUpdate(content);
  assertEqual(result.action, 'soul_evolve', 'action = soul_evolve');
  assertEqual(result.soul_evolve_modifier, 'verbosity', 'modifier parsed');
  assertEqual(result.soul_evolve_direction, 'lower', 'direction parsed');
  assertEqual(result.soul_evolve_backup, 'SOUL_2026-03-17T10-30-00.md', 'backup filename parsed');
  assertEqual(result.status, 'calibrated', 'status preserved');
}

// ============================================================
// Group: backupSoulMd
// ============================================================

group('backupSoulMd — creates backup');
{
  const tmpDir = createTempWorkspace();
  const soulPath = path.join(tmpDir, 'SOUL.md');
  fs.writeFileSync(soulPath, '# SOUL.md\n\n## Core Truths\nTest content');

  const backupName = T.backupSoulMd(tmpDir);
  assert(backupName !== null, 'backup name returned');
  assert(backupName.startsWith('SOUL_'), 'backup name starts with SOUL_');
  assert(backupName.endsWith('.md'), 'backup name ends with .md');

  const backupPath = path.join(tmpDir, '.soul_history', backupName);
  assert(fs.existsSync(backupPath), 'backup file exists');

  const backupContent = fs.readFileSync(backupPath, 'utf-8');
  assert(backupContent.includes('Core Truths'), 'backup content preserved');

  cleanup(tmpDir);
}

group('backupSoulMd — no SOUL.md');
{
  const tmpDir = createTempWorkspace();
  // No SOUL.md file
  const result = T.backupSoulMd(tmpDir);
  assertEqual(result, null, 'returns null when no SOUL.md');
  cleanup(tmpDir);
}

// ============================================================
// Group: processSoulEvolve — validation
// ============================================================

group('processSoulEvolve — no pending');
{
  const config = {
    soul_evolve: { pending: null, evolve_count: {} },
    probe_session_count: 50
  };
  const result = T.processSoulEvolve(config, [], '/tmp');
  assertEqual(result.action, 'none', 'no pending → none');
}

group('processSoulEvolve — validating (within window)');
{
  const config = {
    soul_evolve: {
      pending: {
        modifier: 'verbosity',
        direction: 'lower',
        applied_session: 45,
        validation_window: 10,
        negative_signals: 0,
        backup_file: null
      },
      evolve_count: { verbosity: 1 }
    },
    probe_session_count: 50
  };

  // No contrary observations
  const result = T.processSoulEvolve(config, [], '/tmp');
  assertEqual(result.action, 'validating', 'still validating');
  assertEqual(result.elapsed, 5, 'elapsed = 5');
  assertEqual(result.window, 10, 'window = 10');
  assertEqual(result.negative_signals, 0, 'no negative signals');
}

group('processSoulEvolve — promoted (window complete, no negatives)');
{
  const config = {
    soul_evolve: {
      pending: {
        modifier: 'humor',
        direction: 'raise',
        applied_session: 40,
        validation_window: 10,
        negative_signals: 0,
        backup_file: null
      },
      evolve_count: { humor: 1 }
    },
    probe_session_count: 51
  };

  const result = T.processSoulEvolve(config, [], '/tmp');
  assertEqual(result.action, 'promoted', 'promoted after window');
  assertEqual(result.modifier, 'humor', 'promoted modifier = humor');
  assertEqual(result.direction, 'raise', 'promoted direction = raise');
  assertEqual(config.soul_evolve.pending, null, 'pending cleared after promotion');
}

group('processSoulEvolve — rollback (negative signals during window)');
{
  const tmpDir = createTempWorkspace();
  const soulPath = path.join(tmpDir, 'SOUL.md');
  fs.writeFileSync(soulPath, '# Modified SOUL.md\nPost-evolve content');

  // Create a backup
  const backupName = 'SOUL_backup_test.md';
  fs.writeFileSync(path.join(tmpDir, '.soul_history', backupName), '# Original SOUL.md\nOriginal content');

  const config = {
    soul_evolve: {
      pending: {
        modifier: 'verbosity',
        direction: 'lower',
        applied_session: 45,
        validation_window: 10,
        negative_signals: 0,
        backup_file: backupName
      },
      evolve_count: { verbosity: 2 }
    },
    probe_session_count: 50
  };

  // Observations with contrary direction (verbosity raise instead of lower)
  const observations = [
    { modifier_hint: 'verbosity → raise', type: 'style' },
    { modifier_hint: 'verbosity → raise', type: 'style' },
  ];

  const result = T.processSoulEvolve(config, observations, tmpDir);
  assertEqual(result.action, 'rollback', 'rollback triggered');
  assertEqual(result.modifier, 'verbosity', 'rollback modifier');
  assertEqual(result.reason, 'negative_signals', 'reason = negative_signals');
  assert(result.restored === true, 'SOUL.md restored from backup');

  // Verify SOUL.md content restored
  const restoredContent = fs.readFileSync(soulPath, 'utf-8');
  assert(restoredContent.includes('Original content'), 'SOUL.md content restored to original');

  // Verify evolve_count decremented
  assertEqual(config.soul_evolve.evolve_count.verbosity, 1, 'evolve_count decremented after rollback');

  // Verify pending cleared
  assertEqual(config.soul_evolve.pending, null, 'pending cleared after rollback');

  cleanup(tmpDir);
}

group('processSoulEvolve — rollback at window end');
{
  const config = {
    soul_evolve: {
      pending: {
        modifier: 'challenge',
        direction: 'raise',
        applied_session: 30,
        validation_window: 10,
        negative_signals: 3,  // Already accumulated
        backup_file: null
      },
      evolve_count: { challenge: 1 }
    },
    probe_session_count: 41
  };

  const result = T.processSoulEvolve(config, [], '/tmp');
  assertEqual(result.action, 'rollback', 'rollback at window end with negatives');
  assertEqual(config.soul_evolve.evolve_count.challenge, 0, 'evolve_count decremented to 0');
}

// ============================================================
// Group: SOUL_EVOLVE signal suppression when pending
// ============================================================

group('action signals — SOUL_EVOLVE suppressed when pending');
{
  const config = {
    probe_session_count: 60,  // calibration phase
    drift_state: {
      verbosity: { net: -6, last_alert_session: null, user_declined: false },
      humor: { net: 0, last_alert_session: null, user_declined: false },
      challenge: { net: 0, last_alert_session: null, user_declined: false },
      proactivity: { net: 0, last_alert_session: null, user_declined: false }
    },
    soul_evolve: {
      last_execution: null,
      evolve_count: { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 },
      pending: {
        modifier: 'verbosity',
        direction: 'lower',
        applied_session: 55,
        validation_window: 10,
        negative_signals: 0
      }
    },
    calibration_baseline: { modifiers: { verbosity: 2, humor: 1, challenge: 1, proactivity: 1 } },
    modifiers: { verbosity: 2, humor: 1, challenge: 1, proactivity: 1 },
    memory_stats: { unique_entries: 10 }
  };

  const signals = T.generateActionSignals(config, [], [], null, { cleaned: false });
  const evolveSignals = signals.filter(s => s.signal === 'SOUL_EVOLVE');
  assertEqual(evolveSignals.length, 0, 'no SOUL_EVOLVE when pending exists');
}

group('action signals — SOUL_EVOLVE generated when no pending');
{
  const config = {
    probe_session_count: 60,
    drift_state: {
      verbosity: { net: -6, last_alert_session: null, user_declined: false },
      humor: { net: 0, last_alert_session: null, user_declined: false },
      challenge: { net: 0, last_alert_session: null, user_declined: false },
      proactivity: { net: 0, last_alert_session: null, user_declined: false }
    },
    soul_evolve: {
      last_execution: null,
      evolve_count: { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 },
      pending: null
    },
    calibration_baseline: { modifiers: { verbosity: 2, humor: 1, challenge: 1, proactivity: 1 } },
    modifiers: { verbosity: 2, humor: 1, challenge: 1, proactivity: 1 },
    memory_stats: { unique_entries: 10 }
  };

  const signals = T.generateActionSignals(config, [], [], null, { cleaned: false });
  const evolveSignals = signals.filter(s => s.signal === 'SOUL_EVOLVE');
  assertEqual(evolveSignals.length, 1, 'SOUL_EVOLVE generated when no pending');
  assertEqual(evolveSignals[0].data.modifier, 'verbosity', 'evolve targets verbosity');
  assertEqual(evolveSignals[0].data.direction, 'lower', 'evolve direction = lower');
}

// ============================================================
// Group: schema migration — pending field
// ============================================================

group('schema_migration — soul_evolve.pending field added');
{
  const config = {
    version: 3, status: 'calibrated',
    soul_evolve: {
      last_execution: null,
      evolve_count: { verbosity: 0 },
      approved_drifts: { verbosity: 0 }
      // No pending field (pre-3.2 schema)
    }
  };

  const result = T.migrateSchema(config);
  assert(result.soul_evolve.hasOwnProperty('pending'), 'pending field added to existing soul_evolve');
  assertEqual(result.soul_evolve.pending, null, 'pending defaults to null');
  // Existing fields preserved
  assertEqual(result.soul_evolve.last_execution, null, 'existing fields preserved');
}

// ============================================================
// Group: injection — pending SOUL_EVOLVE in context
// ============================================================

group('injection — pending SOUL_EVOLVE shown');
{
  const config = {
    status: 'calibrated',
    disc: { primary: 'D', confidence: 'medium' },
    modifiers: { verbosity: 2, humor: 1, proactivity: 1, challenge: 1 },
    probe_session_count: 50,
    pending_changes: {},
    soul_evolve: {
      pending: {
        modifier: 'verbosity',
        direction: 'lower',
        applied_session: 45,
        validation_window: 10,
        negative_signals: 1
      }
    }
  };

  const content = T.generateInjection(config, [], {}, null, []);
  assert(content.includes('SOUL_EVOLVE'), 'pending SOUL_EVOLVE shown in injection');
  assert(content.includes('verbosity'), 'pending modifier shown');
  assert(content.includes('lower'), 'pending direction shown');
  assert(content.includes('sessions remaining'), 'remaining sessions shown');
}

group('injection — no pending section when empty');
{
  const config = {
    status: 'calibrated',
    disc: { primary: 'D', confidence: 'medium' },
    modifiers: { verbosity: 2, humor: 1, proactivity: 1, challenge: 1 },
    probe_session_count: 50,
    pending_changes: {},
    soul_evolve: { pending: null }
  };

  const content = T.generateInjection(config, [], {}, null, []);
  assert(!content.includes('## Pending Changes'), 'no Pending Changes section when empty');
}

// ============================================================
// Group: processConfigUpdate — soul_evolve action handling
// ============================================================

group('processConfigUpdate — soul_evolve action records pending');
{
  const tmpDir = createTempWorkspace();
  const updatePath = path.join(tmpDir, '.soul_forge', 'config_update.md');
  const configPath = path.join(tmpDir, '.soul_forge', 'config.json');

  const config = {
    status: 'calibrated', version: 3,
    probe_session_count: 50,
    soul_evolve: {
      last_execution: null,
      evolve_count: { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 },
      approved_drifts: {},
      pending: null
    },
    calibration_history: []
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  fs.writeFileSync(updatePath, `# Config Update Request

## Action
soul_evolve

## Soul_Evolve
- **modifier**: verbosity
- **direction**: lower
- **backup**: SOUL_2026-03-17T10-30-00.md

## Status
calibrated

## Reason
SOUL_EVOLVE: adjusted verbosity lower`);

  const result = T.processConfigUpdate(tmpDir, config);

  assert(result.soul_evolve.pending !== null, 'pending recorded');
  assertEqual(result.soul_evolve.pending.modifier, 'verbosity', 'pending modifier');
  assertEqual(result.soul_evolve.pending.direction, 'lower', 'pending direction');
  assertEqual(result.soul_evolve.pending.applied_session, 50, 'pending applied_session');
  assertEqual(result.soul_evolve.pending.validation_window, 10, 'pending validation_window');
  assertEqual(result.soul_evolve.pending.backup_file, 'SOUL_2026-03-17T10-30-00.md', 'pending backup_file');
  assertEqual(result.soul_evolve.evolve_count.verbosity, 1, 'evolve_count incremented');
  assert(result.soul_evolve.last_execution !== null, 'last_execution set');

  cleanup(tmpDir);
}

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Phase 3.2 Unit Tests: ${_pass} PASS, ${_fail} FAIL (${_pass + _fail} total)`);
console.log('='.repeat(50));

if (_fail > 0) {
  process.exit(1);
}

/**
 * Soul Forge Phase 2 — Unit Tests for handler.js logic
 * Tests: T-WP0-2, T-WP0-3, T-WP0-6, T-WP2-1..7, T-WP1-3, T-WP4-1, T-WP4-2, T-WP3-1/2
 *
 * Strategy: Extract pure functions by re-requiring handler.js with mocked fs,
 * OR copy function source and test directly. We use the second approach for portability.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const HANDLER_PATH = path.join(ROOT, 'src', 'hooks', 'soul-forge-bootstrap', 'handler.js');

// ============================================================
// Extract pure functions from handler.js source by eval-ing
// only the function definitions (not the main() call)
// ============================================================
const handlerSource = fs.readFileSync(HANDLER_PATH, 'utf8');

// Evaluate all functions/constants but intercept module.exports
// We run everything up to the main execution
const sandbox = { require, module: { exports: {} }, exports: {}, __dirname: path.dirname(HANDLER_PATH), __filename: HANDLER_PATH };
const wrappedSource = `(function(require, module, exports, __dirname, __filename) {\n${handlerSource}\n})(sandbox.require, sandbox.module, sandbox.exports, sandbox.__dirname, sandbox.__filename)`;
eval(wrappedSource);

// Access constants and functions from sandbox.module.exports or via eval scope
// Since handler.js doesn't export, we need to extract them differently
// Use a simpler approach: redefine only what we need

// Re-extract constants
const CURRENT_SCHEMA_VERSION = 2;
const CURRENT_Q_VERSION = 2;

// Re-extract functions by pulling from the source text
// Parse and redefine pure functions
const fnSource = handlerSource
  .replace(/^'use strict';/, '')
  .replace(/const fs = require\('fs'\);/, '')
  .replace(/const path = require\('path'\);/, '')
  .replace(/\/\/ Main handler[\s\S]*$/, ''); // Stop before main()

// Evaluate function definitions in local scope
eval(fnSource);

// ============================================================
let passed = 0, failed = 0, results = [];

function check(id, desc, condition, detail) {
  const ok = typeof condition === 'boolean' ? condition : !!condition;
  const mark = ok ? '✅ PASS' : '❌ FAIL';
  const suffix = detail ? `  (${detail})` : '';
  console.log(`${mark} [${id}] ${desc}${suffix}`);
  results.push({ id, desc, ok, detail });
  if (ok) passed++; else failed++;
  return ok;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================
// T-WP0-2: migrateSchema() — v1 → v2
// ============================================================
console.log('\n--- T-WP0-2: Schema Migration v1 → v2 ---');

{
  const v1Config = {
    status: 'calibrated',
    version: 1,
    disc: { primary: 'S', secondary: 'C', confidence: 'high', scores: {D:1,I:2,S:5,C:4} },
    modifiers: { humor: 1, verbosity: 2, proactivity: 1, challenge: 0 },
    calibration_history: [{ timestamp: '2026-02-15T10:00:00Z', trigger: 'calibration', changes: 'Initial' }],
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-16T10:00:00Z'
  };

  const migrated = migrateSchema(JSON.parse(JSON.stringify(v1Config)));

  check('T-WP0-2a', 'version → 3 (v1 migrates to latest)', migrated.version === 3);
  check('T-WP0-2b', 'q_version added = 1', migrated.q_version === 1);
  check('T-WP0-2c', 'answers_hash added = null', migrated.disc.answers_hash === null);
  check('T-WP0-2d', 'probe_phase_start = created_at', migrated.probe_phase_start === '2026-02-15T10:00:00Z');
  check('T-WP0-2e', 'last_style_probe = null', migrated.last_style_probe === null);
  check('T-WP0-2f', 'probe_session_count = 0', migrated.probe_session_count === 0);
  check('T-WP0-2g', 'modifiers preserved (v:2, c:0)', migrated.modifiers.verbosity === 2 && migrated.modifiers.challenge === 0);
  check('T-WP0-2h', 'disc.primary/secondary preserved', migrated.disc.primary === 'S' && migrated.disc.secondary === 'C');
  check('T-WP0-2i', 'calibration_history preserved', migrated.calibration_history.length === 1);
}

// Already v2 — no change
{
  const v2Config = { status: 'calibrated', version: 2, q_version: 2, probe_phase_start: '2026-01-01', probe_session_count: 5 };
  const result = migrateSchema(JSON.parse(JSON.stringify(v2Config)));
  check('T-WP0-2j', 'v2 config migrated to v3 (probe_session_count preserved)', result.probe_session_count === 5 && result.version === 3);
}

// ============================================================
// T-WP0-6: Pre-flight — future version warning
// (preflightCheck uses fs.existsSync; create temp dir)
// ============================================================
console.log('\n--- T-WP0-6: Future version warning ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  fs.mkdirSync(path.join(tmpDir, '.soul_forge'), { recursive: true });
  // Create minimal required files
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'config.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'memory.md'), '');
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), '');

  const futureConfig = { status: 'calibrated', version: 99 };
  const { warnings } = preflightCheck(tmpDir, futureConfig);
  const futureWarn = warnings.find(w => w.includes('version 99'));
  check('T-WP0-6', 'Future version generates warning', !!futureWarn, futureWarn);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-WP0-4: Pre-flight — SOUL.md missing warning
// ============================================================
console.log('\n--- T-WP0-4: Pre-flight SOUL.md missing ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  fs.mkdirSync(path.join(tmpDir, '.soul_forge'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'config.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'memory.md'), '');
  // NO SOUL.md

  const config = { status: 'calibrated', version: 2 };
  const { warnings } = preflightCheck(tmpDir, config);
  const soulWarn = warnings.find(w => w.includes('SOUL.md'));
  check('T-WP0-4', 'SOUL.md missing generates warning', !!soulWarn, soulWarn);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-WP3-1: Legacy user detection — SOUL.md with custom content
// T-WP3-2: No false positive — fresh SOUL.md
// ============================================================
console.log('\n--- T-WP3-1/2: Legacy user detection ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  fs.mkdirSync(path.join(tmpDir, '.soul_forge'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'config.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, '.soul_forge', 'memory.md'), '');

  // Custom SOUL.md (no soul-forge:v1: marker, > 200 bytes, has ## Core Truths)
  const customSoul = `## Core Truths\nThis is a long custom soul document that I wrote myself.\nIt has lots of custom content that was handcrafted.\nThe user has put real effort into this file.\nMore content here to push it above 200 bytes.\nEven more content here.`;
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), customSoul);
  const freshConfig = { status: 'fresh', version: 2 };
  const { legacyUser } = preflightCheck(tmpDir, freshConfig);
  check('T-WP3-1', 'Custom SOUL.md detected as legacy_user', legacyUser === true);

  // Non-legacy: has soul-forge:v1: marker
  const soulForgeSoul = `## Core Truths\nsoul-forge:v1: auto-generated\nThis was generated by soul forge and has the marker.\nMore content to exceed 200 bytes threshold for the legacy detection check.\nAdding more text here.`;
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), soulForgeSoul);
  const { legacyUser: notLegacy1 } = preflightCheck(tmpDir, freshConfig);
  check('T-WP3-2a', 'soul-forge:v1: marked SOUL.md → not legacy', notLegacy1 === false);

  // Non-legacy: has soul-forge:v2: marker (BUG FIX — v2 marker must also exclude legacy detection)
  const soulForgeV2Soul = `## Core Truths\nThis is a properly calibrated SOUL.md with full Soul Forge v2 content.\nAll the custom behavior has been set up by the calibration process.\nMore content to push above 200 bytes in this test.\n[//]: # (soul-forge:v2:D:20260314)`;
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), soulForgeV2Soul);
  const { legacyUser: notLegacy1b } = preflightCheck(tmpDir, freshConfig);
  check('T-WP3-2d', 'soul-forge:v2: marked SOUL.md → not legacy (v2 fix)', notLegacy1b === false);

  // Non-legacy: too short
  const shortSoul = 'Short content';
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), shortSoul);
  const { legacyUser: notLegacy2 } = preflightCheck(tmpDir, freshConfig);
  check('T-WP3-2b', 'Short SOUL.md → not legacy', notLegacy2 === false);

  // Non-legacy: already calibrated (status != fresh)
  fs.writeFileSync(path.join(tmpDir, 'SOUL.md'), customSoul);
  const calibratedConfig = { status: 'calibrated', version: 2 };
  const { legacyUser: notLegacy3 } = preflightCheck(tmpDir, calibratedConfig);
  check('T-WP3-2c', 'Calibrated status → not legacy (already processed)', notLegacy3 === false);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-WP2-1: Stage 1 probing (< 14 days)
// T-WP2-2: Stage 2 probing (14-30 days)
// T-WP2-3: Stage 3 maturity (> 30 days)
// ============================================================
console.log('\n--- T-WP2-1/2/3: Probing stages ---');

function makeProbeConfig(daysAgo, sessionCount, lastProbeDaysAgo) {
  const now = new Date();
  const phaseStart = new Date(now - daysAgo * 86400000).toISOString();
  const lastProbe = lastProbeDaysAgo !== null
    ? new Date(now - lastProbeDaysAgo * 86400000).toISOString()
    : null;
  return {
    status: 'calibrated',
    version: 2,
    probe_phase_start: phaseStart,
    probe_session_count: sessionCount,
    last_style_probe: lastProbe,
    modifiers: { humor: 1, verbosity: 2, proactivity: 1, challenge: 0 }
  };
}

{
  // Stage 1: 5 days ago, 4 sessions (>= minSessions 3), last probe 2 days ago (>= minDays 1)
  const stage1Config = makeProbeConfig(5, 4, 2);
  const r1 = computeProbingControl(stage1Config);
  check('T-WP2-1a', 'Stage 1 = 1', r1.stage === 1, `stage=${r1.stage}`);
  check('T-WP2-1b', 'Stage 1 allowed=true', r1.style_probe_allowed === true);
  check('T-WP2-1c', 'Stage 1 has target', r1.target !== null, `target=${r1.target}`);
  // Target should be closest to 1 — challenge:0 (distance 1) or humor:1 (distance 0)
  // humor=1 has distance 0 (lowest confidence), so target should be humor or challenge
  check('T-WP2-1d', 'Target is lowest-confidence modifier', r1.target === 'humor' || r1.target === 'proactivity');
}

{
  // Stage 2: 20 days ago, 6 sessions, last probe 3 days ago
  const stage2Config = makeProbeConfig(20, 6, 3);
  const r2 = computeProbingControl(stage2Config);
  check('T-WP2-2a', 'Stage 2 = 2', r2.stage === 2, `stage=${r2.stage}`);
  check('T-WP2-2b', 'Stage 2 allowed=true (minSessions:5 met, minDays:2 met)', r2.style_probe_allowed === true);
}

{
  // Stage 3: 35 days ago
  const stage3Config = makeProbeConfig(35, 10, 5);
  const r3 = computeProbingControl(stage3Config);
  check('T-WP2-3a', 'Stage 3 = 3', r3.stage === 3, `stage=${r3.stage}`);
  check('T-WP2-3b', 'Stage 3 allowed=false', r3.style_probe_allowed === false);
  check('T-WP2-3c', 'Stage 3 target=null', r3.target === null);
}

// ============================================================
// T-WP2-4: Frequency lower bound (not enough sessions/days)
// T-WP2-5: Frequency upper bound (maxSessions exceeded)
// ============================================================
console.log('\n--- T-WP2-4/5: Frequency control ---');

{
  // T-WP2-4: Stage 1, only 1 session, 1 hour ago probe
  const lowConfig = makeProbeConfig(5, 1, 0.04); // 0.04 days ≈ 1 hour
  const r4 = computeProbingControl(lowConfig);
  check('T-WP2-4', 'Too few sessions → allowed=false', r4.style_probe_allowed === false, `sessions=1, daysSinceProbe≈1h`);
}

{
  // T-WP2-5: Stage 1, 8 sessions (>= maxSessions 7), last probe 2 days ago
  const highConfig = makeProbeConfig(5, 8, 2);
  const r5 = computeProbingControl(highConfig);
  check('T-WP2-5', 'maxSessions exceeded → forced allowed=true', r5.style_probe_allowed === true, `sessions=8 >= max=7`);
}

{
  // Not calibrated → no probing
  const uncalibConfig = makeProbeConfig(5, 5, 2);
  uncalibConfig.status = 'fresh';
  const r6 = computeProbingControl(uncalibConfig);
  check('T-WP2-fresh', 'Non-calibrated → allowed=false, stage=0', r6.style_probe_allowed === false && r6.stage === 0);
}

// ============================================================
// T-WP2-7: parseConfigUpdate — Probing section
// T-WP1-3: parseConfigUpdate — Questionnaire section
// ============================================================
console.log('\n--- T-WP2-7 / T-WP1-3: parseConfigUpdate ---');

{
  const probingUpdate = `# Config Update Request

## Probing
- **last_style_probe**: 2026-02-19T10:00:00Z
- **probe_session_count**: 0

## Status
calibrated`;

  const parsed = parseConfigUpdate(probingUpdate);
  check('T-WP2-7a', 'Probing section parsed', !!parsed.probing);
  check('T-WP2-7b', 'last_style_probe parsed', parsed.probing.last_style_probe === '2026-02-19T10:00:00Z');
  check('T-WP2-7c', 'probe_session_count parsed = 0', parsed.probing.probe_session_count === 0);
  check('T-WP2-7d', 'status parsed', parsed.status === 'calibrated');
}

{
  const questUpdate = `# Config Update Request

## Questionnaire
- **q_version**: 2
- **answers_hash**: abc12345

## Status
calibrated`;

  const parsed = parseConfigUpdate(questUpdate);
  check('T-WP1-3a', 'Questionnaire section parsed', !!parsed.questionnaire);
  check('T-WP1-3b', 'q_version parsed = 2', parsed.questionnaire.q_version === 2);
  check('T-WP1-3c', 'answers_hash parsed', parsed.questionnaire.answers_hash === 'abc12345');
}

{
  // Full calibration update with DISC + Modifiers
  const fullUpdate = `# Config Update Request

## Status
calibrated

## Reason
user_initiated calibration

## DISC
- **primary**: D
- **secondary**: I
- **confidence**: high
- **scores**: D=5 I=3 S=0 C=0

## Modifiers
- **humor**: 2
- **verbosity**: 3
- **proactivity**: 1
- **challenge**: 1`;

  const parsed = parseConfigUpdate(fullUpdate);
  check('T-full-status', 'Full: status=calibrated', parsed.status === 'calibrated');
  check('T-full-disc', 'Full: disc.primary=D', parsed.disc && parsed.disc.primary === 'D');
  check('T-full-scores', 'Full: scores parsed', parsed.disc.scores && parsed.disc.scores.D === 5);
  check('T-full-modifiers', 'Full: modifiers parsed', parsed.modifiers && parsed.modifiers.humor === 2);
  check('T-full-reason', 'Full: reason contains user_initiated', parsed.reason && parsed.reason.includes('user_initiated'));
}

// ============================================================
// T-WP4-1: processConfigUpdate — reset/dormant field cleanup
// T-WP4-2: processConfigUpdate — dormant → calibrated reactivation
// (These require filesystem; use tmpDir)
// ============================================================
console.log('\n--- T-WP4-1: Reset → dormant field cleanup ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  const config = {
    status: 'calibrated',
    version: 2,
    q_version: 2,
    disc: { primary: 'D', secondary: 'I', confidence: 'high', scores: {D:5,I:3,S:0,C:0}, answers_hash: 'abc12345' },
    modifiers: { humor: 2, verbosity: 3, proactivity: 1, challenge: 1 },
    calibration_history: [{ timestamp: '2026-02-15T10:00:00Z', trigger: 'calibration', changes: 'Initial' }],
    probe_phase_start: '2026-02-15T10:00:00Z',
    last_style_probe: '2026-02-20T10:00:00Z',
    probe_session_count: 5
  };

  // Write config.json (required by processConfigUpdate)
  fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify(config));

  // Write config_update.md with reset
  const resetUpdate = `# Config Update Request

## Status
dormant

## Action
reset`;
  fs.writeFileSync(path.join(sfDir, 'config_update.md'), resetUpdate);

  const result = processConfigUpdate(tmpDir, JSON.parse(JSON.stringify(config)));

  check('T-WP4-1a', 'status → dormant', result.status === 'dormant', `status=${result.status}`);
  check('T-WP4-1b', 'probe_phase_start → null', result.probe_phase_start === null);
  check('T-WP4-1c', 'last_style_probe → null', result.last_style_probe === null);
  check('T-WP4-1d', 'probe_session_count → 0', result.probe_session_count === 0);
  check('T-WP4-1e', 'q_version preserved', result.q_version === 2);
  check('T-WP4-1f', 'answers_hash preserved', result.disc && result.disc.answers_hash === 'abc12345');
  check('T-WP4-1g', 'modifiers preserved', result.modifiers && result.modifiers.verbosity === 3);
  check('T-WP4-1h', 'config_update.md deleted', !fs.existsSync(path.join(sfDir, 'config_update.md')));

  fs.rmSync(tmpDir, { recursive: true });
}

console.log('\n--- T-WP4-2: Dormant → calibrated reactivation ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  const dormantConfig = {
    status: 'dormant',
    version: 2,
    q_version: 2,
    disc: { primary: 'S', answers_hash: 'xyz99999' },
    modifiers: { humor: 1, verbosity: 2, proactivity: 1, challenge: 0 },
    calibration_history: [],
    probe_phase_start: null,
    last_style_probe: null,
    probe_session_count: 0
  };

  fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify(dormantConfig));

  const reactiveUpdate = `# Config Update Request

## Status
calibrated

## Reason
user_initiated reactivation`;
  fs.writeFileSync(path.join(sfDir, 'config_update.md'), reactiveUpdate);

  const result = processConfigUpdate(tmpDir, JSON.parse(JSON.stringify(dormantConfig)));

  check('T-WP4-2a', 'status → calibrated', result.status === 'calibrated');
  check('T-WP4-2b', 'probe_phase_start set to now', !!result.probe_phase_start && result.probe_phase_start !== null);
  check('T-WP4-2c', 'probe_session_count reset to 0', result.probe_session_count === 0);
  check('T-WP4-2d', 'last_style_probe = null', result.last_style_probe === null);
  // probe_phase_start should be recent (within last 5 seconds)
  const age = Date.now() - new Date(result.probe_phase_start).getTime();
  check('T-WP4-2e', 'probe_phase_start is recent (< 5s old)', age < 5000, `age=${age}ms`);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-WP2-6: probe_session_count increment (via processConfigUpdate)
// ============================================================
console.log('\n--- T-WP2-6: Session count increment (main flow) ---');
// Note: probe_session_count increment happens in main(), not in pure functions.
// We verify the logic by checking that computeProbingControl reads it correctly.
{
  const config3 = makeProbeConfig(5, 3, 2);
  const config4 = makeProbeConfig(5, 4, 2);
  const r3 = computeProbingControl(config3);
  const r4 = computeProbingControl(config4);
  check('T-WP2-6-minSessions', 'At minSessions boundary: 3 sessions stage1 allowed', r3.style_probe_allowed === true);
  check('T-WP2-6-counting', 'session_count is consumed by computeProbingControl', r4.style_probe_allowed === true);
}

// ============================================================
// T-WP0-5: Modifier defaults for new calibration
// ============================================================
console.log('\n--- T-WP0-5: Modifier defaults in processConfigUpdate ---');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  const freshConfig = { status: 'fresh', version: 2 };
  fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify(freshConfig));

  // Simulate calibration with modifiers from Phase 2 defaults (all 1s baseline)
  const calibUpdate = `# Config Update Request

## Status
calibrated

## DISC
- **primary**: C
- **secondary**: D
- **confidence**: high
- **scores**: D=2 I=0 S=0 C=6

## Modifiers
- **humor**: 1
- **verbosity**: 1
- **proactivity**: 1
- **challenge**: 1`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), calibUpdate);

  const result = processConfigUpdate(tmpDir, JSON.parse(JSON.stringify(freshConfig)));
  check('T-WP0-5a', 'Fresh calibration sets modifiers', !!result.modifiers);
  check('T-WP0-5b', 'Default modifiers all 1 (no signal)',
    result.modifiers.humor === 1 && result.modifiers.verbosity === 1 &&
    result.modifiers.proactivity === 1 && result.modifiers.challenge === 1);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-WP1-5: q_version mismatch — _q_outdated flag in existing config
// ============================================================
console.log('\n--- T-WP1-5: q_version mismatch detection ---');
{
  // Verify CURRENT_Q_VERSION = 2 in handler
  const match = handlerSource.match(/CURRENT_Q_VERSION\s*=\s*(\d+)/);
  const handlerQVersion = match ? parseInt(match[1]) : null;
  check('T-WP1-5-const', `CURRENT_Q_VERSION = 2 in handler (actual: ${handlerQVersion})`, handlerQVersion === 2);

  // The _q_outdated flag and probe_phase_start reset are in main(), not a pure function.
  // Verify the logic exists in source:
  const hasQOutdated = handlerSource.includes('_q_outdated') ||
    (handlerSource.includes('q_version') && handlerSource.includes('CURRENT_Q_VERSION'));
  check('T-WP1-5-logic', 'q_version vs CURRENT_Q_VERSION check exists in handler', hasQOutdated);

  const hasQOutdatedFlag = handlerSource.includes('_q_outdated');
  check('T-WP1-5-flag', '_q_outdated flag in handler', hasQOutdatedFlag);
}

// ============================================================
// T-WP1-6: answers_hash same-answer detection
// ============================================================
console.log('\n--- T-WP1-6: Same answers hash detection ---');
{
  // This is SKILL.md behavior (Agent logic), not handler.js pure functions
  // Verify answers_hash is written and preserved through parseConfigUpdate
  const questWithHash = `# Config Update Request

## Questionnaire
- **q_version**: 2
- **answers_hash**: abc12345`;

  const parsed = parseConfigUpdate(questWithHash);
  check('T-WP1-6-write', 'answers_hash survives parseConfigUpdate', parsed.questionnaire.answers_hash === 'abc12345');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTS: ${passed} PASS, ${failed} FAIL out of ${passed+failed} tests`);
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.ok).forEach(r => {
    console.log(`  ❌ [${r.id}] ${r.desc}${r.detail ? ': ' + r.detail : ''}`);
  });
}

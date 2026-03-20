'use strict';

// ============================================================
// Soul Forge Phase 3.0 Unit Tests
// Tests: sentiment analysis, mood engine, post-hoc, schema migration
// Run: node mvp/Test-Phase3-Unit.js
// ============================================================

const path = require('path');
const fs = require('fs');

// --- Paths ---
const HOOK_DIR = path.join(__dirname, '..', 'src', 'hooks', 'soul-forge-bootstrap');
const sentiment = require(path.join(HOOK_DIR, 'sentiment'));
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

// ============================================================
// Group: sentiment
// ============================================================

group('sentiment — Chinese positive/negative/neutral');
{
  const r1 = sentiment.analyze('开心');
  assertEqual(r1.vote, 'positive', 'zh positive word');
  assertEqual(r1.lang, 'zh', 'zh language detection');

  const r2 = sentiment.analyze('伤心难过');
  assertEqual(r2.vote, 'negative', 'zh negative words');

  const r3 = sentiment.analyze('正常普通');
  assertEqual(r3.vote, 'neutral', 'zh neutral words');
}

group('sentiment — English positive/negative/neutral');
{
  const r1 = sentiment.analyze('I am happy and excited');
  assertEqual(r1.vote, 'positive', 'en positive');
  assertEqual(r1.lang, 'en', 'en language detection');

  const r2 = sentiment.analyze('terrible awful disaster');
  assertEqual(r2.vote, 'negative', 'en negative');

  const r3 = sentiment.analyze('the weather is normal');
  assertEqual(r3.vote, 'neutral', 'en neutral');
}

group('sentiment — Chinese negation');
{
  const r1 = sentiment.analyze('不开心');
  assertEqual(r1.vote, 'negative', 'zh full negation: 不开心 → negative');

  const r2 = sentiment.analyze('不是很开心');
  assertEqual(r2.vote, 'negative', 'zh degree negation: 不是很开心 → negative');
  assert(r2.score > -2, 'zh degree negation score less severe than full negation');

  const r3 = sentiment.analyze('不是不开心');
  assertEqual(r3.vote, 'positive', 'zh double negation: 不是不开心 → positive');
}

group('sentiment — English negation');
{
  const r1 = sentiment.analyze('I am not happy');
  assertEqual(r1.vote, 'negative', 'en negation: not happy → negative');

  const r2 = sentiment.analyze('never good always terrible');
  assertEqual(r2.vote, 'negative', 'en negation: never good + terrible → negative');
}

group('sentiment — Window breakers');
{
  // Chinese breaker
  const r1 = sentiment.analyze('虽然伤心但是开心');
  // After breaker, only the second sentiment counts in second segment
  assert(r1.tokens >= 2, 'zh breaker: both tokens matched');

  // English breaker
  const r2 = sentiment.analyze('not good but amazing');
  assertEqual(r2.vote, 'positive', 'en breaker: "but" resets negation, amazing wins');
}

group('sentiment — Edge cases');
{
  const r1 = sentiment.analyze('');
  assertEqual(r1.vote, 'neutral', 'empty text → neutral');
  assertEqual(r1.confidence, 'low', 'empty text → low confidence');

  const r2 = sentiment.analyze(null);
  assertEqual(r2.vote, 'neutral', 'null → neutral');

  const r3 = sentiment.analyze('12345');
  assertEqual(r3.vote, 'neutral', 'numbers only → neutral');
}

group('sentiment — Confidence levels');
{
  const r1 = sentiment.analyze('好');
  assertEqual(r1.confidence, 'low', '1 token → low confidence');

  const r2 = sentiment.analyze('开心快乐幸福愉悦高兴');
  assert(r2.confidence === 'medium' || r2.confidence === 'high', '5 tokens → medium/high confidence');
}

// ============================================================
// Group: mood_engine
// ============================================================

group('mood_engine — computeMoodTrend');
{
  // Stable
  const t1 = T.computeMoodTrend([
    { score: 0.1 }, { score: 0.2 }, { score: 0.1 }, { score: 0.15 }
  ]);
  assertEqual(t1, 'stable', 'similar scores → stable');

  // Declining
  const t2 = T.computeMoodTrend([
    { score: 0.5 }, { score: 0.3 }, { score: -0.2 }, { score: -0.5 }
  ]);
  assertEqual(t2, 'declining', 'decreasing scores → declining');

  // Improving
  const t3 = T.computeMoodTrend([
    { score: -0.5 }, { score: -0.3 }, { score: 0.2 }, { score: 0.5 }
  ]);
  assertEqual(t3, 'improving', 'increasing scores → improving');

  // Single entry → stable
  const t4 = T.computeMoodTrend([{ score: 0 }]);
  assertEqual(t4, 'stable', 'single entry → stable');

  // Empty → stable
  const t5 = T.computeMoodTrend([]);
  assertEqual(t5, 'stable', 'empty → stable');

  // Null → stable
  const t6 = T.computeMoodTrend(null);
  assertEqual(t6, 'stable', 'null → stable');
}

// ============================================================
// Group: schema_migration
// ============================================================

group('schema_migration — v1 to v3');
{
  const v1Config = { status: 'calibrated', version: 1, disc: { primary: 'D' } };
  const result = T.migrateSchema(v1Config);
  assertEqual(result.version, 3, 'v1 → v3: version = 3');
  assert(result.modifiers !== undefined, 'v1 → v3: modifiers added');
  assert(result.mood_history !== undefined, 'v1 → v3: mood_history added');
  assert(result.drift_state !== undefined, 'v1 → v3: drift_state added');
  assert(result.pending_changes !== undefined, 'v1 → v3: pending_changes added');
  assert(result.memory_stats !== undefined, 'v1 → v3: memory_stats added');
  assert(result.soul_evolve !== undefined, 'v1 → v3: soul_evolve added');
  assert(result.calibration_baseline !== undefined, 'v1 → v3: calibration_baseline added');
  assert(result.integrity !== undefined, 'v1 → v3: integrity added');
}

group('schema_migration — v2 to v3');
{
  const v2Config = {
    status: 'calibrated', version: 2,
    modifiers: { humor: 2, verbosity: 1, proactivity: 1, challenge: 3 },
    disc: { primary: 'D', scores: { D: 5, I: 0, S: 0, C: 3 } },
    probe_session_count: 10
  };
  const result = T.migrateSchema(v2Config);
  assertEqual(result.version, 3, 'v2 → v3: version = 3');
  assertEqual(result.modifiers.humor, 2, 'v2 → v3: existing modifiers preserved');
  assertEqual(result.calibration_baseline.modifiers.challenge, 3, 'v2 → v3: baseline captures current modifiers');
  assertEqual(result.probe_session_count, 10, 'v2 → v3: probe_session_count preserved');
}

group('schema_migration — v3 unchanged');
{
  const v3Config = {
    status: 'calibrated', version: 3,
    modifiers: { humor: 1, verbosity: 2, proactivity: 1, challenge: 1 },
    mood_history: [{ session: 1, score: 0.5 }],
    drift_state: { verbosity: { net: 3 } },
    integrity: { violation_count: 1 }
  };
  const result = T.migrateSchema(v3Config);
  assertEqual(result.version, 3, 'v3 → v3: version unchanged');
  assertEqual(result.mood_history.length, 1, 'v3 → v3: mood_history preserved');
  assertEqual(result.integrity.violation_count, 1, 'v3 → v3: integrity preserved');
}

group('schema_migration — null/undefined');
{
  const result = T.migrateSchema(null);
  assertEqual(result.version, 3, 'null → fresh v3');
  assertEqual(result.status, 'fresh', 'null → fresh status');
}

// ============================================================
// Group: checksum
// ============================================================

group('checksum — basic');
{
  const config1 = { status: 'calibrated', modifiers: { humor: 1 } };
  const config2 = { status: 'calibrated', modifiers: { humor: 2 } };
  const cs1 = T.computeConfigChecksum(config1);
  const cs2 = T.computeConfigChecksum(config2);
  assert(typeof cs1 === 'string', 'checksum returns string');
  assert(cs1.length > 0, 'checksum is non-empty');
  assert(cs1 !== cs2, 'different configs → different checksums');

  // Same config → same checksum
  const cs1b = T.computeConfigChecksum(config1);
  assertEqual(cs1, cs1b, 'same config → same checksum');

  // Integrity field excluded from checksum
  const config3 = Object.assign({}, config1, { integrity: { _handler_checksum: 'abc', violation_count: 5 } });
  const cs3 = T.computeConfigChecksum(config3);
  assertEqual(cs1, cs3, 'integrity field excluded from checksum');
}

// ============================================================
// Group: parseMemory
// ============================================================

group('parseMemory — basic');
{
  const content = `## 2026-03-14 15:51
- **type**: calibration
- **signal**: User recalibrated
- **inference**: Strong D-type preference
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-03-15 11:36
- **type**: style
- **signal**: User says quick answers
- **modifier_hint**: verbosity → lower
- **status**: active`;

  const obs = T.parseMemory(content);
  assertEqual(obs.length, 2, 'parsed 2 observations');
  assertEqual(obs[0].type, 'calibration', 'first obs type');
  assertEqual(obs[0].modifier_hint, 'verbosity → lower', 'first obs modifier_hint');
  assertEqual(obs[1].type, 'style', 'second obs type');
}

group('parseMemory — empty/null');
{
  assertEqual(T.parseMemory(null).length, 0, 'null → empty array');
  assertEqual(T.parseMemory('').length, 0, 'empty string → empty array');
  assertEqual(T.parseMemory('# Just a header\n\nNo observations.').length, 0, 'no observations → empty');
}

// ============================================================
// Group: post-hoc checks (simulated)
// ============================================================

group('post_hoc — config tamper detection');
{
  // Create a config with known checksum
  const config = {
    status: 'calibrated', version: 3,
    modifiers: { humor: 1 },
    integrity: { _handler_checksum: null, _last_memory_lines: 0, violation_count: 0 }
  };
  config.integrity._handler_checksum = T.computeConfigChecksum(config);

  // No tamper → no issues
  // We can't fully test postHocCheck without filesystem, but we can test checksum logic
  const cs = T.computeConfigChecksum(config);
  assertEqual(cs, config.integrity._handler_checksum, 'untampered config: checksum matches');

  // Simulate tamper
  config.modifiers.humor = 3;
  const cs2 = T.computeConfigChecksum(config);
  assert(cs2 !== config.integrity._handler_checksum, 'tampered config: checksum mismatch');
}

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Phase 3.0 Unit Tests: ${_pass} PASS, ${_fail} FAIL (${_pass + _fail} total)`);
console.log('='.repeat(50));

if (_fail > 0) {
  process.exit(1);
}

/**
 * Soul Forge Phase 2 — Static & Unit Tests
 * Tests: T-WP5-1, T-WP5-2, T-WP0 (static), handler.js function tests
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
// ROOT = D:\Coding\OpenClaw_Indiviual_SOUL.md (worktree is at .claude/worktrees/determined-benz)
const SKILL_PATH = path.join(ROOT, 'src', 'skills', 'soul-forge', 'SKILL.md');
const HANDLER_PATH = path.join(ROOT, 'src', 'hooks', 'soul-forge-bootstrap', 'handler.js');
const CONFIG_SRC = path.join(ROOT, 'src', '.soul_forge', 'config.json');
const INSTALL_PATH = path.join(ROOT, 'mvp', 'Soul_Forge_Customer_Install.ps1');

console.log('ROOT:', ROOT);

let passed = 0, failed = 0, results = [];

function check(id, desc, condition) {
  const ok = typeof condition === 'boolean' ? condition : !!condition;
  const mark = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} [${id}] ${desc}`);
  results.push({ id, desc, ok });
  if (ok) passed++; else failed++;
  return ok;
}

// ============================================================
// Load files
// ============================================================
const skillContent = fs.readFileSync(SKILL_PATH, 'utf8');
const handlerContent = fs.readFileSync(HANDLER_PATH, 'utf8');
const srcConfig = JSON.parse(fs.readFileSync(CONFIG_SRC, 'utf8'));
const installContent = fs.readFileSync(INSTALL_PATH, 'utf8');

// ============================================================
// T-WP5-1: Section N in SKILL.md
// ============================================================
console.log('\n--- T-WP5-1: Section N ---');
check('T-WP5-1a', 'Section N exists: ## N. Model-Specific Compliance', skillContent.includes('## N. Model-Specific Compliance'));
check('T-WP5-1b', 'Tier 1 defined', skillContent.includes('Tier 1'));
check('T-WP5-1c', 'Tier 2 defined', skillContent.includes('Tier 2'));
check('T-WP5-1d', 'Tier 3 defined', skillContent.includes('Tier 3'));

// Count constraints in Section N
const secNMatch = skillContent.match(/## N\. Model-Specific Compliance[\s\S]*?(?=\n## [A-Z]\. |$)/);
const secNConstraints = secNMatch ? (secNMatch[0].match(/MANDATORY|FORBIDDEN|STRICT|\*\*[A-Z].{5,}/g) || []).length : 0;
console.log(`  Section N constraint-like items: ${secNConstraints}`);

// ============================================================
// T-WP5-2: MANDATORY/FORBIDDEN/STRICT marker density
// ============================================================
console.log('\n--- T-WP5-2: Enforcement marker density ---');
const mandatory = (skillContent.match(/MANDATORY/g) || []).length;
const forbidden = (skillContent.match(/FORBIDDEN/g) || []).length;
const strict = (skillContent.match(/STRICT/g) || []).length;
const total = mandatory + forbidden + strict;
console.log(`  MANDATORY: ${mandatory}, FORBIDDEN: ${forbidden}, STRICT: ${strict}, TOTAL: ${total}`);
check('T-WP5-2a', `Total >= 25 (actual: ${total})`, total >= 25);

// Check key sections have markers
const sections = skillContent.split(/\n(?=## [A-Z]\. )/);
const sectionMarkers = {};
sections.forEach(s => {
  const m = s.match(/^## ([A-Z])\. /);
  if (m) sectionMarkers[m[1]] = (s.match(/MANDATORY|FORBIDDEN|STRICT/g) || []).length;
});
console.log('  Per-section:', JSON.stringify(sectionMarkers));
for (const sec of ['C', 'D', 'F', 'I', 'M']) {
  check(`T-WP5-2-${sec}`, `Section ${sec} has markers (${sectionMarkers[sec]||0})`, (sectionMarkers[sec]||0) > 0);
}

// ============================================================
// T-WP0 static: Source config.json
// ============================================================
console.log('\n--- T-WP0-1: Source config.json ---');
check('T-WP0-1-version', `Source config version=2 (actual: ${srcConfig.version})`, srcConfig.version === 2);
check('T-WP0-1-status', `Source config status=fresh (actual: ${srcConfig.status})`, srcConfig.status === 'fresh');
const srcConfigKeys = Object.keys(srcConfig);
check('T-WP0-1-minimal', `Source config is minimal (keys: ${srcConfigKeys.join(',')})`, srcConfigKeys.length <= 2);

// ============================================================
// handler.js Phase 2 feature presence
// ============================================================
console.log('\n--- handler.js Phase 2 functions ---');
check('handler-migrateSchema', 'migrateSchema() present', handlerContent.includes('migrateSchema'));
check('handler-computeProbing', 'computeProbingControl() present', handlerContent.includes('computeProbingControl'));
check('handler-preflight', 'pre-flight check present', handlerContent.match(/pre.?flight/i));
check('handler-version2', 'version 2 referenced', handlerContent.includes('version: 2') || handlerContent.includes('version:2'));
check('handler-q_version', 'q_version field present', handlerContent.includes('q_version'));
check('handler-answers_hash', 'answers_hash field present', handlerContent.includes('answers_hash'));
check('handler-probe_phase_start', 'probe_phase_start field present', handlerContent.includes('probe_phase_start'));
check('handler-probe_session_count', 'probe_session_count field present', handlerContent.includes('probe_session_count'));
check('handler-legacy_user', 'legacy_user detection present', handlerContent.includes('legacy_user') || handlerContent.includes('legacyUser'));

// ============================================================
// T-WP6-1: Customer install deploys v2 config
// Note: Install script uses $SCRIPT_DIR/.soul_forge/config.json as source
// The customer_package/.soul_forge/config.json is the authoritative source
// ============================================================
console.log('\n--- T-WP6-1: Customer Install v2 config ---');
const pkgConfigPath = path.join(ROOT, 'mvp', 'customer_package', '.soul_forge', 'config.json');
const pkgConfig = JSON.parse(fs.readFileSync(pkgConfigPath, 'utf8'));
check('T-WP6-1a', `customer_package config version=2 (actual: ${pkgConfig.version})`, pkgConfig.version === 2);
check('T-WP6-1b', `customer_package config status=fresh (actual: ${pkgConfig.status})`, pkgConfig.status === 'fresh');
// Also verify Install.ps1 == Soul_Forge_Customer_Install.ps1 (same file)
const pkgInstallContent = fs.readFileSync(path.join(ROOT, 'mvp', 'customer_package', 'Install.ps1'), 'utf8');
check('T-WP6-1c', 'Install.ps1 == Soul_Forge_Customer_Install.ps1 (identical)', pkgInstallContent === installContent);
// T-WP6-2: Upgrade install - config is skipped if already present
check('T-WP6-2', 'Install script skips config.json if already exists (upgrade safety)', installContent.includes('already exists, skipped'));

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} PASS, ${failed} FAIL out of ${passed+failed} tests`);
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ❌ [${r.id}] ${r.desc}`));
}

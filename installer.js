#!/usr/bin/env node
// ============================================================
// Soul Forge Installer — Cross-platform (Windows/macOS/Linux)
// ============================================================
// Usage:
//   npx soul-forge-install           # Normal install
//   npx soul-forge-install --dry-run  # Preview only
//   npx soul-forge-install --upgrade  # Upgrade existing install
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- Config ---
const DRY_RUN = process.argv.includes('--dry-run');
const UPGRADE = process.argv.includes('--upgrade');
const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, '.openclaw');
const WORKSPACE = path.join(CONFIG_DIR, 'workspace');
const SKILL_DIR = path.join(CONFIG_DIR, 'skills', 'soul-forge');
const HOOK_DIR = path.join(CONFIG_DIR, 'hooks', 'soul-forge-bootstrap');
const RUNTIME_DIR = path.join(WORKSPACE, '.soul_forge');
const HISTORY_DIR = path.join(WORKSPACE, '.soul_history');
const SCRIPT_DIR = __dirname;

// --- Color helpers (ANSI) ---
const C = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
};

const completedSteps = [];
const logLines = [];

function log(msg, color) {
  const formatted = color ? color(msg) : msg;
  console.log(formatted);
  logLines.push(`${new Date().toISOString()}  ${msg}`);
}

function safeMkdir(dir) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] Would create: ${dir}`, C.gray);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

function safeCopy(src, dst) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] Would copy: ${path.basename(src)} -> ${dst}`, C.gray);
    return;
  }
  fs.copyFileSync(src, dst);
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function countBytes(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log('');
  log('============================================', C.cyan);
  log('  Soul Forge Installer', C.cyan);
  log('============================================', C.cyan);
  console.log('');

  if (DRY_RUN) log('MODE: DRY-RUN — no files will be written', C.cyan);
  if (UPGRADE) log('MODE: UPGRADE — will overwrite code files, preserve data', C.cyan);

  // --- [0/8] Pre-flight ---
  log('[0/8] Pre-flight checks...', C.yellow);

  if (!dirExists(CONFIG_DIR)) {
    log(`  ERROR: OpenClaw config not found: ${CONFIG_DIR}`, C.red);
    log('  Please install OpenClaw first.', C.red);
    process.exit(1);
  }
  log('  OpenClaw config directory — OK', C.green);

  const requiredFiles = [
    'skills/soul-forge/SKILL.md',
    'hooks/soul-forge-bootstrap/HOOK.md',
    'hooks/soul-forge-bootstrap/handler.js',
    '.soul_forge/config.json',
    '.soul_forge/memory.md',
    '.soul_forge/SOUL_INIT.md',
    '.soul_forge/IDENTITY_INIT.md',
    'HEARTBEAT_SEGMENT.md',
  ];

  const missing = requiredFiles.filter(f => !fileExists(path.join(SCRIPT_DIR, f)));
  if (missing.length > 0) {
    log('  ERROR: Missing source files:', C.red);
    missing.forEach(m => log(`    - ${m}`, C.red));
    process.exit(1);
  }
  log('  All source files found — OK', C.green);

  // --- [1/8] Backup ---
  log('[1/8] Backing up existing files...', C.yellow);
  let backups = 0;

  function backupIfExists(src, dst, label) {
    if (fileExists(src) && !fileExists(dst)) {
      safeMkdir(path.dirname(dst));
      safeCopy(src, dst);
      log(`  ${label} -> ${path.basename(dst)}`, C.gray);
      backups++;
    }
  }

  backupIfExists(
    path.join(WORKSPACE, 'SOUL.md'),
    path.join(HISTORY_DIR, 'SOUL_BEFORE_SOULFORGE.md'),
    'SOUL.md'
  );
  backupIfExists(
    path.join(WORKSPACE, 'IDENTITY.md'),
    path.join(HISTORY_DIR, 'IDENTITY_BEFORE_SOULFORGE.md'),
    'IDENTITY.md'
  );
  backupIfExists(
    path.join(WORKSPACE, 'HEARTBEAT.md'),
    path.join(HISTORY_DIR, 'HEARTBEAT_BEFORE_SOULFORGE.md'),
    'HEARTBEAT.md'
  );
  backupIfExists(
    path.join(CONFIG_DIR, 'openclaw.json'),
    path.join(CONFIG_DIR, 'openclaw.before-soulforge.json'),
    'openclaw.json'
  );

  log(`  Done (${backups} backups).`, C.green);
  completedSteps.push('1-Backup');

  // --- [2/8] Directories ---
  log('[2/8] Creating directory structure...', C.yellow);
  [SKILL_DIR, HOOK_DIR, RUNTIME_DIR, HISTORY_DIR].forEach(d => {
    safeMkdir(d);
    log(`  ${d}`, C.gray);
  });
  log('  Done.', C.green);
  completedSteps.push('2-Directories');

  // --- [3/8] Skill ---
  log('[3/8] Installing skill...', C.yellow);
  safeCopy(
    path.join(SCRIPT_DIR, 'skills', 'soul-forge', 'SKILL.md'),
    path.join(SKILL_DIR, 'SKILL.md')
  );
  log('  SKILL.md installed', C.gray);
  log('  Done.', C.green);
  completedSteps.push('3-Skill');

  // --- [4/8] Hook ---
  log('[4/8] Installing hook...', C.yellow);

  const hookFiles = ['HOOK.md', 'handler.js'];
  // Phase 3 sentiment engine
  if (fileExists(path.join(SCRIPT_DIR, 'hooks', 'soul-forge-bootstrap', 'sentiment.js'))) {
    hookFiles.push('sentiment.js');
  }

  hookFiles.forEach(f => {
    safeCopy(
      path.join(SCRIPT_DIR, 'hooks', 'soul-forge-bootstrap', f),
      path.join(HOOK_DIR, f)
    );
    log(`  ${f} installed`, C.gray);
  });

  // Sentiment dictionaries
  const sentimentsDir = path.join(SCRIPT_DIR, 'hooks', 'soul-forge-bootstrap', 'sentiments');
  if (dirExists(sentimentsDir)) {
    safeMkdir(path.join(HOOK_DIR, 'sentiments'));
    fs.readdirSync(sentimentsDir).filter(f => f.endsWith('.json')).forEach(f => {
      safeCopy(path.join(sentimentsDir, f), path.join(HOOK_DIR, 'sentiments', f));
      log(`  sentiments/${f} installed`, C.gray);
    });
  }

  log('  Done.', C.green);
  completedSteps.push('4-Hook');

  // --- [5/8] Runtime data ---
  log('[5/8] Installing runtime data...', C.yellow);

  // config.json — preserve existing (unless upgrade with --force)
  const cfgDst = path.join(RUNTIME_DIR, 'config.json');
  if (!fileExists(cfgDst) || UPGRADE) {
    if (fileExists(cfgDst) && UPGRADE) {
      // Backup existing config before overwrite
      safeCopy(cfgDst, path.join(RUNTIME_DIR, 'config.json.prev'));
      log('  config.json.prev backup created', C.gray);
    }
    if (!fileExists(cfgDst)) {
      safeCopy(path.join(SCRIPT_DIR, '.soul_forge', 'config.json'), cfgDst);
      log('  config.json installed (new)', C.gray);
    } else {
      log('  config.json preserved (upgrade: schema migration handled by handler.js)', C.yellow);
    }
  } else {
    log('  config.json already exists, skipped', C.yellow);
  }

  // memory.md — never overwrite
  const memDst = path.join(RUNTIME_DIR, 'memory.md');
  if (!fileExists(memDst)) {
    safeCopy(path.join(SCRIPT_DIR, '.soul_forge', 'memory.md'), memDst);
    log('  memory.md installed (new)', C.gray);
  } else {
    log('  memory.md already exists, skipped', C.yellow);
  }

  log('  Done.', C.green);
  completedSteps.push('5-Runtime');

  // --- [6/8] INIT templates ---
  log('[6/8] Installing INIT templates...', C.yellow);

  const initFiles = [
    { src: '.soul_forge/SOUL_INIT.md', dst: path.join(HISTORY_DIR, 'SOUL_INIT.md') },
    { src: '.soul_forge/IDENTITY_INIT.md', dst: path.join(HISTORY_DIR, 'IDENTITY_INIT.md') },
  ];

  initFiles.forEach(({ src, dst }) => {
    if (!fileExists(dst)) {
      safeCopy(path.join(SCRIPT_DIR, src), dst);
      log(`  ${path.basename(dst)} installed`, C.gray);
    } else {
      log(`  ${path.basename(dst)} already exists, skipped`, C.yellow);
    }
  });

  log('  Done.', C.green);
  completedSteps.push('6-INIT');

  // --- [7/8] HEARTBEAT segment ---
  log('[7/8] Installing HEARTBEAT segment...', C.yellow);

  const heartbeatPath = path.join(WORKSPACE, 'HEARTBEAT.md');
  const segmentSrc = path.join(SCRIPT_DIR, 'HEARTBEAT_SEGMENT.md');

  try {
    const segmentContent = fs.readFileSync(segmentSrc, 'utf-8');
    const match = segmentContent.match(/<!-- SOUL_FORGE_START[\s\S]*?SOUL_FORGE_END -->/);

    if (!match) {
      log('  WARNING: Could not extract SOUL_FORGE block', C.red);
    } else if (fileExists(heartbeatPath)) {
      const existing = fs.readFileSync(heartbeatPath, 'utf-8');
      if (existing.includes('SOUL_FORGE_START')) {
        log('  HEARTBEAT.md already contains Soul Forge segment, skipped', C.yellow);
      } else if (!DRY_RUN) {
        fs.appendFileSync(heartbeatPath, '\n' + match[0] + '\n');
        log('  Soul Forge segment appended to HEARTBEAT.md', C.gray);
      } else {
        log('  [DRY-RUN] Would append Soul Forge segment to HEARTBEAT.md', C.gray);
      }
    } else {
      log('  HEARTBEAT.md not found — will be auto-created by handler.js', C.yellow);
    }
  } catch (e) {
    log(`  WARNING: HEARTBEAT processing error: ${e.message}`, C.red);
  }

  log('  Done.', C.green);
  completedSteps.push('7-HEARTBEAT');

  // --- [8/8] Enable hooks + Verify ---
  log('[8/8] Verification + hooks check...', C.yellow);

  const openclawJson = path.join(CONFIG_DIR, 'openclaw.json');

  try {
    let config = {};
    if (fileExists(openclawJson)) {
      config = JSON.parse(fs.readFileSync(openclawJson, 'utf-8'));
    }

    const hooksEnabled = config.hooks?.internal?.enabled === true;

    if (!hooksEnabled) {
      if (!config.hooks) config.hooks = {};
      if (!config.hooks.internal) config.hooks.internal = {};
      config.hooks.internal.enabled = true;

      if (!DRY_RUN) {
        fs.writeFileSync(openclawJson, JSON.stringify(config, null, 2));
      }
      log('  hooks.internal.enabled = true — auto-enabled', C.green);
    } else {
      log('  hooks.internal.enabled = true — OK', C.green);
    }
  } catch (e) {
    log(`  WARNING: Could not update openclaw.json: ${e.message}`, C.yellow);
    log('  Please manually enable hooks in openclaw.json', C.yellow);
  }

  // File verification
  console.log('');
  log('  --- File Verification ---', C.cyan);

  let allOk = true;
  function verify(filepath, label) {
    if (DRY_RUN) {
      log(`  SKIP  ${label} (dry-run)`, C.gray);
      return;
    }
    const size = countBytes(filepath);
    if (size > 0) {
      log(`  OK    ${label} (${size} bytes)`, C.green);
    } else if (fileExists(filepath)) {
      log(`  WARN  ${label} (0 bytes!)`, C.red);
      allOk = false;
    } else {
      log(`  FAIL  ${label} (missing)`, C.red);
      allOk = false;
    }
  }

  verify(path.join(SKILL_DIR, 'SKILL.md'), 'Skill SKILL.md');
  verify(path.join(HOOK_DIR, 'HOOK.md'), 'Hook HOOK.md');
  verify(path.join(HOOK_DIR, 'handler.js'), 'Hook handler.js');
  verify(path.join(RUNTIME_DIR, 'config.json'), 'Runtime config.json');
  verify(path.join(RUNTIME_DIR, 'memory.md'), 'Runtime memory.md');
  verify(path.join(HISTORY_DIR, 'SOUL_INIT.md'), 'INIT SOUL_INIT.md');
  verify(path.join(HISTORY_DIR, 'IDENTITY_INIT.md'), 'INIT IDENTITY_INIT.md');

  // Optional Phase 3 files
  if (fileExists(path.join(HOOK_DIR, 'sentiment.js'))) {
    verify(path.join(HOOK_DIR, 'sentiment.js'), 'Sentiment sentiment.js');
  }
  if (fileExists(path.join(HOOK_DIR, 'sentiments', 'zh.json'))) {
    verify(path.join(HOOK_DIR, 'sentiments', 'zh.json'), 'Sentiment zh.json');
  }
  if (fileExists(path.join(HOOK_DIR, 'sentiments', 'en.json'))) {
    verify(path.join(HOOK_DIR, 'sentiments', 'en.json'), 'Sentiment en.json');
  }

  completedSteps.push('8-Verify');

  // --- Summary ---
  console.log('');
  log('============================================', C.cyan);
  log('  Installation Summary', C.cyan);
  log('============================================', C.cyan);
  log(`  Steps: ${completedSteps.join(', ')}`, C.green);

  if (DRY_RUN) {
    console.log('');
    log('  DRY-RUN complete. No files were modified.', C.cyan);
    log('  Run without --dry-run to install.', C.cyan);
  } else if (allOk) {
    console.log('');
    log('  Installation successful!', C.green);
    console.log('');
    log('  Next steps:', C.cyan);
    log('    1. Restart OpenClaw:', C.gray);
    log('       Docker: docker compose down && docker compose up -d', C.gray);
    log('       Local:  restart the gateway', C.gray);
    log('    2. Check logs for: "loaded 4 internal hook handlers"', C.gray);
    log('    3. Send /soul-forge in Telegram to start calibration', C.gray);
  } else {
    console.log('');
    log('  Installation completed with warnings. Check above.', C.yellow);
  }

  // Save log
  if (!DRY_RUN) {
    try {
      fs.writeFileSync(
        path.join(SCRIPT_DIR, 'install_log.txt'),
        logLines.join('\n') + '\n'
      );
    } catch { /* ignore log write failure */ }
  }

  console.log('');
  process.exit(allOk ? 0 : 1);
}

main();

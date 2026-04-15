'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ============================================================
// Soul Forge Bootstrap Hook — handler.js (CommonJS)
// Runs on agent:bootstrap. Pure Node.js builtins only.
// ============================================================

const CURRENT_SCHEMA_VERSION = 3;
const SOUL_TEMPLATE_VERSION = '2';
const CURRENT_Q_VERSION = 2;
const FRESH_CONFIG = { status: 'fresh', version: 3 };
const MAX_INJECT_BYTES = 6144; // 6KB budget
const MAX_OBSERVATIONS = 20;
const READINESS_THRESHOLD = 5;
const MOOD_HISTORY_MAX = 10; // FIFO mood history size
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// --- Auto-update + Telemetry constants ---
const SOUL_FORGE_VERSION = '3.1.1';
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/BenjaminMeng/soul-forge/main/version.json';
const UPDATE_CHECK_URL_CN = 'https://ecliptica.studio/soul-forge/version.json';
const UPDATE_BASE_URL = 'https://raw.githubusercontent.com/BenjaminMeng/soul-forge/main/';
const UPDATE_BASE_URL_CN = 'https://ecliptica.studio/soul-forge/';
const UPDATE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const TELEMETRY_SALT = 'soul_forge_2026_anon';
const TELEMETRY_ENDPOINT_DEFAULT = 'https://89.117.23.59:9090/api/telemetry';
const TELEMETRY_ENDPOINT_CN = 'https://ecliptica.studio/api/telemetry';
const UMAMI_ENDPOINT = process.env.SOUL_FORGE_UMAMI_ENDPOINT || 'https://89.117.23.59:9090/umami/api/send';
const UMAMI_WEBSITE_ID = '6d51ecbf-df18-4e97-8be5-a0a003907875';

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

function normalizeNewlines(text) {
  return (text || '').replace(/\r\n/g, '\n');
}

function parseMarkdownH2Sections(content) {
  const normalized = normalizeNewlines(content);
  const sections = {};
  const order = [];
  let currentHeading = null;
  let buffer = [];

  for (const line of normalized.split('\n')) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading !== null) {
        sections[currentHeading] = buffer.join('\n').trim();
        order.push(currentHeading);
      }
      currentHeading = headingMatch[1].trim();
      buffer = [];
      continue;
    }

    if (currentHeading !== null) {
      buffer.push(line);
    }
  }

  if (currentHeading !== null) {
    sections[currentHeading] = buffer.join('\n').trim();
    order.push(currentHeading);
  }
  return { sections, order };
}

function cleanSoulSectionBody(body) {
  return normalizeNewlines(body)
    .replace(/\n\[\/\/\]: # \(soul-forge:[^)]+\)\s*$/m, '')
    .replace(/\n---\n\n_This file is yours to evolve[\s\S]*$/m, '')
    .trim();
}

function splitExemplarBlocks(exemplars) {
  const normalized = normalizeNewlines(exemplars).trim();
  if (!normalized) return [];
  return normalized.split(/\n\s*\n(?=User:)/).map(block => block.trim()).filter(Boolean);
}

function getDefaultInsightsTemplate() {
  return [
    '# Soul Forge Insights',
    '',
    '## Interaction Patterns',
    '[//]: # (Purpose: Stable semantic interaction patterns distilled from companion-type memory and used for active bootstrap injection.)',
    '[//]: # (Fields: text=<pattern summary> | weight=<integer strength> | since=<YYYY-MM-DD> | status=active|pending|archived)',
    '',
    '## Relationship Memory',
    '[//]: # (Purpose: Important relationship events and shared context that shape long-term continuity.)',
    '[//]: # (Fields: date=<YYYY-MM-DD> | description=<event summary> | importance=high|medium|low)',
    '',
    '## Behavioral Exemplars',
    '[//]: # (Purpose: Concrete successful interaction examples that can later be promoted into reusable behavior.)',
    '[//]: # (Fields: title=<short label> | status=candidate|verified|archived | source=<memory reference or note>)',
    ''
  ].join('\n');
}

function computeCompanionRulesHash(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return '';
  const str = JSON.stringify(rules.slice().sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function getExpectedSoulFingerprint(config) {
  const modifiers = config && config.modifiers ? config.modifiers : {};
  const humor = modifiers.humor ?? 1;
  const verbosity = modifiers.verbosity ?? 1;
  const proactivity = modifiers.proactivity ?? 1;
  const challenge = modifiers.challenge ?? 1;
  const companionHash = computeCompanionRulesHash(config.companion_rules || []);
  return `soul-forge:v${CURRENT_SCHEMA_VERSION}:t${SOUL_TEMPLATE_VERSION}:${config.disc.primary}:h${humor}-v${verbosity}-p${proactivity}-c${challenge}:cr${companionHash}`;
}

function needsSoulBuild(workspaceDir, config) {
  if (!config || config.status !== 'calibrated') return false;
  if (!config.disc || !config.disc.primary) return false;

  const soulPath = path.join(workspaceDir, 'SOUL.md');
  const content = safeReadFile(soulPath);
  if (!content) return true;

  return !content.includes(getExpectedSoulFingerprint(config));
}

function readExemplars(primaryType) {
  if (!primaryType) return '';
  const templatePath = path.join(TEMPLATES_DIR, `disc-${primaryType}.md`);
  const content = safeReadFile(templatePath);
  if (!content) return '';

  const parts = normalizeNewlines(content).split('\n---EXEMPLARS---\n');
  return parts.length > 1 ? parts[1].trim() : '';
}

function parseIdentityFields(content) {
  const normalized = normalizeNewlines(content);
  const lines = normalized.split('\n');
  const labels = ['Name', 'Creature', 'Vibe', 'Emoji', 'Avatar'];
  const fields = {};

  for (let i = 0; i < lines.length; i++) {
    for (const label of labels) {
      const regex = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.*)$`);
      const match = lines[i].match(regex);
      if (!match) continue;

      let value = (match[1] || '').trim();
      if (!value && i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (next && !next.startsWith('_(') && !next.startsWith('_(workspace-relative')) {
          value = next;
        }
      }
      fields[label] = value;
    }
  }

  return fields;
}

function isFilledIdentityValue(value) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith('_(')) return false;
  if (normalized.includes('pick something you like')) return false;
  if (normalized.includes('workspace-relative path')) return false;
  return true;
}

function buildIdentityDocument(baseContent, identitySection, currentIdentityContent) {
  const base = normalizeNewlines(baseContent);
  const templateFields = parseIdentityFields(identitySection);
  const currentFields = parseIdentityFields(currentIdentityContent);
  const merged = {
    Name: isFilledIdentityValue(currentFields.Name) ? currentFields.Name : (templateFields.Name || '_(pick something you like)_'),
    Creature: isFilledIdentityValue(currentFields.Creature) ? currentFields.Creature : (templateFields.Creature || '_(pick something you like)_'),
    Vibe: isFilledIdentityValue(currentFields.Vibe) ? currentFields.Vibe : (templateFields.Vibe || '_(pick something you like)_'),
    Emoji: isFilledIdentityValue(currentFields.Emoji) ? currentFields.Emoji : (templateFields.Emoji || ''),
    Avatar: isFilledIdentityValue(currentFields.Avatar) ? currentFields.Avatar : (templateFields.Avatar || '_(workspace-relative path, http(s) URL, or data URI)_')
  };

  const headerMatch = base.match(/^[\s\S]*?(?=^- \*\*Name:\*\*)/m);
  const footerMatch = base.match(/\n---\n[\s\S]*$/m);
  const header = headerMatch ? headerMatch[0].trimEnd() : '# IDENTITY.md - Who Am I?\n\n_Fill this in during your first conversation. Make it yours._';
  const footer = footerMatch ? footerMatch[0].trim() : '---\n\nThis is the start of figuring out who you are.';

  return [
    header,
    '',
    `- **Name:** ${merged.Name}`,
    `- **Creature:** ${merged.Creature}`,
    `- **Vibe:** ${merged.Vibe}`,
    `- **Emoji:** ${merged.Emoji}`,
    `- **Avatar:** ${merged.Avatar}`,
    '',
    footer
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function buildBehavioralProtocol(type, selfCheckBody) {
  const checks = normalizeNewlines(selfCheckBody).split('\n').map(line => line.trim()).filter(Boolean);
  const checkLines = checks.length > 0 ? checks : [
    '1. Match the user\'s requested depth.',
    '2. Keep the response internally consistent.',
    '3. Adjust on the next turn if the tone was off.'
  ];

  return [
    '## Behavioral Protocol',
    '',
    '### Observation Rules',
    'Record signals to `.soul_forge/memory.md` (APPEND-ONLY — never overwrite).',
    '',
    '### Observation Format',
    '## YYYY-MM-DD HH:MM',
    '- **type**: companion|relationship|exemplar_candidate|style|emotion|boundary|decision',
    '- **signal**: (exact quote or behavior)',
    '- **inference**: (what it implies)',
    '- **modifier_hint**: (modifier -> direction)',
    '- **status**: active',
    '- **importance**: high|medium|low',
    '',
    `### Self-Check (${type} type — internal only)`,
    'After each response, silently verify:'
  ].concat(checkLines).concat([
    'If 2+ fail, adjust next response. NEVER announce this to the user.',
    '',
    '### Action Signal Definitions',
    '- `soften`: lower challenge, lower humor, increase supportiveness.',
    '- `calibration_ready`: ask whether the user wants that specific adjustment.',
    '- `soul_evolve`: acknowledge the stable preference change and keep it consistent.',
    '',
    '### Scene Adaptation (internal only)',
    '- work -> more detail, less humor',
    '- chat -> more warmth, less challenge',
    '- emotional -> minimize challenge, maximize support'
  ]).join('\n');
}

function buildSoulFiles(workspaceDir, config) {
  const type = config && config.disc ? config.disc.primary : null;
  if (!type) {
    return { ok: false, exemplars: '', warning: 'missing DISC primary type' };
  }

  const templatePath = path.join(TEMPLATES_DIR, `disc-${type}.md`);
  const templateContent = safeReadFile(templatePath);
  if (!templateContent) {
    return { ok: false, exemplars: '', warning: `template not found for DISC type ${type}` };
  }

  const parts = normalizeNewlines(templateContent).split('\n---EXEMPLARS---\n');
  if (parts.length < 2) {
    return { ok: false, exemplars: '', warning: `template parse failed for DISC type ${type}` };
  }

  const templateSections = parseMarkdownH2Sections(parts[0]).sections;
  const exemplars = parts[1].trim();
  const modifiersContent = safeReadFile(path.join(TEMPLATES_DIR, 'modifiers.md'));
  const modifierSections = parseMarkdownH2Sections(modifiersContent).sections;

  const currentSoulPath = path.join(workspaceDir, 'SOUL.md');
  const currentIdentityPath = path.join(workspaceDir, 'IDENTITY.md');
  const currentSoulContent = safeReadFile(currentSoulPath);
  const currentIdentityContent = safeReadFile(currentIdentityPath);
  const soulBackup = backupSoulMd(workspaceDir);
  const previousIdentityContent = currentIdentityContent;

  const historySoulInit = safeReadFile(path.join(workspaceDir, '.soul_history', 'SOUL_INIT.md'));
  const historyIdentityInit = safeReadFile(path.join(workspaceDir, '.soul_history', 'IDENTITY_INIT.md'));
  const baseSoul = historySoulInit || safeReadFile(path.resolve(__dirname, '..', '..', '.soul_forge', 'SOUL_INIT.md')) || '';
  const baseIdentity = historyIdentityInit || safeReadFile(path.resolve(__dirname, '..', '..', '.soul_forge', 'IDENTITY_INIT.md')) || '';

  const baseSoulSections = parseMarkdownH2Sections(baseSoul).sections;
  const currentSoulSections = parseMarkdownH2Sections(currentSoulContent);
  const managedSections = new Set(['Core Truths', 'Behavioral Protocol', 'Vibe', 'Boundaries', 'Continuity']);
  const continuityBody = cleanSoulSectionBody(
    (currentSoulSections.sections && currentSoulSections.sections.Continuity) ||
    baseSoulSections.Continuity ||
    'Each session, you wake up fresh. These files are your memory.'
  );
  const preservedCustomSections = (currentSoulSections.order || [])
    .filter(heading => !managedSections.has(heading))
    .map(heading => `## ${heading}\n\n${cleanSoulSectionBody(currentSoulSections.sections[heading])}`)
    .filter(Boolean);

  const modifiers = config.modifiers || {};
  const humor = modifiers.humor ?? 1;
  const verbosity = modifiers.verbosity ?? 1;
  const proactivity = modifiers.proactivity ?? 1;
  const challenge = modifiers.challenge ?? 1;
  const modifierVibeBits = [
    modifierSections[`HUMOR_${humor}`],
    modifierSections[`VERBOSITY_${verbosity}`],
    modifierSections[`PROACTIVITY_${proactivity}`],
    modifierSections[`CHALLENGE_${challenge}`]
  ].filter(Boolean);
  const boundaryAddons = [
    templateSections.BOUNDARIES_ADDON,
    modifierSections[`CHALLENGE_RED_LINES_${challenge}`]
  ].filter(Boolean);

  const fingerprint = getExpectedSoulFingerprint(config);
  const soulContent = [
    '# SOUL.md - Who You Are',
    '',
    '_You\'re not a chatbot. You\'re becoming someone._',
    '',
    '## Core Truths',
    '',
    cleanSoulSectionBody(baseSoulSections['Core Truths'] || ''),
    '',
    '**Self-calibrate with restraint.** Notice how the user responds and adjust tone or pacing without turning every exchange into a calibration exercise.',
    '',
    (templateSections.CORE_TRUTHS_ADDON || '').trim(),
    '',
    buildBehavioralProtocol(type, templateSections.SELF_CHECK || ''),
    '',
    '## Vibe',
    '',
    (templateSections.VIBE || cleanSoulSectionBody(baseSoulSections.Vibe || '')).trim(),
    '',
    modifierVibeBits.join('\n\n').trim(),
    '',
    ...(Array.isArray(config.companion_rules) && config.companion_rules.length > 0
      ? ['### Companion Rules', '', config.companion_rules.map(r => `- ${r}`).join('\n')]
      : []),
    '',
    '## Boundaries',
    '',
    cleanSoulSectionBody(baseSoulSections.Boundaries || ''),
    '',
    boundaryAddons.join('\n\n').trim(),
    '',
    '## Continuity',
    '',
    continuityBody.trim(),
    '',
    preservedCustomSections.join('\n\n').trim(),
    '',
    '---',
    '',
    '_This file is yours to evolve. As you learn who you are, update it._',
    '',
    `[//]: # (${fingerprint})`
  ].filter((line, index, array) => !(line === '' && array[index - 1] === '')).join('\n').trim() + '\n';

  const identityContent = buildIdentityDocument(baseIdentity, templateSections.IDENTITY || '', currentIdentityContent || '');

  if (!templateSections.IDENTITY || !templateSections.CORE_TRUTHS_ADDON || !templateSections.VIBE || !templateSections.BOUNDARIES_ADDON || !templateSections.SELF_CHECK) {
    return { ok: false, exemplars: '', warning: `template missing required sections for DISC type ${type}` };
  }

  if (!safeWriteFile(currentIdentityPath, identityContent)) {
    return { ok: false, exemplars: '', warning: 'failed to write IDENTITY.md' };
  }

  if (!safeWriteFile(currentSoulPath, soulContent)) {
    if (previousIdentityContent !== null) safeWriteFile(currentIdentityPath, previousIdentityContent);
    return { ok: false, exemplars: '', warning: 'failed to write SOUL.md' };
  }

  const structureWarnings = [];
  checkSoulMdStructure(workspaceDir, structureWarnings);
  if (structureWarnings.length > 0) {
    if (soulBackup) {
      const backupPath = path.join(workspaceDir, '.soul_history', soulBackup);
      if (fs.existsSync(backupPath)) {
        safeWriteFile(currentSoulPath, safeReadFile(backupPath));
      }
    }
    if (previousIdentityContent !== null) safeWriteFile(currentIdentityPath, previousIdentityContent);
    return { ok: false, exemplars: '', warning: structureWarnings.join(' | ') };
  }

  return { ok: true, exemplars, type };
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

function backupInsightsMd(workspaceDir) {
  const insightsPath = path.join(workspaceDir, '.soul_forge', 'insights.md');
  const historyDir = path.join(workspaceDir, '.soul_history');

  try {
    if (!fs.existsSync(insightsPath)) return null;
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const currentContent = safeReadFile(insightsPath);
    if (currentContent === null) return null;

    const existingBackups = fs.readdirSync(historyDir)
      .filter(file => file.startsWith('insights_') && file.endsWith('.md'))
      .sort()
      .reverse();

    if (existingBackups.length > 0) {
      const latestName = existingBackups[0];
      const latestContent = safeReadFile(path.join(historyDir, latestName));
      if (latestContent === currentContent) {
        return latestName;
      }
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `insights_${ts}.md`;
    const backupPath = path.join(historyDir, backupName);
    fs.copyFileSync(insightsPath, backupPath);
    return backupName;
  } catch {
    return null;
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

// --- Schema migration ---

function ensureCompanionConfigFields(config) {
  if (config.companion_session_count === undefined) config.companion_session_count = 0;
  if (config.companion_last_session_id === undefined) config.companion_last_session_id = null;
  if (config.companion_last_bootstrap_ts === undefined) config.companion_last_bootstrap_ts = 0;
  if (config.companion_bootstrap_count_since_last_extract === undefined) config.companion_bootstrap_count_since_last_extract = 0;
  if (config.companion_extract_threshold === undefined) config.companion_extract_threshold = 3;
  if (!Array.isArray(config.companion_rules)) config.companion_rules = [];
  if (config.companion_rules_hash === undefined) config.companion_rules_hash = '';
  if (config.companion_scene_cooldown === undefined) config.companion_scene_cooldown = 5;
  if (config.companion_last_scene_inject_session === undefined) config.companion_last_scene_inject_session = 0;
  return config;
}

function migrateSchema(config) {
  if (!config) return ensureCompanionConfigFields(Object.assign({}, FRESH_CONFIG));
  if (config.version >= CURRENT_SCHEMA_VERSION) {
    // Phase 3.2: Ensure soul_evolve.pending field exists even on existing v3 configs
    if (config.soul_evolve && !config.soul_evolve.hasOwnProperty('pending')) {
      config.soul_evolve.pending = null;
    }
    // Phase 3.4: Auto-update + telemetry fields (ensure they exist)
    config.soul_forge_version = SOUL_FORGE_VERSION; // always reflect running handler version
    if (config.auto_update === undefined) config.auto_update = true;
    if (!config.last_update_check) config.last_update_check = null;
    if (!config.last_update_applied) config.last_update_applied = null;
    if (config.telemetry_opt_in === undefined) config.telemetry_opt_in = null;
    if (!config.telemetry_anon_id) config.telemetry_anon_id = null;
    if (!config.telemetry_endpoint) config.telemetry_endpoint = TELEMETRY_ENDPOINT_DEFAULT;
    // S6: One-time fix — reset system-default false → null for existing v3 configs
    // anon_id can no longer be used as proxy (S3 generates it unconditionally);
    // version stamp alone is sufficient since telemetry disable only existed since 3.1.0
    if (config.telemetry_opt_in === false &&
        config.soul_forge_version && config.soul_forge_version < '3.1.1') {
      config.telemetry_opt_in = null;
    }
    return ensureCompanionConfigFields(config);
  }

  // v1 → v2 migration
  if (!config.version || config.version < 2) {
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
    if (!config.modifiers) {
      config.modifiers = { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 };
    }
    config.version = 2;
  }

  // v2 → v3 migration
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
        pending: null
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

  // Phase 3.4: Auto-update + telemetry fields
  config.soul_forge_version = SOUL_FORGE_VERSION; // always reflect running handler version
  if (config.auto_update === undefined) config.auto_update = true;
  if (!config.last_update_check) config.last_update_check = null;
  if (!config.last_update_applied) config.last_update_applied = null;
  if (config.telemetry_opt_in === undefined) config.telemetry_opt_in = null;
  if (!config.telemetry_anon_id) config.telemetry_anon_id = null;
  if (!config.telemetry_endpoint) config.telemetry_endpoint = TELEMETRY_ENDPOINT_DEFAULT;

  // S6: One-time fix — reset system-default false → null
  if (config.telemetry_opt_in === false &&
      config.soul_forge_version && config.soul_forge_version < '3.1.1') {
    config.telemetry_opt_in = null;
  }

  return ensureCompanionConfigFields(config);
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

  const insightsPath = path.join(workspaceDir, '.soul_forge', 'insights.md');
  if (!fs.existsSync(insightsPath)) {
    warnings.push('insights.md not found at expected location; created empty template');
    if (!safeWriteFile(insightsPath, getDefaultInsightsTemplate())) {
      warnings.push('insights.md missing and auto-create failed');
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
        if (trimmed) {
          result.telemetry_opt_in = trimmed.toLowerCase() === 'true';
        }
        break;
      case 'value':
        // Generic value section: interpret based on action already parsed
        if (trimmed && result.action === 'telemetry_opt_in') {
          result.telemetry_opt_in = trimmed.toLowerCase() === 'true';
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

    // ── Hard guardrail: Option shuffle detection (Problem 1: options not shuffled) ──
    if (config.disc && config.disc.option_order) {
      const orders = config.disc.option_order.split(',');
      const allSame = orders.length >= 8 && orders.every(o => o === orders[0]);
      if (allSame) {
        config.disc._options_not_shuffled = true;
        appendToErrorLog(workspaceDir, `Option shuffle NOT performed: all ${orders.length} questions used same order "${orders[0]}". Agent should randomize options per question.`);
      } else {
        delete config.disc._options_not_shuffled;
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

    // Handle soul_evolve action (Phase 3.2)
    if (update.action === 'soul_evolve') {
      const modifier = update.soul_evolve_modifier || null;
      const direction = update.soul_evolve_direction || null;
      if (modifier && direction && config.soul_evolve) {
        config.soul_evolve.pending = {
          modifier: modifier,
          direction: direction,
          applied_session: config.probe_session_count || 0,
          validation_window: 10,
          negative_signals: 0,
          backup_file: update.soul_evolve_backup || null
        };
        config.soul_evolve.last_execution = new Date().toISOString();
        if (config.soul_evolve.evolve_count) {
          config.soul_evolve.evolve_count[modifier] = (config.soul_evolve.evolve_count[modifier] || 0) + 1;
        }
      }
    }

    // Handle telemetry opt-in/out (Phase 3.4)
    if (update.telemetry_opt_in !== undefined) {
      config.telemetry_opt_in = update.telemetry_opt_in;
      if (update.telemetry_opt_in && !config.telemetry_anon_id) {
        config.telemetry_anon_id = generateAnonId(config);
      }
    }

    // Handle reset/dormant probe field cleanup
    if (update.status === 'dormant' || update.action === 'reset') {
      config.probe_phase_start = null;
      config.last_style_probe = null;
      config.probe_session_count = 0;
    }

    // Handle initial calibration (fresh → calibrated) or reactivation (dormant → calibrated)
    if ((previousStatus === 'fresh' || previousStatus === 'dormant') && update.status === 'calibrated') {
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

  const recent = moodHistory.slice(-5);
  if (recent.length < 2) return 'stable';

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
    return { moodResult: null, trend: computeMoodTrend(config.mood_history) };
  }

  const sessionCount = config.probe_session_count || 0;
  const entry = {
    session: sessionCount,
    score: moodResult.score,
    raw_score: moodResult.score,
    token_count: moodResult.tokens,
    confidence: moodResult.confidence,
    emotion: moodResult.vote
  };

  if (!config.mood_history) config.mood_history = [];
  config.mood_history.push(entry);

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
      const prevPath = path.join(workspaceDir, '.soul_forge', 'config.json.prev');
      if (fs.existsSync(prevPath)) {
        appendToErrorLog(workspaceDir, 'CONFIG_TAMPERED detected — Agent may have directly written config.json. Logging violation.');
      }
      if (!config.integrity) config.integrity = { violation_count: 0 };
      config.integrity.violation_count = (config.integrity.violation_count || 0) + 1;
    }

    if (issue.type === 'MEMORY_OVERWRITTEN') {
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

  if (!config.integrity) config.integrity = { violation_count: 0 };
  config.integrity._last_memory_lines = lines;
}

// ============================================================
// Phase 3.1 — Unified Context Adjustments
// ============================================================

function computeContextAdjustments(moodResult, trend, config) {
  const adjustments = { verbosity: 0, humor: 0, challenge: 0, proactivity: 0 };

  if (!moodResult) return adjustments;

  if (trend === 'declining' && moodResult.score < -0.2) {
    adjustments.challenge = -1;
    adjustments.humor = -1;
    if (moodResult.score < -0.5) {
      adjustments.proactivity = 1;
    }
  } else if (trend === 'improving' && moodResult.score > 0.3) {
    adjustments.humor = 1;
  }

  for (const key of Object.keys(adjustments)) {
    adjustments[key] = Math.max(-1, Math.min(1, adjustments[key]));
  }

  return adjustments;
}

// ============================================================
// Phase 3.1 — Action Signal Generator
// ============================================================

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
    const hasPendingEvolve = config.soul_evolve && config.soul_evolve.pending;
    if (!hasPendingEvolve) {
      for (const modifier of ['verbosity', 'humor', 'challenge', 'proactivity']) {
        const drift = config.drift_state && config.drift_state[modifier];
        if (!drift) continue;

        const absNet = Math.abs(drift.net);
        if (absNet < maturity.drift_threshold) continue;

        const evolveCount = config.soul_evolve &&
          config.soul_evolve.evolve_count &&
          config.soul_evolve.evolve_count[modifier] || 0;

        if (evolveCount >= 3) {
          signals.push({
            signal: 'RECALIBRATE_SUGGEST',
            data: { modifier, evolve_count: evolveCount, reason: 'evolve_count_exceeded' }
          });
          continue;
        }

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
    }
  }

  // MOOD_SHIFT signal
  if (moodContext && moodContext.moodResult && moodContext.trend === 'declining' && moodContext.moodResult.score < -0.2) {
    signals.push({
      signal: 'MOOD_SHIFT',
      data: { score: moodContext.moodResult.score, trend: moodContext.trend }
    });
  }

  return signals;
}

// ============================================================
// Phase 3.1 — Memory Fingerprint Dedup
// ============================================================

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

    const dateMatch = trimmed.match(/^##\s+(.+?)$/m);
    if (dateMatch) fields._date = dateMatch[1].trim();

    entries.push({ raw: trimmed, fields });
  }
  return entries;
}

function fingerprint(entry) {
  const type = entry.fields.type || 'unknown';

  const directions = [];
  const dirRegex = /(\w+)\s*[→\->]+\s*(raise|lower|maintain|pending|提高|降低|维持)/gi;
  let m;
  const hint = entry.fields.modifier_hint || '';
  while ((m = dirRegex.exec(hint)) !== null) {
    directions.push(`${m[1].toLowerCase()}:${m[2].toLowerCase()}`);
  }
  directions.sort();

  let signal = (entry.fields.signal || '').replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '');
  signal = signal.replace(/\d+/g, '').trim().substring(0, 50);

  return `${type}|${directions.join(',')}|${signal}`;
}

function deduplicateMemory(workspaceDir, config) {
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');
  const content = safeReadFile(memoryPath);
  if (!content) return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };

  const entries = parseMemoryEntries(content);
  if (entries.length < 3) return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };

  const groups = {};
  for (const entry of entries) {
    const fp = fingerprint(entry);
    if (!groups[fp]) groups[fp] = [];
    groups[fp].push(entry);
  }

  let totalDuplicates = 0;
  for (const fp of Object.keys(groups)) {
    if (groups[fp].length > 1) {
      totalDuplicates += groups[fp].length - 1;
    }
  }

  const duplicateRatio = totalDuplicates / entries.length;

  if (duplicateRatio <= 0.5) {
    return { cleaned: false, duplicatesRemoved: 0, backupCreated: false };
  }

  const historyDir = path.join(workspaceDir, '.soul_history');
  let backupCreated = false;
  try {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const datestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(historyDir, `memory_${datestamp}.md`);
    if (!fs.existsSync(backupPath)) {
      safeWriteFile(backupPath, content);
      backupCreated = true;
    }
  } catch {
    // Continue without backup
  }

  const kept = [];
  for (const fp of Object.keys(groups)) {
    const group = groups[fp];
    kept.push(group[group.length - 1]);
  }

  const keptSet = new Set(kept.map(e => e.raw));
  const newSections = [];
  const h1Match = content.match(/^(# .+\n)/);
  if (h1Match) newSections.push(h1Match[1]);

  for (const entry of entries) {
    if (keptSet.has(entry.raw)) {
      newSections.push(entry.raw);
    }
  }

  const newContent = newSections.join('\n\n') + '\n';
  safeWriteFile(memoryPath, newContent);

  const sessionCount = config.probe_session_count || 0;
  if (!config.memory_stats) config.memory_stats = {};
  config.memory_stats.last_dedup_session = sessionCount;
  config.memory_stats.entries_removed = totalDuplicates;
  config.memory_stats.unique_entries = kept.length;

  appendToErrorLog(workspaceDir, `Memory dedup: removed ${totalDuplicates} duplicates (${entries.length} → ${kept.length} entries, ratio was ${(duplicateRatio * 100).toFixed(1)}%)`);

  return { cleaned: true, duplicatesRemoved: totalDuplicates, backupCreated };
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

function parseInsights(content) {
  const parsed = {
    interactionPatterns: [],
    relationshipMemory: [],
    behavioralExemplars: []
  };

  if (!content) return parsed;

  const { sections } = parseMarkdownH2Sections(content);
  const sectionMap = [
    {
      heading: 'Interaction Patterns',
      target: 'interactionPatterns',
      build(fields) {
        if (!fields.text) return null;
        const weight = Number.parseInt(fields.weight, 10);
        return {
          text: fields.text,
          weight: Number.isFinite(weight) ? weight : 0,
          since: fields.since || '',
          status: fields.status || 'active'
        };
      }
    },
    {
      heading: 'Relationship Memory',
      target: 'relationshipMemory',
      build(fields) {
        if (!fields.description) return null;
        return {
          date: fields.date || '',
          description: fields.description,
          importance: fields.importance || 'medium'
        };
      }
    },
    {
      heading: 'Behavioral Exemplars',
      target: 'behavioralExemplars',
      build(fields) {
        if (!fields.title) return null;
        return {
          title: fields.title,
          status: fields.status || 'candidate',
          source: fields.source || ''
        };
      }
    }
  ];

  for (const section of sectionMap) {
    const body = normalizeNewlines(sections[section.heading] || '');
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('- ')) continue;
      if (line.startsWith('[//]:')) continue;

      const fields = {};
      const parts = line.slice(2).split(/\s+\|\s+/);
      for (const part of parts) {
        const separatorIndex = part.indexOf(':');
        if (separatorIndex === -1) continue;
        const key = part.slice(0, separatorIndex).trim().toLowerCase().replace(/-/g, '_');
        const value = part.slice(separatorIndex + 1).trim();
        if (key) fields[key] = value;
      }

      const entry = section.build(fields);
      if (entry) {
        parsed[section.target].push(entry);
      }
    }
  }

  return parsed;
}

// --- A3: Insights lifecycle management ---

function updateInsightWeight(patterns, matchText, delta) {
  for (const entry of patterns) {
    if (entry.text === matchText) {
      entry.weight = Math.max(0, entry.weight + delta);
      return patterns;
    }
  }
  return patterns;
}

function transitionInsightStatus(patterns, companionPhase) {
  const promoteThreshold = companionPhase === 'stable' ? 8 : companionPhase === 'calibration' ? 5 : 3;
  for (const entry of patterns) {
    if (entry.status === 'pending' && entry.weight >= promoteThreshold) {
      entry.status = 'active';
    } else if (entry.status === 'active' && entry.weight <= 0) {
      entry.status = 'archived';
    }
  }
  return patterns;
}

function decayInsightWeights(patterns) {
  for (const entry of patterns) {
    if (entry.status === 'active') {
      entry.weight = Math.max(1, entry.weight - 1);
    } else if (entry.status === 'archived') {
      entry.weight = Math.max(0, entry.weight - 1);
    }
  }
  return patterns;
}

function evictExcessEntries(entries, maxCount) {
  if (entries.length <= maxCount) return entries;
  const sorted = entries.slice().sort((a, b) => {
    const aArchived = a.status === 'archived' ? 1 : 0;
    const bArchived = b.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return bArchived - aArchived; // archived last (evict first)
    return (a.weight || 0) - (b.weight || 0); // lower weight evicted first
  });
  const toRemove = entries.length - maxCount;
  const evictSet = new Set(sorted.slice(0, toRemove));
  return entries.filter(e => !evictSet.has(e));
}

function promoteExemplar(exemplars, title) {
  for (const entry of exemplars) {
    if (entry.title === title && entry.status === 'candidate') {
      entry.status = 'verified';
      return exemplars;
    }
  }
  return exemplars;
}

// --- A4: Time normalization ---

function _formatIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _shiftDate(base, deltaDays) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  return _formatIsoDate(d);
}

function normalizeRelativeDates(text, entryDate) {
  if (!text || !entryDate) return text;
  const ref = entryDate instanceof Date ? entryDate : new Date(entryDate);
  return text
    .replace(/\b(\d+)\s+weeks?\s+ago\b/gi, (_, n) => _shiftDate(ref, -parseInt(n, 10) * 7))
    .replace(/\b(\d+)\s+days?\s+ago\b/gi, (_, n) => _shiftDate(ref, -parseInt(n, 10)))
    .replace(/\blast\s+month\b/gi, () => _shiftDate(ref, -30))
    .replace(/\blast\s+week\b/gi, () => _shiftDate(ref, -7))
    .replace(/\byesterday\b/gi, () => _shiftDate(ref, -1))
    .replace(/\btoday\b/gi, () => _formatIsoDate(ref));
}

// --- A5: Companion session counter ---

function getCompanionMaturityPhase(companionSessionCount) {
  if (companionSessionCount < 10) return 'exploration';
  if (companionSessionCount < 30) return 'calibration';
  return 'stable';
}

function updateCompanionSessionCount(config, context) {
  if (context && context.sessionId) {
    if (context.sessionId !== config.companion_last_session_id) {
      config.companion_session_count = (config.companion_session_count || 0) + 1;
      config.companion_last_session_id = context.sessionId;
      config.companion_last_bootstrap_ts = Date.now();
      return true;
    }
  } else {
    const now = Date.now();
    const lastBoot = config.companion_last_bootstrap_ts || 0;
    config.companion_last_bootstrap_ts = now;
    if (now - lastBoot > 30 * 60 * 1000) {
      config.companion_session_count = (config.companion_session_count || 0) + 1;
      return true;
    }
  }
  config.companion_last_bootstrap_ts = Date.now();
  return false;
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
  }

  const alerts = [];
  for (const modifier of Object.keys(nets)) {
    if (!config.drift_state[modifier]) {
      config.drift_state[modifier] = { net: 0, last_alert_session: null, user_declined: false };
    }
    config.drift_state[modifier].net = nets[modifier];

    const absNet = Math.abs(nets[modifier]);
    if (absNet >= maturity.drift_threshold) {
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

  // Gate 3: Direction consistency
  if (config.drift_state && config.drift_state[modifier]) {
    const driftNet = config.drift_state[modifier].net;
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
        actions.push({ type: 'permanent', modifier, from: pending.from, to: pending.to });
        if (!config.change_history) config.change_history = [];
        config.change_history.push({
          modifier, from: pending.from, to: pending.to,
          session: sessionCount, result: 'permanent',
          timestamp: new Date().toISOString()
        });
        delete config.pending_changes[modifier];
      } else {
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

  if (config.change_history && config.change_history.length > 20) {
    config.change_history = config.change_history.slice(-20);
  }

  return actions;
}

// --- Generate injection content ---

function generateInjection(config, observations, readiness, moodContext, actionSignals, sessionExemplars, insightsParsed, sceneTrigger) {
  const lines = [];
  const exemplarBlocks = splitExemplarBlocks(sessionExemplars);

  lines.push('# Soul Forge Calibration Context');
  lines.push('');

  // Language context (hard control for DEF-1b: prevents bilingual follow-up from memory context)
  lines.push('## Language Rule');
  lines.push('User interface language: zh. MANDATORY: Your FIRST response to any /soul-forge trigger or slash command MUST be in English only. Do NOT send a Chinese follow-up or translation in the same trigger. Switch to Chinese only after the user replies in Chinese.');
  lines.push('');

  // === HEAD (high attention) ===

  // Companion Insights (A12: active Interaction Patterns from L2 insights.md) — placed first for U-shape salience
  if (insightsParsed) {
    const activePatterns = (insightsParsed.interactionPatterns || []).filter(p => p.status === 'active');
    if (activePatterns.length > 0) {
      lines.push('## Companion Insights');
      for (const p of activePatterns) {
        lines.push(`MANDATORY: ${p.text}`);
      }
      lines.push('');
    }
  }

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

  // Relationship Highlights (permanent, top 3 high|medium importance entries)
  const relHighlights = (insightsParsed && insightsParsed.relationshipMemory)
    ? insightsParsed.relationshipMemory
        .filter(r => r.importance === 'high' || r.importance === 'medium')
        .sort((a, b) => a.importance === 'high' ? -1 : 1)
        .slice(0, 3)
    : [];
  if (relHighlights.length > 0) {
    lines.push('## Relationship Highlights');
    for (const r of relHighlights) {
      lines.push(`- ${r.date}: ${r.description.slice(0, 100)}`);
    }
    lines.push('');
  }

  // === MIDDLE (low attention) ===

  // Scene-triggered index sections (A12 §1.6: companion_scene_cooldown)
  if (sceneTrigger && insightsParsed) {
    const relMem = (insightsParsed.relationshipMemory || []).filter(r => r.description);
    if (relMem.length > 0) {
      lines.push('## Relationship Memory Index');
      for (const r of relMem.slice(0, 5)) {
        lines.push(`- ${r.date}: ${r.description}`);
      }
      lines.push('');
    }
    const exemplars = (insightsParsed.behavioralExemplars || []).filter(e => e.title && e.status !== 'archived');
    if (exemplars.length > 0) {
      lines.push('## Behavioral Exemplar Index');
      for (const e of exemplars.slice(0, 5)) {
        lines.push(`- [${e.status}] ${e.title}`);
      }
      lines.push('');
    }
  }

  // Context Adjustments (Phase 3: mood-driven)
  if (moodContext && moodContext.moodResult) {
    lines.push('## Context Adjustments');
    const mc = moodContext;
    const moodLabel = mc.moodResult.score > 0.3 ? 'positive' :
                      mc.moodResult.score < -0.3 ? 'negative' : 'neutral';
    lines.push(`mood: ${mc.moodResult.score} (${moodLabel}) | trend: ${mc.trend} | emotion: ${mc.moodResult.vote}`);

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
  lines.push('- **type**: companion|relationship|exemplar_candidate|style|emotion|boundary|decision');
  lines.push('- **signal**: (what you observed)');
  lines.push('- **inference**: (what it implies)');
  lines.push('- **modifier_hint**: (modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)');
  lines.push('- **status**: active');
  lines.push('- **importance**: high|medium|low');
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

  function renderObservationLines(obsList) {
    const observationLines = ['## Recent Observations'];
    if (obsList.length === 0) {
      observationLines.push('No observations recorded yet.');
    } else {
      for (const obs of obsList) {
        const date = obs.date || 'unknown';
        const type = obs.type || '?';
        const signal = obs.signal || '';
        const shortSignal = signal.length > 80 ? signal.substring(0, 77) + '...' : signal;
        observationLines.push(`- ${date}: ${type} / ${shortSignal}`);
      }
    }
    return observationLines;
  }

  // Keep exemplars directly above Recent Observations so budget trimming
  // only removes exemplar content and never swallows control sections.
  if (exemplarBlocks.length > 0) {
    lines.push('## Behavioral Exemplars');
    lines.push('Follow these patterns for your DISC type:');
    for (const block of exemplarBlocks) {
      lines.push(block);
      lines.push('');
    }
  }

  lines.push(...renderObservationLines(recentObs));

  // === TAIL (high attention) ===

  // Action Signals (Phase 3.1, moved to tail for U-shape attention)
  if (actionSignals && actionSignals.length > 0) {
    lines.push('');
    lines.push('## Action Signals');
    for (const sig of actionSignals) {
      const dataStr = Object.entries(sig.data || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      lines.push(`- ${sig.signal}: ${dataStr}`);
    }
  }

  // Pending Changes (Phase 3.1, moved to tail)
  const hasPendingChanges = config.pending_changes && Object.keys(config.pending_changes).length > 0;
  const hasPendingEvolve = config.soul_evolve && config.soul_evolve.pending;
  if (hasPendingChanges || hasPendingEvolve) {
    lines.push('');
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
  }

  let content = lines.join('\n');

  if (Buffer.byteLength(content, 'utf-8') > MAX_INJECT_BYTES && exemplarBlocks.length > 0) {
    for (const count of [2, 1, 0]) {
      const candidateBlocks = exemplarBlocks.slice(0, count);
      const replacement = candidateBlocks.length > 0
        ? ['## Behavioral Exemplars', 'Follow these patterns for your DISC type:', ...candidateBlocks, ''].join('\n')
        : '';
      const candidate = content.replace(/## Behavioral Exemplars[\s\S]*?(?=\n## Recent Observations)/, replacement);
      if (Buffer.byteLength(candidate, 'utf-8') <= MAX_INJECT_BYTES) {
        content = candidate;
        break;
      }
      content = candidate;
    }
  }

  if (Buffer.byteLength(content, 'utf-8') > MAX_INJECT_BYTES) {
    const prefix = content.replace(/\n## Recent Observations[\s\S]*$/m, '').trimEnd();
    const trimCounts = [10, 5, 0];
    for (const count of trimCounts) {
      const trimmedObs = recentObs.slice(-count);
      const observationLines = ['## Recent Observations'];
      if (trimmedObs.length === 0) {
        observationLines.push(`${activeObs.length} observations recorded (summary omitted for space).`);
      } else {
        for (const obs of trimmedObs) {
          const date = obs.date || 'unknown';
          const type = obs.type || '?';
          observationLines.push(`- ${date}: ${type}`);
        }
      }
      content = [prefix, ...observationLines].join('\n');
      if (Buffer.byteLength(content, 'utf-8') <= MAX_INJECT_BYTES) break;
    }
  }

  if (Buffer.byteLength(content, 'utf-8') > MAX_INJECT_BYTES && relHighlights.length > 0) {
    content = content.replace(/## Relationship Highlights\n[\s\S]*?\n\n/, '');
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
    - **type**: companion|relationship|exemplar_candidate|style|emotion|boundary|decision
    - **signal**: (exact quote or behavior observed)
    - **inference**: (what it implies about preferences)
    - **modifier_hint**: (which modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)
    - **status**: active
    - **importance**: high|medium|low
  If ALL neutral → skip silently

- Check the "Calibration Readiness" section in your bootstrap context
  (injected by soul-forge-bootstrap hook, NOT in memory.md).
  If any modifier shows "READY", suggest user run /soul-forge calibrate
  (max once per day). Do NOT read memory.md for counting.
<!-- SOUL_FORGE_END -->`;

const COMPANION_EXTRACT_SEGMENT = `<!-- SOUL_FORGE_COMPANION_EXTRACT_START -->
## Soul Forge: Companion Signal Extraction
Focus on COMPANION signals (not task signals):
1. Interaction Pattern: reply length, emoji usage, language switching
2. Emotional Response Preference: does user want humor, empathy, or space when stressed?
3. Relationship Events: personal sharing, vulnerability, trust moments, corrections
4. Successful Interactions: user reacted positively -- mark as exemplar_candidate

Append to .soul_forge/memory.md. Use ABSOLUTE dates (YYYY-MM-DD HH:MM) only.
Use EXACTLY this format:
## YYYY-MM-DD HH:MM
- **type**: companion|relationship|exemplar_candidate
- **signal**: (exact quote or behavior observed)
- **inference**: (what it implies about what the user likes)
- **modifier_hint**: (optional: verbosity->lower, humor->higher, pacing->rapid, emoji->moderate, formality->casual)
- **status**: active
- **importance**: high|medium|low
<!-- SOUL_FORGE_COMPANION_EXTRACT_END -->`;

// ============================================================
// Phase 3.3: Telemetry export
// ============================================================

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

  if (config.drift_state) {
    for (const [mod, state] of Object.entries(config.drift_state)) {
      telemetry.drift[mod] = { net: state.net || 0 };
    }
  }

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

  const telemetryPath = path.join(workspaceDir, '.soul_forge', 'telemetry.json');
  safeWriteFile(telemetryPath, JSON.stringify(telemetry, null, 2));

  return telemetry;
}

// ============================================================
// Phase 3.4: Auto-update + Telemetry upload
// ============================================================

function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs || 5000 }, (res) => {
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

  const lastCheck = config.last_update_check ? new Date(config.last_update_check).getTime() : 0;
  if (Date.now() - lastCheck < UPDATE_COOLDOWN_MS) return Promise.resolve(null);

  return httpsGet(UPDATE_CHECK_URL, 3000).catch(() => httpsGet(UPDATE_CHECK_URL_CN, 5000)).then(body => {
    const remote = JSON.parse(body);
    config.last_update_check = new Date().toISOString();

    const localVersion = config.soul_forge_version || SOUL_FORGE_VERSION;
    if (compareVersions(remote.version, localVersion) <= 0) {
      return null;
    }

    const baseUrlPromise = httpsGet(UPDATE_CHECK_URL, 2000)
      .then(() => UPDATE_BASE_URL)
      .catch(() => UPDATE_BASE_URL_CN);

    return baseUrlPromise.then(baseUrl => {
      const fileMap = remote.files || {};
      const downloads = Object.keys(fileMap).map(repoPath => {
        const url = baseUrl + repoPath;
        let targetPath;
        if (repoPath.startsWith('hooks/')) {
          targetPath = path.join(configDir, repoPath);
        } else if (repoPath.startsWith('skills/')) {
          targetPath = path.join(configDir, repoPath);
        } else {
          return Promise.resolve();
        }

        return httpsGet(url, 10000).then(content => {
          const tmpPath = targetPath + '.tmp';
          const dir = path.dirname(targetPath);
          try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
          fs.writeFileSync(tmpPath, content, 'utf-8');
          fs.renameSync(tmpPath, targetPath);
        }).catch(() => {});
      });

      return Promise.all(downloads).then(() => {
        config.soul_forge_version = remote.version;
        config.last_update_applied = new Date().toISOString();
        return remote;
      });
    });
  }).catch(() => {
    config.last_update_check = new Date().toISOString();
    return null;
  });
}

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
      current_score: moodContext ? (moodContext.moodResult ? moodContext.moodResult.score : null) : null,
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

  if (config.drift_state) {
    for (const mod of Object.keys(config.drift_state)) {
      base.drift[mod] = { net: config.drift_state[mod].net || 0 };
    }
  }

  if (config.change_history && Array.isArray(config.change_history)) {
    for (const ch of config.change_history) {
      if (ch.result === 'permanent') base.change_history_summary.permanent++;
      else if (ch.result === 'reverted') base.change_history_summary.reverted++;
    }
  }

  if (config.mood_history && config.mood_history.length > 0) {
    let sum = 0, lowConf = 0;
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

  if (dedupResult) {
    base.memory_dedup = {
      dedup_this_session: dedupResult.duplicatesRemoved > 0,
      entries_removed: dedupResult.duplicatesRemoved || 0
    };
  }

  return base;
}

// --- Mandatory minimal telemetry (unconditional, no opt-in gate, ~100 bytes) ---
function sendMinimalTelemetry(config) {
  if (process.env.SOUL_FORGE_TELEMETRY_DISABLED === '1') return;
  if (!config.telemetry_anon_id) config.telemetry_anon_id = generateAnonId(config);
  const payload = JSON.stringify({
    type: 'minimal',
    anon_id: config.telemetry_anon_id,
    version: config.soul_forge_version || SOUL_FORGE_VERSION,
    status: config.status || 'unknown',
    disc_primary: (config.disc && config.disc.primary) || null,
    session_count: (config.session && config.session.count) || 0,
    language: config.language || 'unknown',
    _generated_at: new Date().toISOString()
  });
  const endpoints = [
    config.telemetry_endpoint || TELEMETRY_ENDPOINT_DEFAULT,
    TELEMETRY_ENDPOINT_CN
  ];
  for (const endpoint of endpoints) {
    if (!endpoint) continue;
    try {
      const url = new URL(endpoint);
      const options = {
        hostname: url.hostname, port: url.port || 443,
        path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 5000, rejectUnauthorized: false
      };
      const req = https.request(options, () => {});
      req.on('error', () => {}); req.on('timeout', () => req.destroy());
      req.end(payload);
      return;
    } catch { continue; }
  }
}

function sendTelemetry(config, telemetryData) {
  if (!config.telemetry_opt_in) return;
  if (process.env.SOUL_FORGE_TELEMETRY_DISABLED === '1') return;

  const endpoints = [
    config.telemetry_endpoint || TELEMETRY_ENDPOINT_DEFAULT,
    TELEMETRY_ENDPOINT_CN
  ];

  for (const endpoint of endpoints) {
    if (!endpoint) continue;
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
        rejectUnauthorized: false
      };

      if (config.telemetry_api_key) {
        options.headers['Authorization'] = 'Bearer ' + config.telemetry_api_key;
      }

      const req = https.request(options, () => {});
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end(payload);
      return;
    } catch {
      continue;
    }
  }
}

// --- Umami funnel event tracking (fire-and-forget, non-blocking) ---

function sendUmamiEvent(eventName, data) {
  if (process.env.SOUL_FORGE_TELEMETRY_DISABLED === '1') return;
  try {
    const payload = JSON.stringify({
      type: 'event',
      payload: {
        website: UMAMI_WEBSITE_ID,
        hostname: 'soul-forge',
        url: '/',
        name: eventName,
        data: data || {}
      }
    });
    const url = new URL(UMAMI_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 5000,
      rejectUnauthorized: false
    };
    const req = https.request(options, () => {});
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
    req.end(payload);
  } catch {
    // fire-and-forget, silent fail
  }
}

// --- A11: distill insights -> companion_rules (L2->L3) ---

function distillToSoul(workspaceDir, config) {
  const insightsPath = path.join(workspaceDir, '.soul_forge', 'insights.md');
  const content = safeReadFile(insightsPath);
  if (!content) return { distilled: 0 };

  const parsed = parseInsights(content);
  const phase = getCompanionMaturityPhase(config.companion_session_count || 0);
  const ruleThreshold = phase === 'stable' ? 5 : phase === 'calibration' ? 4 : 3;

  const newRules = parsed.interactionPatterns
    .filter(p => p.status === 'active' && p.weight >= ruleThreshold)
    .map(p => p.text.trim())
    .filter(Boolean);

  if (newRules.length === 0 && (config.companion_rules || []).length === 0) {
    return { distilled: 0 };
  }

  const merged = Array.from(new Set([...(config.companion_rules || []), ...newRules])).slice(0, 10);
  config.companion_rules = merged;
  config.companion_rules_hash = computeCompanionRulesHash(merged);

  return { distilled: newRules.length, rules: merged };
}

// --- A9: L1->L2 daily consolidation ---

function serializeInsights(parsed) {
  const ip = parsed.interactionPatterns || [];
  const rm = parsed.relationshipMemory || [];
  const be = parsed.behavioralExemplars || [];

  const ipLines = ip
    .filter(e => e.text)
    .map(e => `- text: ${e.text} | weight: ${e.weight} | since: ${e.since} | status: ${e.status}`);
  const rmLines = rm
    .filter(e => e.description)
    .map(e => `- date: ${e.date} | description: ${e.description} | importance: ${e.importance}`);
  const beLines = be
    .filter(e => e.title)
    .map(e => `- title: ${e.title} | status: ${e.status} | source: ${e.source}`);

  const sections = [
    '## Interaction Patterns',
    '[//]: # (Purpose: Stable semantic interaction patterns distilled from companion-type memory and used for active bootstrap injection.)',
    '[//]: # (Fields: text=<pattern summary> | weight=<integer strength> | since=<YYYY-MM-DD> | status=active|pending|archived)',
    ...ipLines,
    '',
    '## Relationship Memory',
    '[//]: # (Purpose: Important relationship events and shared context that shape long-term continuity.)',
    '[//]: # (Fields: date=<YYYY-MM-DD> | description=<event summary> | importance=high|medium|low)',
    ...rmLines,
    '',
    '## Behavioral Exemplars',
    '[//]: # (Purpose: Concrete successful interaction examples that can later be promoted into reusable behavior.)',
    '[//]: # (Fields: title=<short label> | status=candidate|verified|archived | source=<memory reference or note>)',
    ...beLines,
    ''
  ];

  return '# Soul Forge Insights\n\n' + sections.join('\n');
}

function consolidateInsights(workspaceDir, config) {
  const lastConsolidation = (config.memory_stats && config.memory_stats.last_consolidation) ? config.memory_stats.last_consolidation : null;
  const lastTs = lastConsolidation ? new Date(lastConsolidation).getTime() : 0;

  if (Date.now() - lastTs < 24 * 3600 * 1000) {
    return { skipped: true, reason: 'not due' };
  }

  const insightsPath = path.join(workspaceDir, '.soul_forge', 'insights.md');
  const insightsContent = safeReadFile(insightsPath);
  const parsed = insightsContent
    ? parseInsights(insightsContent)
    : { interactionPatterns: [], relationshipMemory: [], behavioralExemplars: [] };

  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');
  const memoryContent = safeReadFile(memoryPath) || '';
  const allEntries = parseMemoryEntries(memoryContent);

  const newEntries = allEntries.filter(e => {
    const f = e.fields || {};
    const eDate = f._date || '';
    return f.status === 'active' &&
      ['companion', 'relationship', 'exemplar_candidate'].includes(f.type) &&
      (!lastConsolidation || eDate > lastConsolidation);
  });

  let companionCount = 0;
  let relCount = 0;
  let exemplarCount = 0;

  for (const entry of newEntries) {
    const f = entry.fields || {};
    const eDate = (f._date || '').slice(0, 10);
    if (f.type === 'companion') {
      const text = (f.inference || f.signal || '').trim().slice(0, 120);
      if (!text) continue;
      const existing = parsed.interactionPatterns.find(p => p.text === text);
      if (existing) {
        updateInsightWeight(parsed.interactionPatterns, text, 1);
      } else {
        parsed.interactionPatterns.push({ text, weight: 1, since: eDate, status: 'pending' });
      }
      companionCount++;
    } else if (f.type === 'relationship') {
      const desc = (f.signal || '').trim();
      if (!desc) continue;
      if (!parsed.relationshipMemory.find(r => r.description === desc)) {
        parsed.relationshipMemory.push({ date: eDate, description: desc, importance: f.importance || 'medium' });
        relCount++;
      }
    } else if (f.type === 'exemplar_candidate') {
      const title = (f.signal || '').trim().slice(0, 80);
      if (!title) continue;
      if (!parsed.behavioralExemplars.find(b => b.title === title)) {
        parsed.behavioralExemplars.push({ title, status: 'candidate', source: eDate });
        exemplarCount++;
      }
    }
  }

  // Lifecycle
  const phase = getCompanionMaturityPhase(config.companion_session_count || 0);
  transitionInsightStatus(parsed.interactionPatterns, phase);
  decayInsightWeights(parsed.interactionPatterns);
  evictExcessEntries(parsed.interactionPatterns, 50);
  evictExcessEntries(parsed.relationshipMemory, 30);
  evictExcessEntries(parsed.behavioralExemplars, 20);

  safeWriteFile(insightsPath, serializeInsights(parsed));

  if (!config.memory_stats) config.memory_stats = {};
  config.memory_stats.last_consolidation = new Date().toISOString();

  return { consolidated: true, counts: { companion: companionCount, relationship: relCount, exemplar: exemplarCount } };
}

// --- Check/repair HEARTBEAT.md ---

function checkHeartbeat(workspaceDir, includeCompanionExtract, config) {
  const heartbeatPath = path.join(workspaceDir, 'HEARTBEAT.md');
  let content = safeReadFile(heartbeatPath);

  if (content === null) {
    // No HEARTBEAT.md at all — create with segment
    const base = '# HEARTBEAT\n\n' + HEARTBEAT_SEGMENT + '\n';
    const full = includeCompanionExtract ? base.trimEnd() + '\n\n' + COMPANION_EXTRACT_SEGMENT + '\n' : base;
    safeWriteFile(heartbeatPath, full);
    appendToErrorLog(workspaceDir, 'HEARTBEAT.md missing, created with Soul Forge segment');
    return;
  }

  // Ensure main segment is present
  if (!content.includes('SOUL_FORGE_START')) {
    content = content.trimEnd() + '\n\n' + HEARTBEAT_SEGMENT + '\n';
    appendToErrorLog(workspaceDir, 'HEARTBEAT.md Soul Forge segment missing, appended');
  }

  // Manage companion extract segment
  // Keep segment present for at least 25 min after injection so scheduled heartbeat (30m) can process it
  const hasExtract = content.includes('SOUL_FORGE_COMPANION_EXTRACT_START');
  const injectedAt = config && config.companion_extract_injected_at ? config.companion_extract_injected_at : 0;
  const extractAge = Date.now() - injectedAt;
  const extractExpired = extractAge > 25 * 60 * 1000;
  if (includeCompanionExtract && !hasExtract) {
    content = content.trimEnd() + '\n\n' + COMPANION_EXTRACT_SEGMENT + '\n';
  } else if (!includeCompanionExtract && hasExtract && extractExpired) {
    content = content.replace(/\n?<!-- SOUL_FORGE_COMPANION_EXTRACT_START -->[\s\S]*?<!-- SOUL_FORGE_COMPANION_EXTRACT_END -->\n?/g, '');
  }

  safeWriteFile(heartbeatPath, content);
}

// --- Check SOUL.md structure ---

function checkSoulMdStructure(workspaceDir, injectionWarnings) {
  const soulPath = path.join(workspaceDir, 'SOUL.md');
  const content = safeReadFile(soulPath);

  if (!content) return; // No SOUL.md — nothing to check

  const requiredSections = ['## Core Truths', '## Behavioral Protocol', '## Vibe', '## Boundaries', '## Continuity'];
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

  if (elapsed < window) {
    let negativeCount = 0;
    for (const obs of observations) {
      const hint = obs.modifier_hint || '';
      if (!hint.includes(pending.modifier)) continue;

      const isRaise = hint.includes('raise');
      const isLower = hint.includes('lower');
      if (pending.direction === 'raise' && isLower) negativeCount++;
      if (pending.direction === 'lower' && isRaise) negativeCount++;
    }

    pending.negative_signals = negativeCount;

    if (negativeCount >= 2) {
      return rollbackSoulEvolve(config, workspaceDir, pending, 'negative_signals');
    }

    return { action: 'validating', elapsed, window, negative_signals: negativeCount };
  }

  if (pending.negative_signals >= 2) {
    return rollbackSoulEvolve(config, workspaceDir, pending, 'negative_signals');
  }

  config.soul_evolve.pending = null;
  return { action: 'promoted', modifier: pending.modifier, direction: pending.direction };
}

function rollbackSoulEvolve(config, workspaceDir, pending, reason) {
  const result = { action: 'rollback', modifier: pending.modifier, reason };

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

  if (config.soul_evolve && config.soul_evolve.evolve_count) {
    const count = config.soul_evolve.evolve_count[pending.modifier] || 0;
    if (count > 0) {
      config.soul_evolve.evolve_count[pending.modifier] = count - 1;
    }
  }

  config.soul_evolve.pending = null;

  appendToErrorLog(workspaceDir, `SOUL_EVOLVE rollback: ${pending.modifier} (${reason})`);

  return result;
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
  console.log('[SF-DEBUG] bootstrap context keys:', JSON.stringify(Object.keys(context || {})));
  if (!context) return;

  const workspaceDir = context.workspaceDir;
  if (!workspaceDir) return;

  if (!context.bootstrapFiles) {
    context.bootstrapFiles = [];
  }

  const configPath = path.join(workspaceDir, '.soul_forge', 'config.json');
  const memoryPath = path.join(workspaceDir, '.soul_forge', 'memory.md');

  // --- Step 1: Backup config ---
  backupConfig(workspaceDir);
  backupInsightsMd(workspaceDir);

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

  // Phase 3: Post-hoc integrity check — must run on unmodified config (before processConfigUpdate)
  // Stored in a variable here; results are applied later in the calibrated branch
  const _earlyIntegrityIssues = postHocCheck(workspaceDir, config);

  // Capture status before processConfigUpdate for funnel event detection
  const _previousStatus = config.status || 'fresh';

  // Process config_update.md first (Phase 3 order: update before migrate)
  config = processConfigUpdate(workspaceDir, config);

  // Umami funnel: detect fresh → calibrated transition (questionnaire + calibration completed)
  if (_previousStatus === 'fresh' && config.status === 'calibrated') {
    const funnelData = { version: SOUL_FORGE_VERSION, language: config.language || 'unknown' };
    sendUmamiEvent('questionnaire_completed', funnelData);
    sendUmamiEvent('calibration_completed', Object.assign({}, funnelData, {
      disc_primary: (config.disc && config.disc.primary) || 'unknown'
    }));
  }

  // Schema migration (v1→v2→v3)
  config = migrateSchema(config);
  safeWriteFile(configPath, JSON.stringify(config, null, 2));

  // Pre-flight Check
  let preflight = preflightCheck(workspaceDir, config);

  // --- Step 1b: Auto-update check (fire-and-forget, non-blocking) ---
  const configDir = path.resolve(workspaceDir, '..');
  checkForUpdates(config, configDir, workspaceDir).catch(() => {});

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
    // Umami funnel: disclose shown to user
    sendUmamiEvent('disclosure_shown', { version: SOUL_FORGE_VERSION, language: config.language || 'unknown' });

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

  // S4: Umami funnel — send disclosure_shown once for upgraded users who haven't been prompted
  if (config.telemetry_opt_in === null && !config._upgrade_disclosed) {
    sendUmamiEvent('disclosure_shown', {
      version: SOUL_FORGE_VERSION,
      language: config.language || 'unknown',
      source: 'upgrade'
    });
    config._upgrade_disclosed = true;  // persisted on next safeWriteFile, won't repeat
  }

  const injectionWarnings = [];

  let sessionExemplars = readExemplars(config.disc && config.disc.primary);
  if (needsSoulBuild(workspaceDir, config)) {
    const buildResult = buildSoulFiles(workspaceDir, config);
    if (buildResult.ok) {
      sessionExemplars = buildResult.exemplars || sessionExemplars;
    } else {
      injectionWarnings.push(`SOUL build: ${buildResult.warning}`);
    }
    preflight = preflightCheck(workspaceDir, config);
  }

  // Include preflight warnings
  if (preflight.warnings.length > 0) {
    injectionWarnings.push(...preflight.warnings);
  }

  // Phase 3: Post-hoc integrity check results (computed before processConfigUpdate, at top of handler)
  const integrityIssues = _earlyIntegrityIssues;

  // Increment probe_session_count for each bootstrap in calibrated state
  config.probe_session_count = (config.probe_session_count || 0) + 1;

  // Companion session counter (Plan §5.1 方案A)
  updateCompanionSessionCount(config, context);

  // A8: soft-skip — track bootstrap count, flag when extraction is due
  config.companion_bootstrap_count_since_last_extract = (config.companion_bootstrap_count_since_last_extract || 0) + 1;
  const _extractionDue = config.companion_bootstrap_count_since_last_extract >= (config.companion_extract_threshold || 3);
  if (_extractionDue) {
    config.companion_bootstrap_count_since_last_extract = 0;
    config.companion_extract_injected_at = Date.now();
  }

  // q_version mismatch check + probe cycle reset
  if (config.q_version && config.q_version < CURRENT_Q_VERSION) {
    config._q_outdated = true;
    config.probe_phase_start = new Date().toISOString();
    config.probe_session_count = 0;
    config.last_style_probe = null;
  } else {
    delete config._q_outdated;
  }
  if (integrityIssues.length > 0) {
    for (const issue of integrityIssues) {
      injectionWarnings.push(`Integrity: ${issue.type} detected and handled.`);
    }
  }

  // Phase 3: Mood engine
  const moodContext = updateMoodHistory(config, workspaceDir);

  // Read memory.md
  const memoryContent = safeReadFile(memoryPath);
  const observations = parseMemory(memoryContent);

  // Phase 3.1: Memory fingerprint dedup
  const dedupResult = deduplicateMemory(workspaceDir, config);
  if (dedupResult.cleaned) {
    injectionWarnings.push(`Memory dedup: removed ${dedupResult.duplicatesRemoved} duplicate entries.`);
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

  // A12: read insights for companion injection
  const insightsRaw = safeReadFile(path.join(workspaceDir, '.soul_forge', 'insights.md'));
  const insightsParsed = insightsRaw ? parseInsights(insightsRaw) : null;
  // Scene trigger: inject index sections when cooldown elapsed
  const _sessionCount = config.companion_session_count || 0;
  const _lastSceneInject = config.companion_last_scene_inject_session || 0;
  const _sceneTrigger = !!insightsParsed && (_sessionCount - _lastSceneInject >= (config.companion_scene_cooldown || 5));
  if (_sceneTrigger) config.companion_last_scene_inject_session = _sessionCount;

  // Generate injection content (with mood context + action signals)
  const injectionContent = generateInjection(config, observationsPost, readiness, moodContext, actionSignals, sessionExemplars, insightsParsed, _sceneTrigger);

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

  // --- Step 4: Check HEARTBEAT.md (A8: pass extraction flag) ---
  // A11: distill insights -> companion_rules (L2->L3)
  distillToSoul(workspaceDir, config);
  // A9: L1->L2 daily consolidation
  consolidateInsights(workspaceDir, config);
  checkHeartbeat(workspaceDir, _extractionDue, config);

  // --- Step 5: Check SOUL.md structure ---
  checkSoulMdStructure(workspaceDir, injectionWarnings);

  // If structure check added warnings after injection was built, update
  if (injectionWarnings.length > 0) {
    let warningSection = '\n\n## Warnings\n';
    for (const w of injectionWarnings) {
      warningSection += `- ${w}\n`;
    }
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

  // --- Step 6b: Upload telemetry (Phase 3.4) ---
  if (!config.telemetry_anon_id) config.telemetry_anon_id = generateAnonId(config);
  sendMinimalTelemetry(config);   // mandatory minimal, always fires (no opt-in gate)
  if (config.telemetry_opt_in) {
    const enhancedData = generateEnhancedTelemetry(config, actionSignals, moodContext, dedupResult);
    sendTelemetry(config, enhancedData);
  }

  // --- Step 7: Save config with integrity checksum ---
  config.updated_at = new Date().toISOString();
  if (!config.integrity) config.integrity = { violation_count: 0 };
  config.integrity._handler_checksum = computeConfigChecksum(config);
  safeWriteFile(configPath, JSON.stringify(config, null, 2));
};

// --- Exports for unit testing ---
module.exports._test = {
  migrateSchema,
  computeConfigChecksum,
  computeMoodTrend,
  parseMemory,
  parseInsights,
  parseConfigUpdate,
  processConfigUpdate,
  computeCalibrationReadiness,
  generateInjection,
  needsSoulBuild,
  buildSoulFiles,
  readExemplars,
  postHocCheck,
  updateMemoryStats,
  backupConfig,
  backupInsightsMd,
  preflightCheck,
  computeProbingControl,
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
  // Phase A: Memory Evolution — A3/A4/A5
  updateInsightWeight,
  // Phase A: Memory Evolution — A10/A11
  getExpectedSoulFingerprint,
  computeCompanionRulesHash,
  distillToSoul,
  // Phase A: Memory Evolution — A8/A9
  serializeInsights,
  consolidateInsights,
  checkHeartbeat,
  COMPANION_EXTRACT_SEGMENT,
  transitionInsightStatus,
  decayInsightWeights,
  evictExcessEntries,
  promoteExemplar,
  normalizeRelativeDates,
  getCompanionMaturityPhase,
  updateCompanionSessionCount,
  // Phase 3.4: Auto-update + Telemetry
  SOUL_FORGE_VERSION,
  compareVersions,
  checkForUpdates,
  generateAnonId,
  generateEnhancedTelemetry,
  sendMinimalTelemetry,
  sendTelemetry
};

/**
 * Soul Forge Questionnaire v2 — Auto Tests
 * Tests questionnaire content, dual-axis scoring, validation parsing, and SKILL.md structure
 *
 * Test coverage:
 * - T-QV2-S: SKILL.md static content checks (8 questions, dual-axis tables, framing)
 * - T-QV2-P: parseConfigUpdate new fields (option_order, validation section, float scores)
 * - T-QV2-V: processConfigUpdate validation confidence adjustment
 * - T-QV2-D: Dual-axis scoring math verification (8:8:8:8 balance)
 * - T-QV2-R: R1 positioning statement present
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(ROOT, 'src', 'skills', 'soul-forge', 'SKILL.md');
const HANDLER_PATH = path.join(ROOT, 'src', 'hooks', 'soul-forge-bootstrap', 'handler.js');
const DESIGN_PATH = path.join(ROOT, 'docs', 'Soul_Forge_Questionnaire_v2_Design.md');

// ============================================================
// Load and eval handler.js functions
// ============================================================
const handlerSource = fs.readFileSync(HANDLER_PATH, 'utf8');
const fnSource = handlerSource
  .replace(/^'use strict';/, '')
  .replace(/const fs = require\('fs'\);/, '')
  .replace(/const path = require\('path'\);/, '')
  .replace(/\/\/ Main handler[\s\S]*$/, '');
eval(fnSource);

const skillContent = fs.readFileSync(SKILL_PATH, 'utf8');

// ============================================================
let passed = 0, failed = 0, results = [];

function check(id, desc, condition, detail) {
  const ok = typeof condition === 'boolean' ? condition : !!condition;
  const mark = ok ? '\u2705 PASS' : '\u274C FAIL';
  const suffix = detail ? `  (${detail})` : '';
  console.log(`${mark} [${id}] ${desc}${suffix}`);
  results.push({ id, desc, ok, detail });
  if (ok) passed++; else failed++;
  return ok;
}

// ============================================================
// T-QV2-S: SKILL.md Static Content Checks
// ============================================================
console.log('\n--- T-QV2-S: SKILL.md Questionnaire v2 Content ---');

// S1: All 8 questions present with correct scene labels
const questionLabels = [
  'Question 1: Deadline',
  'Question 2: Stuck',
  'Question 3: Collaboration',
  'Question 4: Casual Chat',
  'Question 5: Learning',
  'Question 6: Life Choice',
  'Question 7: Under Pressure',
  'Question 8: Good News'
];
for (let i = 0; i < questionLabels.length; i++) {
  check(`T-QV2-S1-${i+1}`, `${questionLabels[i]} present`, skillContent.includes(questionLabels[i]));
}

// S2: Dual-axis table format (Primary/Secondary columns instead of DISC/Modifier Signal)
check('T-QV2-S2a', 'Primary column exists in tables', skillContent.includes('| Primary |'));
check('T-QV2-S2b', 'Secondary column exists in tables', skillContent.includes('| Secondary |'));
check('T-QV2-S2c', 'Old DISC column removed', !skillContent.includes('| DISC |'));
check('T-QV2-S2d', 'Old Modifier Signal column removed', !skillContent.includes('| Modifier Signal |'));

// S3: Framing principle - no "AI assistant" in question stems
const sectionB = skillContent.match(/## B\. DISC Questionnaire[\s\S]*?(?=\n---\n\n## C\.)/);
const sectionBContent = sectionB ? sectionB[0] : '';
check('T-QV2-S3a', 'Section B extracted', sectionBContent.length > 500);
// Check ZH question stems don't mention AI
const zhStems = sectionBContent.match(/\*\*ZH:\*\* .+/g) || [];
const aiMentions = zhStems.filter(s => s.includes('AI') && !s.includes('AI interaction'));
check('T-QV2-S3b', `No "AI" in ZH question stems (found ${aiMentions.length})`, aiMentions.length === 0,
  aiMentions.length > 0 ? aiMentions[0] : 'clean');

// S4: "什么样的人" framing present
const renFraming = (sectionBContent.match(/什么样的人/g) || []).length;
check('T-QV2-S4', `"什么样的人" framing appears >= 6 times (actual: ${renFraming})`, renFraming >= 6);

// S5: Each question has bilingual content (EN + ZH)
const enStems = (sectionBContent.match(/\*\*EN:\*\*/g) || []).length;
const zhStemCount = (sectionBContent.match(/\*\*ZH:\*\*/g) || []).length;
check('T-QV2-S5a', `8 EN stems (actual: ${enStems})`, enStems === 8);
check('T-QV2-S5b', `8 ZH stems (actual: ${zhStemCount})`, zhStemCount === 8);

// S6: Scene distribution: Work 3, Daily 3, Emotion 2
const workScenes = (sectionBContent.match(/\(Work\)/g) || []).length;
const dailyScenes = (sectionBContent.match(/\(Daily\)/g) || []).length;
const emotionScenes = (sectionBContent.match(/\(Emotion\)/g) || []).length;
check('T-QV2-S6a', `Work scenes = 3 (actual: ${workScenes})`, workScenes === 3);
check('T-QV2-S6b', `Daily scenes = 3 (actual: ${dailyScenes})`, dailyScenes === 3);
check('T-QV2-S6c', `Emotion scenes = 2 (actual: ${emotionScenes})`, emotionScenes === 2);

// S7: Positioning statement
check('T-QV2-S7a', 'R1: behavioral style classification statement in Section B',
  sectionBContent.includes('behavioral style classification'));
check('T-QV2-S7b', 'R1: positioning in opening description',
  skillContent.includes('behavioral style classification system'));
check('T-QV2-S7c', 'R1: NOT psychological personality assessment',
  skillContent.includes('NOT a psychological personality assessment'));

// ============================================================
// T-QV2-D: Dual-Axis Scoring Math Verification
// ============================================================
console.log('\n--- T-QV2-D: Dual-Axis Distribution Balance ---');

// Extract all Primary/Secondary mappings from Section B
// Pattern: | X | ... | D+1 | I+0.5 | ...
const axisPattern = /\| [A-D] \|[^|]+\|[^|]+\| ([DISC])\+1 \| ([DISC])\+0\.5 \|/g;
const primaryCounts = { D: 0, I: 0, S: 0, C: 0 };
const secondaryCounts = { D: 0, I: 0, S: 0, C: 0 };
let match;
let totalOptions = 0;

while ((match = axisPattern.exec(sectionBContent)) !== null) {
  primaryCounts[match[1]]++;
  secondaryCounts[match[2]]++;
  totalOptions++;
}

check('T-QV2-D1', `Total options found = 32 (actual: ${totalOptions})`, totalOptions === 32);
check('T-QV2-D2a', `Primary D count = 8 (actual: ${primaryCounts.D})`, primaryCounts.D === 8);
check('T-QV2-D2b', `Primary I count = 8 (actual: ${primaryCounts.I})`, primaryCounts.I === 8);
check('T-QV2-D2c', `Primary S count = 8 (actual: ${primaryCounts.S})`, primaryCounts.S === 8);
check('T-QV2-D2d', `Primary C count = 8 (actual: ${primaryCounts.C})`, primaryCounts.C === 8);
check('T-QV2-D3a', `Secondary D count = 8 (actual: ${secondaryCounts.D})`, secondaryCounts.D === 8);
check('T-QV2-D3b', `Secondary I count = 8 (actual: ${secondaryCounts.I})`, secondaryCounts.I === 8);
check('T-QV2-D3c', `Secondary S count = 8 (actual: ${secondaryCounts.S})`, secondaryCounts.S === 8);
check('T-QV2-D3d', `Secondary C count = 8 (actual: ${secondaryCounts.C})`, secondaryCounts.C === 8);

// D4: Verify no option has primary == secondary
const selfRefPattern = /\| [A-D] \|[^|]+\|[^|]+\| ([DISC])\+1 \| \1\+0\.5 \|/g;
const selfRefs = sectionBContent.match(selfRefPattern) || [];
check('T-QV2-D4', `No primary==secondary (self-reference count: ${selfRefs.length})`, selfRefs.length === 0);

// D5: Score total verification (8 questions x 1.5 = 12.0)
check('T-QV2-D5', 'Section C states total = 12.0', skillContent.includes('Total MUST equal 12.0'));

// ============================================================
// T-QV2-C: Section C Scoring Logic
// ============================================================
console.log('\n--- T-QV2-C: Section C Scoring Logic ---');

const sectionC = skillContent.match(/## C\. Scoring Logic[\s\S]*?(?=\n---\n\n## D\.)/);
const sectionCContent = sectionC ? sectionC[0] : '';

check('T-QV2-C1', 'Dual-axis formula: primary +1, secondary +0.5',
  sectionCContent.includes('Primary axis') && sectionCContent.includes('+1 point') &&
  sectionCContent.includes('Secondary axis') && sectionCContent.includes('+0.5 point'));

check('T-QV2-C2', 'Score range 0-12 documented',
  sectionCContent.includes('0 to 12'));

check('T-QV2-C3', 'Confidence thresholds updated (>= 2.0 = high)',
  sectionCContent.includes('>= 2.0') && sectionCContent.includes('high'));

check('T-QV2-C4', 'Modifiers default to 1,1,1,1 (no questionnaire extraction)',
  sectionCContent.includes('NO LONGER extracted from the questionnaire'));

check('T-QV2-C5', 'Scoring example present and correct',
  sectionCContent.includes('Total = 3.0 + 4.0 + 3.5 + 1.5 = 12.0'));

check('T-QV2-C6', 'Extreme distribution threshold updated to >= 10.0',
  sectionCContent.includes('>= 10.0'));

// ============================================================
// T-QV2-H: Section H Removed (Plan D — confidence from distribution only)
// ============================================================
console.log('\n--- T-QV2-H: Section H Removed ---');

check('T-QV2-H1', 'Section H (Reverse Validation) removed from SKILL.md',
  !skillContent.includes('## H. Post-Install Reverse Validation'));

check('T-QV2-H2', 'No reverse validation references in SKILL.md',
  !skillContent.includes('reverse validation question asked'));

check('T-QV2-H3', 'Section G does not reference Section H',
  !skillContent.includes('proceed to Section H'));

check('T-QV2-H4', 'Checklist does not mention reverse validation',
  !skillContent.includes('reverse validation'));

check('T-QV2-H5', 'Section G points to Section K after naming',
  skillContent.includes('proceed to Section K'));

// ============================================================
// T-QV2-P: parseConfigUpdate — New Fields
// ============================================================
console.log('\n--- T-QV2-P: parseConfigUpdate New Fields ---');

// P1: option_order parsing
{
  const updateWithOrder = `# Config Update Request

## Questionnaire
- **q_version**: 2
- **answers_hash**: abc12345
- **option_order**: BCDA,ADCB,CABD,DBAC,ABDC,CDBA,BACD,DCAB

## Status
calibrated`;

  const parsed = parseConfigUpdate(updateWithOrder);
  check('T-QV2-P1a', 'option_order parsed', !!parsed.questionnaire && !!parsed.questionnaire.option_order);
  check('T-QV2-P1b', 'option_order value correct',
    parsed.questionnaire.option_order === 'BCDA,ADCB,CABD,DBAC,ABDC,CDBA,BACD,DCAB');
}

// P2: validation section is now silently ignored
{
  const updateWithValidation = `# Config Update Request

## Validation
- **validation_consistent**: true
- **validation_source_q**: 3
- **confidence_adjustment**: none

## Status
calibrated`;

  const parsed = parseConfigUpdate(updateWithValidation);
  check('T-QV2-P2a', 'Validation section silently ignored (no .validation in result)',
    !parsed.validation);
}

// P4: Float scores parsing (dual-axis)
{
  const updateFloat = `# Config Update Request

## DISC
- **primary**: I
- **secondary**: S
- **confidence**: medium
- **scores**: D=3.0 I=4.0 S=3.5 C=1.5

## Status
calibrated`;

  const parsed = parseConfigUpdate(updateFloat);
  check('T-QV2-P4a', 'Float scores parsed: D=3.0', parsed.disc.scores.D === 3.0);
  check('T-QV2-P4b', 'Float scores parsed: I=4.0', parsed.disc.scores.I === 4.0);
  check('T-QV2-P4c', 'Float scores parsed: S=3.5', parsed.disc.scores.S === 3.5);
  check('T-QV2-P4d', 'Float scores parsed: C=1.5', parsed.disc.scores.C === 1.5);
  check('T-QV2-P4e', 'Total = 12.0',
    parsed.disc.scores.D + parsed.disc.scores.I + parsed.disc.scores.S + parsed.disc.scores.C === 12.0);
}

// P5: Integer scores still work (backward compat)
{
  const updateInt = `# Config Update Request

## DISC
- **scores**: D=5 I=3 S=0 C=0

## Status
calibrated`;

  const parsed = parseConfigUpdate(updateInt);
  check('T-QV2-P5', 'Integer scores still parse correctly: D=5',
    parsed.disc.scores.D === 5);
}

// ============================================================
// T-QV2-V: Validation removed — confidence from distribution only
// ============================================================
console.log('\n--- T-QV2-V: Validation Removed ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  // Calibration without validation section — should NOT set _validation_pending
  const noValidation = `# Config Update Request

## DISC
- **primary**: D
- **secondary**: I
- **confidence**: high
- **scores**: D=6 I=3 S=2 C=1

## Questionnaire
- **q_version**: 2
- **answers_hash**: abc12345

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), noValidation);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');

  const config = {
    status: 'fresh', version: 2,
    modifiers: { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 }
  };

  const result = processConfigUpdate(tmpDir, JSON.parse(JSON.stringify(config)));
  check('T-QV2-V1', 'Calibration without validation: no _validation_pending flag',
    !result._validation_pending);
  check('T-QV2-V2', 'Calibration without validation: no .validation in config',
    !result.validation);
  check('T-QV2-V3', 'Confidence preserved as-is from DISC section',
    result.disc.confidence === 'high');

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-QV2-O: option_order stored in config
// ============================================================
console.log('\n--- T-QV2-O: option_order in config ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });

  const orderUpdate = `# Config Update Request

## Questionnaire
- **q_version**: 2
- **answers_hash**: def67890
- **option_order**: DCBA,ABCD,BDAC,CADB,DCBA,ABCD,BDAC,CADB

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), orderUpdate);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');

  const config = {
    status: 'fresh', version: 2,
    modifiers: { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 }
  };

  const result = processConfigUpdate(tmpDir, JSON.parse(JSON.stringify(config)));
  check('T-QV2-O1', 'option_order stored in config.disc',
    result.disc && result.disc.option_order === 'DCBA,ABCD,BDAC,CADB,DCBA,ABCD,BDAC,CADB');
  check('T-QV2-O2', 'answers_hash stored alongside',
    result.disc && result.disc.answers_hash === 'def67890');
  check('T-QV2-O3', 'q_version updated',
    result.q_version === 2);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-QV2-F: Config template in Section F
// ============================================================
console.log('\n--- T-QV2-F: Config Template ---');

check('T-QV2-F1', 'config_update template has option_order field',
  skillContent.includes('option_order'));

check('T-QV2-F2', 'Modifiers in template are defaults (1)',
  skillContent.includes('- **humor**: 1\n- **verbosity**: 1\n- **proactivity**: 1\n- **challenge**: 1'));

// ============================================================
// T-QV2-G: Section G → K flow (Section H removed)
// ============================================================
console.log('\n--- T-QV2-G: Section G→K Flow ---');

const sectionGContent = (skillContent.match(/## G\. Effect Demo[\s\S]*?(?=\n---\n\n## I\.)/)||[''])[0];

check('T-QV2-G1', 'Section G points to Section K (not Section H)',
  sectionGContent.includes('Section K'));

check('T-QV2-G2', 'Section G does NOT reference Section H',
  !sectionGContent.includes('Section H'));

check('T-QV2-G3', 'No MANDATORY H instruction in Section G',
  !sectionGContent.includes('MANDATORY') || !sectionGContent.includes('Section H'));

// ============================================================
// T-QV2-T: Secondary tie-breaking rule (Issue 2 fix)
// ============================================================
console.log('\n--- T-QV2-T: Secondary Tie-Breaking ---');

check('T-QV2-T1', 'Secondary tie-breaking rule exists in Section C',
  sectionCContent.includes('tie for secondary'));

check('T-QV2-T2', 'Secondary tie-breaking priority order specified (I > S > D > C)',
  sectionCContent.includes('I > S > D > C'));

check('T-QV2-T3', 'Fallback for all non-primary types scoring 0',
  sectionCContent.includes('Set secondary to "none"'));

// ============================================================
// T-QV2-W: Show-your-work scoring guardrails (Issue 3 fix)
// ============================================================
console.log('\n--- T-QV2-W: Scoring Guardrails ---');

check('T-QV2-W1', 'Scoring procedure done internally (not shown to user)',
  sectionCContent.includes('do NOT show the full calculation to the user'));

check('T-QV2-W2', 'Step 3 requires writing out each question contribution',
  sectionCContent.includes('Write out each question'));

check('T-QV2-W3', 'Step 4 requires counting primaries with sum=8 check',
  sectionCContent.includes('primary count') && sectionCContent.includes('MUST sum to 8'));

check('T-QV2-W4', 'Step 5 requires counting secondaries with sum=8 check',
  sectionCContent.includes('secondary count') && sectionCContent.includes('MUST sum to 8'));

check('T-QV2-W5', 'Step 6 uses explicit formula (count × 1) + (count × 0.5)',
  sectionCContent.includes('primary count × 1') && sectionCContent.includes('secondary count × 0.5'));

check('T-QV2-W6', 'Steps numbered 1-10 continuously (no duplicate numbers)',
  /\b8\. \*\*Determine primary type\*\*/.test(sectionCContent) &&
  /\b9\. \*\*Determine secondary type\*\*/.test(sectionCContent) &&
  /\b10\. \*\*Extreme distribution check\*\*/.test(sectionCContent));

// ============================================================
// T-QV2-X: Design doc exists
// ============================================================
console.log('\n--- T-QV2-X: Design Document ---');

const designExists = fs.existsSync(DESIGN_PATH);
check('T-QV2-X1', 'Questionnaire v2 design doc exists', designExists);
if (designExists) {
  const designContent = fs.readFileSync(DESIGN_PATH, 'utf8');
  check('T-QV2-X2', 'Design doc has 8 questions', (designContent.match(/### Q[1-8]/g) || []).length === 8);
  check('T-QV2-X3', 'Design doc has rotation pattern table', designContent.includes('Rotation Pattern'));
  check('T-QV2-X4', 'Design doc has scoring rules', designContent.includes('Phase A'));
}

// ============================================================
// T-QV2-HG: Hard guardrail — Score validation (Issue 3)
// ============================================================
console.log('\n--- T-QV2-HG: Hard Guardrail — Score Validation ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-hg-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');

  // Valid scores (sum=12.0)
  const validUpdate = `# Config Update Request

## DISC
- **primary**: D
- **secondary**: C
- **confidence**: high
- **scores**: D=4.5 I=0.5 S=2.5 C=4.5

## Questionnaire
- **q_version**: 2
- **answers_hash**: test1234

## Validation
- **validation_consistent**: true
- **validation_source_q**: 3
- **confidence_adjustment**: none

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), validUpdate);
  const r1 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-HG1', 'Valid scores (12.0): no _scores_invalid flag',
    !r1.disc._scores_invalid);

  // Invalid scores (sum=10.0)
  const invalidUpdate = `# Config Update Request

## DISC
- **primary**: C
- **secondary**: D
- **confidence**: high
- **scores**: D=3.5 I=0 S=2 C=4.5

## Questionnaire
- **q_version**: 2
- **answers_hash**: test5678

## Validation
- **validation_consistent**: true
- **validation_source_q**: 1
- **confidence_adjustment**: none

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), invalidUpdate);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');
  const r2 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-HG2', 'Invalid scores (10.0): _scores_invalid flag set',
    r2.disc._scores_invalid === true);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-QV2-HS: Hard guardrail — Secondary derivation (Issue 2)
// ============================================================
console.log('\n--- T-QV2-HS: Hard Guardrail — Secondary Derivation ---');

{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-hs-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');

  // Agent writes secondary=none but D scores second highest
  const noneUpdate = `# Config Update Request

## DISC
- **primary**: D
- **secondary**: none
- **confidence**: high
- **scores**: D=8.5 I=1.5 S=1.5 C=0.5

## Questionnaire
- **q_version**: 2
- **answers_hash**: test9999

## Validation
- **validation_consistent**: true
- **validation_source_q**: 5
- **confidence_adjustment**: none

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), noneUpdate);
  const r1 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-HS1', 'Agent wrote none but I/S tied at 1.5 → handler picks I (priority I>S>D>C)',
    r1.disc.secondary === 'I');

  // Agent writes wrong secondary
  const wrongUpdate = `# Config Update Request

## DISC
- **primary**: I
- **secondary**: D
- **confidence**: medium
- **scores**: D=2.0 I=5.0 S=1.5 C=3.5

## Questionnaire
- **q_version**: 2
- **answers_hash**: testAAAA

## Validation
- **validation_consistent**: true
- **validation_source_q**: 2
- **confidence_adjustment**: none

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), wrongUpdate);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');
  const r2 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-HS2', 'Agent wrote D but C=3.5 > D=2.0 → handler overrides to C',
    r2.disc.secondary === 'C');

  // All non-primary = 0
  const allZeroUpdate = `# Config Update Request

## DISC
- **primary**: D
- **secondary**: I
- **confidence**: high
- **scores**: D=12.0 I=0 S=0 C=0

## Questionnaire
- **q_version**: 2
- **answers_hash**: testBBBB

## Validation
- **validation_consistent**: true
- **validation_source_q**: 4
- **confidence_adjustment**: none

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), allZeroUpdate);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');
  const r3 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-HS3', 'All non-primary = 0 → secondary = none',
    r3.disc.secondary === 'none');

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-QV2-HI: Hard guardrail — Context injection signals
// ============================================================
console.log('\n--- T-QV2-HI: Hard Guardrail — Context Injection ---');

check('T-QV2-HI1', 'handler.js does NOT inject validation_pending (removed)',
  !handlerSource.includes('_validation_pending'));

check('T-QV2-HI2', 'handler.js injects scores_invalid warning in context',
  handlerSource.includes('_scores_invalid') && handlerSource.includes('Scoring Error Detected'));

// ============================================================
// T-QV2-SH: Option shuffle enforcement
// ============================================================
console.log('\n--- T-QV2-SH: Option Shuffle ---');

check('T-QV2-SH1', 'SKILL.md has MANDATORY shuffle instruction',
  skillContent.includes('MANDATORY — Option Shuffle'));

check('T-QV2-SH2', 'SKILL.md warns same-order is a BUG',
  skillContent.includes('this is a BUG'));

// handler.js shuffle detection
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-sh-'));
  const sfDir = path.join(tmpDir, '.soul_forge');
  fs.mkdirSync(sfDir, { recursive: true });
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');

  // All same order — should flag
  const noShuffle = `# Config Update Request

## DISC
- **primary**: D
- **secondary**: I
- **confidence**: high
- **scores**: D=8.0 I=1.5 S=1.5 C=1.0

## Questionnaire
- **q_version**: 2
- **answers_hash**: testSH01
- **option_order**: ABCD,ABCD,ABCD,ABCD,ABCD,ABCD,ABCD,ABCD

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), noShuffle);
  const r1 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-SH3', 'All-same option_order → _options_not_shuffled = true',
    r1.disc._options_not_shuffled === true);

  // Different orders — should NOT flag
  const shuffled = `# Config Update Request

## DISC
- **primary**: I
- **secondary**: S
- **confidence**: high
- **scores**: D=1.5 I=8.0 S=1.5 C=1.0

## Questionnaire
- **q_version**: 2
- **answers_hash**: testSH02
- **option_order**: BCDA,DCAB,ABDC,CABD,BDCA,ABCD,DCBA,BACD

## Status
calibrated`;

  fs.writeFileSync(path.join(sfDir, 'config_update.md'), shuffled);
  fs.writeFileSync(path.join(sfDir, 'config.json'), '{}');
  const r2 = processConfigUpdate(tmpDir, { status: 'fresh', version: 2 });
  check('T-QV2-SH4', 'Mixed option_order → no _options_not_shuffled flag',
    !r2.disc._options_not_shuffled);

  fs.rmSync(tmpDir, { recursive: true });
}

// ============================================================
// T-QV2-UX: User-facing communication rules
// ============================================================
console.log('\n--- T-QV2-UX: UX Rules ---');

check('T-QV2-UX1', 'SKILL.md has no-internal-thinking rule',
  skillContent.includes('No internal thinking exposed'));

check('T-QV2-UX2', 'SKILL.md has no-calculation-dumps rule',
  skillContent.includes('No calculation dumps'));

check('T-QV2-UX3', 'SKILL.md has backtick-filenames rule',
  skillContent.includes('Backtick all filenames'));

check('T-QV2-UX4', 'SKILL.md scoring says do internally not show to user',
  skillContent.includes('do NOT show the full calculation to the user'));

check('T-QV2-UX5', 'SKILL.md has Step 11 result summary instruction',
  skillContent.includes('Show result summary to user'));

check('T-QV2-UX6', 'SKILL.md has official website placeholder',
  skillContent.includes('soulforge.example.com'));

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTS: ${passed} PASS, ${failed} FAIL out of ${passed + failed} tests`);
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.ok).forEach(r => console.log(`  - [${r.id}] ${r.desc}`));
}
process.exit(failed > 0 ? 1 : 0);

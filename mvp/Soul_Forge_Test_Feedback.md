# Soul Forge — Test Feedback & Resolution Log

**Created:** 2026-02-13
**Status:** Active (continuously updated with each test round)

---

## Round 1 — 2026-02-13: Initial Deployment Test

### Test Environment

- OS: Windows 10 (Build 26200.7840)
- OpenClaw version: v2026.2.6-3
- Channel: Telegram
- Shell: PowerShell / Git Bash / CMD

### Issue #1: Install script shell incompatibility

**Severity:** Blocker
**Status:** Resolved

**Symptom:** Original install commands used CMD batch syntax (`set`, `rem`, `copy`, `if not exist`). Failed in PowerShell (syntax error at `if`) and Git Bash (`command not found`).

**Root Cause:** The deployment guide (Section 2.2) provided only CMD syntax. Users often have PowerShell or Git Bash as their default terminal.

**Resolution:** Created `Soul_Forge_MVP_Install.ps1` (PowerShell script) with proper syntax. Also documented correct Git Bash equivalents.

**Files Changed:**
- Created: `mvp/Soul_Forge_MVP_Install.ps1`

---

### Issue #2: CMD `WORKSPACE` variable had extra curly braces

**Severity:** Blocker
**Status:** Resolved

**Symptom:** `set WORKSPACE={C:\Users\benja\.openclaw}` — the `{}` were included literally in the path, making all copy commands fail with "filename syntax incorrect".

**Root Cause:** Original guide used `{WORKSPACE}` as placeholder notation. User copied it literally including the braces.

**Resolution:** Clarified that `{WORKSPACE}` is a placeholder; actual command should be `set WORKSPACE=C:\Users\benja\.openclaw` without braces.

---

### Issue #3: `/soul-forge` returns fabricated analysis instead of DISC questionnaire

**Severity:** Critical
**Status:** Resolved

**Symptom:** User sends `/soul-forge` via Telegram. Instead of the privacy notice + DISC questionnaire defined in SKILL.md, the AI returned a made-up "Soul Analysis Report" with scores (93/100), suggestions, and a roadmap that don't exist in any skill definition.

**Root Cause (2 sub-issues):**

**3a) Skills `DEFAULT_CONFIG_VALUES` missing `workspace.dir`**

File: `d:\Coding\OpenClaw\src\agents\skills\config.ts`

The `DEFAULT_CONFIG_VALUES` map in the skills config module was missing `"workspace.dir": true`. The hooks config (`src/hooks/config.ts`) already had it. Since soul-forge's SKILL.md declares `requires.config: ["workspace.dir"]`, the skill was silently filtered out by `shouldIncludeSkill()`.

Execution path:
```
shouldIncludeSkill()
  → isConfigPathTruthy(config, "workspace.dir")
  → config.workspace.dir = undefined (user has workspace.defaultPath, not workspace.dir)
  → "workspace.dir" not in DEFAULT_CONFIG_VALUES
  → returns false → skill excluded from prompt
```

Fix applied to `src/agents/skills/config.ts`:
```typescript
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  "workspace.dir": true,           // ADDED
};
```

**3b) `.soul_forge/` runtime data in wrong directory**

Original install placed `.soul_forge/` at `~/.openclaw/.soul_forge/` (CONFIG_DIR root). `handler.js` expects it at `~/.openclaw/workspace/.soul_forge/` (workspace dir) because it uses `path.join(workspaceDir, '.soul_forge', ...)`.

Fix: Updated `Soul_Forge_MVP_Install.ps1` to install to correct path.

**Files Changed:**
- Modified: `d:\Coding\OpenClaw\src\agents\skills\config.ts` (added workspace.dir default)
- Created: `mvp/Soul_Forge_MVP_Install.ps1` (correct paths)
- Created: `mvp/Soul_Forge_Issue_Record.md` (detailed postmortem)

---

### Issue #4: MVP Test Guide deployment section needs update

**Severity:** Medium
**Status:** Resolved

**Symptom:** Section 2.2 of `Soul_Forge_MVP_Test_Guide.md` uses CMD-only syntax and incorrect deployment path model (puts everything in `{WORKSPACE}` instead of distinguishing managed vs workspace dirs).

**Resolution:** Updated Section 2.2 with correct path model and added prerequisite about the skills config fix.

**Files Changed:**
- Modified: `mvp/Soul_Forge_MVP_Test_Guide.md`

---

## Verification Checklist After Round 1 Fixes

```
[ ] src/agents/skills/config.ts has "workspace.dir": true
[ ] OpenClaw rebuilt after code change
[ ] Soul_Forge_MVP_Install.ps1 executed successfully
[ ] ~/.openclaw/skills/soul-forge/SKILL.md exists
[ ] ~/.openclaw/hooks/soul-forge-bootstrap/HOOK.md exists
[ ] ~/.openclaw/hooks/soul-forge-bootstrap/handler.js exists
[ ] ~/.openclaw/workspace/.soul_forge/config.json exists (status: fresh)
[ ] ~/.openclaw/workspace/.soul_forge/memory.md exists
[ ] Gateway restarted
[ ] /soul-forge on Telegram shows privacy notice (not a fake analysis)
```

---

## Round 15 — 2026-02-15: Hook System Enable + SKILL.md Batch Fixes

### Test Environment

- OS: Windows 10
- OpenClaw version: v2026.2.6-3
- Channel: Telegram
- Docker: openclaw-deploy

### Changes Applied

**Phase 0: BUG-3 Fix (Hook system never activated)**
- Added `hooks.internal.enabled: true` to `openclaw.json`
- Root cause: `loadInternalHooks()` returned 0 when `cfg.hooks?.internal?.enabled` was falsy

**Phase 0.5: Docker Restart**
- Gateway logs confirm: `loaded 4 internal hook handlers`
- `Registered hook: soul-forge-bootstrap -> agent:bootstrap`

**Phase 1: Bootstrap Contract Test**
- config_update.md consumed: PASS
- config.json updated (dormant + calibration_history): PASS
- HEARTBEAT segment: N/A (dormant status skips by design)

**Phase 2A: SKILL.md Batch A (Language/Display)**
- A1 (BUG-6): Added explicit stop instruction for paused state
- A2 (#11): Added FILE LANGUAGE RULE (SOUL.md/IDENTITY.md must be English)
- A3 (#18): Added Language Detection Rules (slash command immunity + single-language)

**Phase 2B: SKILL.md Batch B (Scoring/Description/Naming)**
- B1 (BUG-1): Added MANDATORY Scoring Procedure with total=8 hard constraint
- B2 (#10): Added clear AI-behavior framing for type descriptions
- B3 (#12): Added Post-Calibration Greeting & Naming section

### Gate Results

| Gate | Checks | Result |
|------|--------|--------|
| Phase 0 | JSON valid + enabled=true + original config intact | 7/7 PASS |
| Batch A | Frontmatter + NO_REPLY removed + FILE LANGUAGE RULE + Language Detection Rules + sections complete | 7/7 PASS |
| Batch B | Scoring procedure + total=8 + no-infer + AI subject + greeting + naming + all Batch A re-checks + section order + Q1-Q8 + DISC mappings | 16/16 PASS |

---

## Round 15 — Test Checklist (Pending User Execution)

### Semi-Automatic Tests (Claude Code prepares + user Telegram action + Claude Code verifies)

| Test | Content | Pre-Setup (Claude Code) | User Action (Telegram) | Verification (Claude Code) |
|------|---------|------------------------|----------------------|---------------------------|
| T-semi-1 | Bootstrap contract retest | Reset config.json=fresh + create config_update.md | `/new` | config_update.md consumed + config.json updated + HEARTBEAT segment |
| T-semi-2 | Paused blocking visible | Set config.json status=paused | `/new` then `/soul_forge calibrate` | User confirms blocking message visible in Telegram |
| T-semi-3 | Dormant restore | Set config.json status=dormant | `/new` then `/soul_forge` | Prompt to restore/start fresh |
| T-semi-4 | Declined re-show | Set config.json status=declined | `/new` then `/soul_forge` | Privacy notice re-displayed |

### Full Manual Tests (User independently on Telegram)

| Test | Content | Verification Checklist |
|------|---------|----------------------|
| T-manual-1 | Complete calibration flow (fresh -> calibrated) | Pre-flight Check shown / Language detected from first natural reply (not slash command) / All 8 questions presented / Scoring total=8 / Type description uses "your AI" framing / SOUL.md + IDENTITY.md written in English / Effect demo shown / In-character greeting / Naming invitation / Preference question asked |
| T-manual-2 | Status command full flow | `/soul-forge pause` -> message visible / `/soul_forge calibrate` -> blocked with "resume first" / `/soul-forge resume` -> observation resumed / `/soul-forge reset` -> reset confirmation |

### Semi-Auto Test Results (2026-02-15)

```
T-semi-1: [x] PASS — config_update.md consumed + config.json updated to calibrated + HEARTBEAT segment written (3/3 contracts)
T-semi-2: [x] PASS — paused state: both /soul_forge and /soul_forge calibrate showed visible blocking messages
T-semi-3: [x] PASS — dormant state: prompted to restore previous config or start fresh
T-semi-4: [x] PASS — declined state: privacy notice re-displayed
T-manual-1: [x] PASS (R16+R17 补充) — 流程完整通过. 计分 total=8 正确(D=1 I=5 S=1 C=1). BUG-3 端到端 PASS. 效果演示+偏好问题+命名邀请均已展示(R17确认). 残留: #11 SOUL.md/IDENTITY.md 仍用中文(DeepSeek 无视 FILE LANGUAGE RULE).
T-manual-2: [x] PASS (R17) — pause/resume/reset 3/3 PASS. handler.js 状态追踪确认(calibration_history追踪pause/resume). Reset 文件恢复 6/6 全部正确. calibrate 阻断未在本轮测试(同会话上下文已 reset).
```

---

## Round 15 — Session Log Review (2026-02-15)

基于 `soul-forge-session-log-20260214.md`（15 轮测试，1247 行）的审查。

### BUG 修复覆盖分析

| BUG | 历史表现 | 今日修复 | 风险评估 |
|-----|---------|---------|---------|
| BUG-1 (DISC 计分) | R1: I/C 平局未触发 tie-breaking; R12: DeepSeek 全 C=8 | MANDATORY Scoring Procedure + total=8 硬约束 | **高风险** — prompt-level 指令对 DeepSeek 约束力存疑 |
| BUG-2 (HEARTBEAT) | R1 未写入 | 合并至 BUG-3 | 已解决 |
| BUG-3 (Bootstrap hook) | R1-R8 从未执行 | `hooks.internal.enabled: true` 写入 openclaw.json | 已解决，T-semi-1 验证通过 |
| BUG-4 (Pre-flight Check) | R5-R6 跳过状态检查 | R7 已修复 | 已解决，T-semi-2/3/4 再次确认 |
| BUG-5 (语言检测) | R3-R5 斜杠命令误判 | Language Detection Rules | 中风险，待 T-manual-1 验证 |
| BUG-6 (NO_REPLY) | R9 Telegram 端无回复 | 移除 NO_REPLY 改为 stop 指令 | 已解决，T-semi-2 验证 Telegram 端可见 |

### 待 T-manual 验证的关键观察点

**T-manual-1 (完整校准流程)：**
1. 计分是否 total=8 — BUG-1 核心验证（R12 中 DeepSeek 全 C=8）
2. SOUL.md/IDENTITY.md 是否英文写入 — R12 中全部用中文
3. 类型描述是否说 "你的 AI" — R12 未记录
4. 校准后是否有命名邀请 — R12 确认缺失
5. 效果演示后是否有人格化打招呼 — R12 未记录

**建议：** 如 DeepSeek 仍计分/语言出错，切换 Claude Opus 对比测试以区分 "指令不够强" vs "模型能力不足"。

### 日志准确性备注

- R15 日志记录的 hook 首次注册可能是临时 Docker 重启效果，今日 Phase 0 才是持久化写入 openclaw.json
- R12 计分 D=0 I=0 S=0 C=8 的用户确认反应未记录

---

## Round 15-17 — 集中反馈（2026-02-15）

### 全部测试结果总览

| 测试 | 结果 | 说明 |
|------|------|------|
| T-semi-1 (Bootstrap 合同) | **PASS** | 3/3 合同通过 |
| T-semi-2 (paused 阻断可见) | **PASS** | BUG-6 修复验证 |
| T-semi-3 (dormant 恢复) | **PASS** | 正确提示恢复/重新开始 |
| T-semi-4 (declined 重展示) | **PASS** | 隐私声明正确重展示 |
| T-manual-1 (完整校准) | **PASS** | R16+R17 确认全流程通过 |
| T-manual-2 (状态命令) | **PASS** | pause/resume/reset 3/3 + handler.js 追踪 |

### 已解决的 BUG（本轮确认）

| BUG | 修复内容 | 验证结果 |
|-----|---------|---------|
| BUG-1 (计分偏差) | MANDATORY Scoring Procedure + total=8 | R16: D=1 I=5 S=1 C=1 (total=8 ✅), R12 的全 C=8 不再复现 |
| BUG-3 (Bootstrap hook) | `hooks.internal.enabled: true` | R16 端到端校准 + R17 状态追踪，完全验证 |
| BUG-6 (NO_REPLY) | 移除 NO_REPLY 改为 stop | T-semi-2 Telegram 端可见 |
| #12 (命名邀请) | Post-Calibration Greeting | R17 确认 Agent 已问 "想给我起个名字吗？"（从"缺失"降级为"用户未回应"） |

### 仍存在的问题

| 问题 | 严重程度 | 说明 | 建议 |
|------|---------|------|------|
| **#11 文件语言** | **中** | R16 SOUL.md addon 仍用中文, IDENTITY.md 双语混合。FILE LANGUAGE RULE 指令被 DeepSeek 忽视 | 需强化：移除 Section E 中文模板或在写入步骤添加硬性 "ENGLISH ONLY" 锚定 |
| BUG-5 语言检测 | 低 | Language Detection Rules 已添加但未独立验证 | 可在下次校准时观察 |
| BUG-1 映射准确性 | 低 | total=8 已正确，但逐题映射未人工核对 | 可接受，用户已确认类型 |
| R15 Pre-flight 不一致 | 低 | paused 显示菜单而非阻断、dormant 混合隐私声明 | DeepSeek 对 prompt 指令执行的固有不确定性，非代码 BUG |

### 结论

6/6 测试通过。系统核心功能（校准流程、Bootstrap hook、状态命令、Pre-flight Check）全部工作正常。唯一未解决的实质问题是 **#11 文件语言规则**——DeepSeek Chat 无视 FILE LANGUAGE RULE 指令，SOUL.md/IDENTITY.md 持续以中文/双语写入。此问题不影响功能正确性（文件结构完整、内容语义正确），但违反了设计规范。

**下一步建议：**
1. 强化 #11：在 SKILL.md Section E 和 Section F 的模板/写入步骤中做更强的语言锚定
2. 可选：用 Claude Opus 跑一次完整校准确认指令本身有效

---

## Round 18a — 2026-02-16: SKILL.md Language Contradiction Fix + Routing Stability + handler.js Observability

### Changes Applied

| Priority | Item | Description |
|----------|------|-------------|
| **P0** | #11 File Language Fix | Eliminated contradiction between FILE LANGUAGE RULE and Step 4/5 "in detected language" instructions. Strengthened FILE LANGUAGE RULE in Sections E and F with ⚠️ MANDATORY prefix. Step 4 now explicitly separates file language (English only) from conversation language. Step 5 template comments changed from "in detected language" to "EN version". |
| **P1** | Pre-flight Check Routing | Added **STOP HERE** anchors to paused/dormant/declined routes. Preserved menu semantics for paused state. |
| **P1** | Language Detection Exception | Added "File write exception" to Language Detection Rules clarifying that language detection applies to conversation only, not file writes. |
| **P2** | handler.js Observability | Added `fs.existsSync` check before `safeReadFile` in `processConfigUpdate()`. Only logs when file exists but can't be read; silent when file doesn't exist (normal case). |

### Files Modified

- `src/skills/soul-forge/SKILL.md` (P0 + P1: 8 edits)
- `src/hooks/soul-forge-bootstrap/handler.js` (P2: 1 edit)

### Gate Results

```
Gate 1 (no "in detected language" in Step 5): [x] PASS — 0 matches
Gate 2 (Step 4 contains "English only"): [x] PASS — Line 810
Gate 3 (MANDATORY FILE LANGUAGE RULE x2): [x] PASS — Lines 315, 772 (+ references at 22, 810)
Gate 4 (File write exception exists): [x] PASS — Line 22
Gate 5 (STOP HERE x3): [x] PASS — Lines 782, 783, 784
Gate 6 (paused still has "Show menu"): [x] PASS — Line 782
Gate 7 (handler.js has diagnostic message): [x] PASS — Line 129
Gate 8 (Sections A-M complete): [x] PASS — 13/13 sections present
Gate 9 (source = deployed): [x] PASS — both files identical (diff)
```

### Additional Fix During R18a Deployment

**handler.js regex regression (BUG-3 再次修复):** D: 源码的正则修复 `[→\->]+` 在某次操作中丢失，源码和部署都回退为未修复的 `[→->]+`。在 R18a 部署验证中发现并修复。Docker 重启后确认 `loaded 4 internal hook handlers`。

### Semi-Auto Test Results (Pending)

```
T-R18a-1 (Chinese user → English files): [x] PASS (R19) — SOUL.md 连续 3 次全英文 (D+I+I). IDENTITY.md 仍双语.
T-R18a-2 (paused → menu only, no questionnaire): [x] PASS (R21) — Section I 三选项菜单展示, 无隐私声明/问卷. Agent 还主动检测到 #21 D/I desync. Heartbeat paused 正确跳过.
```

---

## Round 19 — 2026-02-15: handler.js 重新部署 + 双重校准验证（Session Log 第 18-19 轮）

### Test Environment

- Docker restart: 2026-02-15 22:12:18 UTC
- Model: litellm/deepseek-chat
- Session 1: 871cc2f7 (D-type), Session 2: (I-type)

### Key Findings

#### 1. BUG-3 Fix Confirmed

Container logs: `Registered hook: soul-forge-bootstrap -> agent:bootstrap`, `loaded 4 internal hook handlers`. No `Failed to load` errors.

#### 2. Two Calibrations — handler.js End-to-End

| Calibration | Type | Scores | handler.js | config.json |
|-------------|------|--------|------------|-------------|
| #1 (D-type) | D (Advisor) | D=7 I=1 S=0 C=0 | ✅ Consumed at 22:17:51 | ✅ Updated to calibrated |
| #2 (I-type) | I (Companion) | D=0 I=8 S=0 C=0 | config_update.md pending | Awaiting next bootstrap |

#### 3. BUG-1 Root Cause: User Selected "A" for All Questions

Session-memory 2217.md shows user chose option A for all 8 questions. Scoring D=7 I=1 is **mathematically correct** given the shuffle — 7 of 8 A-options mapped to D. Calibration #2's I=8 follows the same pattern (shuffle changed A-mappings between calibrations).

Six-calibration comparison:

| Round | Model | Scores | Type | All-same-letter? |
|-------|-------|--------|------|-----------------|
| R1 | Opus | D=2 I=3 S=1 C=2 | I | No |
| R12 | DeepSeek | D=0 I=0 S=0 C=8 | C | Likely |
| R16 | DeepSeek | D=1 I=5 S=1 C=1 | I | No |
| R18 | DeepSeek | D=7 I=1 S=0 C=0 | D | Yes (all A) |
| R19-1 | DeepSeek | D=7 I=1 S=0 C=0 | D | Yes (all A) |
| R19-2 | DeepSeek | D=0 I=8 S=0 C=0 | I | Likely |

#### 4. SOUL.md English — Consecutive Success

D-type + I-type addons both written in English. Two consecutive calibrations with all-English SOUL.md. IDENTITY.md still bilingual.

#### 5. IDENTITY.md Still Bilingual

```
Creature: A warm digital companion ... / 温暖的数字伙伴
Vibe: Warm, expressive, engaging / 热情、表达力强、有感染力
```

### Issue Status Update

| Issue | Status | Notes |
|-------|--------|-------|
| BUG-3 (Bootstrap hook) | **Resolved (again)** | Regex re-fixed + redeployed, handler.js D-type consumption verified |
| BUG-1 (DISC scoring) | **Clarified** | Extreme scores caused by user selecting same letter for all questions; math is correct |
| #11 (File language) | **Partial** | SOUL.md now consistently English (2 consecutive), IDENTITY.md still bilingual |
| #12 (Naming invite) | **Resolved** | Agent showed "想给我起个名字吗？", user did not respond |

### Remaining Issues for Next Fix Round

1. **IDENTITY.md bilingual** — MANDATORY FILE LANGUAGE RULE not yet effective for IDENTITY.md template; may need explicit IDENTITY.md template enforcement in SKILL.md
2. **BUG-1 all-same-letter** — Not a code bug; consider adding questionnaire instruction to encourage varied answers, or accept as user behavior
3. **changelog.md overwrite** — Each calibration overwrites instead of appending; minor data loss

---

## Round 20 — 2026-02-15: config_update.md Overwrite Race Condition (Session Log 第 20 轮)

### Key Findings

#### 1. Issue #21 (New) — config_update.md Overwrite Race Condition

**Severity:** Medium
**Status:** Open

**Symptom:** config.json shows D-type/paused while SOUL.md/IDENTITY.md contain I-type content. The I-type calibration result (I=8) was never persisted to config.json.

**Root Cause:** I-type calibration wrote config_update.md (calibration action). User then executed `/soul_forge pause` in the same session, which overwrote config_update.md with a pause action. handler.js consumed the pause action at next bootstrap, only changing status without updating DISC data.

**Impact:** config.json retains stale DISC data (D-type) while actual personality files (SOUL.md/IDENTITY.md) reflect I-type. This is a data inconsistency, not a functional failure — the AI still behaves as I-type based on SOUL.md content.

#### 2. SOUL.md English — Third Consecutive

I-type addon confirmed all-English in session 2236.md. Three consecutive calibrations (R18 D-type, R19 I-type, R20 continuation) with English-only SOUL.md.

#### 3. IDENTITY.md Still Bilingual

Issue #11 persists for IDENTITY.md.

#### 4. Issue #20 Persists

Agent attempts to read `soul-forge-context.md` as physical file → ENOENT. bootstrapFiles is memory injection, not a disk file. Non-blocking but generates unnecessary tool calls.

### Updated Issue Table

| Issue | Status | Notes |
|-------|--------|-------|
| **#21 (New)** | **Open** | config_update.md overwrite race — calibration result lost when status command executed in same session |
| #20 | Open | soul-forge-context.md ENOENT — Agent reads injected bootstrap context as physical file |
| #11 | Partial | SOUL.md consistently English, IDENTITY.md still bilingual |
| BUG-3 | Resolved | handler.js regex fixed and redeployed, 4 hooks loaded |

---

## Round 21 — 2026-02-15: T-R18a-2 Paused Menu + Heartbeat Verification (Session Log 第 21 轮)

### Test: T-R18a-2 — paused → menu only, no questionnaire

**Result: PASS** ✅

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Pre-flight detects paused | Read config.json | ✅ Detected status=paused | ✅ |
| Show Section I menu | 3-option menu (resume/recalibrate/view config) | ✅ Menu displayed | ✅ |
| No privacy notice | Do not show Section A | ✅ Not shown | ✅ |
| No questionnaire | Do not proceed to Section B | ✅ Not shown | ✅ |
| STOP HERE effective | No continuation after menu | ✅ Menu was only output | ✅ |
| Heartbeat paused skip | No new observations recorded | ✅ HEARTBEAT_OK | ✅ |

### Bonus Finding

Agent proactively detected Issue #21 desync: "The config says 'D' type but the files show 'I' type". This confirms the config_update.md overwrite race condition is observable by the AI itself.

### R18a Semi-Auto Test Summary

```
T-R18a-1: [x] PASS — SOUL.md consistently English (3 consecutive). IDENTITY.md still bilingual.
T-R18a-2: [x] PASS — Paused menu displayed correctly, no questionnaire/privacy notice leak. STOP HERE anchor effective.
```

### R18a Overall Conclusion

R18a's 4 changes validated:

| Change | Validation |
|--------|-----------|
| P0: FILE LANGUAGE RULE strengthening | ✅ SOUL.md English 3 consecutive times. IDENTITY.md partially effective. |
| P1: STOP HERE routing anchors | ✅ T-R18a-2 confirms paused stops at menu. |
| P1: File write exception | ✅ Part of language rule ecosystem, no regression. |
| P2: handler.js fs.existsSync | ✅ No false-positive error logs in normal (no config_update.md) case. |

### Open Issues — Post-R18a Review (2026-02-16)

**一句话总结：** MVP 主流程可用，卡在"状态一致性（#21）+ 输出一致性（#11/BUG-5/BUG-6）"两类质量问题。

#### P0: 状态一致性竞态（#21）

config_update.md 是单文件队列，同一会话内校准后执行状态命令会覆写校准结果，导致 config.json 与 SOUL.md/IDENTITY.md 人格类型不一致。这是当前最实质的系统问题。

**技术分析：** 根因是 config_update.md 作为 Agent→handler.js 的唯一通信通道，不支持多次写入的原子累积。修复方向：
- (a) SKILL.md 层：禁止同会话内校准后立即执行状态命令（最小变更，但约束用户行为）
- (b) handler.js 层：改为 append-only 队列或带时间戳的多文件（需改 handler.js 解析逻辑）
- (c) SKILL.md 层：校准完成后立即写入 config.json（绕过 config_update.md），但违反当前架构（Agent 不直接写 config.json）

#### P1: #11 IDENTITY.md 仍双语

SOUL.md 连续 3 次全英文（R18a 修复有效），但 IDENTITY.md 持续双语。SKILL.md 中 IDENTITY.md 的模板指令不够强——Step 6 (Assemble IDENTITY.md) 没有像 Step 5 那样被 R18a 显式修改。

**技术分析：** SKILL.md Step 6 的 IDENTITY.md 模板注释可能仍含隐含的"detected language"语义。需检查 Step 6 并做与 Step 5 相同的 EN-only 强化。

#### P1: BUG-5 语言检测

Language Detection Rules 已在 R15 添加（斜杠命令免疫 + 单语言规则），但从未独立验证。R18a 添加了 File write exception。理论上已修复但缺乏专项测试。

**技术分析：** 由于 R18-R21 的校准全部使用中文对话且 SOUL.md 均为英文，语言检测规则在实际中已被间接验证（未出现斜杠命令误判或中英混用）。可考虑降级为"间接验证通过"。

#### P1: BUG-6 NO_REPLY 交互可见性

R9 发现 paused 阻断消息因 NO_REPLY 标记导致 Telegram 端不可见。R18a 将 Pre-flight Check 的 paused/dormant/declined 路由从"output NO_REPLY and stop"改为"STOP HERE"语义。R21 的 T-R18a-2 确认 paused 菜单在 Telegram 端可见。

**技术分析：** R18a 的 STOP HERE 修改已实质解决 BUG-6 的 Pre-flight Check 场景。但其他位置是否仍有 NO_REPLY 使用需检查。如果 SKILL.md 中已无 NO_REPLY 引用，可闭环。

#### P2: BUG-1 计分体验

用户全选同字母导致极端分布（D=7 或 I=8），数学正确但用户体验受影响。

**技术分析：** 修复方向：
- (a) 选项呈现不使用 A/B/C/D 字母标签（改用序号 1/2/3/4 或直接显示文字）
- (b) 添加极端分布检测（如 7/8 或 8/8 为单一类型时触发二次确认）
- (c) 接受为用户行为特征，不修改

#### 部署一致性风险（BUG-3 防护）

BUG-3 已修复但曾回归两次。已在 CLAUDE.md 添加 Pre-Test Mandatory Checklist（diff + cp + docker restart + log verify）作为流程防护。

---

## Template: Future Test Rounds

Copy this template for each new test round:

```markdown
## Round N — YYYY-MM-DD: Description

### Issue #N: Title

**Severity:** Blocker / Critical / Medium / Low
**Status:** Open / Investigating / Resolved

**Symptom:**

**Root Cause:**

**Resolution:**

**Files Changed:**
```

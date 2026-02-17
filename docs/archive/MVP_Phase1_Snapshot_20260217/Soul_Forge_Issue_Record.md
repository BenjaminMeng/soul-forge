# Soul Forge — Issue Record

**Created:** 2026-02-13
**Updated:** 2026-02-17
**Status:** Active

---

## Issue Summary (19 Total)

| Issue | Name | Found | Severity | Status | Fixed |
|-------|------|-------|----------|--------|-------|
| #1 | Install 脚本 shell 不兼容 | R1 | Blocker | CLOSED | R1 |
| #2 | WORKSPACE 变量花括号 | R1 | Blocker | CLOSED | R1 |
| #3 | Skill 加载失败 (workspace.dir) | R1 | Critical | CLOSED | R1 |
| #4 | Test Guide 部署章节过时 | R1 | Medium | CLOSED | R1 |
| #10 | 类型描述主语错误 | R15 | Medium | CLOSED | R15 |
| #11 | SOUL/IDENTITY 中文写入 | R15 | Medium | CLOSED | R18b |
| #12 | 缺少命名邀请 | R15 | Medium | CLOSED | R15 |
| #18 | 斜杠命令误判语言 | R15 | Medium | CLOSED | R15 |
| #20 | context.md ENOENT | R20 | P2 | ONGOING (mitigated) | R18c+R18d 缓解 |
| #21 | config_update.md 覆写竞态 | R20 | Medium | CLOSED | R18b |
| #22 | Agent 自修复绕过路由 | R23 | Medium | CLOSED | R18c |
| #23 | Agent 直写 config.json | R24 | P2 | CLOSED | R18c+R18d |
| #24 | INIT 文件污染 | R29 | P0 | CLOSED (R35 验证通过 + INIT 已手动修复) | R18d |
| #25 | memory.md 覆写 | R32 | P1 | CLOSED (R35 验证通过) | R18d |
| #26 | Reset 不完整 | R28 | P1 | CLOSED (R35 验证通过, 8/8) | R18d |
| BUG-1 | DISC 全选同字母 | R12 | Low | ACCEPTED (用户行为) | — |
| BUG-3 | Bootstrap Hook 未激活 | R1 | Critical | CLOSED | R15 |
| BUG-5 | 语言检测误判 | R15 | Low | CLOSED (间接验证) | R15+R18a |
| BUG-6 | NO_REPLY Telegram 不可见 | R9 | Medium | CLOSED | R15+R18a |

### Statistics

| Category | Count |
|----------|-------|
| Total | 19 |
| CLOSED | 17 (全部已验证, R35) |
| ACCEPTED (won't fix) | 1 (BUG-1) |
| ONGOING (mitigated) | 1 (#20) |

---

## Detailed Postmortem: R1 Deployment Issues

**Date:** 2026-02-13
**Severity:** Medium (feature broken, no data loss)
**Status:** Resolved

### Symptom

User sends `/soul-forge` via Telegram. Instead of the DISC privacy notice + questionnaire flow defined in SKILL.md, the AI returns a fabricated "soul analysis report" with scores and suggestions that don't exist in any skill definition.

### Root Causes (2 issues found)

#### Issue 1: Missing `workspace.dir` default in skills config (PRIMARY)

**File:** `src/agents/skills/config.ts`

The `DEFAULT_CONFIG_VALUES` map in the **skills** config module was missing the `"workspace.dir": true` entry that the **hooks** config module already had.

**Before (broken):**
```typescript
// src/agents/skills/config.ts
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  // "workspace.dir" is MISSING
};
```

**After (fixed):**
```typescript
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  "workspace.dir": true,
};
```

**Reference (hooks already correct):**
```typescript
// src/hooks/config.ts — already had it
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  "workspace.dir": true,           // <-- present
};
```

**Impact:** Any skill with `requires.config: ["workspace.dir"]` in its SKILL.md frontmatter (including soul-forge) was silently filtered out by `shouldIncludeSkill()` and never injected into the AI's prompt. The AI received the `/soul-forge` command as plain text with no instructions to follow.

#### Issue 2: `.soul_forge/` runtime data installed in wrong directory

**Expected:** `~/.openclaw/workspace/.soul_forge/` (workspace directory)
**Actual:** `~/.openclaw/.soul_forge/` (config root directory)

The `handler.js` bootstrap hook references files via `path.join(workspaceDir, '.soul_forge', ...)`, where `workspaceDir` resolves to `~/.openclaw/workspace/`. The original installation script placed the runtime data in `~/.openclaw/.soul_forge/` (CONFIG_DIR root), so the hook could not find `config.json` or `memory.md`.

### Execution Flow Analysis

```
User sends /soul-forge on Telegram
    |
    v
bot-message-context.ts: builds context
    |
    v
buildWorkspaceSkillSnapshot(): loads skills from 4 sources
    |
    v
shouldIncludeSkill(): checks requires.config
    |
    v
isConfigPathTruthy(config, "workspace.dir")
    |
    v
config.workspace.dir is undefined, "workspace.dir" NOT in DEFAULT_CONFIG_VALUES
    |
    v
Returns false --> soul-forge skill FILTERED OUT
    |
    v
AI prompt has NO SKILL.md content --> AI improvises
```

### Files Modified

| File | Change |
|------|--------|
| `src/agents/skills/config.ts` | Added `"workspace.dir": true` to `DEFAULT_CONFIG_VALUES` |

### Installation Path Reference

| Component | Correct Location | Loaded By |
|-----------|-----------------|-----------|
| Skill SKILL.md | `~/.openclaw/skills/soul-forge/SKILL.md` | `loadSkillEntries()` (managed skills) |
| Hook HOOK.md | `~/.openclaw/hooks/soul-forge-bootstrap/HOOK.md` | `loadHookEntries()` (managed hooks) |
| Hook handler.js | `~/.openclaw/hooks/soul-forge-bootstrap/handler.js` | Hook runner |
| config.json | `~/.openclaw/workspace/.soul_forge/config.json` | `handler.js` via `workspaceDir` |
| memory.md | `~/.openclaw/workspace/.soul_forge/memory.md` | `handler.js` via `workspaceDir` |

### Post-Fix Verification

After applying the fix:
1. Rebuild OpenClaw (`pnpm build` or equivalent)
2. Restart the gateway
3. Send `/soul-forge` on Telegram
4. Expected: Privacy notice appears first, followed by 8-question DISC questionnaire

### Lessons Learned

1. When two subsystems (hooks vs skills) share identical eligibility logic with independent `DEFAULT_CONFIG_VALUES`, they must be kept in sync. Consider extracting shared defaults to a single source of truth.
2. Installation scripts must distinguish between CONFIG_DIR (`~/.openclaw/`) and WORKSPACE_DIR (`~/.openclaw/workspace/`). Runtime data used by hooks referencing `workspaceDir` must be placed in the workspace, not the config root.
3. Silent skill filtering (returning empty instead of warning) makes debugging difficult. Consider adding a debug log when a skill is excluded due to config requirements.

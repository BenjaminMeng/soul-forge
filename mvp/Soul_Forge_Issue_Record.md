# Soul Forge — Issue Record

**Created:** 2026-02-13
**Updated:** 2026-02-18
**Status:** Active

---

## Issue Summary (21 Total)

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
| #27 | Customer Install WhatIf 日志泄漏 | R36 | Medium | CLOSED | R36 |
| #28 | Customer Install 备份无条件覆盖 | R36 | Medium | CLOSED | R36 |
| #29 | Hooks 自动启用 + Setup.bat 一键化 | R37 | Enhancement | CLOSED | R37 |

### Statistics

| Category | Count |
|----------|-------|
| Total | 22 |
| CLOSED | 20 (R35 验证 17 + R36 新增 2 + R37 新增 1) |
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

---

## R36 Customer Install 端到端自动化测试 (2026-02-17)

代码审查 + 自动化测试（5 Suites / 41 Assertions）发现 2 个 bug，均已修复并验证。

### Issue #27: Customer Install WhatIf 日志泄漏

**Severity:** Medium
**Status:** CLOSED (R36, 自动化测试验证)
**Found:** R36 代码审查

**Symptom:** `-WhatIf` 模式下 `install_log.txt` 仍被创建和写入，违反"dry-run 不产生副作用"原则。Summary 中 "Log saved to:" 提示也在日志不存在时显示。

**Root Cause:** `Write-Log` 函数（第 41 行）的文件写入和日志初始化（第 76 行）均不受 `$WhatIfPreference` 保护。

**Resolution:**
- `Write-Log` 文件写入包裹在 `if (-not $WhatIfPreference) { ... }`
- 日志初始化同样包裹
- "Log saved to:" 提示加 `if (-not $WhatIfPreference)` 条件

**Files Changed:**
- `mvp/Soul_Forge_Customer_Install.ps1` 第 40、78、468 行
- `mvp/customer_package/Install.ps1`（同步）

### Issue #28: Customer Install 备份无条件覆盖

**Severity:** Medium
**Status:** CLOSED (R36, 自动化测试验证)
**Found:** R36 代码审查

**Symptom:** 重复安装（upgrade 场景）时，4 处备份操作使用 `-Force` 无条件覆盖已有备份文件，导致首次安装前的原始备份丢失。

**影响文件：**
- `SOUL_BEFORE_SOULFORGE.md`
- `IDENTITY_BEFORE_SOULFORGE.md`
- `HEARTBEAT_BEFORE_SOULFORGE.md`
- `openclaw.before-soulforge.json`

**Resolution:** 所有 4 处备份目标均添加 `if (Test-Path $backupDest)` 检查，已存在则跳过并提示 "already exists, preserving original"，移除 `-Force`。

**Files Changed:**
- `mvp/Soul_Forge_Customer_Install.ps1` 第 153、173、193、208 行
- `mvp/customer_package/Install.ps1`（同步）

### R36 自动化测试覆盖

| Suite | 断言数 | 测试内容 |
|-------|--------|---------|
| DryRun | 5 | -WhatIf 不产生任何文件/目录 |
| FreshInstall | 10 | 干净安装生成全部预期文件 |
| ExistingUser | 13 | 已有 SOUL/IDENTITY/HEARTBEAT 时正确备份 + 追加 segment |
| Idempotency | 8 | 二次运行不覆盖 config/memory/INIT，无 segment 重复 |
| FailureScenario | 5 | 缺少源文件 → exit 1，无部分安装残留 |
| **Total** | **41** | **41/41 PASS** |

**测试脚本:** `mvp/Test-CustomerInstall.ps1`
**隔离机制:** 临时 USERPROFILE 沙箱 + `powershell -File` 子进程调用

---

## R37 Customer Install 一键化 (2026-02-18)

### Issue #29: Hooks 自动启用 + Setup.bat 一键化

**Severity:** Enhancement
**Status:** CLOSED (R37, 自动化测试验证 55/55)
**Found:** R37 用户反馈 — 非技术用户安装流程过于复杂

**Symptom:** 客户需要手动开 PowerShell、改 ExecutionPolicy、检查 hooks 配置才能完成安装，对非技术用户不友好。

**Resolution (3 部分):**

1. **Install.ps1 Step 8 — hooks 自动启用:**
   - openclaw.json 存在但无 `hooks.internal.enabled` → 用 `Add-Member` 注入，保留其他字段
   - openclaw.json 不存在 → 创建含 `hooks.internal.enabled: true` 的新文件
   - 均受 `$PSCmdlet.ShouldProcess` 保护（WhatIf 安全）
   - Step 1 已备份 openclaw.json → `openclaw.before-soulforge.json`，可回滚

2. **Setup.bat 双击入口:**
   - `--auto` 参数：跳过两处 `pause`，支持自动化测试
   - 退出码传递：`set INSTALL_RESULT=%ERRORLEVEL%` + `exit /b %INSTALL_RESULT%`
   - 手动双击体验不变（显示欢迎 → pause → 安装 → 结果 → pause）

3. **测试扩展 (Suite 6 + Suite 7):**
   - Suite 6 HooksAutoEnable: 9 项断言，覆盖"已有 JSON 注入"和"新建 JSON"两个分支
   - Suite 7 SetupBat: 4 项断言（`-RunSetupBatSmoke` 开关启用），覆盖正常安装和失败退出码传递
   - DryRun Suite 新增: WhatIf 不修改 openclaw.json 的断言

**Files Changed:**
- `mvp/Soul_Forge_Customer_Install.ps1` Step 8 (hooks auto-enable)
- `mvp/customer_package/Install.ps1`（同步）
- `mvp/customer_package/Setup.bat`（--auto + exit /b）
- `mvp/Test-CustomerInstall.ps1`（Suite 6 + Suite 7 + DryRun 修改）

### R37 自动化测试覆盖

| Suite | 断言数 | 测试内容 |
|-------|--------|---------|
| DryRun | 6 | -WhatIf 不产生任何文件/目录，openclaw.json 不被修改 |
| FreshInstall | 10 | 干净安装生成全部预期文件 |
| ExistingUser | 13 | 已有 SOUL/IDENTITY/HEARTBEAT 时正确备份 + 追加 segment |
| Idempotency | 8 | 二次运行不覆盖 config/memory/INIT，无 segment 重复 |
| FailureScenario | 5 | 缺少源文件 → exit 1，无部分安装残留 |
| HooksAutoEnable | 9 | hooks 注入（已有 JSON / 新建 JSON）+ 字段保留 + 备份链路 |
| SetupBat (optional) | 4 | Setup.bat --auto 正常安装 + 失败退出码传递 |
| **主回归 Total** | **51** | **51/51 PASS** |
| **含 SetupBat smoke** | **55** | **55/55 PASS** |

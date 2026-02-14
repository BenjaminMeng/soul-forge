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

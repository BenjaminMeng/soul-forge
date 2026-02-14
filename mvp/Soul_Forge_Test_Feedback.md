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

## Round 2 — 2026-02-15: Redeployment & Docker Image Rebuild

### Test Environment

- OS: Windows 10 (Build 26200.7840)
- OpenClaw version: v2026.2.6-3
- Channel: Telegram
- Shell: Git Bash (via Claude Code)
- Docker image: `openclaw:local` (rebuilt)

### Issue #5: Docker image not rebuilt after source fix

**Severity:** Critical
**Status:** Resolved

**Symptom:** After Round 1 source fix (`workspace.dir: true` in `config.ts`) and file redeployment, `/soul_forge` on Telegram still returned fabricated analysis instead of the DISC questionnaire.

**Root Cause:** The Docker image `openclaw:local` was built 36+ hours ago, before the `workspace.dir: true` fix was applied. The Dockerfile copies source and runs `pnpm build` inside the image, so the running container still had the old compiled code without the fix. Merely restarting the container (`docker compose down/up`) reused the same old image.

Verified by searching inside the container:
```
docker exec ... grep -r "workspace.dir" /app/dist/skills*
→ NOT FOUND (old image)
```

**Resolution:** Rebuilt Docker image from `D:\Coding\OpenClaw\`:
```bash
cd D:\Coding\OpenClaw && docker build -t openclaw:local .
```

Then restarted containers:
```bash
cd C:\Users\benja\openclaw-deploy && docker compose down && docker compose up -d
```

Post-rebuild verification confirmed fix present:
```
/app/dist/skills-D0TD_rYe.js:  "workspace.dir": true  ✓
/app/dist/skills-DoFl99dg.js:  "workspace.dir": true  ✓
```

**Files Changed:**
- None (infrastructure operation only — Docker image rebuild)

---

### Issue #6: Install script `$env:USERPROFILE` resolves to wrong user

**Severity:** Medium
**Status:** Resolved (workaround)

**Symptom:** `Soul_Forge_MVP_Install.ps1` uses `$env:USERPROFILE\.openclaw` which resolves to `C:\Users\Administrator\.openclaw\` when run as Administrator, but the actual OpenClaw config is at `C:\Users\benja\.openclaw\`.

**Root Cause:** The install script assumes `$env:USERPROFILE` matches the OpenClaw user. On this machine, the terminal runs as `Administrator` but OpenClaw is configured under user `benja`.

**Resolution:** Deployed manually via Git Bash with correct paths:
```bash
SRC="/d/Coding/OpenClaw/OpenClaw_Indiviual_SOUL.md/src"
CONFIG_DIR="/c/Users/benja/.openclaw"
WORKSPACE="/c/Users/benja/.openclaw/workspace"

mkdir -p "$CONFIG_DIR/skills/soul-forge"
mkdir -p "$CONFIG_DIR/hooks/soul-forge-bootstrap"
mkdir -p "$WORKSPACE/.soul_forge"

cp "$SRC/skills/soul-forge/SKILL.md" "$CONFIG_DIR/skills/soul-forge/SKILL.md"
cp "$SRC/hooks/soul-forge-bootstrap/HOOK.md" "$CONFIG_DIR/hooks/soul-forge-bootstrap/HOOK.md"
cp "$SRC/hooks/soul-forge-bootstrap/handler.js" "$CONFIG_DIR/hooks/soul-forge-bootstrap/handler.js"
cp "$SRC/.soul_forge/config.json" "$WORKSPACE/.soul_forge/config.json"
cp "$SRC/.soul_forge/memory.md" "$WORKSPACE/.soul_forge/memory.md"
```

**Future Fix:** Install script should accept a configurable `$CONFIG_DIR` parameter or auto-detect the OpenClaw config location.

**Files Changed:**
- None (manual deployment)

---

### Issue #7: Skill not recognized without starting a new conversation

**Severity:** Low
**Status:** Expected behavior

**Symptom:** After Docker image rebuild and container restart, sending `/soul_forge` in the existing Telegram conversation still failed. Skill only worked after running `/new` to start a fresh conversation.

**Root Cause:** OpenClaw loads the skill snapshot during agent bootstrap (session initialization). An existing conversation uses the snapshot from when it was started (before the fix). A new conversation triggers a fresh bootstrap, which loads the updated skill list including soul-forge.

**Resolution:** Use `/new` to start a new conversation after any skill deployment or Docker image change. This is expected OpenClaw behavior, not a bug.

**Files Changed:**
- None

---

### Note: DeepSeek Agent misdiagnosis

During debugging, the OpenClaw Agent (running DeepSeek V3) was asked to diagnose why `/soul_forge` wasn't working. It provided an incorrect analysis claiming:

1. "Windows paths not visible in Linux container" → **Wrong.** Docker volume mounts confirmed working.
2. "hooks/ is wrong, should use BOOTSTRAP.md" → **Wrong.** `hooks/` with `HOOK.md` + `handler.js` is the standard managed hook mechanism (verified in `src/hooks/workspace.ts:192-239`).
3. "SKILL.md must be in `workspace/skills/`" → **Wrong.** Managed skills at `~/.openclaw/skills/` are loaded by `loadSkillEntries()` alongside workspace, bundled, and extra skill sources.

**Lesson:** Do not rely on the AI agent's self-diagnosis of OpenClaw internals. Verify against source code directly.

---

## Verification Checklist After Round 2 Fixes

```
[x] src/agents/skills/config.ts has "workspace.dir": true
[x] Docker image rebuilt with fix (docker build -t openclaw:local)
[x] Container restarted (docker compose down/up)
[x] Fix verified inside container (grep workspace.dir /app/dist/skills*)
[x] ~/.openclaw/skills/soul-forge/SKILL.md exists (43,663 bytes)
[x] ~/.openclaw/hooks/soul-forge-bootstrap/HOOK.md exists (733 bytes)
[x] ~/.openclaw/hooks/soul-forge-bootstrap/handler.js exists (22,050 bytes)
[x] ~/.openclaw/workspace/.soul_forge/config.json exists (status: fresh)
[x] ~/.openclaw/workspace/.soul_forge/memory.md exists
[x] Gateway restarted with new image
[x] /new to start fresh conversation
[x] /soul_forge on Telegram shows privacy notice + DISC questionnaire ✓
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

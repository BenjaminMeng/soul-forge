# CLAUDE.md — Soul Forge Project Notes

## Project Overview

Soul Forge is a DISC-based AI personality calibration system for OpenClaw. It consists of a Skill (SKILL.md), a Bootstrap Hook (handler.js), and runtime data files that together enable personality questionnaire, calibration, and continuous observation.

## Directory Structure

```
OpenClaw_Indiviual_SOUL.md/
├── README.md                  # This project's directory guide
├── CLAUDE.md                  # Claude Code project notes (this file)
├── src/                       # Deployable source files
│   ├── skills/soul-forge/SKILL.md
│   ├── hooks/soul-forge-bootstrap/HOOK.md
│   ├── hooks/soul-forge-bootstrap/handler.js
│   ├── .soul_forge/config.json
│   ├── .soul_forge/memory.md
│   ├── HEARTBEAT_SEGMENT.md
│   ├── SOUL.md
│   └── IDENTITY.md
├── mvp/                       # MVP deliverables & test artifacts
│   ├── Soul_Forge_MVP_Install.ps1
│   ├── Soul_Forge_MVP_Test_Guide.md
│   ├── Soul_Forge_Test_Feedback.md
│   └── Soul_Forge_Issue_Record.md
├── docs/                      # Design documents
│   ├── Soul_Forge_Architecture_v3.1.md
│   ├── Soul_Forge_v3_Review.md
│   ├── SoulForge_Business_Plan.md
│   └── archive/               # Superseded documents
└── .claude/                   # Claude Code settings
```

## Deployment Paths

OpenClaw has two important directory levels — do NOT confuse them:

```
CONFIG_DIR  = ~/.openclaw/                    # OpenClaw configuration root
WORKSPACE   = ~/.openclaw/workspace/           # Default agent workspace

Skills  → CONFIG_DIR/skills/     (managed)  or  WORKSPACE/skills/     (workspace)
Hooks   → CONFIG_DIR/hooks/      (managed)  or  WORKSPACE/hooks/      (workspace)
Runtime → WORKSPACE/.soul_forge/  (MUST be in workspace, handler.js uses workspaceDir)
```

## Known Issues & Fixes

### 2026-02-13: Skills `workspace.dir` config default missing

**File:** `d:\Coding\OpenClaw\src\agents\skills\config.ts`

`DEFAULT_CONFIG_VALUES` was missing `"workspace.dir": true` (hooks had it, skills didn't). Any skill with `requires.config: ["workspace.dir"]` was silently filtered out — the AI never saw the SKILL.md content.

**Fix:** Added `"workspace.dir": true` to the skills `DEFAULT_CONFIG_VALUES`.

### 2026-02-13: .soul_forge/ installed in wrong directory

Original install script placed `.soul_forge/` in `~/.openclaw/.soul_forge/` (CONFIG_DIR root). Correct location is `~/.openclaw/workspace/.soul_forge/` because `handler.js` uses `path.join(workspaceDir, '.soul_forge', ...)`.

## Key Code References

- Skill eligibility: `src/agents/skills/config.ts:shouldIncludeSkill()`
- Skill loading: `src/agents/skills/workspace.ts:loadSkillEntries()`
- Hook eligibility: `src/hooks/config.ts:shouldIncludeHook()`
- Default workspace: `src/agents/workspace.ts:resolveDefaultAgentWorkspaceDir()`
- Config dir: `src/utils.ts:resolveConfigDir()`

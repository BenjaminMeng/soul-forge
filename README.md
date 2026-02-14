# Soul Forge — AI Personality Calibration for OpenClaw

## Quick Start

1. Apply the OpenClaw source fix (see below)
2. Run `mvp/Soul_Forge_MVP_Install.ps1` in PowerShell
3. Restart the OpenClaw gateway
4. Send `/soul-forge` in Telegram

## Required Source Fix

Before installing, patch `src/agents/skills/config.ts` in the OpenClaw source:

```typescript
// Add "workspace.dir": true to DEFAULT_CONFIG_VALUES
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  "workspace.dir": true,           // <-- ADD THIS LINE
};
```

Then rebuild OpenClaw.

## Directory Guide

| Directory | Contents |
|-----------|----------|
| `src/` | Deployable source files (SKILL.md, handler.js, templates, runtime data) |
| `mvp/` | MVP install script, test guide, test feedback log, issue records |
| `docs/` | Architecture documents, business plan, design reviews |
| `docs/archive/` | Superseded documents (v2 architecture, old decisions) |

## Key Documents

- **Install:** `mvp/Soul_Forge_MVP_Install.ps1`
- **Test Guide:** `mvp/Soul_Forge_MVP_Test_Guide.md`
- **Test Log:** `mvp/Soul_Forge_Test_Feedback.md`
- **Issue Record:** `mvp/Soul_Forge_Issue_Record.md`
- **Architecture:** `docs/Soul_Forge_Architecture_v3.1.md`

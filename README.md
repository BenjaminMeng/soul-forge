# Soul Forge — AI Personality Calibration for OpenClaw

> Make your AI assistant feel like *your* AI assistant.

[![Version](https://img.shields.io/badge/version-3.0--beta-blue)](https://github.com/BenjaminMeng/soul-forge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-orange)](https://openclaw.ai)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

**[中文文档](README_zh.md)**

---

## What is Soul Forge?

Soul Forge is a **DISC-inspired behavioral style classification system** that calibrates your AI assistant's communication style to match your preferences — and keeps learning over time.

**8 scenario questions** → **Your behavioral style** → **AI adapts to you** → **Continuous refinement**

| Style | Name | Communication |
|:-----:|------|---------------|
| **D** | Advisor | Direct, efficient, action-oriented |
| **I** | Partner | Warm, expressive, emotionally attuned |
| **S** | Butler | Steady, patient, service-oriented |
| **C** | Critic | Precise, analytical, high-standards |

## Installation

### One-Line Install (any platform)

```bash
npx soul-forge-install
```

> Requires Node.js 14+. Preview first with `npx soul-forge-install --dry-run`.

### From Git

**macOS / Linux:**

```bash
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

Or use the platform-specific scripts:

```bash
# macOS / Linux
chmod +x install.sh setup.sh && ./setup.sh

# Windows
.\Setup.bat
```

### OpenClaw Native (coming soon)

```bash
clawhub install soul-forge                          # Skill
openclaw hooks install soul-forge-bootstrap          # Hook
```

### Manual Install

1. Copy `skills/soul-forge/` → `~/.openclaw/skills/soul-forge/`
2. Copy `hooks/soul-forge-bootstrap/` → `~/.openclaw/hooks/soul-forge-bootstrap/`
3. Copy `.soul_forge/` → `~/.openclaw/workspace/.soul_forge/`
4. Append `HEARTBEAT_SEGMENT.md` content to your `HEARTBEAT.md`
5. Enable hooks in `~/.openclaw/openclaw.json`: `{"hooks":{"internal":{"enabled":true}}}`
6. Restart OpenClaw

### After Installation

1. Restart OpenClaw: `docker compose down && docker compose up -d`
2. Check logs for: `loaded 4 internal hook handlers`
3. Send `/soul-forge` in Telegram to start calibration

## Features

### Core
- **8 bilingual scenario questions** (English / Chinese) with "what kind of person" framing
- **Dual-axis DISC scoring** — each answer scores a primary (+1) and secondary (+0.5) axis
- **Hard-coded guardrails** — score validation, automatic secondary type derivation, shuffle detection
- **4 personality templates** — Advisor, Partner, Butler, Critic

### Continuous Learning
- **Sentiment analysis** — local mood tracking with negation-aware lexicon (EN + ZH)
- **Drift detection** — tracks modifier preference shifts across sessions
- **Staged change pipeline** — 4-gate admission review + validation window + auto-rollback
- **SOUL_EVOLVE** — automatic personality refinement with safety guardrails
- **Memory lifecycle** — fingerprint dedup + LLM consolidation + archival
- **Maturity curve** — parameters auto-adjust as the system learns (exploration → calibration → stable)
- **Post-hoc integrity** — detects unauthorized config/memory modifications

### Privacy
- **100% local** — all data stays on your machine in `.soul_forge/`
- **No telemetry by default** — opt-in only

## Commands

| Command | Description |
|---------|-------------|
| `/soul-forge` | Start calibration or view current status |
| `/soul-forge status` | Detailed status with context adjustments |
| `/soul-forge pause` | Pause personality observation |
| `/soul-forge resume` | Resume observation |
| `/soul-forge reset` | Reset to default personality |
| `/soul-forge recalibrate` | Re-run the questionnaire |

## How It Works

```
1. /soul-forge          → Privacy notice + consent
2. Answer 8 questions   → DISC scoring (dual-axis, total = 12.0)
3. Confirm your type    → SOUL.md + IDENTITY.md assembled
4. Daily conversations  → Heartbeat observes and refines
5. Over time            → Drift detection → staged changes → SOUL evolves
```

## Architecture

```
~/.openclaw/
├── skills/soul-forge/SKILL.md              # Questionnaire + personality logic
├── hooks/soul-forge-bootstrap/
│   ├── HOOK.md                             # Hook metadata
│   ├── handler.js                          # Bootstrap hook (1800+ lines)
│   ├── sentiment.js                        # Sentiment analysis engine
│   └── sentiments/{zh,en}.json             # Emotion lexicons
└── workspace/
    ├── .soul_forge/
    │   ├── config.json                     # Calibration state (schema v3)
    │   ├── memory.md                       # Behavioral observations
    │   └── telemetry.json                  # Anonymized metrics (local only)
    └── .soul_history/                      # Backups + archives
```

## Compatibility

Tested with:
- **DeepSeek V3.2** via LiteLLM (primary test model)

Designed to work with any OpenClaw-compatible LLM. Cross-model testing in progress.

## License

[MIT](LICENSE)

---

Built with care by [Benjamin Meng](https://github.com/BenjaminMeng)

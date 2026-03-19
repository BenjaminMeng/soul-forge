# Soul Forge — AI Personality Calibration for OpenClaw

> Make your AI assistant feel like *your* AI assistant.

[![Version](https://img.shields.io/badge/version-2.0--beta-blue)](https://github.com/BenjaminMeng/soul-forge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-orange)](https://openclaw.ai)

**[中文文档](README_zh.md)**

---

## What is Soul Forge?

Soul Forge is a **DISC-inspired behavioral style classification system** that calibrates your AI assistant's communication style to match your preferences.

**8 scenario questions** → **Your behavioral style** → **AI adapts to you**

| Style | Name | Communication |
|:-----:|------|---------------|
| **D** | Advisor | Direct, efficient, action-oriented |
| **I** | Partner | Warm, expressive, emotionally attuned |
| **S** | Butler | Steady, patient, service-oriented |
| **C** | Critic | Precise, analytical, high-standards |

## Quick Start

### One-Line Install (PowerShell)

```powershell
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
.\Install.ps1
```

Then restart OpenClaw and send `/soul-forge` in Telegram.

### Manual Install

1. Copy `skills/soul-forge/` to `~/.openclaw/skills/soul-forge/`
2. Copy `hooks/soul-forge-bootstrap/` to `~/.openclaw/hooks/soul-forge-bootstrap/`
3. Copy `.soul_forge/` to `~/.openclaw/workspace/.soul_forge/`
4. Append `HEARTBEAT_SEGMENT.md` content to your `HEARTBEAT.md`
5. Restart OpenClaw

## Features

- **8 bilingual scenario questions** (English / Chinese) with "what kind of person" framing
- **Dual-axis DISC scoring** — each answer scores a primary (+1) and secondary (+0.5) axis
- **Hard-coded guardrails** — score validation, automatic secondary type derivation, shuffle detection
- **4 personality templates** — Advisor, Partner, Butler, Critic
- **Continuous learning** — Heartbeat observation + style probing between sessions
- **Sentiment analysis** — mood tracking and drift detection
- **100% local** — all data stays on your machine in `.soul_forge/`

## Commands

| Command | Description |
|---------|-------------|
| `/soul-forge` | Start calibration or view current status |
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
```

## Architecture

```
~/.openclaw/
├── skills/soul-forge/SKILL.md          # Questionnaire + personality logic
├── hooks/soul-forge-bootstrap/
│   ├── HOOK.md                         # Hook metadata
│   └── handler.js                      # Bootstrap hook (scoring validation, context injection)
└── workspace/.soul_forge/
    ├── config.json                     # Calibration state
    └── memory.md                       # Behavioral observations
```

## Privacy

All data is stored locally in `~/.openclaw/workspace/.soul_forge/`. Nothing is sent to external servers. You can:

- Run `/soul-forge reset` to restore defaults
- Delete `.soul_forge/` to remove all Soul Forge data
- Run `/soul-forge pause` to stop observation at any time

## Compatibility

Tested with:
- **DeepSeek V3.2** via LiteLLM (primary test model)

Designed to work with any OpenClaw-compatible LLM. Cross-model testing in progress.

## License

[MIT](LICENSE)

---

Built with care by [Benjamin Meng](https://github.com/BenjaminMeng)

# Soul Forge — AI Personality Calibration for OpenClaw

Soul Forge is a DISC-based personality calibration plugin for [OpenClaw](https://github.com/openclaw/openclaw). It learns your communication style through an 8-question questionnaire and continuously adapts the AI's tone, depth, and response patterns to match how you actually think.

## What It Does

- **One-time questionnaire** — 8 scenario-based questions identify your DISC type (D/I/S/C)
- **Continuous observation** — monitors your conversation patterns and refines the calibration over time
- **Cross-model** — works with DeepSeek, MiniMax, and other models running on OpenClaw
- **Privacy-first** — all calibration data stays local; anonymous minimal telemetry (install count only, no conversation data) is always active; detailed telemetry is opt-in

## Installation

### Windows

```powershell
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

Then restart your OpenClaw gateway.

Full guide: [docs/install/windows.md](docs/install/windows.md)

### macOS / Linux

```bash
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

Full guide: [docs/install/macos.md](docs/install/macos.md)

## Requirements

- OpenClaw (npm or Docker)
- Node.js 18+ (22 LTS recommended)
- A configured Telegram bot

## Quick Start

After installation, send `/soul-forge` in your Telegram bot to start the questionnaire. The whole process takes about 3 minutes.

See [docs/usage/quickstart.md](docs/usage/quickstart.md) for a step-by-step walkthrough.

## Version

Current: **v3.1.1**

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Compatibility

See [docs/compatibility/openclaw-version-support.md](docs/compatibility/openclaw-version-support.md) for OpenClaw version compatibility.

## FAQ

Common questions: [docs/faq/common-questions.md](docs/faq/common-questions.md)

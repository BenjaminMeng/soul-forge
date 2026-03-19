Soul Forge v2 (Beta) - AI Personality Calibration for OpenClaw
==============================================================

Soul Forge uses a DISC-inspired behavioral style classification system
to calibrate your AI assistant's communication style, making it feel
more natural and personalized to you.

Version: 2.0-beta
Tested with: DeepSeek V3.2 via LiteLLM

INSTALLATION
------------
1. Ensure OpenClaw is installed (~/.openclaw/ exists)
2. Open PowerShell in this directory
3. Preview: .\Install.ps1 -WhatIf
4. Install: .\Install.ps1
5. Restart OpenClaw (Docker: docker compose down && docker compose up -d)
6. Check logs for "loaded 4 internal hook handlers"

Or contact us for assisted installation.

USAGE
-----
Send /soul-forge in Telegram to start calibration.

After agreeing to the privacy notice, you'll answer 8 short
scenario-based questions using a "what kind of person" framing.
Soul Forge then determines your behavioral style type (D/I/S/C)
and generates a personalized AI personality with continuous learning.

FEATURES
--------
- 8 bilingual scenario questions (EN/ZH) with dual-axis scoring
- 4 personality types: Advisor (D), Partner (I), Butler (S), Critic (C)
- Continuous observation via Heartbeat + Probing
- Sentiment analysis + drift detection (Phase 3)
- Staged change pipeline with SOUL_EVOLVE
- All data stored 100% locally

AVAILABLE COMMANDS
------------------
/soul-forge            Start calibration or view current status
/soul-forge pause      Pause personality observation
/soul-forge resume     Resume observation
/soul-forge reset      Reset to default personality
/soul-forge recalibrate  Re-run the questionnaire

DATA & PRIVACY
--------------
All data is stored locally in your ~/.openclaw/workspace/.soul_forge/
directory. Nothing is sent to external servers. You can delete the
.soul_forge/ directory at any time to remove all Soul Forge data.

KNOWN LIMITATIONS (Beta)
------------------------
- Tool narration: The AI may show internal processing messages
  (e.g., "Reading skill file...") before the actual interaction.
  This is an OpenClaw framework behavior, not a Soul Forge issue.
- Calculation display: Some models may show the full scoring
  calculation instead of just the result summary.
- Link previews: Telegram may generate link previews for .md
  filenames. These are harmless visual artifacts.

FEEDBACK & SUPPORT
------------------
Official website: https://soulforge.example.com (coming soon)
GitHub: https://github.com/<repo>/soul-forge

We'd love to hear from you! After using Soul Forge for a few days,
please share your feedback.

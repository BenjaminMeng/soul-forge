Soul Forge - AI Personality Calibration for OpenClaw
====================================================

Soul Forge uses the DISC personality framework to calibrate your AI
assistant's communication style, making it feel more natural and
personalized to you.

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
scenario-based questions. Soul Forge then determines your DISC type
and generates a personalized AI personality.

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

FEEDBACK & SUPPORT
------------------
We'd love to hear from you! After using Soul Forge for a few days,
please share your feedback. Contact us via the channel where you
received this package.

#!/usr/bin/env bash
# ============================================================
# Soul Forge - Quick Setup (macOS / Linux / WSL)
# ============================================================
# Double-click or run: bash setup.sh
# Preview mode:        bash setup.sh --dry-run
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  Soul Forge - AI Personality Calibration"
echo "============================================"
echo ""
echo "This will install Soul Forge into your OpenClaw."
echo "Your existing files will be backed up automatically."
echo ""

# Pass through --dry-run if provided
ARGS=""
if [[ "${1:-}" == "--dry-run" ]]; then
  ARGS="--dry-run"
fi

# Auto mode (skip pause) if --auto is passed
if [[ "${1:-}" != "--auto" ]]; then
  read -rp "Press Enter to continue (or Ctrl+C to cancel)..."
fi

echo ""
echo "Running installation..."
echo ""

bash "$SCRIPT_DIR/install.sh" $ARGS
INSTALL_RESULT=$?

echo ""
if [[ "$INSTALL_RESULT" -eq 0 ]]; then
  echo "============================================"
  echo "  Installation successful!"
  echo ""
  echo "  Please restart OpenClaw to activate."
  echo ""
  echo "  Docker:  docker compose down && docker compose up -d"
  echo "  Then send /soul-forge in Telegram to start."
  echo "============================================"
else
  echo "============================================"
  echo "  Installation failed. See errors above."
  echo "============================================"
fi

exit $INSTALL_RESULT

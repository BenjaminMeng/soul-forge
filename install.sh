#!/usr/bin/env bash
# ============================================================
# Soul Forge Customer Installation Script (Bash)
# ============================================================
# Usage:
#   ./install.sh           # Normal install
#   ./install.sh --dry-run # Preview only (no files written)
#
# Compatible with: macOS, Linux, WSL
# Requires: bash 3.2+, Node.js (for JSON manipulation)
# ============================================================

set -euo pipefail

# --- Color helpers ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# --- Path Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.openclaw"
WORKSPACE="$CONFIG_DIR/workspace"

SKILL_DIR="$CONFIG_DIR/skills/soul-forge"
HOOK_DIR="$CONFIG_DIR/hooks/soul-forge-bootstrap"
RUNTIME_DIR="$WORKSPACE/.soul_forge"
HISTORY_DIR="$WORKSPACE/.soul_history"

LOG_FILE="$SCRIPT_DIR/install_log.txt"

# Track completed steps
COMPLETED_STEPS=()

log() {
  local color="${2:-$NC}"
  echo -e "${color}$1${NC}"
  if [[ "$DRY_RUN" == false ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S')  $1" >> "$LOG_FILE"
  fi
}

rollback_guide() {
  local failed_step="$1"
  log "" "$RED"
  log "============================================" "$RED"
  log "  Installation failed at: $failed_step" "$RED"
  log "============================================" "$RED"
  log ""
  if [[ ${#COMPLETED_STEPS[@]} -gt 0 ]]; then
    log "  Completed steps: ${COMPLETED_STEPS[*]}" "$YELLOW"
    log ""
    log "  Manual rollback guide:" "$YELLOW"
    log "    - Skill files: rm -rf $SKILL_DIR" "$YELLOW"
    log "    - Hook files: rm -rf $HOOK_DIR" "$YELLOW"
    log "    - Runtime data: rm -rf $RUNTIME_DIR" "$YELLOW"
    log "    - INIT templates: rm $HISTORY_DIR/SOUL_INIT.md $HISTORY_DIR/IDENTITY_INIT.md" "$YELLOW"
    if [[ -f "$CONFIG_DIR/openclaw.before-soulforge.json" ]]; then
      log "    - Config restore: cp openclaw.before-soulforge.json openclaw.json" "$YELLOW"
    fi
  else
    log "  No steps completed — nothing to roll back." "$GRAY"
  fi
  log ""
}

safe_cp() {
  local src="$1" dst="$2"
  if [[ "$DRY_RUN" == true ]]; then
    log "  [DRY-RUN] Would copy: $(basename "$src") -> $dst" "$GRAY"
  else
    cp "$src" "$dst"
  fi
}

safe_mkdir() {
  local dir="$1"
  if [[ "$DRY_RUN" == true ]]; then
    log "  [DRY-RUN] Would create: $dir" "$GRAY"
  else
    mkdir -p "$dir"
  fi
}

# ============================================================

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Soul Forge Customer Installer${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Initialize log
if [[ "$DRY_RUN" == false ]]; then
  echo "" > "$LOG_FILE"
fi
log "Soul Forge Customer Install started"
log "Script directory: $SCRIPT_DIR"
if [[ "$DRY_RUN" == true ]]; then
  log "MODE: DRY-RUN — no files will be written" "$CYAN"
fi

# --- [0/8] Pre-flight checks ---
log "[0/8] Pre-flight checks..." "$YELLOW"

# Bash version
BASH_MAJOR="${BASH_VERSINFO[0]:-0}"
if [[ "$BASH_MAJOR" -lt 3 ]]; then
  log "  ERROR: Bash 3.2+ required (found $BASH_VERSION)" "$RED"
  exit 1
fi
log "  Bash $BASH_VERSION — OK" "$GREEN"

# Node.js available? (needed for JSON manipulation in step 8)
if ! command -v node &>/dev/null; then
  log "  WARNING: Node.js not found. Step 8 (hooks auto-enable) will be skipped." "$YELLOW"
  log "  You may need to manually enable hooks in openclaw.json." "$YELLOW"
  HAS_NODE=false
else
  log "  Node.js $(node -v) — OK" "$GREEN"
  HAS_NODE=true
fi

# OpenClaw installed?
if [[ ! -d "$CONFIG_DIR" ]]; then
  log "  ERROR: OpenClaw config directory not found: $CONFIG_DIR" "$RED"
  log "  Please install OpenClaw first." "$RED"
  exit 1
fi
log "  OpenClaw config directory found — OK" "$GREEN"

# Source files present?
REQUIRED_FILES=(
  "skills/soul-forge/SKILL.md"
  "hooks/soul-forge-bootstrap/HOOK.md"
  "hooks/soul-forge-bootstrap/handler.js"
  ".soul_forge/config.json"
  ".soul_forge/memory.md"
  ".soul_forge/SOUL_INIT.md"
  ".soul_forge/IDENTITY_INIT.md"
  "HEARTBEAT_SEGMENT.md"
)

MISSING=()
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$f" ]]; then
    MISSING+=("$f")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  log "  ERROR: Missing source files:" "$RED"
  for m in "${MISSING[@]}"; do
    log "    - $m" "$RED"
  done
  log "  Ensure all files are in the correct subdirectories." "$RED"
  exit 1
fi
log "  All source files found — OK" "$GREEN"
log "  Pre-flight checks passed." "$GREEN"

# --- [1/8] Backup existing configuration ---
log "[1/8] Backing up existing configuration..." "$YELLOW"

BACKUPS_MADE=0

backup_if_exists() {
  local src="$1" dst="$2" label="$3"
  if [[ -f "$src" ]]; then
    if [[ -f "$dst" ]]; then
      log "  $label already backed up, preserving original." "$YELLOW"
    else
      safe_mkdir "$(dirname "$dst")"
      safe_cp "$src" "$dst"
      log "  $label -> $(basename "$dst")" "$GRAY"
      ((BACKUPS_MADE++)) || true
    fi
  fi
}

backup_if_exists "$WORKSPACE/SOUL.md" "$HISTORY_DIR/SOUL_BEFORE_SOULFORGE.md" "SOUL.md"
backup_if_exists "$WORKSPACE/IDENTITY.md" "$HISTORY_DIR/IDENTITY_BEFORE_SOULFORGE.md" "IDENTITY.md"
backup_if_exists "$WORKSPACE/HEARTBEAT.md" "$HISTORY_DIR/HEARTBEAT_BEFORE_SOULFORGE.md" "HEARTBEAT.md"
backup_if_exists "$CONFIG_DIR/openclaw.json" "$CONFIG_DIR/openclaw.before-soulforge.json" "openclaw.json"

if [[ "$BACKUPS_MADE" -eq 0 ]]; then
  log "  No existing files to back up (fresh install)." "$GRAY"
fi
log "  Done ($BACKUPS_MADE backups)." "$GREEN"
COMPLETED_STEPS+=("1-Backup")

# --- [2/8] Create directory structure ---
log "[2/8] Creating directory structure..." "$YELLOW"

for dir in "$SKILL_DIR" "$HOOK_DIR" "$RUNTIME_DIR" "$HISTORY_DIR"; do
  safe_mkdir "$dir"
  log "  $dir" "$GRAY"
done
log "  Done." "$GREEN"
COMPLETED_STEPS+=("2-Directories")

# --- [3/8] Install Skill ---
log "[3/8] Installing skill (managed)..." "$YELLOW"

safe_cp "$SCRIPT_DIR/skills/soul-forge/SKILL.md" "$SKILL_DIR/SKILL.md"
log "  SKILL.md -> $SKILL_DIR/" "$GRAY"
log "  Done." "$GREEN"
COMPLETED_STEPS+=("3-Skill")

# --- [4/8] Install Hook ---
log "[4/8] Installing hook (managed)..." "$YELLOW"

safe_cp "$SCRIPT_DIR/hooks/soul-forge-bootstrap/HOOK.md" "$HOOK_DIR/HOOK.md"
safe_cp "$SCRIPT_DIR/hooks/soul-forge-bootstrap/handler.js" "$HOOK_DIR/handler.js"

# Phase 3: sentiment engine files
if [[ -f "$SCRIPT_DIR/hooks/soul-forge-bootstrap/sentiment.js" ]]; then
  safe_cp "$SCRIPT_DIR/hooks/soul-forge-bootstrap/sentiment.js" "$HOOK_DIR/sentiment.js"
  log "  sentiment.js -> $HOOK_DIR/" "$GRAY"
fi
if [[ -d "$SCRIPT_DIR/hooks/soul-forge-bootstrap/sentiments" ]]; then
  safe_mkdir "$HOOK_DIR/sentiments"
  for dict in "$SCRIPT_DIR/hooks/soul-forge-bootstrap/sentiments/"*.json; do
    if [[ -f "$dict" ]]; then
      safe_cp "$dict" "$HOOK_DIR/sentiments/$(basename "$dict")"
      log "  sentiments/$(basename "$dict") -> $HOOK_DIR/sentiments/" "$GRAY"
    fi
  done
fi

log "  HOOK.md    -> $HOOK_DIR/" "$GRAY"
log "  handler.js -> $HOOK_DIR/" "$GRAY"
log "  Done." "$GREEN"
COMPLETED_STEPS+=("4-Hook")

# --- [5/8] Install runtime data ---
log "[5/8] Installing runtime data (workspace)..." "$YELLOW"

# config.json — only if not present (preserve existing calibration)
CFG_DST="$RUNTIME_DIR/config.json"
if [[ ! -f "$CFG_DST" ]]; then
  safe_cp "$SCRIPT_DIR/.soul_forge/config.json" "$CFG_DST"
  log "  config.json -> $RUNTIME_DIR/ (new)" "$GRAY"
else
  log "  config.json already exists, skipped." "$YELLOW"
fi

# memory.md — only if not present (preserve existing observations)
MEM_DST="$RUNTIME_DIR/memory.md"
if [[ ! -f "$MEM_DST" ]]; then
  safe_cp "$SCRIPT_DIR/.soul_forge/memory.md" "$MEM_DST"
  log "  memory.md -> $RUNTIME_DIR/ (new)" "$GRAY"
else
  log "  memory.md already exists, skipped." "$YELLOW"
fi

log "  Done." "$GREEN"
COMPLETED_STEPS+=("5-Runtime")

# --- [6/8] Install INIT templates ---
log "[6/8] Installing default INIT templates (.soul_history/)..." "$YELLOW"

SOUL_INIT_DST="$HISTORY_DIR/SOUL_INIT.md"
if [[ ! -f "$SOUL_INIT_DST" ]]; then
  safe_cp "$SCRIPT_DIR/.soul_forge/SOUL_INIT.md" "$SOUL_INIT_DST"
  log "  SOUL_INIT.md -> $HISTORY_DIR/ (new)" "$GRAY"
else
  log "  SOUL_INIT.md already exists, skipped." "$YELLOW"
fi

IDENTITY_INIT_DST="$HISTORY_DIR/IDENTITY_INIT.md"
if [[ ! -f "$IDENTITY_INIT_DST" ]]; then
  safe_cp "$SCRIPT_DIR/.soul_forge/IDENTITY_INIT.md" "$IDENTITY_INIT_DST"
  log "  IDENTITY_INIT.md -> $HISTORY_DIR/ (new)" "$GRAY"
else
  log "  IDENTITY_INIT.md already exists, skipped." "$YELLOW"
fi

log "  Done." "$GREEN"
COMPLETED_STEPS+=("6-INIT")

# --- [7/8] Install HEARTBEAT segment ---
log "[7/8] Installing HEARTBEAT segment..." "$YELLOW"

HEARTBEAT_PATH="$WORKSPACE/HEARTBEAT.md"
SEGMENT_SRC="$SCRIPT_DIR/HEARTBEAT_SEGMENT.md"

# Extract the SOUL_FORGE block
SOUL_FORGE_BLOCK=$(sed -n '/<!-- SOUL_FORGE_START/,/<!-- SOUL_FORGE_END -->/p' "$SEGMENT_SRC" 2>/dev/null || true)

if [[ -z "$SOUL_FORGE_BLOCK" ]]; then
  log "  WARNING: Could not extract SOUL_FORGE block from HEARTBEAT_SEGMENT.md" "$RED"
  log "  Skipping HEARTBEAT installation." "$RED"
  COMPLETED_STEPS+=("7-HEARTBEAT(skipped)")
elif [[ -f "$HEARTBEAT_PATH" ]]; then
  if grep -q 'SOUL_FORGE_START' "$HEARTBEAT_PATH" 2>/dev/null; then
    log "  HEARTBEAT.md already contains Soul Forge segment, skipped." "$YELLOW"
  else
    if [[ "$DRY_RUN" == false ]]; then
      printf '\n%s\n' "$SOUL_FORGE_BLOCK" >> "$HEARTBEAT_PATH"
    fi
    log "  Soul Forge segment appended to HEARTBEAT.md" "$GRAY"
  fi
  COMPLETED_STEPS+=("7-HEARTBEAT")
else
  log "  HEARTBEAT.md not found — segment will be auto-created by handler.js on next bootstrap." "$YELLOW"
  COMPLETED_STEPS+=("7-HEARTBEAT")
fi

log "  Done." "$GREEN"

# --- [8/8] Enable hooks + Verification ---
log "[8/8] Verification + hooks check..." "$YELLOW"

OPENCLAW_JSON="$CONFIG_DIR/openclaw.json"

if [[ "$HAS_NODE" == true ]]; then
  if [[ -f "$OPENCLAW_JSON" ]]; then
    # Check if hooks.internal.enabled is already true
    HOOKS_ENABLED=$(node -e "
      try {
        const c = JSON.parse(require('fs').readFileSync('$OPENCLAW_JSON','utf-8'));
        console.log(c.hooks && c.hooks.internal && c.hooks.internal.enabled === true ? 'true' : 'false');
      } catch(e) { console.log('false'); }
    " 2>/dev/null || echo "false")

    if [[ "$HOOKS_ENABLED" != "true" ]]; then
      log "  hooks.internal.enabled not set — auto-enabling..." "$YELLOW"
      if [[ "$DRY_RUN" == false ]]; then
        node -e "
          const fs = require('fs');
          let c = {};
          try { c = JSON.parse(fs.readFileSync('$OPENCLAW_JSON','utf-8')); } catch(e) {}
          if (!c.hooks) c.hooks = {};
          if (!c.hooks.internal) c.hooks.internal = {};
          c.hooks.internal.enabled = true;
          fs.writeFileSync('$OPENCLAW_JSON', JSON.stringify(c, null, 2));
        " 2>/dev/null
      fi
      log "  hooks.internal.enabled = true — auto-enabled" "$GREEN"
    else
      log "  hooks.internal.enabled = true — OK" "$GREEN"
    fi
  else
    log "  openclaw.json not found — creating with hooks enabled..." "$YELLOW"
    if [[ "$DRY_RUN" == false ]]; then
      echo '{"hooks":{"internal":{"enabled":true}}}' | node -e "
        const fs = require('fs');
        let d = '';
        process.stdin.on('data', c => d += c);
        process.stdin.on('end', () => fs.writeFileSync('$OPENCLAW_JSON', JSON.stringify(JSON.parse(d), null, 2)));
      " 2>/dev/null
    fi
    log "  openclaw.json created with hooks.internal.enabled = true" "$GREEN"
  fi
else
  log "  Node.js not available — skipping hooks auto-enable." "$YELLOW"
  log "  Please manually add {\"hooks\":{\"internal\":{\"enabled\":true}}} to $OPENCLAW_JSON" "$YELLOW"
fi

# File verification
log "" "$NC"
log "  --- File Verification ---" "$CYAN"

ALL_OK=true
verify_file() {
  local filepath="$1" label="$2"
  if [[ "$DRY_RUN" == true ]]; then
    log "  SKIP  $label (dry-run mode)" "$GRAY"
    return
  fi
  if [[ -f "$filepath" ]]; then
    local size
    size=$(wc -c < "$filepath" 2>/dev/null | tr -d ' ')
    if [[ "$size" -gt 0 ]]; then
      log "  OK    $label ($size bytes)" "$GREEN"
    else
      log "  WARN  $label (0 bytes!)" "$RED"
      ALL_OK=false
    fi
  else
    log "  FAIL  $label (missing)" "$RED"
    ALL_OK=false
  fi
}

verify_file "$SKILL_DIR/SKILL.md"              "Skill SKILL.md"
verify_file "$HOOK_DIR/HOOK.md"                "Hook HOOK.md"
verify_file "$HOOK_DIR/handler.js"             "Hook handler.js"
verify_file "$RUNTIME_DIR/config.json"         "Runtime config.json"
verify_file "$RUNTIME_DIR/memory.md"           "Runtime memory.md"
verify_file "$HISTORY_DIR/SOUL_INIT.md"        "INIT SOUL_INIT.md"
verify_file "$HISTORY_DIR/IDENTITY_INIT.md"    "INIT IDENTITY_INIT.md"

# Optional Phase 3 files
if [[ -f "$HOOK_DIR/sentiment.js" ]]; then
  verify_file "$HOOK_DIR/sentiment.js"         "Sentiment sentiment.js"
fi
if [[ -f "$HOOK_DIR/sentiments/zh.json" ]]; then
  verify_file "$HOOK_DIR/sentiments/zh.json"   "Sentiment zh.json"
fi
if [[ -f "$HOOK_DIR/sentiments/en.json" ]]; then
  verify_file "$HOOK_DIR/sentiments/en.json"   "Sentiment en.json"
fi

COMPLETED_STEPS+=("8-Verify")

# --- Final Summary ---
log ""
log "============================================" "$CYAN"
log "  Installation Summary" "$CYAN"
log "============================================" "$CYAN"

log "  Completed steps: ${COMPLETED_STEPS[*]}" "$GREEN"
if [[ "$DRY_RUN" == false ]]; then
  log "  Log saved to: $LOG_FILE" "$GRAY"
fi

if [[ "$DRY_RUN" == true ]]; then
  log ""
  log "  DRY-RUN complete. No files were modified." "$CYAN"
  log "  Run without --dry-run to perform actual installation." "$CYAN"
elif [[ "$ALL_OK" == true ]]; then
  log ""
  log "  Installation successful!" "$GREEN"
  log ""
  log "  Next steps:" "$CYAN"
  log "    1. If using Docker: docker compose down && docker compose up -d" "$GRAY"
  log "    2. If running locally: restart the gateway" "$GRAY"
  log "    3. Check logs for: 'loaded 4 internal hook handlers'" "$GRAY"
  log "    4. Send /soul-forge in Telegram to start calibration" "$GRAY"
else
  log ""
  log "  Installation completed with warnings. Check above." "$YELLOW"
fi

log ""

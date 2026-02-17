# ============================================================
# Soul Forge MVP Installation Script (PowerShell)
# ============================================================
# Usage: Run in PowerShell
#   .\Soul_Forge_MVP_Install.ps1
#
# This script installs Soul Forge skill, hook, and runtime data
# into the correct OpenClaw directories.
# ============================================================

$ErrorActionPreference = "Stop"

# --- Path Configuration ---
$SOURCE      = "D:\Coding\OpenClaw_Indiviual_SOUL.md\src"
$CONFIG_DIR  = "$env:USERPROFILE\.openclaw"
$WORKSPACE   = "$env:USERPROFILE\.openclaw\workspace"

# Managed skill/hook dirs (CONFIG_DIR level, loaded by OpenClaw core)
$SKILL_DIR   = "$CONFIG_DIR\skills\soul-forge"
$HOOK_DIR    = "$CONFIG_DIR\hooks\soul-forge-bootstrap"

# Runtime data dir (WORKSPACE level, used by handler.js)
$RUNTIME_DIR = "$WORKSPACE\.soul_forge"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Soul Forge MVP Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Validate source files exist ---
Write-Host "[1/6] Validating source files..." -ForegroundColor Yellow

$requiredFiles = @(
    "$SOURCE\skills\soul-forge\SKILL.md",
    "$SOURCE\hooks\soul-forge-bootstrap\HOOK.md",
    "$SOURCE\hooks\soul-forge-bootstrap\handler.js",
    "$SOURCE\.soul_forge\config.json",
    "$SOURCE\.soul_forge\memory.md",
    "$SOURCE\.soul_forge\SOUL_INIT.md",
    "$SOURCE\.soul_forge\IDENTITY_INIT.md"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "  MISSING: $file" -ForegroundColor Red
        Write-Host "  Installation aborted." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  All source files found." -ForegroundColor Green

# --- Step 2: Create directories ---
Write-Host "[2/6] Creating directories..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $SKILL_DIR   | Out-Null
New-Item -ItemType Directory -Force -Path $HOOK_DIR    | Out-Null
New-Item -ItemType Directory -Force -Path $RUNTIME_DIR | Out-Null

Write-Host "  $SKILL_DIR" -ForegroundColor Gray
Write-Host "  $HOOK_DIR" -ForegroundColor Gray
Write-Host "  $RUNTIME_DIR" -ForegroundColor Gray
Write-Host "  Done." -ForegroundColor Green

# --- Step 3: Copy Skill ---
Write-Host "[3/6] Installing skill (managed)..." -ForegroundColor Yellow

Copy-Item "$SOURCE\skills\soul-forge\SKILL.md" "$SKILL_DIR\SKILL.md" -Force
Write-Host "  SKILL.md -> $SKILL_DIR\" -ForegroundColor Gray
Write-Host "  Done." -ForegroundColor Green

# --- Step 4: Copy Hook ---
Write-Host "[4/6] Installing hook (managed)..." -ForegroundColor Yellow

Copy-Item "$SOURCE\hooks\soul-forge-bootstrap\HOOK.md"    "$HOOK_DIR\HOOK.md"    -Force
Copy-Item "$SOURCE\hooks\soul-forge-bootstrap\handler.js" "$HOOK_DIR\handler.js" -Force
Write-Host "  HOOK.md    -> $HOOK_DIR\" -ForegroundColor Gray
Write-Host "  handler.js -> $HOOK_DIR\" -ForegroundColor Gray
Write-Host "  Done." -ForegroundColor Green

# --- Step 5: Copy Runtime Data (only if not already present) ---
Write-Host "[5/6] Installing runtime data (workspace)..." -ForegroundColor Yellow

if (-not (Test-Path "$RUNTIME_DIR\config.json")) {
    Copy-Item "$SOURCE\.soul_forge\config.json" "$RUNTIME_DIR\config.json"
    Write-Host "  config.json -> $RUNTIME_DIR\ (new)" -ForegroundColor Gray
} else {
    Write-Host "  config.json already exists, skipped." -ForegroundColor DarkYellow
}

if (-not (Test-Path "$RUNTIME_DIR\memory.md")) {
    Copy-Item "$SOURCE\.soul_forge\memory.md" "$RUNTIME_DIR\memory.md"
    Write-Host "  memory.md -> $RUNTIME_DIR\ (new)" -ForegroundColor Gray
} else {
    Write-Host "  memory.md already exists, skipped." -ForegroundColor DarkYellow
}

Write-Host "  Done." -ForegroundColor Green

# --- Step 6: Install .soul_history/ default templates (only if missing) ---
Write-Host "[6/6] Installing default INIT templates (.soul_history/)..." -ForegroundColor Yellow

$HISTORY_DIR = "$WORKSPACE\.soul_history"
if (-not (Test-Path $HISTORY_DIR)) {
    New-Item -ItemType Directory -Force -Path $HISTORY_DIR | Out-Null
    Write-Host "  Created $HISTORY_DIR" -ForegroundColor Gray
}

if (-not (Test-Path "$HISTORY_DIR\SOUL_INIT.md")) {
    Copy-Item "$SOURCE\.soul_forge\SOUL_INIT.md" "$HISTORY_DIR\SOUL_INIT.md"
    Write-Host "  SOUL_INIT.md -> $HISTORY_DIR\ (new)" -ForegroundColor Gray
} else {
    Write-Host "  SOUL_INIT.md already exists, skipped (preserving pristine default)." -ForegroundColor DarkYellow
}

if (-not (Test-Path "$HISTORY_DIR\IDENTITY_INIT.md")) {
    Copy-Item "$SOURCE\.soul_forge\IDENTITY_INIT.md" "$HISTORY_DIR\IDENTITY_INIT.md"
    Write-Host "  IDENTITY_INIT.md -> $HISTORY_DIR\ (new)" -ForegroundColor Gray
} else {
    Write-Host "  IDENTITY_INIT.md already exists, skipped (preserving pristine default)." -ForegroundColor DarkYellow
}

Write-Host "  Done." -ForegroundColor Green

# --- Verification ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$checkFiles = @(
    @{ Path = "$SKILL_DIR\SKILL.md";      Label = "Skill SKILL.md" },
    @{ Path = "$HOOK_DIR\HOOK.md";        Label = "Hook HOOK.md" },
    @{ Path = "$HOOK_DIR\handler.js";     Label = "Hook handler.js" },
    @{ Path = "$RUNTIME_DIR\config.json"; Label = "Runtime config.json" },
    @{ Path = "$RUNTIME_DIR\memory.md";   Label = "Runtime memory.md" },
    @{ Path = "$WORKSPACE\.soul_history\SOUL_INIT.md";     Label = "INIT SOUL_INIT.md" },
    @{ Path = "$WORKSPACE\.soul_history\IDENTITY_INIT.md"; Label = "INIT IDENTITY_INIT.md" }
)

$allOk = $true
foreach ($check in $checkFiles) {
    if (Test-Path $check.Path) {
        $size = (Get-Item $check.Path).Length
        if ($size -gt 0) {
            Write-Host "  OK  $($check.Label) ($size bytes)" -ForegroundColor Green
        } else {
            Write-Host "  WARN  $($check.Label) (0 bytes!)" -ForegroundColor Red
            $allOk = $false
        }
    } else {
        Write-Host "  FAIL  $($check.Label) (missing)" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "  Installation successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Cyan
    Write-Host "    1. Ensure OpenClaw source fix is applied:" -ForegroundColor Gray
    Write-Host "       src/agents/skills/config.ts needs 'workspace.dir': true" -ForegroundColor Gray
    Write-Host "    2. Rebuild OpenClaw (pnpm build or equivalent)" -ForegroundColor Gray
    Write-Host "    3. Restart the gateway (openclaw gateway run)" -ForegroundColor Gray
    Write-Host "    4. Send /soul-forge in Telegram" -ForegroundColor Gray
} else {
    Write-Host "  Installation completed with warnings. Check above." -ForegroundColor Yellow
}

Write-Host ""

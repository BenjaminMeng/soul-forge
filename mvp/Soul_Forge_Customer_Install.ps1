# ============================================================
# Soul Forge Customer Installation Script (PowerShell)
# ============================================================
# Usage:
#   .\Soul_Forge_Customer_Install.ps1           # Normal install
#   .\Soul_Forge_Customer_Install.ps1 -WhatIf   # Dry-run preview
#
# This script installs Soul Forge skill, hook, and runtime data
# into the correct OpenClaw directories. Designed for customer
# environments — no hardcoded developer paths.
# ============================================================

[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"

# --- Path Configuration ---
$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$CONFIG_DIR  = Join-Path $env:USERPROFILE ".openclaw"
$WORKSPACE   = Join-Path $CONFIG_DIR "workspace"

# Managed skill/hook dirs (CONFIG_DIR level, loaded by OpenClaw core)
$SKILL_DIR   = Join-Path $CONFIG_DIR "skills\soul-forge"
$HOOK_DIR    = Join-Path $CONFIG_DIR "hooks\soul-forge-bootstrap"

# Runtime data dir (WORKSPACE level, used by handler.js)
$RUNTIME_DIR = Join-Path $WORKSPACE ".soul_forge"
$HISTORY_DIR = Join-Path $WORKSPACE ".soul_history"

# Log file
$LOG_FILE    = Join-Path $SCRIPT_DIR "install_log.txt"

# Track completed steps for rollback guidance
$completedSteps = @()

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp  $Message" | Out-File -Append -FilePath $LOG_FILE -Encoding UTF8
}

function Write-RollbackGuide {
    param([string]$FailedStep)
    Write-Log "" Red
    Write-Log "============================================" Red
    Write-Log "  Installation failed at: $FailedStep" Red
    Write-Log "============================================" Red
    Write-Log ""
    if ($completedSteps.Count -gt 0) {
        Write-Log "  Completed steps: $($completedSteps -join ', ')" Yellow
        Write-Log ""
        Write-Log "  Manual rollback guide:" Yellow
        Write-Log "    - Skill files: Remove $SKILL_DIR" Yellow
        Write-Log "    - Hook files: Remove $HOOK_DIR" Yellow
        Write-Log "    - Runtime data: Remove $RUNTIME_DIR" Yellow
        Write-Log "    - INIT templates: Remove $HISTORY_DIR\SOUL_INIT.md and IDENTITY_INIT.md" Yellow
        if (Test-Path (Join-Path $CONFIG_DIR "openclaw.before-soulforge.json")) {
            Write-Log "    - Config restore: Copy openclaw.before-soulforge.json back to openclaw.json" Yellow
        }
    } else {
        Write-Log "  No steps completed — nothing to roll back." Gray
    }
    Write-Log ""
}

# ============================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Soul Forge Customer Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Initialize log
"" | Out-File -FilePath $LOG_FILE -Encoding UTF8
Write-Log "Soul Forge Customer Install started"
Write-Log "Script directory: $SCRIPT_DIR"
if ($WhatIfPreference) {
    Write-Log "MODE: DRY-RUN (WhatIf) — no files will be written" Cyan
}

# --- [0/8] Pre-flight checks ---
Write-Log "[0/8] Pre-flight checks..." Yellow

try {
    # PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-Log "  ERROR: PowerShell 5.1+ required (found $($PSVersionTable.PSVersion))" Red
        exit 1
    }
    Write-Log "  PowerShell $($PSVersionTable.PSVersion) — OK" Green

    # OpenClaw installed?
    if (-not (Test-Path $CONFIG_DIR)) {
        Write-Log "  ERROR: OpenClaw config directory not found: $CONFIG_DIR" Red
        Write-Log "  Please install OpenClaw first." Red
        exit 1
    }
    Write-Log "  OpenClaw config directory found — OK" Green

    # Source files present?
    $requiredFiles = @(
        @{ Path = "skills\soul-forge\SKILL.md";                      Label = "SKILL.md" },
        @{ Path = "hooks\soul-forge-bootstrap\HOOK.md";              Label = "HOOK.md" },
        @{ Path = "hooks\soul-forge-bootstrap\handler.js";           Label = "handler.js" },
        @{ Path = ".soul_forge\config.json";                          Label = "config.json" },
        @{ Path = ".soul_forge\memory.md";                            Label = "memory.md" },
        @{ Path = ".soul_forge\SOUL_INIT.md";                         Label = "SOUL_INIT.md" },
        @{ Path = ".soul_forge\IDENTITY_INIT.md";                     Label = "IDENTITY_INIT.md" },
        @{ Path = "HEARTBEAT_SEGMENT.md";                             Label = "HEARTBEAT_SEGMENT.md" }
    )

    $missing = @()
    foreach ($f in $requiredFiles) {
        $fullPath = Join-Path $SCRIPT_DIR $f.Path
        if (-not (Test-Path $fullPath)) {
            $missing += $f.Label
        }
    }
    if ($missing.Count -gt 0) {
        Write-Log "  ERROR: Missing source files: $($missing -join ', ')" Red
        Write-Log "  Ensure all files are in the same directory as this script." Red
        exit 1
    }
    Write-Log "  All source files found — OK" Green

    Write-Log "  Pre-flight checks passed." Green
} catch {
    Write-Log "  Pre-flight check error: $_" Red
    exit 1
}

# --- [1/8] Backup existing configuration ---
Write-Log "[1/8] Backing up existing configuration..." Yellow

try {
    $backupsMade = 0

    # SOUL.md
    $soulPath = Join-Path $WORKSPACE "SOUL.md"
    if (Test-Path $soulPath) {
        $backupDest = Join-Path $HISTORY_DIR "SOUL_BEFORE_SOULFORGE.md"
        if (-not (Test-Path $HISTORY_DIR)) {
            if ($PSCmdlet.ShouldProcess($HISTORY_DIR, "Create directory")) {
                New-Item -ItemType Directory -Force -Path $HISTORY_DIR | Out-Null
            }
        }
        if ($PSCmdlet.ShouldProcess($soulPath, "Backup SOUL.md")) {
            Copy-Item $soulPath $backupDest -Force
        }
        Write-Log "  SOUL.md -> SOUL_BEFORE_SOULFORGE.md" Gray
        $backupsMade++
    }

    # IDENTITY.md
    $identityPath = Join-Path $WORKSPACE "IDENTITY.md"
    if (Test-Path $identityPath) {
        $backupDest = Join-Path $HISTORY_DIR "IDENTITY_BEFORE_SOULFORGE.md"
        if (-not (Test-Path $HISTORY_DIR)) {
            if ($PSCmdlet.ShouldProcess($HISTORY_DIR, "Create directory")) {
                New-Item -ItemType Directory -Force -Path $HISTORY_DIR | Out-Null
            }
        }
        if ($PSCmdlet.ShouldProcess($identityPath, "Backup IDENTITY.md")) {
            Copy-Item $identityPath $backupDest -Force
        }
        Write-Log "  IDENTITY.md -> IDENTITY_BEFORE_SOULFORGE.md" Gray
        $backupsMade++
    }

    # HEARTBEAT.md
    $heartbeatPath = Join-Path $WORKSPACE "HEARTBEAT.md"
    if (Test-Path $heartbeatPath) {
        $backupDest = Join-Path $HISTORY_DIR "HEARTBEAT_BEFORE_SOULFORGE.md"
        if (-not (Test-Path $HISTORY_DIR)) {
            if ($PSCmdlet.ShouldProcess($HISTORY_DIR, "Create directory")) {
                New-Item -ItemType Directory -Force -Path $HISTORY_DIR | Out-Null
            }
        }
        if ($PSCmdlet.ShouldProcess($heartbeatPath, "Backup HEARTBEAT.md")) {
            Copy-Item $heartbeatPath $backupDest -Force
        }
        Write-Log "  HEARTBEAT.md -> HEARTBEAT_BEFORE_SOULFORGE.md" Gray
        $backupsMade++
    }

    # openclaw.json
    $openclawJson = Join-Path $CONFIG_DIR "openclaw.json"
    if (Test-Path $openclawJson) {
        $backupDest = Join-Path $CONFIG_DIR "openclaw.before-soulforge.json"
        if ($PSCmdlet.ShouldProcess($openclawJson, "Backup openclaw.json")) {
            Copy-Item $openclawJson $backupDest -Force
        }
        Write-Log "  openclaw.json -> openclaw.before-soulforge.json" Gray
        $backupsMade++
    }

    if ($backupsMade -eq 0) {
        Write-Log "  No existing files to back up (fresh install)." Gray
    }
    Write-Log "  Done ($backupsMade backups)." Green
    $completedSteps += "1-Backup"
} catch {
    Write-RollbackGuide "Step 1 (Backup)"
    throw
}

# --- [2/8] Create directory structure ---
Write-Log "[2/8] Creating directory structure..." Yellow

try {
    $dirs = @($SKILL_DIR, $HOOK_DIR, $RUNTIME_DIR, $HISTORY_DIR)
    foreach ($dir in $dirs) {
        if ($PSCmdlet.ShouldProcess($dir, "Create directory")) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        Write-Log "  $dir" Gray
    }
    Write-Log "  Done." Green
    $completedSteps += "2-Directories"
} catch {
    Write-RollbackGuide "Step 2 (Create directories)"
    throw
}

# --- [3/8] Install Skill ---
Write-Log "[3/8] Installing skill (managed)..." Yellow

try {
    $src = Join-Path $SCRIPT_DIR "skills\soul-forge\SKILL.md"
    $dst = Join-Path $SKILL_DIR "SKILL.md"
    if ($PSCmdlet.ShouldProcess($dst, "Copy SKILL.md")) {
        Copy-Item $src $dst -Force
    }
    Write-Log "  SKILL.md -> $SKILL_DIR\" Gray
    Write-Log "  Done." Green
    $completedSteps += "3-Skill"
} catch {
    Write-RollbackGuide "Step 3 (Install Skill)"
    throw
}

# --- [4/8] Install Hook ---
Write-Log "[4/8] Installing hook (managed)..." Yellow

try {
    $srcHook = Join-Path $SCRIPT_DIR "hooks\soul-forge-bootstrap\HOOK.md"
    $srcHandler = Join-Path $SCRIPT_DIR "hooks\soul-forge-bootstrap\handler.js"
    if ($PSCmdlet.ShouldProcess((Join-Path $HOOK_DIR "HOOK.md"), "Copy HOOK.md")) {
        Copy-Item $srcHook (Join-Path $HOOK_DIR "HOOK.md") -Force
    }
    if ($PSCmdlet.ShouldProcess((Join-Path $HOOK_DIR "handler.js"), "Copy handler.js")) {
        Copy-Item $srcHandler (Join-Path $HOOK_DIR "handler.js") -Force
    }
    Write-Log "  HOOK.md    -> $HOOK_DIR\" Gray
    Write-Log "  handler.js -> $HOOK_DIR\" Gray
    Write-Log "  Done." Green
    $completedSteps += "4-Hook"
} catch {
    Write-RollbackGuide "Step 4 (Install Hook)"
    throw
}

# --- [5/8] Install runtime data ---
Write-Log "[5/8] Installing runtime data (workspace)..." Yellow

try {
    # config.json — only if not present (preserve existing calibration)
    $cfgDst = Join-Path $RUNTIME_DIR "config.json"
    if (-not (Test-Path $cfgDst)) {
        $cfgSrc = Join-Path $SCRIPT_DIR ".soul_forge\config.json"
        if ($PSCmdlet.ShouldProcess($cfgDst, "Copy config.json")) {
            Copy-Item $cfgSrc $cfgDst
        }
        Write-Log "  config.json -> $RUNTIME_DIR\ (new)" Gray
    } else {
        Write-Log "  config.json already exists, skipped." DarkYellow
    }

    # memory.md — only if not present (preserve existing observations)
    $memDst = Join-Path $RUNTIME_DIR "memory.md"
    if (-not (Test-Path $memDst)) {
        $memSrc = Join-Path $SCRIPT_DIR ".soul_forge\memory.md"
        if ($PSCmdlet.ShouldProcess($memDst, "Copy memory.md")) {
            Copy-Item $memSrc $memDst
        }
        Write-Log "  memory.md -> $RUNTIME_DIR\ (new)" Gray
    } else {
        Write-Log "  memory.md already exists, skipped." DarkYellow
    }

    Write-Log "  Done." Green
    $completedSteps += "5-Runtime"
} catch {
    Write-RollbackGuide "Step 5 (Install runtime data)"
    throw
}

# --- [6/8] Install INIT templates ---
Write-Log "[6/8] Installing default INIT templates (.soul_history/)..." Yellow

try {
    $soulInitDst = Join-Path $HISTORY_DIR "SOUL_INIT.md"
    if (-not (Test-Path $soulInitDst)) {
        $soulInitSrc = Join-Path $SCRIPT_DIR ".soul_forge\SOUL_INIT.md"
        if ($PSCmdlet.ShouldProcess($soulInitDst, "Copy SOUL_INIT.md")) {
            Copy-Item $soulInitSrc $soulInitDst
        }
        Write-Log "  SOUL_INIT.md -> $HISTORY_DIR\ (new)" Gray
    } else {
        Write-Log "  SOUL_INIT.md already exists, skipped (preserving pristine default)." DarkYellow
    }

    $identityInitDst = Join-Path $HISTORY_DIR "IDENTITY_INIT.md"
    if (-not (Test-Path $identityInitDst)) {
        $identityInitSrc = Join-Path $SCRIPT_DIR ".soul_forge\IDENTITY_INIT.md"
        if ($PSCmdlet.ShouldProcess($identityInitDst, "Copy IDENTITY_INIT.md")) {
            Copy-Item $identityInitSrc $identityInitDst
        }
        Write-Log "  IDENTITY_INIT.md -> $HISTORY_DIR\ (new)" Gray
    } else {
        Write-Log "  IDENTITY_INIT.md already exists, skipped (preserving pristine default)." DarkYellow
    }

    Write-Log "  Done." Green
    $completedSteps += "6-INIT"
} catch {
    Write-RollbackGuide "Step 6 (Install INIT templates)"
    throw
}

# --- [7/8] Install HEARTBEAT segment ---
Write-Log "[7/8] Installing HEARTBEAT segment..." Yellow

try {
    $heartbeatPath = Join-Path $WORKSPACE "HEARTBEAT.md"
    $segmentSrc = Join-Path $SCRIPT_DIR "HEARTBEAT_SEGMENT.md"

    # Read the segment content (skip the instruction header, take from the marker line)
    $segmentContent = Get-Content $segmentSrc -Raw -Encoding UTF8
    # Extract from <!-- SOUL_FORGE_START to <!-- SOUL_FORGE_END -->
    if ($segmentContent -match '(?s)(<!-- SOUL_FORGE_START.*?<!-- SOUL_FORGE_END -->)') {
        $soulForgeBlock = $Matches[1]
    } else {
        Write-Log "  WARNING: Could not extract SOUL_FORGE block from HEARTBEAT_SEGMENT.md" Red
        Write-Log "  Skipping HEARTBEAT installation." Red
        $completedSteps += "7-HEARTBEAT(skipped)"
        throw "HEARTBEAT_SEGMENT.md format error"
    }

    if (Test-Path $heartbeatPath) {
        $existingContent = Get-Content $heartbeatPath -Raw -Encoding UTF8
        # Idempotency check: already contains the marker?
        if ($existingContent -match 'SOUL_FORGE_START') {
            Write-Log "  HEARTBEAT.md already contains Soul Forge segment, skipped." DarkYellow
        } else {
            if ($PSCmdlet.ShouldProcess($heartbeatPath, "Append Soul Forge segment to HEARTBEAT.md")) {
                "`n$soulForgeBlock`n" | Out-File -Append -FilePath $heartbeatPath -Encoding UTF8 -NoNewline
            }
            Write-Log "  Soul Forge segment appended to HEARTBEAT.md" Gray
        }
    } else {
        Write-Log "  HEARTBEAT.md not found — segment will be auto-created by handler.js on next bootstrap." DarkYellow
    }

    Write-Log "  Done." Green
    $completedSteps += "7-HEARTBEAT"
} catch {
    if ($_.Exception.Message -ne "HEARTBEAT_SEGMENT.md format error") {
        Write-RollbackGuide "Step 7 (Install HEARTBEAT segment)"
        throw
    }
}

# --- [8/8] Enable hooks + Verification ---
Write-Log "[8/8] Verification + hooks check..." Yellow

try {
    # Check hooks.internal.enabled in openclaw.json
    $openclawJson = Join-Path $CONFIG_DIR "openclaw.json"
    if (Test-Path $openclawJson) {
        $config = Get-Content $openclawJson -Raw -Encoding UTF8 | ConvertFrom-Json
        $hooksEnabled = $false
        if ($config.hooks -and $config.hooks.internal -and $config.hooks.internal.enabled -eq $true) {
            $hooksEnabled = $true
        }
        if (-not $hooksEnabled) {
            Write-Log "  NOTE: hooks.internal.enabled is not set to true in openclaw.json" Yellow
            Write-Log "  Soul Forge Bootstrap Hook requires this setting." Yellow
            Write-Log "  You may need to add the following to openclaw.json:" Yellow
            Write-Log '    "hooks": { "internal": { "enabled": true } }' Yellow
        } else {
            Write-Log "  hooks.internal.enabled = true — OK" Green
        }
    } else {
        Write-Log "  openclaw.json not found — hooks setting needs manual configuration." Yellow
    }

    # File verification
    Write-Log "" White
    Write-Log "  --- File Verification ---" Cyan

    $checkFiles = @(
        @{ Path = (Join-Path $SKILL_DIR "SKILL.md");              Label = "Skill SKILL.md" },
        @{ Path = (Join-Path $HOOK_DIR "HOOK.md");                Label = "Hook HOOK.md" },
        @{ Path = (Join-Path $HOOK_DIR "handler.js");             Label = "Hook handler.js" },
        @{ Path = (Join-Path $RUNTIME_DIR "config.json");         Label = "Runtime config.json" },
        @{ Path = (Join-Path $RUNTIME_DIR "memory.md");           Label = "Runtime memory.md" },
        @{ Path = (Join-Path $HISTORY_DIR "SOUL_INIT.md");        Label = "INIT SOUL_INIT.md" },
        @{ Path = (Join-Path $HISTORY_DIR "IDENTITY_INIT.md");    Label = "INIT IDENTITY_INIT.md" }
    )

    $allOk = $true
    foreach ($check in $checkFiles) {
        if (Test-Path $check.Path) {
            $size = (Get-Item $check.Path).Length
            if ($size -gt 0) {
                Write-Log "  OK    $($check.Label) ($size bytes)" Green
            } else {
                Write-Log "  WARN  $($check.Label) (0 bytes!)" Red
                $allOk = $false
            }
        } else {
            if ($WhatIfPreference) {
                Write-Log "  SKIP  $($check.Label) (WhatIf mode)" Gray
            } else {
                Write-Log "  FAIL  $($check.Label) (missing)" Red
                $allOk = $false
            }
        }
    }

    $completedSteps += "8-Verify"
} catch {
    Write-RollbackGuide "Step 8 (Verification)"
    throw
}

# --- Final Summary ---
Write-Log ""
Write-Log "============================================" Cyan
Write-Log "  Installation Summary" Cyan
Write-Log "============================================" Cyan

Write-Log "  Completed steps: $($completedSteps -join ', ')" Green
Write-Log "  Log saved to: $LOG_FILE" Gray

if ($WhatIfPreference) {
    Write-Log ""
    Write-Log "  DRY-RUN complete. No files were modified." Cyan
    Write-Log "  Run without -WhatIf to perform actual installation." Cyan
} elseif ($allOk) {
    Write-Log ""
    Write-Log "  Installation successful!" Green
    Write-Log ""
    Write-Log "  Next steps:" Cyan
    Write-Log "    1. If using Docker: docker compose down && docker compose up -d" Gray
    Write-Log "    2. If running locally: restart the gateway" Gray
    Write-Log "    3. Check logs for: 'loaded 4 internal hook handlers'" Gray
    Write-Log "    4. Send /soul-forge in Telegram to start calibration" Gray
} else {
    Write-Log ""
    Write-Log "  Installation completed with warnings. Check above." Yellow
}

Write-Log ""

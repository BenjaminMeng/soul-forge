# ============================================================
# Soul Forge Customer Install — Automated Test Script
# ============================================================
# Runs 7 test suites against customer_package/Install.ps1
# in isolated sandboxes (temp USERPROFILE). Zero pollution to
# real C:\Users\..\.openclaw\.
#
# Usage:
#   .\Test-CustomerInstall.ps1                    # Suites 1-6 (main regression)
#   .\Test-CustomerInstall.ps1 -RunSetupBatSmoke  # Suites 1-7 (includes Setup.bat smoke)
#
# Exit code: 0 = all pass, 1 = failures
# ============================================================

[CmdletBinding()]
param(
    [switch]$RunSetupBatSmoke
)

$ErrorActionPreference = "Stop"

$script:testScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:packageDir = Join-Path $script:testScriptDir "customer_package"
$script:originalUserProfile = $env:USERPROFILE

# --- Counters ---
$script:failures = @()
$script:passCount = 0
$script:totalCount = 0

# ============================================================
# Assert helpers
# ============================================================

function Assert-FileExists {
    param([string]$Path, [string]$Label)
    $script:totalCount++
    if (Test-Path $Path) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (not found: $Path)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-FileNotExists {
    param([string]$Path, [string]$Label)
    $script:totalCount++
    if (-not (Test-Path $Path)) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (unexpectedly exists: $Path)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-FileNonZero {
    param([string]$Path, [string]$Label)
    $script:totalCount++
    if ((Test-Path $Path) -and (Get-Item $Path).Length -gt 0) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (missing or 0 bytes: $Path)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-FileContent {
    param([string]$Path, [string]$Expected, [string]$Label)
    $script:totalCount++
    if (Test-Path $Path) {
        $content = Get-Content $Path -Raw -Encoding UTF8
        if ($content -imatch [regex]::Escape($Expected)) {
            Write-Host "  PASS  $Label" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "  FAIL  $Label (pattern '$Expected' not found in $Path)" -ForegroundColor Red
            $script:failures += $Label
        }
    } else {
        Write-Host "  FAIL  $Label (file not found: $Path)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-FileHash {
    param([string]$Path, [string]$ExpectedHash, [string]$Label)
    $script:totalCount++
    if (Test-Path $Path) {
        $hash = (Get-FileHash $Path -Algorithm SHA256).Hash
        if ($hash -eq $ExpectedHash) {
            Write-Host "  PASS  $Label" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "  FAIL  $Label (hash mismatch)" -ForegroundColor Red
            $script:failures += $Label
        }
    } else {
        Write-Host "  FAIL  $Label (file not found: $Path)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-StringCount {
    param([string]$Path, [string]$Pattern, [int]$ExpectedCount, [string]$Label)
    $script:totalCount++
    if (Test-Path $Path) {
        $content = Get-Content $Path -Raw -Encoding UTF8
        $matches = [regex]::Matches($content, $Pattern)
        if ($matches.Count -eq $ExpectedCount) {
            Write-Host "  PASS  $Label" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "  FAIL  $Label (expected $ExpectedCount, got $($matches.Count))" -ForegroundColor Red
            $script:failures += $Label
        }
    } else {
        # File not found = 0 matches
        if ($ExpectedCount -eq 0) {
            Write-Host "  PASS  $Label" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "  FAIL  $Label (file not found: $Path)" -ForegroundColor Red
            $script:failures += $Label
        }
    }
}

function Assert-OutputContains {
    param([string]$Output, [string]$Pattern, [string]$Label)
    $script:totalCount++
    if ($Output -imatch $Pattern) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (pattern '$Pattern' not found in output)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-ExitCode {
    param([int]$Actual, [int]$Expected, [string]$Label)
    $script:totalCount++
    if ($Actual -eq $Expected) {
        Write-Host "  PASS  $Label" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (expected $Expected, got $Actual)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-ExitCodeNot {
    param([int]$Actual, [int]$NotExpected, [string]$Label)
    $script:totalCount++
    if ($Actual -ne $NotExpected) {
        Write-Host "  PASS  $Label (got $Actual)" -ForegroundColor Green
        $script:passCount++
    } else {
        Write-Host "  FAIL  $Label (expected NOT $NotExpected, but got $Actual)" -ForegroundColor Red
        $script:failures += $Label
    }
}

function Assert-JsonField {
    param([string]$Path, [string]$FieldPath, $ExpectedValue, [string]$Label)
    $script:totalCount++
    if (-not (Test-Path $Path)) {
        Write-Host "  FAIL  $Label (file not found: $Path)" -ForegroundColor Red
        $script:failures += $Label
        return
    }
    try {
        $json = Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
        $current = $json
        foreach ($segment in $FieldPath.Split('.')) {
            $current = $current.$segment
        }
        if ($current -eq $ExpectedValue) {
            Write-Host "  PASS  $Label" -ForegroundColor Green
            $script:passCount++
        } else {
            Write-Host "  FAIL  $Label (expected '$ExpectedValue', got '$current')" -ForegroundColor Red
            $script:failures += $Label
        }
    } catch {
        Write-Host "  FAIL  $Label (JSON parse error: $_)" -ForegroundColor Red
        $script:failures += $Label
    }
}

# ============================================================
# Sandbox infrastructure
# ============================================================

function New-Sandbox {
    param([string]$Name)
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    $sandbox = Join-Path $env:TEMP "SoulForgeTest_${Name}_${ts}"
    New-Item -ItemType Directory -Path $sandbox | Out-Null

    # Create minimal OpenClaw structure
    $ocDir = Join-Path $sandbox ".openclaw"
    New-Item -ItemType Directory -Force -Path (Join-Path $ocDir "workspace") | Out-Null

    # Write openclaw.json with hooks enabled
    @{ hooks = @{ internal = @{ enabled = $true } } } |
        ConvertTo-Json -Depth 3 |
        Out-File (Join-Path $ocDir "openclaw.json") -Encoding UTF8

    # Switch USERPROFILE
    $script:originalUserProfile = $env:USERPROFILE
    $env:USERPROFILE = $sandbox

    return $sandbox
}

function Remove-Sandbox {
    param([string]$SandboxPath)
    # Return to test script dir to avoid being inside sandbox when deleting
    Set-Location $script:testScriptDir
    $env:USERPROFILE = $script:originalUserProfile
    if ($SandboxPath -and (Test-Path $SandboxPath)) {
        Remove-Item $SandboxPath -Recurse -Force
    }
}

function Invoke-Install {
    param([string[]]$Arguments = @())
    $installScript = Join-Path $script:packageDir "Install.ps1"

    # Clean residual log from previous runs
    $logFile = Join-Path $script:packageDir "install_log.txt"
    if (Test-Path $logFile) { Remove-Item $logFile -Force }

    # Record full command line for debugging
    $cmdLine = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$installScript`" $($Arguments -join ' ')"
    Write-Host "  CMD: $cmdLine" -ForegroundColor DarkGray

    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $installScript @Arguments *>&1 | Out-String
    return @{ ExitCode = $LASTEXITCODE; Output = $output; CommandLine = $cmdLine }
}

# ============================================================
# Suite runner
# ============================================================

function Run-Suite {
    param([string]$Name, [scriptblock]$Body)
    Write-Host "`n=== Suite: $Name ===" -ForegroundColor Cyan
    $sandbox = $null
    try {
        $sandbox = New-Sandbox $Name
        & $Body $sandbox
    } catch {
        Write-Host "  ERROR in $Name : $_" -ForegroundColor Red
        $script:failures += "$Name (exception: $_)"
        $script:totalCount++
    } finally {
        if ($sandbox) { Remove-Sandbox $sandbox }
    }
}

# ============================================================
# Suite 1: DryRun
# ============================================================

Run-Suite "DryRun" {
    param($sb)

    # Overwrite openclaw.json to have NO hooks field — tests that WhatIf doesn't modify it
    $ocJson = Join-Path $sb ".openclaw\openclaw.json"
    '{}' | Out-File $ocJson -Encoding UTF8
    $ocJsonHash = (Get-FileHash $ocJson -Algorithm SHA256).Hash

    $r = Invoke-Install -Arguments @("-WhatIf")

    Assert-ExitCode $r.ExitCode 0 "DryRun: exit code = 0"

    $logFile = Join-Path $script:packageDir "install_log.txt"
    Assert-FileNotExists $logFile "DryRun: install_log.txt not created"

    $skillDir = Join-Path $sb ".openclaw\skills\soul-forge"
    Assert-FileNotExists $skillDir "DryRun: skill dir not created"

    $runtimeDir = Join-Path $sb ".openclaw\workspace\.soul_forge"
    Assert-FileNotExists $runtimeDir "DryRun: runtime dir not created"

    Assert-OutputContains $r.Output "DRY.?RUN complete" "DryRun: output confirms dry-run"

    Assert-FileHash $ocJson $ocJsonHash "DryRun: openclaw.json not modified by WhatIf"
}

# ============================================================
# Suite 2: FreshInstall
# ============================================================

Run-Suite "FreshInstall" {
    param($sb)

    $r = Invoke-Install

    $ocDir   = Join-Path $sb ".openclaw"
    $wsDir   = Join-Path $ocDir "workspace"
    $skillDir = Join-Path $ocDir "skills\soul-forge"
    $hookDir  = Join-Path $ocDir "hooks\soul-forge-bootstrap"
    $rtDir    = Join-Path $wsDir ".soul_forge"
    $histDir  = Join-Path $wsDir ".soul_history"

    Assert-ExitCode $r.ExitCode 0 "Fresh: exit code = 0"
    Assert-FileNonZero (Join-Path $skillDir "SKILL.md") "Fresh: SKILL.md exists"
    Assert-FileNonZero (Join-Path $hookDir "HOOK.md") "Fresh: HOOK.md exists"
    Assert-FileNonZero (Join-Path $hookDir "handler.js") "Fresh: handler.js exists"
    Assert-FileContent (Join-Path $rtDir "config.json") "fresh" "Fresh: config.json contains fresh"
    Assert-FileContent (Join-Path $rtDir "memory.md") "Soul Forge Observations" "Fresh: memory.md header"
    Assert-FileNonZero (Join-Path $histDir "SOUL_INIT.md") "Fresh: SOUL_INIT.md exists"
    Assert-FileNonZero (Join-Path $histDir "IDENTITY_INIT.md") "Fresh: IDENTITY_INIT.md exists"

    $logFile = Join-Path $script:packageDir "install_log.txt"
    Assert-FileNonZero $logFile "Fresh: install_log.txt created"

    Assert-OutputContains $r.Output "Installation successful" "Fresh: success message"
}

# ============================================================
# Suite 3: ExistingUser
# ============================================================

Run-Suite "ExistingUser" {
    param($sb)

    $wsDir = Join-Path $sb ".openclaw\workspace"

    # Pre-populate existing files
    "# My existing personality" | Out-File (Join-Path $wsDir "SOUL.md") -Encoding UTF8
    "# My existing identity"   | Out-File (Join-Path $wsDir "IDENTITY.md") -Encoding UTF8
    "# Heartbeat`n`nExisting content here" | Out-File (Join-Path $wsDir "HEARTBEAT.md") -Encoding UTF8

    $r = Invoke-Install

    $ocDir    = Join-Path $sb ".openclaw"
    $skillDir = Join-Path $ocDir "skills\soul-forge"
    $hookDir  = Join-Path $ocDir "hooks\soul-forge-bootstrap"
    $rtDir    = Join-Path $wsDir ".soul_forge"
    $histDir  = Join-Path $wsDir ".soul_history"

    Assert-ExitCode $r.ExitCode 0 "Existing: exit code = 0"

    # Same file existence checks as FreshInstall
    Assert-FileNonZero (Join-Path $skillDir "SKILL.md") "Existing: SKILL.md exists"
    Assert-FileNonZero (Join-Path $hookDir "HOOK.md") "Existing: HOOK.md exists"
    Assert-FileNonZero (Join-Path $hookDir "handler.js") "Existing: handler.js exists"
    Assert-FileContent (Join-Path $rtDir "config.json") "fresh" "Existing: config.json contains fresh"
    Assert-FileContent (Join-Path $rtDir "memory.md") "Soul Forge Observations" "Existing: memory.md header"
    Assert-FileNonZero (Join-Path $histDir "SOUL_INIT.md") "Existing: SOUL_INIT.md exists"
    Assert-FileNonZero (Join-Path $histDir "IDENTITY_INIT.md") "Existing: IDENTITY_INIT.md exists"

    # Backup checks
    Assert-FileExists (Join-Path $histDir "SOUL_BEFORE_SOULFORGE.md") "Existing: SOUL backup exists"
    Assert-FileContent (Join-Path $histDir "SOUL_BEFORE_SOULFORGE.md") "My existing personality" "Existing: SOUL backup content"
    Assert-FileExists (Join-Path $histDir "IDENTITY_BEFORE_SOULFORGE.md") "Existing: IDENTITY backup exists"
    Assert-FileContent (Join-Path $histDir "IDENTITY_BEFORE_SOULFORGE.md") "My existing identity" "Existing: IDENTITY backup content"

    Assert-StringCount (Join-Path $wsDir "HEARTBEAT.md") "SOUL_FORGE_START" 1 "Existing: HEARTBEAT segment count = 1"
}

# ============================================================
# Suite 4: Idempotency
# ============================================================

Run-Suite "Idempotency" {
    param($sb)

    $wsDir   = Join-Path $sb ".openclaw\workspace"
    $rtDir   = Join-Path $wsDir ".soul_forge"
    $histDir = Join-Path $wsDir ".soul_history"

    # First install to establish baseline
    $r1 = Invoke-Install
    if ($r1.ExitCode -ne 0) {
        Write-Host "  SKIP Idempotency: first install failed (exit $($r1.ExitCode))" -ForegroundColor Red
        $script:failures += "Idempotency (first install failed)"
        $script:totalCount++
        return
    }

    # Modify config.json to simulate calibrated state
    $cfgPath = Join-Path $rtDir "config.json"
    '{"status":"calibrated","version":1,"disc_type":"I"}' | Out-File $cfgPath -Encoding UTF8

    # Append observation to memory.md
    $memPath = Join-Path $rtDir "memory.md"
    "`n## Observation 1`nUser prefers concise answers" | Out-File -Append $memPath -Encoding UTF8

    # Record hashes before second run
    $cfgHash  = (Get-FileHash $cfgPath -Algorithm SHA256).Hash
    $memHash  = (Get-FileHash $memPath -Algorithm SHA256).Hash
    $soulInitHash    = (Get-FileHash (Join-Path $histDir "SOUL_INIT.md") -Algorithm SHA256).Hash
    $identityInitHash = (Get-FileHash (Join-Path $histDir "IDENTITY_INIT.md") -Algorithm SHA256).Hash

    # Second install
    $r2 = Invoke-Install

    Assert-ExitCode $r2.ExitCode 0 "Idempotent: exit code = 0"
    Assert-FileHash $cfgPath $cfgHash "Idempotent: config.json not overwritten"
    Assert-FileHash $memPath $memHash "Idempotent: memory.md not overwritten"
    Assert-FileHash (Join-Path $histDir "SOUL_INIT.md") $soulInitHash "Idempotent: SOUL_INIT.md preserved"
    Assert-FileHash (Join-Path $histDir "IDENTITY_INIT.md") $identityInitHash "Idempotent: IDENTITY_INIT.md preserved"

    Assert-StringCount (Join-Path $wsDir "HEARTBEAT.md") "SOUL_FORGE_START" 0 "Idempotent: no duplicate segment (no HEARTBEAT.md)"

    Assert-OutputContains $r2.Output "config.json already exists, skipped" "Idempotent: config skip msg"
    Assert-OutputContains $r2.Output "memory.md already exists, skipped" "Idempotent: memory skip msg"
}

# ============================================================
# Suite 5: FailureScenario
# ============================================================

$segmentPath = Join-Path $script:packageDir "HEARTBEAT_SEGMENT.md"
$segmentBak  = "$segmentPath.bak"
try {
    # Temporarily remove a required source file
    Rename-Item $segmentPath $segmentBak

    Run-Suite "FailureScenario" {
        param($sb)

        $r = Invoke-Install

        $ocDir = Join-Path $sb ".openclaw"

        # The install script should report missing file and exit 1
        Assert-ExitCode $r.ExitCode 1 "Failure: exit code = 1"
        Assert-OutputContains $r.Output "HEARTBEAT_SEGMENT" "Failure: names missing file"

        # No partial installation should have happened (pre-flight fails before any copy)
        Assert-FileNotExists (Join-Path $ocDir "skills\soul-forge\SKILL.md") "Failure: skill not created"
        Assert-FileNotExists (Join-Path $ocDir "workspace\.soul_forge\config.json") "Failure: runtime not created"
        Assert-FileNotExists (Join-Path $ocDir "hooks\soul-forge-bootstrap\HOOK.md") "Failure: hook not created"
    }
} finally {
    if (Test-Path $segmentBak) { Rename-Item $segmentBak $segmentPath }
}

# ============================================================
# Suite 6: HooksAutoEnable
# ============================================================

# Scenario A — openclaw.json exists but no hooks field
Run-Suite "HooksAutoEnable_Existing" {
    param($sb)

    # Overwrite openclaw.json with a custom field but no hooks
    $ocJson = Join-Path $sb ".openclaw\openclaw.json"
    '{"customSetting":"keep"}' | Out-File $ocJson -Encoding UTF8

    $r = Invoke-Install

    $ocDir = Join-Path $sb ".openclaw"

    Assert-ExitCode $r.ExitCode 0 "HooksA: exit code = 0"
    Assert-JsonField $ocJson "hooks.internal.enabled" $true "HooksA: hooks.internal.enabled injected"
    Assert-JsonField $ocJson "customSetting" "keep" "HooksA: existing field preserved"
    Assert-OutputContains $r.Output "auto-enabled" "HooksA: output confirms auto-enabled"
    Assert-FileExists (Join-Path $ocDir "openclaw.before-soulforge.json") "HooksA: backup exists"
}

# Scenario B — openclaw.json does not exist
Run-Suite "HooksAutoEnable_NoFile" {
    param($sb)

    # Remove openclaw.json (New-Sandbox creates it with hooks enabled, remove it)
    $ocJson = Join-Path $sb ".openclaw\openclaw.json"
    if (Test-Path $ocJson) { Remove-Item $ocJson -Force }

    $r = Invoke-Install

    Assert-ExitCode $r.ExitCode 0 "HooksB: exit code = 0"
    Assert-JsonField $ocJson "hooks.internal.enabled" $true "HooksB: file created with hooks"
    Assert-OutputContains $r.Output "openclaw\.json created" "HooksB: output confirms file created"
    Assert-OutputContains $r.Output "hooks\.internal\.enabled = true" "HooksB: output confirms enabled"
}

# ============================================================
# Suite 7: SetupBat (optional smoke test)
# ============================================================

if ($RunSetupBatSmoke) {
    $setupBat = Join-Path $script:packageDir "Setup.bat"

    # Scenario A — normal install via Setup.bat
    Run-Suite "SetupBat_Normal" {
        param($sb)

        $r = & cmd /c "`"$setupBat`" --auto" *>&1 | Out-String
        $batExit = $LASTEXITCODE

        Assert-ExitCode $batExit 0 "SetupBat: exit code = 0"
        Assert-OutputContains $r "Installation successful" "SetupBat: success message"
    }

    # Scenario B — failure path (missing Install.ps1)
    $installPs1 = Join-Path $script:packageDir "Install.ps1"
    $installBak = "$installPs1.bak"
    try {
        Rename-Item $installPs1 $installBak

        Run-Suite "SetupBat_Failure" {
            param($sb)

            # Use try/catch to capture the error output; $ErrorActionPreference="Stop"
            # would otherwise turn the stderr from cmd into a terminating error
            $batExit = $null
            $r = ""
            try {
                $oldEA = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                $r = & cmd /c "`"$setupBat`" --auto" *>&1 | Out-String
                $batExit = $LASTEXITCODE
                $ErrorActionPreference = $oldEA
            } catch {
                $r = $_.Exception.Message
                $batExit = 1
            }

            Assert-ExitCodeNot $batExit 0 "SetupBat_Fail: exit code != 0"
            Assert-OutputContains $r "failed" "SetupBat_Fail: failure message"
        }
    } finally {
        if (Test-Path $installBak) { Rename-Item $installBak $installPs1 }
    }
} else {
    Write-Host "`n=== Suite: SetupBat ===" -ForegroundColor Cyan
    Write-Host "  SKIPPED (use -RunSetupBatSmoke to enable)" -ForegroundColor DarkYellow
}

# ============================================================
# Summary
# ============================================================

Write-Host ""
Write-Host "============================================"
Write-Host "  Test Summary"
Write-Host "============================================"
Write-Host "  $script:passCount / $script:totalCount PASS"

if ($script:failures.Count -gt 0) {
    Write-Host "  FAILED:" -ForegroundColor Red
    foreach ($f in $script:failures) {
        Write-Host "    - $f" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "  ALL TESTS PASSED" -ForegroundColor Green
    exit 0
}

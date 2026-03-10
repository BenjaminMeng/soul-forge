@echo off
chcp 65001 >nul 2>&1
title Soul Forge Installer

set AUTO_MODE=0
if /i "%~1"=="--auto" set AUTO_MODE=1

echo ============================================
echo   Soul Forge - AI Personality Calibration
echo ============================================
echo.
echo This will install Soul Forge into your OpenClaw.
echo Your existing files will be backed up automatically.
echo.

if %AUTO_MODE%==0 pause

echo.
echo Running installation...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"
set INSTALL_RESULT=%ERRORLEVEL%

echo.
if %INSTALL_RESULT% EQU 0 (
    echo ============================================
    echo   Installation successful!
    echo.
    echo   Please restart OpenClaw to activate.
    echo.
    echo   Docker:  docker compose down ^&^& docker compose up -d
    echo   Then send /soul-forge in Telegram to start.
    echo ============================================
) else (
    echo ============================================
    echo   Installation failed. See errors above.
    echo ============================================
)

echo.
if %AUTO_MODE%==0 pause

exit /b %INSTALL_RESULT%

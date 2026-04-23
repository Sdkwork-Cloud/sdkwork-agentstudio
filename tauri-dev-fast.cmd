@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "SDKWORK_WINDOWS_MIRROR_BASE_DIR=%ROOT%\.cache\short-mirrors"
if not exist "%SDKWORK_WINDOWS_MIRROR_BASE_DIR%" mkdir "%SDKWORK_WINDOWS_MIRROR_BASE_DIR%"
set "BUNDLED_OPENCLAW_DIR=%ROOT%\packages\sdkwork-claw-desktop\src-tauri\generated\bundled\modules\openclaw"

pushd "%ROOT%\packages\sdkwork-claw-desktop" || exit /b 1

call ..\..\sdkwork-run-node.cmd ..\..\scripts\ensure-tauri-rust-toolchain.mjs
if errorlevel 1 goto :end

call ..\..\sdkwork-run-node.cmd ..\..\scripts\prepare-openclaw-runtime.mjs
if errorlevel 1 goto :end

if exist "%BUNDLED_OPENCLAW_DIR%\*" (
  echo Reusing existing bundled OpenClaw dev mirror at "%BUNDLED_OPENCLAW_DIR%".
) else (
  call ..\..\sdkwork-run-node.cmd ..\..\scripts\sync-bundled-components.mjs --dev --no-fetch
  if errorlevel 1 goto :end
)

call ..\..\sdkwork-run-node.cmd ..\..\scripts\ensure-tauri-dev-binary-unlocked.mjs src-tauri sdkwork-claw-desktop
if errorlevel 1 goto :end

call ..\..\sdkwork-run-node.cmd ..\..\scripts\ensure-tauri-dev-port-free.mjs 127.0.0.1 1426
if errorlevel 1 goto :end

if /I "%~1"=="--prepare-only" goto :end

call ..\..\sdkwork-run-node.cmd ..\..\scripts\run-tauri-cli.mjs dev

:end
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%

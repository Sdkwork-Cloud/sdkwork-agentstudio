@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "SDKWORK_WINDOWS_MIRROR_BASE_DIR=%ROOT%\.cache\short-mirrors"
if not exist "%SDKWORK_WINDOWS_MIRROR_BASE_DIR%" mkdir "%SDKWORK_WINDOWS_MIRROR_BASE_DIR%"

pushd "%ROOT%\packages\sdkwork-claw-desktop" || exit /b 1

call ..\..\sdkwork-run-node.cmd ..\..\scripts\ensure-native-rust-toolchain.mjs
if errorlevel 1 goto :end

call ..\..\sdkwork-run-node.cmd ..\..\scripts\prepare-openclaw-runtime.mjs
if errorlevel 1 goto :end

echo Skipping sync-bundled-components for quick Tauri dev startup.

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

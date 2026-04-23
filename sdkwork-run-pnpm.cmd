@echo off
setlocal

if "%~1"=="" (
  >&2 echo Usage: sdkwork-run-pnpm ^<pnpm-args...^>
  exit /b 1
)

if defined npm_execpath if exist "%npm_execpath%" (
  call "%~dp0sdkwork-run-node.cmd" "%npm_execpath%" %*
  exit /b %errorlevel%
)

if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\pnpm.cmd" (
  call "%NVM_SYMLINK%\pnpm.cmd" %*
  exit /b %errorlevel%
)

if defined PNPM_HOME if exist "%PNPM_HOME%\pnpm.cmd" (
  call "%PNPM_HOME%\pnpm.cmd" %*
  exit /b %errorlevel%
)

for /f "usebackq delims=" %%I in (`where pnpm 2^>nul`) do (
  if not defined PNPM_BIN set "PNPM_BIN=%%I"
)

if not defined PNPM_BIN (
  >&2 echo pnpm is not available in the current script environment.
  exit /b 1
)

call "%PNPM_BIN%" %*
exit /b %errorlevel%

@echo off
setlocal

if "%~1"=="" (
  >&2 echo Usage: sdkwork-run-node ^<script-or-arg^> [more-args...]
  exit /b 1
)

if defined npm_node_execpath if exist "%npm_node_execpath%" (
  set "NODE_BIN=%npm_node_execpath%"
)

if not defined NODE_BIN if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" (
  set "NODE_BIN=%NVM_SYMLINK%\node.exe"
)

if not defined NODE_BIN if defined PNPM_HOME if exist "%PNPM_HOME%\node.exe" (
  set "NODE_BIN=%PNPM_HOME%\node.exe"
)

if not defined NODE_BIN (
  for /f "usebackq delims=" %%I in (`where node 2^>nul`) do (
    if not defined NODE_BIN set "NODE_BIN=%%I"
  )
)

if not defined NODE_BIN (
  >&2 echo Node.js is not available in the current script environment.
  exit /b 1
)

"%NODE_BIN%" %*
exit /b %errorlevel%

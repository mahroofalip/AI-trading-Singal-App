@echo off
setlocal
set "APP_DIR=%~dp0"
if not exist "%APP_DIR%server.js" (
  if exist "%APP_DIR%..\\server.js" set "APP_DIR=%APP_DIR%..\\"
)
if not exist "%APP_DIR%server.js" (
  echo ERROR: server.js was not found.
  echo Keep this file in the main gold-trading-terminal folder,
  echo or inside its mt5-bridge subfolder.
  pause
  exit /b 1
)
cd /d "%APP_DIR%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
start "" http://127.0.0.1:3030
node server.js
pause

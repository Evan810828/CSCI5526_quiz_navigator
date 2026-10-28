@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Run Start-Navigator.cmd once to install and build the application.
  pause
  exit /b 1
)
where node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe node_modules\vite\bin\vite.js preview --host 127.0.0.1 --port 4173 --strictPort --configLoader native --open
  exit /b
)
set "NAV_NODE="
for /d %%R in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do if exist "%%~R\bin\node.exe" set "NAV_NODE=%%~R\bin\node.exe"
if defined NAV_NODE (
  "%NAV_NODE%" node_modules\vite\bin\vite.js preview --host 127.0.0.1 --port 4173 --strictPort --configLoader native --open
) else (
  echo Node.js is unavailable. See README.md.
  pause
)
endlocal

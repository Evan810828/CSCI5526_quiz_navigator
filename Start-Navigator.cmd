@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if not errorlevel 1 goto npm_start

rem Reuse an existing local runtime when Node is not on PATH. No machine-specific absolute paths.
set "NAV_NODE="
for /d %%R in ("%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*") do if exist "%%~R\bin\node.exe" set "NAV_NODE=%%~R\bin\node.exe"
set "NAV_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
if not defined NAV_NODE goto missing_node
if not exist "%NAV_PNPM%" goto missing_node
for %%N in ("%NAV_NODE%") do set "PATH=%%~dpN;%PATH%"
echo Installing project dependencies if needed. Lecture content stays on this computer.
call "%NAV_NODE%" "%NAV_PNPM%" install
if errorlevel 1 goto failed
call "%NAV_NODE%" "%NAV_PNPM%" test
if errorlevel 1 goto failed
call "%NAV_NODE%" "%NAV_PNPM%" build
if errorlevel 1 goto failed
echo Open http://127.0.0.1:4173 . Keep this window open while studying.
call "%NAV_NODE%" "%NAV_PNPM%" preview --open
goto end

:npm_start
echo Installing project dependencies if needed. Lecture content stays on this computer.
call npm.cmd install
if errorlevel 1 goto failed
call npm.cmd test
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo Open http://127.0.0.1:4173 . Keep this window open while studying.
call npm.cmd run preview -- --open
goto end

:missing_node
echo Node.js 22.13+ and npm are required for the initial setup.
echo Install Node from https://nodejs.org/en/download and run this launcher again.
pause
goto end

:failed
echo.
echo Setup or validation failed. The error above identifies the failed step.
echo No lecture file was uploaded. See README.md for manual setup instructions.
pause
:end
endlocal

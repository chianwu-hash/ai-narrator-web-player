@echo off
setlocal EnableExtensions

set HOST=news-vm
set CWD=/home/vboxuser/nblm-audio
set INTERPRETER=python3
set KEEP_REMOTE=0
set SCRIPT_FILE=

:parse
if "%~1"=="" goto parsed
if /I "%~1"=="--host" (
  set HOST=%~2
  shift
  shift
  goto parse
)
if /I "%~1"=="--cwd" (
  set CWD=%~2
  shift
  shift
  goto parse
)
if /I "%~1"=="--interpreter" (
  set INTERPRETER=%~2
  shift
  shift
  goto parse
)
if /I "%~1"=="--keep-remote" (
  set KEEP_REMOTE=1
  shift
  goto parse
)
if "%SCRIPT_FILE%"=="" (
  set SCRIPT_FILE=%~1
  shift
  goto parse
)
echo Unknown argument: %~1
exit /b 2

:parsed
if "%SCRIPT_FILE%"=="" (
  echo Usage: tools\codex_vm_run.cmd [--host news-vm] [--cwd /path] [--interpreter python3^|bash^|sh] script-file
  exit /b 2
)
if not exist "%SCRIPT_FILE%" (
  echo Script file not found: %SCRIPT_FILE%
  exit /b 2
)

for %%F in ("%SCRIPT_FILE%") do set EXT=%%~xF
if "%EXT%"=="" (
  if /I "%INTERPRETER%"=="python3" (
    set EXT=.py
  ) else (
    set EXT=.sh
  )
)

set REMOTE_PATH=/tmp/codex-run-%RANDOM%%RANDOM%%RANDOM%%EXT%

scp "%SCRIPT_FILE%" "%HOST%:%REMOTE_PATH%"
if errorlevel 1 exit /b %ERRORLEVEL%

if "%KEEP_REMOTE%"=="1" (
  set CLEANUP=true
) else (
  set CLEANUP=rm -f '%REMOTE_PATH%'
)

ssh "%HOST%" "cd '%CWD%' && chmod 700 '%REMOTE_PATH%' && %INTERPRETER% '%REMOTE_PATH%'; status=$?; %CLEANUP%; exit $status"
exit /b %ERRORLEVEL%

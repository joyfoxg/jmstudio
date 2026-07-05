@echo off
title Joy Markdown Studio Version Deployer
color 0E
echo =======================================================================
echo   Joy Markdown Studio Git Tag Deployer (GitHub Actions Trigger)
echo =======================================================================
echo.

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

echo [Step 1] Checking Python Environment...
set PY_CMD=
if exist .venv\Scripts\python.exe (
    set PY_CMD=.venv\Scripts\python.exe
)
if "%PY_CMD%"=="" (
    C:\Python\Python313\python.exe --version >nul 2>&1
    if not errorlevel 1 (
        set PY_CMD=C:\Python\Python313\python.exe
    )
)
if "%PY_CMD%"=="" (
    python --version >nul 2>&1
    if not errorlevel 1 (
        set PY_CMD=python
    )
)
if "%PY_CMD%"=="" (
    echo [ERROR] Python was not found in C:\Python\Python313 or System PATH!
    exit /b 1
)

echo Reading App Versions...
for /f "delims=" %%V in ('%PY_CMD% -c "import re; content=open(r'%BASE_DIR%\setup.py', encoding='utf-8').read(); m=re.search(r'version=\x22([^\x22]+)\x22', content); print(m.group(1) if m else '')"') do set SETUP_VER=%%V
for /f "delims=" %%V in ('%PY_CMD% -c "import re; content=open(r'%BASE_DIR%\jmstudio\app_config.py', encoding='utf-8').read(); m=re.search(r'VERSION\s*=\s*\x22([^\x22]+)\x22', content); print(m.group(1) if m else '')"') do set APP_VER=%%V

echo   Setup Version (setup.py):          %SETUP_VER%
echo   App Config Version (app_config.py): v%APP_VER%
echo.

if "%SETUP_VER%"=="" (
    echo [ERROR] Failed to read version from setup.py!
    exit /b
)
if "%APP_VER%"=="" (
    echo [ERROR] Failed to read version from jmstudio/app_config.py!
    exit /b
)

for /f "delims=" %%S in ('python -c "fv='%SETUP_VER%'; gv='%APP_VER%'; print('sync' if fv.startswith(gv) or gv.startswith(fv) else 'unsync')"') do set SYNC_STATUS=%%S

set "VERSION=%SETUP_VER%"

if "%SYNC_STATUS%"=="unsync" (
    color 0C
    echo [WARNING] Setup version and App Config version are NOT in sync!
    echo   Setup Version:      %SETUP_VER%
    echo   App Config Version: v%APP_VER%
    echo.
    set /p CHOICE="Do you want to use the Setup version [v%SETUP_VER%] for the Git tag? [Y/N]: "
    if /i not "%CHOICE%"=="Y" (
        echo Deployment cancelled. Please sync versions first.
        color 07
        exit /b
    )
    color 0E
)

echo Target Release Version: v%VERSION%
echo.

echo [Step 2] Staging changes in Git...
git add .
git status -s
echo.

set /p COMMIT_MSG="Enter commit message (Press Enter for 'v%VERSION% Release'): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=v%VERSION% Release"

echo.
echo [Step 3] Committing changes...
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo [WARNING] Nothing to commit or commit failed. Continuing...
)

echo.
echo [Step 4] Pushing code to main branch...
git push origin main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to push code to main!
    exit /b
)

echo.
echo [Step 5] Creating and pushing Git tag v%VERSION%...
git tag -d v%VERSION% >nul 2>&1
git push origin :refs/tags/v%VERSION% >nul 2>&1
git tag v%VERSION%
git push origin v%VERSION%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to push Git tag!
    exit /b
)

echo.
echo =======================================================================
echo   SUCCESS: Version v%VERSION% deployed successfully!
echo   GitHub Actions will now compile and publish the release.
echo =======================================================================
echo.
pause

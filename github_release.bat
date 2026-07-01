@echo off
title Joy Markdown Studio GitHub Release Distributor
color 0B
echo =======================================================================
echo   Joy Markdown Studio GitHub Release ^& Build Tool
echo =======================================================================
echo.

echo [Step 1] Checking Python Environment...
set PY_CMD=
if exist .venv\Scripts\python.exe (
    echo Found virtual environment .venv. Using virtual environment.
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
    echo [ERROR] Python is not installed, not in system PATH, and .venv was not found!
    echo Please install Python and try again.
    pause
    exit /b 1
)

echo.
echo [Step 2] Detecting package version...
set APP_VER=
rem Extract version from app_config.py
for /f "tokens=*" %%a in ('%PY_CMD% -c "from jmstudio import app_config; print(app_config.VERSION)" 2^>nul') do (
    set APP_VER=%%a
)

if "%APP_VER%"=="" (
    rem Fallback: Detect version from setup.py
    for /f %%a in ('%PY_CMD% -c "print([line.split('=')[1].strip().strip(chr(39)+chr(34)+chr(44)+chr(32)) for line in open('setup.py', encoding='utf-8') if 'version=' in line][0])" 2^>nul') do (
        set APP_VER=%%a
    )
)

if "%APP_VER%"=="" (
    echo [ERROR] Failed to detect version from app_config.py or setup.py!
    pause
    exit /b 1
)
echo Detected Version: %APP_VER%
echo.

echo [Step 3] Checking GitHub CLI (gh) installation ^& authentication...
set GH_CMD=
where gh >nul 2>&1
if %errorlevel% == 0 set GH_CMD=gh
if "%GH_CMD%"=="" if exist "C:\Program Files\GitHub CLI\gh.exe" set GH_CMD=C:\Program Files\GitHub CLI\gh.exe

if "%GH_CMD%"=="" (
    echo [ERROR] GitHub CLI is not installed!
    echo Please install it first: winget install --id GitHub.cli
    echo After installation, run: gh auth login
    pause
    exit /b 1
)

"%GH_CMD%" auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] GitHub CLI is not authenticated!
    echo Please log in first by running: gh auth login
    echo If you just installed it, you may need to open a new terminal window to run 'gh auth login'
    pause
    exit /b 1
)
echo GitHub CLI is ready and authenticated.
echo.

set /p CONFIRM="Do you want to release Joy Markdown Studio v%APP_VER% to GitHub? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo Release cancelled by user.
    pause
    exit /b 0
)

echo.
set /p SYNC_GIT="Would you like to push local commits to GitHub main branch first? (Y/N): "
if /i "%SYNC_GIT%"=="Y" (
    echo Pushing local commits to GitHub...
    git push origin main
    if %errorlevel% neq 0 (
        echo [WARNING] Git push failed. Proceeding with release anyway...
    )
)

echo.
echo [Step 4] Checking if release v%APP_VER% already exists on GitHub...
"%GH_CMD%" release view "v%APP_VER%" >nul 2>&1
if %errorlevel% == 0 (
    echo [WARNING] GitHub Release v%APP_VER% already exists!
    set /p RECREATE="Do you want to delete the existing release and recreate it? (Y/N): "
    if /i "%RECREATE%"=="Y" (
        echo Deleting existing GitHub release v%APP_VER%...
        "%GH_CMD%" release delete "v%APP_VER%" --yes --cleanup-tag
    ) else (
        echo Release process stopped to prevent overwrite.
        pause
        exit /b 0
    )
)

echo.
echo [Step 5] Cleaning up old local build directories...
if exist build rd /s /q build
if exist dist\JoyMarkdownStudio-v%APP_VER%.exe del /f /q dist\JoyMarkdownStudio-v%APP_VER%.exe
if exist dist\JoyMarkdownStudio-v%APP_VER%.zip del /f /q dist\JoyMarkdownStudio-v%APP_VER%.zip
echo Clean up done.

echo.
echo [Step 6] Installing/Upgrading required libraries for PyInstaller...
%PY_CMD% -m pip install --upgrade pip setuptools wheel pyinstaller bottle pywebview Pillow
if %errorlevel% neq 0 (
    echo [WARNING] Library install/upgrade had warnings, attempting to build anyway...
)

echo.
echo [Step 7] Compiling standalone executable...
%PY_CMD% -m PyInstaller --clean --noconfirm --onefile --noconsole --add-data "jmstudio/frontend;jmstudio/frontend" --add-data "client_secrets.json;." --icon=app_icon.ico --name="JoyMarkdownStudio-v%APP_VER%" jmstudio/__main__.py
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller compilation failed!
    pause
    exit /b 1
)
echo Standalone executable built successfully: dist\JoyMarkdownStudio-v%APP_VER%.exe

echo.
echo [Step 8] Compressing built executable to ZIP (minimizes file size)...
tar -a -c -f "dist\JoyMarkdownStudio-v%APP_VER%.zip" -C dist "JoyMarkdownStudio-v%APP_VER%.exe"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to compress the executable!
    pause
    exit /b 1
)
echo Compressed successfully: dist\JoyMarkdownStudio-v%APP_VER%.zip
dir "dist\JoyMarkdownStudio-v%APP_VER%.zip" | findstr /i "zip"

echo.
echo [Step 9] Creating GitHub Release ^& uploading ZIP asset...
"%GH_CMD%" release create "v%APP_VER%" "dist\JoyMarkdownStudio-v%APP_VER%.zip" --title "v%APP_VER%" --notes "Release version %APP_VER% of Joy Markdown Studio. Built and compiled locally."
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create GitHub Release!
    pause
    exit /b 1
)

echo.
echo =======================================================================
echo   SUCCESS: Joy Markdown Studio v%APP_VER% Released on GitHub!
echo =======================================================================
echo.
echo You can view the release at:
echo   ==> https://github.com/joyfoxg/jmstudio/releases/tag/v%APP_VER%
echo.

set /p CLEAN_LOCAL="Would you like to delete the local build/dist folders to save disk space? (Y/N): "
if /i "%CLEAN_LOCAL%"=="Y" (
    echo Cleaning up...
    if exist build rd /s /q build
    if exist dist rd /s /q dist
    echo Done.
)

pause

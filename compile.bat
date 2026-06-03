@echo off
title Joy Markdown Studio Compiler
color 0B
echo =======================================================================
echo   Joy Markdown Studio v3.5 Standalone Executable Compiler
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
    exit /b
)

echo.
echo [Step 2] Installing/Upgrading required libraries (PyInstaller, pywebview, bottle, Pillow)...
%PY_CMD% -m pip install --upgrade pip
%PY_CMD% -m pip install --upgrade pyinstaller bottle pywebview Pillow
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install required libraries. Please check internet connection.
    pause
    exit /b
)

echo.
echo [Step 3] Compiling jmstudio.py into a Standalone Executable...
echo (This may take 1-2 minutes. Please do not close this window...)

rem app_config.py에서 버전 정보 추출
for /f "tokens=*" %%a in ('%PY_CMD% -c "from jmstudio import app_config; print(app_config.VERSION)"') do (
    set APP_VER=v%%a
)

%PY_CMD% -m PyInstaller --clean --noconfirm --onefile --windowed --add-data "jmstudio/frontend;jmstudio/frontend" --add-data "client_secrets.json;." --icon=app_icon.ico --name="JoyMarkdownStudio-%APP_VER%" jmstudio/__main__.py
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller compilation failed!
    pause
    exit /b
)

echo.
echo =======================================================================
echo   SUCCESS: Standalone app compiled successfully (Instant Boot)!
echo =======================================================================
echo.
echo The compiled executable is saved at:
echo   ==> .\dist\JoyMarkdownStudio-%APP_VER%.exe
echo.
echo [Distribution Guide]
echo 1. Run 'JoyMarkdownStudio-%APP_VER%.exe' in '.\dist' folder to boot instantly (0.1s)!
echo 2. For distribution, simply copy or send the 'JoyMarkdownStudio-%APP_VER%.exe'.
echo.
pause

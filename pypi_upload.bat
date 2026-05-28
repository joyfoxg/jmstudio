@echo off
title Joy Markdown Studio PyPI Distributor
color 0A
echo =======================================================================
echo   Joy Markdown Studio PyPI Packaging & Distribution Tool
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
echo [Step 2] Detecting package version from setup.py...
for /f %%a in ('%PY_CMD% -c "print([line.split('=')[1].strip().strip(chr(39)+chr(34)+chr(44)+chr(32)) for line in open('setup.py', encoding='utf-8') if 'version=' in line][0])"') do (
    set APP_VER=%%a
)

if "%APP_VER%"=="" (
    echo [ERROR] Failed to detect version from setup.py!
    pause
    exit /b
)
echo Detected Version: %APP_VER%
echo.

set /p CONFIRM="Do you want to package and upload joy-markdown-studio v%APP_VER% to PyPI? (Y/N): "
if /i "%CONFIRM%" neq "Y" (
    echo Upload cancelled by user.
    pause
    exit /b
)

echo.
echo [Step 3] Cleaning up previous PyPI build files for v%APP_VER%...
if exist build rd /s /q build
if exist dist\joy_markdown_studio-%APP_VER%-py3-none-any.whl del /f /q dist\joy_markdown_studio-%APP_VER%-py3-none-any.whl
if exist dist\joy_markdown_studio-%APP_VER%.tar.gz del /f /q dist\joy_markdown_studio-%APP_VER%.tar.gz
echo Cleanup complete.

echo.
echo [Step 4] Installing/Upgrading build tools (wheel, twine)...
%PY_CMD% -m pip install --upgrade pip setuptools wheel twine
if %errorlevel% neq 0 (
    echo [ERROR] Failed to upgrade packaging libraries.
    pause
    exit /b
)

echo.
echo [Step 5] Building source and wheel distributions...
%PY_CMD% setup.py sdist bdist_wheel
if %errorlevel% neq 0 (
    echo [ERROR] Package compilation failed!
    pause
    exit /b
)

echo.
echo [Step 6] Uploading distributions to PyPI...
%PY_CMD% -m twine upload dist/joy_markdown_studio-%APP_VER%*
if %errorlevel% neq 0 (
    echo [ERROR] PyPI upload failed!
    pause
    exit /b
)

echo.
echo =======================================================================
echo   SUCCESS: joy-markdown-studio v%APP_VER% distributed to PyPI!
echo =======================================================================
echo.
echo Verify at: https://pypi.org/project/joy-markdown-studio/%APP_VER%/
echo.
pause

#!/bin/bash

echo "======================================================================="
echo "  Joy Markdown Studio Standalone Executable Compiler for macOS"
echo "======================================================================="
echo ""

# Step 1: Check Python Environment
echo "[Step 1] Checking Python Environment..."
if [ -d ".venv" ] && [ -f ".venv/bin/python" ]; then
    echo "Found virtual environment (.venv). Using virtual environment."
    PY_CMD=".venv/bin/python"
else
    if command -v python3 &>/dev/null; then
        PY_CMD="python3"
    elif command -v python &>/dev/null; then
        PY_CMD="python"
    else
        echo "[ERROR] Python is not installed or not in system PATH!"
        echo "Please install Python 3 and try again."
        exit 1
    fi
fi

# Step 2: Install/Upgrade libraries
echo ""
echo "[Step 2] Installing/Upgrading required libraries..."
$PY_CMD -m pip install --upgrade pip
$PY_CMD -m pip install --upgrade pyinstaller bottle pywebview Pillow
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install required libraries."
    exit 1
fi

# app_config.py에서 버전 정보 추출
APP_VER=$($PY_CMD -c "from jmstudio import app_config; print(app_config.VERSION)")
if [ -z "$APP_VER" ]; then
    APP_VER="unknown"
fi
echo "Detected version: v$APP_VER"

# Step 4: Compiling jmstudio
echo ""
echo "[Step 4] Compiling into a macOS App Bundle..."
# macOS에서는 --windowed 옵션 사용 시 .app 폴더 패키지가 생성됩니다.
# 아이콘으로 app_icon.png를 지정하면 PyInstaller가 내부적으로 .icns 변환을 시도합니다.
$PY_CMD -m PyInstaller --clean --noconfirm --onefile --windowed --add-data "jmstudio/frontend:jmstudio/frontend" --add-data "client_secrets.json:." --icon=app_icon.png --name="JoyMarkdownStudio-v$APP_VER" jmstudio/__main__.py
if [ $? -ne 0 ]; then
    echo "[ERROR] PyInstaller compilation failed!"
    exit 1
fi

echo ""
echo "======================================================================="
echo "  SUCCESS: macOS app bundle compiled successfully!"
echo "======================================================================="
echo ""
echo "The compiled app is saved at:"
echo "  => ./dist/JoyMarkdownStudio-v$APP_VER.app"
echo ""
echo "[Distribution Guide]"
echo "1. Compress (Zip) 'JoyMarkdownStudio-v$APP_VER.app' inside 'dist/' folder."
echo "2. Share the zip file with other Mac users!"
echo "3. Note: Since it is not signed with an Apple Developer account,"
echo "   users might need to Right-click -> Open (and click Open) to bypass Gatekeeper."
echo ""

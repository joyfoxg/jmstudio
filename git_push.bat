@echo off
title Joy Markdown Studio Git Sync
color 0B
echo =======================================================================
echo   Joy Markdown Studio Git Auto-Sync
echo =======================================================================
echo.

rem Step 1: Initialize Git
if not exist .git (
    echo [Step 1] Initializing Git repository...
    git init
    git remote add origin https://github.com/joyfoxg/jmstudio
) else (
    echo [Step 1] Git repository ready.
)

rem Step 2: Get Commit Message Interactively
echo.
set commit_msg=
set /p commit_msg="Enter commit message (Press Enter for default: 'Update source files'): "
if not defined commit_msg (
    set commit_msg=Update source files
)

rem Step 3: Stage and Commit
echo.
echo [Step 3] Staging and committing files...
git add .
git commit -m "%commit_msg%"
if %errorlevel% neq 0 (
    echo [WARNING] No new modifications to commit or commit failed.
)

rem Step 4: Push to Main Branch
echo.
echo [Step 4] Pushing to GitHub (https://github.com/joyfoxg/jmstudio)...
git branch -M main
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Standard push failed. Attempting force push...
    git push -u origin main --force
    if %errorlevel% neq 0 (
        echo [ERROR] Push failed! Please check your credentials or internet.
        pause
        exit /b
    )
)

echo.
echo =======================================================================
echo   SUCCESS: Changes pushed to GitHub successfully!
echo =======================================================================
echo.
pause

@echo off
set GH_CMD=
if "%GH_CMD%"=="" if exist "C:\Program Files\GitHub CLI\gh.exe" set GH_CMD=C:\Program Files\GitHub CLI\gh.exe
echo GH_CMD is: %GH_CMD%
if "%GH_CMD%"=="" (
    echo Empty
) else (
    echo Not empty
)
"%GH_CMD%" --version

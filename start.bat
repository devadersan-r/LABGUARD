@echo off
echo ====================================================
echo  LABGUARD - Full-Stack Local Launcher (Windows)
echo ====================================================
cd /d "%~dp0"

echo [1/2] Checking Python Virtual Environment...
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXEC=.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXEC=python"
)

echo [2/2] Launching Backend and Frontend...
npm run dev
pause

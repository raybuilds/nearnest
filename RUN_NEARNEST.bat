@echo off
setlocal

set "ROOT=%~dp0"

echo Starting NearNest backend...
start "NearNest Backend" cmd /k "cd /d "%ROOT%" && npm run dev"

echo Starting NearNest frontend...
start "NearNest Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Waiting for frontend to boot...
timeout /t 4 /nobreak >nul

echo Opening browser...
cmd /c start "" "http://localhost:3000"

echo NearNest launch sequence complete.
endlocal

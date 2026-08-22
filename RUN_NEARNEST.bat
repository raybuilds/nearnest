@echo off
setlocal

set "ROOT=%~dp0"

echo Stopping stale NearNest processes on ports 3000 and 5000...
for %%P in (3000 5000) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /F /PID %%I >nul 2>nul
  )
)

echo Ensuring NearNest backend dependencies are installed...
if not exist "%ROOT%node_modules\dotenv" (
  pushd "%ROOT%"
  call npm install
  if errorlevel 1 (
    echo Backend dependency install failed.
    popd
    exit /b 1
  )
  popd
)

echo Generating Prisma client for backend...
pushd "%ROOT%"
call npx prisma generate
if errorlevel 1 (
  echo Prisma client generation failed.
  popd
  exit /b 1
)
popd

echo Starting NearNest backend...
start "NearNest Backend" cmd /k "cd /d "%ROOT%" && npm run dev"

echo Resetting frontend build cache...
if exist "%ROOT%frontend\.next" rmdir /s /q "%ROOT%frontend\.next"

echo Starting NearNest frontend...
start "NearNest Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Waiting for frontend to boot...
timeout /t 4 /nobreak >nul

echo Opening browser...
cmd /c start "" "http://localhost:3000"

echo NearNest launch sequence complete.
endlocal

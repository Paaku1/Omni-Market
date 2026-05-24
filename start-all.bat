@echo off
title OmniMarket Suite Starter (Background)
echo ========================================================
echo         OMNI MARKET SUITE LAUNCH ENGINE
echo ========================================================
echo.

:: Ensure logs directory exists
mkdir logs 2>nul

:: Load environment variables from root .env if it exists
if exist "%~dp0.env" (
    echo [ENV] Loading environment variables from root .env...
    for /f "usebackq tokens=1,* delims==" %%A in (`findstr /v "^#" "%~dp0.env"`) do (
        set "%%A=%%B"
    )
)

echo [1/4] Booting Docker Infrastructure (Redis ^& RabbitMQ)...
docker compose up -d > logs/docker-compose.log 2>&1
if %errorlevel% equ 0 (
    echo       [OK] Redis ^& RabbitMQ running in background.
) else (
    echo       [WARNING] Docker compose failed. Make sure Docker Desktop is active!
)
echo.

echo [2/4] Launching Spring Boot Bidding Engine in background...
start /b cmd /c "cd bidding-engine-spring && mvnw.cmd spring-boot:run > ..\logs\spring-bidding.log 2>&1"
echo       -^> Standard output redirected to: logs/spring-bidding.log
echo       [OK] Launched.
echo.

echo [3/4] Launching .NET Core Identity Gateway in background...
start /b cmd /c "cd identity-gateway-dotnet\identity-gateway-dotnet\OmniMarket.Gateway && dotnet run > ..\..\..\logs\dotnet-gateway.log 2>&1"
echo       -^> Standard output redirected to: logs/dotnet-gateway.log
echo       [OK] Launched.
echo.

echo [4/4] Launching Angular Frontend Server in background...
start /b cmd /c "cd omni-market-angular\omni-market-frontend && npm start > ..\..\logs\angular-frontend.log 2>&1"
echo       -^> Standard output redirected to: logs/angular-frontend.log
echo       [OK] Launched.
echo.

echo ========================================================
echo   OmniMarket Suite is launching in the background!
echo   -----------------------------------------------------
echo   - Angular Frontend:   http://localhost:4200
echo   - Reverse Gateway API: http://localhost:5276
echo   - RabbitMQ Dashboard:  http://localhost:15672
echo.
echo   * To view live bidding engine logs, run:
echo     powershell -Command Get-Content -Wait logs/spring-bidding.log
echo   * To view live gateway logs, run:
echo     powershell -Command Get-Content -Wait logs/dotnet-gateway.log
echo   * To stop all services cleanly, run stop-all.bat
echo ========================================================
pause

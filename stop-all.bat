@echo off
title OmniMarket Suite Stopper
echo ========================================================
echo         OMNI MARKET SUITE TERMINATION ENGINE
echo ========================================================
echo.

echo [1/4] Stopping .NET Identity Gateway...
taskkill /f /im OmniMarket.Gateway.exe 2>nul
taskkill /f /im dotnet.exe 2>nul
echo.

echo [2/4] Stopping Spring Boot Bidding Engine...
taskkill /f /im java.exe 2>nul
echo.

echo [3/4] Stopping Angular Frontend server...
taskkill /f /im node.exe 2>nul
echo.

echo [4/4] Tearing down Docker Infrastructure (Redis ^& RabbitMQ)...
docker compose down
echo.

echo ========================================================
echo   All OmniMarket services have been stopped successfully!
echo ========================================================
pause

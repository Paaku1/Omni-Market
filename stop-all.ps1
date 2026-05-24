Write-Host "========================================================" -ForegroundColor Red
Write-Host "        OMNI MARKET SUITE TERMINATION ENGINE" -ForegroundColor Red
Write-Host "========================================================" -ForegroundColor Red
Write-Host ""

Write-Host "[1/4] Stopping .NET Identity Gateway..." -ForegroundColor Yellow
Stop-Process -Name "OmniMarket.Gateway" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "dotnet" -Force -ErrorAction SilentlyContinue
Write-Host ""

Write-Host "[2/4] Stopping Spring Boot Bidding Engine..." -ForegroundColor Yellow
Stop-Process -Name "java" -Force -ErrorAction SilentlyContinue
Write-Host ""

Write-Host "[3/4] Stopping Angular Frontend server..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Write-Host ""

Write-Host "[4/4] Tearing down Docker Infrastructure (Redis & RabbitMQ)..." -ForegroundColor Yellow
docker compose down
Write-Host ""

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   All OmniMarket services have been stopped successfully!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

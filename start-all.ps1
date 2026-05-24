Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "        OMNI MARKET SUITE LAUNCH ENGINE" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure logs directory exists
New-Item -ItemType Directory -Force -Path "logs" | Out-Null

# Load environment variables from root .env if it exists
if (Test-Path "$PSScriptRoot\.env") {
    Write-Host "[ENV] Loading variables from root .env..." -ForegroundColor Gray
    Get-Content "$PSScriptRoot\.env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $key, $value = $line -split '=', 2
            if ($key -and $value) {
                [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), [System.EnvironmentVariableTarget]::Process)
            }
        }
    }
}

Write-Host "[1/4] Booting Docker Infrastructure (Redis & RabbitMQ)..." -ForegroundColor Yellow
docker compose up -d > logs/docker-compose.log 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      [OK] Redis & RabbitMQ running in background." -ForegroundColor Green
} else {
    Write-Host "      [WARNING] Docker compose failed. Make sure Docker Desktop is active!" -ForegroundColor Red
}
Write-Host ""

Write-Host "[2/4] Launching Spring Boot Bidding Engine in background..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c", "cd bidding-engine-spring && mvnw.cmd spring-boot:run > ..\logs\spring-bidding.log 2>&1" -WindowStyle Hidden
Write-Host "      -> Standard output redirected to: logs/spring-bidding.log" -ForegroundColor Gray
Write-Host "      [OK] Launched." -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Launching .NET Core Identity Gateway in background..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c", "cd identity-gateway-dotnet\identity-gateway-dotnet\OmniMarket.Gateway && dotnet run > ..\..\..\logs\dotnet-gateway.log 2>&1" -WindowStyle Hidden
Write-Host "      -> Standard output redirected to: logs/dotnet-gateway.log" -ForegroundColor Gray
Write-Host "      [OK] Launched." -ForegroundColor Green
Write-Host ""

Write-Host "[4/4] Launching Angular Frontend Server in background..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/c", "cd omni-market-angular\omni-market-frontend && npm start > ..\..\logs\angular-frontend.log 2>&1" -WindowStyle Hidden
Write-Host "      -> Standard output redirected to: logs/angular-frontend.log" -ForegroundColor Gray
Write-Host "      [OK] Launched." -ForegroundColor Green
Write-Host ""

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   OmniMarket Suite is launching in the background!" -ForegroundColor Green
Write-Host "   -----------------------------------------------------" -ForegroundColor Green
Write-Host "   - Angular Frontend:   http://localhost:4200" -ForegroundColor Green
Write-Host "   - Reverse Gateway API: http://localhost:5276" -ForegroundColor Green
Write-Host "   - RabbitMQ Dashboard:  http://localhost:15672" -ForegroundColor Green
Write-Host ""
Write-Host "   * To view live bidding engine logs, run:" -ForegroundColor Cyan
Write-Host "     Get-Content -Wait logs/spring-bidding.log" -ForegroundColor Cyan
Write-Host "   * To view live gateway logs, run:" -ForegroundColor Cyan
Write-Host "     Get-Content -Wait logs/dotnet-gateway.log" -ForegroundColor Cyan
Write-Host "   * To stop all services cleanly, run stop-all.bat" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         Launching KesslerGrid 4-Tier Ecosystem         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Hardhat Node
Write-Host "[1/4] Starting Hardhat EVM Blockchain Node (Port 8545)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\MainBackend\KesslerGrid\contracts`" && npx hardhat node" -WorkingDirectory "$root\MainBackend\KesslerGrid\contracts"

Start-Sleep -Seconds 4

# Deploy Smart Contract
Write-Host "Deploying KesslerGridCore smart contract to local EVM..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/c", "cd /d `"$root\MainBackend\KesslerGrid\contracts`" && npx hardhat run scripts/deploy.cjs --network localhost" -Wait -WorkingDirectory "$root\MainBackend\KesslerGrid\contracts"

# 2. Python AI Analytics
Write-Host "[2/4] Starting Python AI Analytics Engine (Port 8000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\analytics`" && python run.py" -WorkingDirectory "$root\analytics"

Start-Sleep -Seconds 2

# 3. Node.js Backend
Write-Host "[3/4] Starting Node.js Backend & Oracle (Port 5000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root\backend`" && node server.js" -WorkingDirectory "$root\backend"

Start-Sleep -Seconds 2

# 4. Vite Frontend
Write-Host "[4/4] Starting Vite WebGL Frontend Dashboard (Port 5173)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k", "cd /d `"$root`" && npm run dev" -WorkingDirectory "$root"

Write-Host "========================================================" -ForegroundColor Green
Write-Host " All services launched successfully!" -ForegroundColor Green
Write-Host " - Frontend Dashboard : http://localhost:5173" -ForegroundColor Green
Write-Host " - Backend Gateway    : http://localhost:5000" -ForegroundColor Green
Write-Host " - AI Analytics       : http://localhost:8000" -ForegroundColor Green
Write-Host " - Hardhat Local EVM  : http://127.0.0.1:8545" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

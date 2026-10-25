@echo off
title KesslerGrid Launcher
echo ========================================================
echo         Launching KesslerGrid 4-Tier Ecosystem
echo ========================================================

echo [1/4] Starting Hardhat EVM Blockchain Node (Port 8545)...
start "KesslerGrid Blockchain (Hardhat)" cmd /k "cd /d %~dp0MainBackend\KesslerGrid\contracts && npx hardhat node"

echo Waiting for Hardhat node to initialize...
ping 127.0.0.1 -n 5 >nul

echo Deploying KesslerGridCore smart contract to local EVM...
start "KesslerGrid Contract Deployer" /wait cmd /c "cd /d %~dp0MainBackend\KesslerGrid\contracts && npx hardhat run scripts/deploy.cjs --network localhost"

echo [2/4] Starting Python AI Analytics Engine (Port 8000)...
start "KesslerGrid AI Analytics (FastAPI)" cmd /k "cd /d %~dp0analytics && python run.py"

ping 127.0.0.1 -n 3 >nul

echo [3/4] Starting Node.js Backend & Oracle (Port 5000)...
start "KesslerGrid Backend Gateway" cmd /k "cd /d %~dp0backend && node server.js"

ping 127.0.0.1 -n 3 >nul

echo [4/4] Starting Vite WebGL Frontend Dashboard (Port 5173)...
start "KesslerGrid Frontend (Vite)" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================================
echo  All services launched successfully!
echo  - Frontend Dashboard : http://localhost:5173
echo  - Backend Gateway    : http://localhost:5000
echo  - AI Analytics       : http://localhost:8000
echo  - Hardhat Local EVM  : http://127.0.0.1:8545
echo ========================================================

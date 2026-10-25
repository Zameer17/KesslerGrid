import axios from 'axios';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PYTHON_API = 'http://localhost:8000';
const RPC_URL = 'http://127.0.0.1:8545';

async function initWatchdog() {
    console.log("🛡️ AI Conjunction Watchdog Worker Started...");

    // 1. Load Smart Contract ABI & Address
    let abiPath = path.join(__dirname, '../../shared/KesslerGridCore.json');
    if (!fs.existsSync(abiPath)) {
        abiPath = path.join(__dirname, '../shared/KesslerGridCore.json');
    }

    if (!fs.existsSync(abiPath)) {
        console.error("❌ Watchdog Error: Contract ABI not found. Deploy contract first.");
        return;
    }

    const contractData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

    // 2. Set up Ethers provider and wallet signer (using Hardhat's default rich account #0)
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    // Hardhat Account #0 private key (standard local test key)
    const signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

    const contract = new ethers.Contract(contractData.address, contractData.abi, signer);

    // 3. Continuous Monitoring Loop (runs every 10 seconds)
    setInterval(async () => {
        try {
            // Fetch current satellite layout from backend
            const satResponse = await axios.get('http://localhost:5000/api/v1/satellites');
            const satellites = satResponse.data;

            // Send to Python AI Analytics Engine
            const aiResponse = await axios.post(`${PYTHON_API}/api/v1/detect-conjunction`, {
                satellites: satellites
            });

            const alerts = aiResponse.data;

            if (alerts && alerts.length > 0) {
                for (const alert of alerts) {
                    console.log(`🚨 ALERT: Conjunction risk between ${alert.satA} and ${alert.satB} (Risk: ${alert.riskScore * 100}%)`);

                    // If risk score exceeds 80%, trigger automated on-chain penalty/slashing!
                    if (alert.riskScore >= 0.8) {
                        console.log(`⚡ High Risk Detected! Executing automated slash for ${alert.satA}...`);

                        // Calling smart contract penalty function (adjust method name based on your contract schema)
                        const tx = await contract.slashStake(alert.satA, ethers.parseEther("0.01"));
                        await tx.wait();

                        console.log(`✅ Successfully slashed stake for ${alert.satA} on-chain! Tx Hash: ${tx.hash}`);
                    }
                }
            } else {
                console.log("🟢 Orbit status clear. No immediate conjunction threats.");
            }

        } catch (error) {
            console.error("⚠️ Watchdog loop error:", error.message);
        }
    }, 10000); // Check every 10 seconds
}

initWatchdog();
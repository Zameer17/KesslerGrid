import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'kessler.db');
const contractJsonPath = path.resolve(__dirname, '../shared/KesslerGridCore.json');
const LOCAL_RPC_URL = 'http://127.0.0.1:8545';
const ADMIN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export async function runWatchdogCycle() {
  if (!fs.existsSync(contractJsonPath)) {
    console.warn('[Watchdog Warning] Contract deployment file not found at:', contractJsonPath);
    return;
  }

  const contractData = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
  const contractAddress = contractData.address;
  const contractAbi = contractData.abi;

  if (!contractAddress) {
    console.warn('[Watchdog Warning] No contract address in KesslerGridCore.json');
    return;
  }

  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  const adminSigner = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(contractAddress, contractAbi, adminSigner);

  const db = new sqlite3.Database(dbPath);

  db.all(
    `SELECT id, sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km, collision_prob
     FROM conjunction_events
     WHERE threat_level = 'CRITICAL' AND slashing_triggered = 0`,
    [],
    async (err, rows) => {
      if (err) {
        console.error('[Watchdog Error] Query failed:', err.message);
        db.close();
        return;
      }

      if (!rows || rows.length === 0) {
        db.close();
        return;
      }

      console.log(`[Watchdog] Found ${rows.length} un-slashed CRITICAL conjunction threat(s)`);

      for (const row of rows) {
        const { id, sat1_id, sat1_name, sat2_id, sat2_name, miss_distance_km, collision_prob } = row;
        console.log(`[Watchdog Slashing] Executing on-chain parametric slashing for ${sat1_name} (${sat1_id}) <-> ${sat2_name} (${sat2_id})`);

        try {
          const reason = `CRITICAL CONJUNCTION THREAT: Miss distance ${miss_distance_km}km, Prob ${collision_prob}`;
          
          // Check if sat1_id is registered on-chain before attempting slash
          let isReg = false;
          try {
            const satObj = await contract.satellites(sat1_id);
            isReg = satObj.isRegistered;
          } catch (e) {}

          let txHash = 'N/A (Simulated Slashing)';
          if (isReg) {
            const tx = await contract.slash(sat1_id, reason, { gasLimit: 300000 });
            const receipt = await tx.wait();
            txHash = receipt.hash;
            console.log(`✅ [Watchdog On-Chain Slashing Confirmed] Sat: ${sat1_id} | Tx: ${txHash}`);
          } else {
            console.log(`ℹ️ [Watchdog Notice] Satellite ${sat1_id} not registered on-chain yet. Marking event as processed.`);
          }

          // Mark slashing_triggered = 1 in database
          db.run(
            `UPDATE conjunction_events SET slashing_triggered = 1 WHERE id = ?`,
            [id],
            (updateErr) => {
              if (updateErr) {
                console.error(`[Watchdog DB Error] Failed to update slashing_triggered for event ID ${id}:`, updateErr.message);
              } else {
                console.log(`✅ [Watchdog DB Updated] Event ID ${id} set slashing_triggered = 1`);
              }
            }
          );
        } catch (slashErr) {
          console.error(`⚠️ [Watchdog Slashing Error] Failed for sat ${sat1_id}:`, slashErr.reason || slashErr.message);
        }
      }

      db.close();
    }
  );
}

export function startWatchdog(intervalMs = 60000) {
  console.log(`🛡️ [Autonomous Watchdog Service] Started (running every ${intervalMs / 1000}s)`);
  runWatchdogCycle();
  setInterval(() => {
    runWatchdogCycle();
  }, intervalMs);
}

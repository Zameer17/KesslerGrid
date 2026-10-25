import cron from 'node-cron';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbSqlite } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
// Hardhat Account #0 private key
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export function startConjunctionWatchdog() {
  console.log('🛡️ Autonomous Web3 Slashing Watchdog Service Started (60s cron cycle)...');

  // Load smart contract address and ABI
  let contractPath = path.join(__dirname, '../../shared/KesslerGridCore.json');
  if (!fs.existsSync(contractPath)) {
    contractPath = path.join(__dirname, '../../../shared/KesslerGridCore.json');
  }

  // Run watchdog every 60 seconds
  cron.schedule('*/60 * * * * *', async () => {
    try {
      if (!fs.existsSync(contractPath)) {
        console.warn('⚠️ Watchdog Warning: Shared KesslerGridCore.json not found. Deploy contract first.');
        return;
      }

      const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(contractData.address, contractData.abi, signer);

      // Query un-evaded critical threats from conjunction_events
      const criticalEvents = dbSqlite.prepare(`
        SELECT * FROM conjunction_events 
        WHERE (risk_level = 'CRITICAL' OR collision_probability > 0.8 OR risk_score > 0.8) 
        AND (slashing_triggered = 0 OR slashing_triggered IS NULL)
      `).all();

      if (criticalEvents.length === 0) {
        return;
      }

      console.log(`🚨 Watchdog Sentinel: Found ${criticalEvents.length} pending critical conjunction threats.`);

      for (const event of criticalEvents) {
        const satIdRaw = event.primary_sat_id || event.sat_a || 'UNKNOWN_SAT';
        const satId = satIdRaw.split(' ')[0]; // Extract base satellite ID name

        console.log(`⚡ Executing Parametric Slashing for offending satellite: ${satId} (Event #${event.id})...`);

        try {
          // Execute on-chain slash penalty
          const tx = await contract.slash(satId, `Parametric Slashing: Critical Conjunction Risk > 80% (Event #${event.id})`, { gasLimit: 300000 });
          await tx.wait();

          console.log(`✅ On-chain Slash Confirmed for ${satId}! Tx Hash: ${tx.hash}`);

          // Update database: set slashing_triggered = 1
          dbSqlite.prepare(`
            UPDATE conjunction_events 
            SET slashing_triggered = 1 
            WHERE id = ?
          `).run(event.id);

          console.log(`💾 Database updated: Set slashing_triggered = TRUE for Event #${event.id}`);
        } catch (slashErr) {
          console.warn(`⚠️ Slash execution skipped for ${satId}:`, slashErr.reason || slashErr.message);
          // Mark as processed in DB to prevent infinite retry loops if sat was not registered on-chain
          dbSqlite.prepare(`
            UPDATE conjunction_events 
            SET slashing_triggered = 1 
            WHERE id = ?
          `).run(event.id);
        }
      }
    } catch (err) {
      console.error('❌ Watchdog Cycle Error:', err.message);
    }
  });
}
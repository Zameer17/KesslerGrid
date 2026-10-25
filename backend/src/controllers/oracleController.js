import { ethers } from 'ethers';
import { query } from '../config/db.js';
import { kesslerContract } from '../config/web3.js';
import { writeAuditLog } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export const executeSlashingPenalty = async (req, res) => {
    try {
        const { offenderSatId, victimAddress, penaltyEth, reportUri } = req.body;

        if (!offenderSatId || !victimAddress || !penaltyEth) {
            return res.status(400).json({ error: 'Missing penalty transaction parameters' });
        }

        const penaltyWei = ethers.parseEther(penaltyEth.toString());
        const incidentUri = reportUri || `https://kesslergrid.io/reports/${Date.now()}`;

        writeAuditLog('CRITICAL', 'ORACLE_DISPATCHER', `Initiating on-chain slashing for ${offenderSatId}. Penalty: ${penaltyEth} ETH to ${victimAddress}`);

        let txHash = '0x_simulated_oracle_tx';
        if (kesslerContract.target) {
            const tx = await kesslerContract.executeSlashing(offenderSatId, victimAddress, penaltyWei, incidentUri);
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }

        // Update database status
        await query(
            "UPDATE satellites SET operational_status = 'PENALIZED' WHERE sat_id = $1",
            [offenderSatId]
        );

        writeAuditLog('SUCCESS', 'ORACLE_DISPATCHER', `Slashing confirmed on-chain for ${offenderSatId} | Tx: ${txHash}`);

        return res.status(200).json({
            success: true,
            offenderSatId,
            victimAddress,
            penaltyEth,
            txHash
        });
    } catch (error) {
        writeAuditLog('CRITICAL', 'ORACLE_DISPATCHER', `Slashing failed for ${req.body?.offenderSatId}: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
};

export const getAuditLogs = async (req, res) => {
    try {
        const logPath = path.join(process.cwd(), 'logs', 'watchdog_audit.txt');
        if (!fs.existsSync(logPath)) {
            return res.status(200).json({ success: true, logs: [] });
        }

        const fileContent = fs.readFileSync(logPath, 'utf8');
        const lines = fileContent.trim().split('\n').filter(Boolean).slice(-100);

        return res.status(200).json({ success: true, lineCount: lines.length, logs: lines });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
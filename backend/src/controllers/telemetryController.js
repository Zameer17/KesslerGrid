import { query } from '../config/db.js';
import { buildTelemetryMerkleTree } from '../services/merkleService.js';
import { kesslerContract } from '../config/web3.js';
import { writeAuditLog } from '../utils/logger.js';

export const ingestTelemetry = async (req, res) => {
    try {
        const { satId, timestamp, pos, vel } = req.body;

        if (!satId || !pos || !vel) {
            return res.status(400).json({ error: 'Invalid telemetry payload structure' });
        }

        const epochTime = timestamp || Date.now();

        const sql = `
            INSERT INTO telemetry_logs (sat_id, epoch_timestamp, pos_x, pos_y, pos_z, vel_x, vel_y, vel_z)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        const values = [satId, epochTime, pos.x, pos.y, pos.z, vel.vx, vel.vy, vel.vz];
        const result = await query(sql, values);

        return res.status(200).json({
            success: true,
            telemetryId: result.rows[0].id,
            satId,
            timestamp: epochTime
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const getLatestTelemetry = async (req, res) => {
    try {
        const { satId } = req.params;
        const sql = `
            SELECT * FROM telemetry_logs 
            WHERE sat_id = $1 
            ORDER BY epoch_timestamp DESC 
            LIMIT 1;
        `;
        const result = await query(sql, [satId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: `No telemetry found for ${satId}` });
        }

        return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const anchorBatchOnChain = async (req, res) => {
    try {
        const { satId } = req.body;

        const unanchored = await query(
            'SELECT * FROM telemetry_logs WHERE sat_id = $1 AND is_anchored = FALSE ORDER BY epoch_timestamp ASC LIMIT 100',
            [satId]
        );

        if (unanchored.rowCount === 0) {
            return res.status(400).json({ message: 'No unanchored records available for this satellite' });
        }

        const { merkleRoot } = buildTelemetryMerkleTree(unanchored.rows);

        // Call smart contract to store Merkle Root
        let txHash = '0x_simulated_contract_not_configured';
        if (kesslerContract.target) {
            const tx = await kesslerContract.anchorTelemetryRoot(satId, merkleRoot);
            const receipt = await tx.wait();
            txHash = receipt.hash;
        }

        // Mark records as anchored in SQL
        const rowIds = unanchored.rows.map(r => r.id);
        await query(
            'UPDATE telemetry_logs SET is_anchored = TRUE, merkle_root_hash = $1 WHERE id = ANY($2::bigint[])',
            [merkleRoot, rowIds]
        );

        writeAuditLog('SUCCESS', 'ANCHOR_SENTINEL', `Anchored ${rowIds.length} records for ${satId}. Root: ${merkleRoot} | Tx: ${txHash}`);

        return res.status(200).json({
            success: true,
            satId,
            recordsAnchored: rowIds.length,
            merkleRoot,
            txHash
        });
    } catch (error) {
        console.error('Anchoring Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
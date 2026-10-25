import { query } from '../config/db.js';
import { kesslerContract } from '../config/web3.js';
import { writeAuditLog } from '../utils/logger.js';

export const registerSatellite = async (req, res) => {
    try {
        const { satId, noradId, satelliteName, operatorAddress, stakedEth } = req.body;

        if (!satId || !noradId || !satelliteName || !operatorAddress) {
            return res.status(400).json({ error: 'Missing required satellite fields' });
        }

        const sql = `
            INSERT INTO satellites (sat_id, operator_address, norad_cat_id, satellite_name, staked_amount_eth, operational_status)
            VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
            RETURNING *;
        `;
        const values = [satId, operatorAddress.toLowerCase(), noradId, satelliteName, stakedEth || 0.0];
        const result = await query(sql, values);

        writeAuditLog('INFO', 'REGISTRY', `Satellite ${satId} (NORAD: ${noradId}) registered by ${operatorAddress}`);

        return res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Satellite ID or NORAD ID already exists' });
        }
        console.error('Registration Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

export const getAllSatellites = async (req, res) => {
    try {
        const result = await query('SELECT * FROM satellites ORDER BY registered_at DESC');
        return res.status(200).json({ success: true, count: result.rowCount, data: result.rows });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const getSatelliteById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM satellites WHERE sat_id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Satellite not found' });
        }

        let onChainData = null;
        try {
            if (kesslerContract.target) {
                const onChainSat = await kesslerContract.getSatellite(id);
                onChainData = {
                    stakedAmountWei: onChainSat.stakedAmount.toString(),
                    status: Number(onChainSat.status),
                    registeredAt: Number(onChainSat.registeredAt)
                };
            }
        } catch (chainErr) {
            console.warn(`Could not fetch on-chain data for ${id}:`, chainErr.message);
        }

        return res.status(200).json({
            success: true,
            database: result.rows[0],
            onChain: onChainData
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};